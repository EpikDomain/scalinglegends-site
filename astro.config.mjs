import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://scalinglegends.com',
  integrations: [sitemap()],
  output: 'static',
  adapter: vercel({
    webAnalytics: { enabled: true }
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
