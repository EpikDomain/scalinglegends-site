#!/usr/bin/env node
// Validates src/data/seo-overrides.json against the articles and public/_redirects.
// Usage: node scripts/check-seo-overrides.mjs [distDir]
// With a dist directory it also checks the built output (no page for 301s,
// robots noindex on pruned pages, pruned URLs absent from the sitemap).
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/seo-overrides.json'), 'utf8'));
const slugs = new Set(fs.readdirSync(path.join(root, 'src/content/articles')).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)));
const redirectsFile = fs.readFileSync(path.join(root, 'public/_redirects'), 'utf8');
const errors = [];

for (const [from, { to }] of Object.entries(data.redirects)) {
  if (!slugs.has(to)) errors.push(`redirect target missing: ${from} -> ${to}`);
  if (data.redirects[to]) errors.push(`redirect chain: ${from} -> ${to} -> ${data.redirects[to].to}`);
  if (data.noindex[to]) errors.push(`redirect target is noindexed: ${to}`);
  for (const src of [`/article/${from}/`, `/article/${from}`]) {
    if (!redirectsFile.split('\n').some(l => l.trim() === `${src} /article/${to}/ 301`)) errors.push(`public/_redirects missing: ${src} /article/${to}/ 301`);
  }
}
for (const id of Object.keys(data.noindex)) {
  if (!slugs.has(id) && !data.redirects[id]) errors.push(`noindex entry has no article: ${id}`);
  if (data.redirects[id]) errors.push(`both noindex and redirect: ${id}`);
}
for (const id of Object.keys(data.pages)) if (!slugs.has(id)) errors.push(`page override has no article: ${id}`);

const dist = process.argv[2];
if (dist) {
  const sitemap = fs.readdirSync(dist).filter(f => /^sitemap-\d+\.xml$/.test(f)).map(f => fs.readFileSync(path.join(dist, f), 'utf8')).join('');
  const images = fs.existsSync(path.join(dist, 'sitemap-images.xml')) ? fs.readFileSync(path.join(dist, 'sitemap-images.xml'), 'utf8') : '';
  for (const from of Object.keys(data.redirects)) {
    if (fs.existsSync(path.join(dist, 'article', from, 'index.html'))) errors.push(`built page for redirected article: ${from}`);
    if (sitemap.includes(`/article/${from}/<`) || images.includes(`/article/${from}/<`)) errors.push(`redirected article in sitemap: ${from}`);
  }
  for (const id of Object.keys(data.noindex)) {
    const file = path.join(dist, 'article', id, 'index.html');
    if (!fs.existsSync(file)) { errors.push(`noindexed page not built: ${id}`); continue; }
    if (!/<meta name="robots" content="noindex, follow"/.test(fs.readFileSync(file, 'utf8'))) errors.push(`missing noindex meta: ${id}`);
    if (sitemap.includes(`/article/${id}/<`) || images.includes(`/article/${id}/<`)) errors.push(`noindexed article in sitemap: ${id}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`seo-overrides OK: ${Object.keys(data.redirects).length} redirects, ${Object.keys(data.noindex).length} noindex, ${Object.keys(data.pages).length} page overrides${dist ? ` (checked ${dist})` : ''}`);
