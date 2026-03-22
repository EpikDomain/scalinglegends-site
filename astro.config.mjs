import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://scalinglegends.com',
  trailingSlash: 'always',
  integrations: [sitemap()],
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
