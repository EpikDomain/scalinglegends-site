import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import remarkSeoCleanup from './src/lib/remark-seo-cleanup.mjs';
import { isNoindex, isRedirected } from './src/lib/seo.mjs';

// Pre-load article dates for sitemap lastmod
const articleDates = {};
// Articles kept out of the sitemap: noindex (frontmatter or src/data/seo-overrides.json) and 301s.
const excludedArticles = new Set();
const articlesDir = path.join(process.cwd(), 'src/content/articles');
try {
  for (const file of fs.readdirSync(articlesDir)) {
    if (!file.endsWith('.md')) continue;
    const text = fs.readFileSync(path.join(articlesDir, file), 'utf-8');
    const dateMatch = text.match(/^updatedAt:\s*"?(\d{4}-\d{2}-\d{2})"?/m) || text.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
    const slug = file.replace('.md', '');
    if (dateMatch) {
      articleDates[slug] = dateMatch[1];
    }
    if (isRedirected(slug) || isNoindex(slug, { noindex: /^noindex:\s*true\s*$/m.test(text.split(/^---$/m)[1] ?? '') })) {
      excludedArticles.add(slug);
    }
  }
} catch {}

export default defineConfig({
  site: 'https://scalinglegends.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      customSitemaps: ['https://scalinglegends.com/sitemap-images.xml'],
      filter(page) {
        const match = page.match(/\/article\/([^/]+)\/?$/);
        return !(match && excludedArticles.has(match[1]));
      },
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
  markdown: {
    remarkPlugins: [remarkSeoCleanup],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
