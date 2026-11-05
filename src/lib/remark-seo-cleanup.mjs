// Render-time cleanup of generated article markdown.
// The markdown is regenerated from Supabase, so these fixes are applied while
// rendering instead of by editing the files:
//  - internal links to redirected articles point at the consolidated page;
//  - internal links to articles that do not exist (live 404s) become plain text;
//  - auto-inserted internal links inside headings and FAQ sections become plain text;
//  - repeated links to the same article keep only the first one, and self-links are removed;
//  - Smart Business Automator links get UTM attribution;
//  - a body H1 that repeats the page title is removed, any other body H1 becomes an H2
//    (the page template already renders the only H1);
//  - optional per-page heading text replacements from seo-overrides.json.
import fs from 'node:fs';
import path from 'node:path';
import { REDIRECTS, SITE, SBA_HOST, pageOverride, sbaUrl } from './seo.mjs';

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles');

function existingSlugs() {
  try {
    return new Set(fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)));
  } catch {
    return null; // Unknown: never unlink because of a missing directory.
  }
}

const textOf = node => node.type === 'text' || node.type === 'inlineCode'
  ? node.value
  : (node.children ?? []).map(textOf).join('');
// remark-smartypants runs first, so compare headings with straight quotes.
const straightQuotes = s => String(s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function articleSlug(url) {
  if (typeof url !== 'string') return null;
  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      if (u.hostname.replace(/^www\./, '') !== new URL(SITE).hostname) return null;
      pathname = u.pathname;
    } catch { return null; }
  }
  const m = pathname.match(/^\/article\/([^/?#\s]+)\/?(?:[?#].*)?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function remarkSeoCleanup() {
  const slugs = existingSlugs();
  return (tree, file) => {
    const filePath = file?.path || file?.history?.[0] || '';
    const slug = path.basename(String(filePath), '.md');
    const override = pageOverride(slug);
    const pageTitle = override.title || file?.data?.astro?.frontmatter?.title || '';
    const headingMap = override.headings ?? {};
    const seen = new Set();

    function walk(node, ctx) {
      if (!node.children) return;
      const out = [];
      for (const child of node.children) {
        if (child.type === 'link') {
          const target = articleSlug(child.url);
          if (target !== null) {
            const resolved = REDIRECTS[target] ?? target;
            const missing = slugs !== null && !slugs.has(resolved);
            if (missing || ctx.inHeading || ctx.inFaq || resolved === slug || seen.has(resolved)) {
              walk(child, ctx);
              out.push(...child.children); // keep the anchor text, drop the link
              continue;
            }
            seen.add(resolved);
            if (resolved !== target) child.url = `/article/${resolved}/`;
          } else if (/smartbusinessautomator\.com/i.test(child.url ?? '')) {
            try {
              if (new URL(child.url).hostname.replace(/^www\./, '') === SBA_HOST) child.url = sbaUrl(child.url, slug, 'article-body');
            } catch { /* leave malformed URLs untouched */ }
          }
        }
        walk(child, { ...ctx, inHeading: ctx.inHeading || child.type === 'heading' });
        out.push(child);
      }
      node.children = out;
    }

    const top = [];
    let inFaq = false;
    for (const node of tree.children) {
      if (node.type === 'heading') {
        const text = textOf(node).trim();
        const key = Object.keys(headingMap).find(k => straightQuotes(k) === straightQuotes(text));
        if (key) node.children = [{ type: 'text', value: headingMap[key] }];
        if (node.depth === 1) {
          const t = norm(text);
          if (t && norm(pageTitle).includes(t)) continue; // duplicate of the page H1
          node.depth = 2;
        }
        if (node.depth <= 2) inFaq = /frequently asked|\bfaqs?\b/i.test(text);
      }
      top.push(node);
    }
    tree.children = top;
    // Walk top-level nodes individually so FAQ context follows section boundaries.
    inFaq = false;
    for (const node of tree.children) {
      if (node.type === 'heading' && node.depth <= 2) inFaq = /frequently asked|\bfaqs?\b/i.test(textOf(node));
      walk({ children: [node] }, { inHeading: false, inFaq });
    }
  };
}
