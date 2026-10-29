import { getCollection } from 'astro:content';
import { editorialImage } from '../lib/editorial-images';
export const prerender = true;
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export async function GET() {
  const site = 'https://scalinglegends.com';
  const articles = await getCollection('articles', ({ data }) => data.published !== false && !data.noindex && new Date(data.date) <= new Date());
  const entries = [
    ...articles.map(a => ({ path: `/article/${a.id}/`, title: a.data.title, section: a.data.pillar || '' })),
    ...['market-intelligence', 'business-growth', 'technology', 'workforce', 'policy'].map(p => ({ path: `/pillar/${p}/`, title: p, section: p })),
  ];
  const body = entries.map(p => `<url><loc>${site}${escape(p.path)}</loc><image:image><image:loc>${site}${escape(editorialImage(p.title, p.section).src)}</image:loc></image:image></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${body}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
