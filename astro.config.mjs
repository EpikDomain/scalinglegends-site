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
    const dateMatch = text.match(/^updatedAt:\s*"?(\d{4}-\d{2}-\d{2})"?/m) || text.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
    if (dateMatch) {
      articleDates[file.replace('.md', '')] = dateMatch[1];
    }
  }
} catch {}

export default defineConfig({
  site: 'https://scalinglegends.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      customSitemaps: ['https://scalinglegends.com/sitemap-images.xml'],
      serialize(item) {
        const match = item.url.match(/\/article\/([^/]+)\/?$/);
        if (match && articleDates[match[1]]) {
          const slug = match[1];
          const d = new Date(articleDates[slug] + 'T00:00:00Z');
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
