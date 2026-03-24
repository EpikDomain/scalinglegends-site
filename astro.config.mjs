import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

// Pre-load article dates for sitemap lastmod
const articleDates = {};
const articlesDir = path.join(process.cwd(), 'src/content/articles');
try {
  for (const file of fs.readdirSync(articlesDir)) {
    if (!file.endsWith('.md')) continue;
    const text = fs.readFileSync(path.join(articlesDir, file), 'utf-8');
    const dateMatch = text.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
    if (dateMatch) {
      articleDates[file.replace('.md', '')] = dateMatch[1];
    }
  }
} catch {}

// Derive a stable hour/minute offset from slug so each article gets a unique
// but deterministic publish time (looks like natural editorial cadence)
function slugToTime(slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  const h = 6 + Math.abs(hash % 14);        // 06:00 - 19:59
  const m = Math.abs((hash >> 8) % 60);      // 00 - 59
  return { h, m };
}

export default defineConfig({
  site: 'https://scalinglegends.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      serialize(item) {
        const match = item.url.match(/\/article\/([^/]+)\/?$/);
        if (match && articleDates[match[1]]) {
          const slug = match[1];
          const { h, m } = slugToTime(slug);
          const d = new Date(articleDates[slug] + `T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);
          item.lastmod = d.toISOString();
          item.changefreq = 'weekly';
          item.priority = 0.8;
        } else if (item.url.includes('/pillar/')) {
          item.changefreq = 'daily';
          item.priority = 0.9;
        } else if (item.url.endsWith('.com/')) {
          item.changefreq = 'daily';
          item.priority = 1.0;
        }
        return item;
      },
    }),
  ],
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
