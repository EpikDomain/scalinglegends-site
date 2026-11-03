// Build-time SEO rules shared by astro.config.mjs (sitemap + remark plugin) and pages.
// The data lives in src/data/seo-overrides.json so that it survives the Supabase
// article pull, which rewrites every markdown file.
import overrides from '../data/seo-overrides.json' with { type: 'json' };

export const SITE = 'https://scalinglegends.com';
export const SBA_HOST = 'smartbusinessautomator.com';

export const REDIRECTS = Object.fromEntries(Object.entries(overrides.redirects).map(([from, r]) => [from, r.to]));
export const NOINDEX = new Set(Object.keys(overrides.noindex));
export const PAGE_OVERRIDES = overrides.pages;

/** A redirected article is not built; its URL 301s to the consolidated page. */
export const isRedirected = id => Object.hasOwn(REDIRECTS, id);

/** Noindex from the overrides file or from article frontmatter. */
export const isNoindex = (id, data = {}) => NOINDEX.has(id) || data.noindex === true;

export const pageOverride = id => PAGE_OVERRIDES[id] ?? {};

/** Article collection filter used by every listing: published, not future-dated, not redirected. */
export const isLiveArticle = entry =>
  entry.data.published !== false && new Date(entry.data.date) <= new Date() && !isRedirected(entry.id);

/**
 * Smart Business Automator link with attribution. Existing query parameters
 * (e.g. ?source=scaling-legends) are kept; utm_* values already present win.
 */
export function sbaUrl(href, campaign, content) {
  const url = new URL(href, `https://${SBA_HOST}`);
  if (url.hostname.replace(/^www\./, '') !== SBA_HOST) return href;
  if (!url.searchParams.has('utm_source')) {
    url.searchParams.set('utm_source', 'scalinglegends');
    url.searchParams.set('utm_medium', 'referral');
    url.searchParams.set('utm_campaign', campaign || 'site');
    if (content) url.searchParams.set('utm_content', content);
  }
  return url.href;
}

/** Entry with override title/description, for listings (never pass the copy to render()). */
export function withOverrides(entry) {
  const o = pageOverride(entry.id);
  if (!o.title && !o.description) return entry;
  return { ...entry, data: { ...entry.data, title: o.title || entry.data.title, description: o.description || entry.data.description } };
}

/** Live articles (see isLiveArticle) with optional extra filter, overrides applied. */
export async function getLiveArticles(getCollection, extra = () => true) {
  const entries = await getCollection('articles', entry => isLiveArticle(entry) && extra(entry));
  return entries.map(withOverrides);
}
