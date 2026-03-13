#!/usr/bin/env node
// Pull all articles from Supabase + match RSS.com audio URLs → write Astro markdown files

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://yzlcegvoqenqjxbdmxns.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bGNlZ3ZvcWVucWp4YmRteG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1ODI5ODEsImV4cCI6MjA4ODE1ODk4MX0.Zz4hmSen0ksyVuHrmANHWdfphS7JBT5tvAXuJm06InM';
const RSS_FEED = 'https://media.rss.com/scalinglegends/feed.xml';
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'content', 'articles');

// Fetch live RSS feed and build title → audio URL mapping (no more stale hardcoded list)
let rssEpisodes = [];

async function loadRSSFeed() {
  try {
    const resp = await fetch(RSS_FEED);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();
    // Parse <item> blocks from RSS XML
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    for (const item of items) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const encMatch = item.match(/<enclosure[^>]+url="([^"]+)"/);
      const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : '';
      const audio = encMatch ? encMatch[1] : '';
      if (title && audio) {
        rssEpisodes.push({ title, audio });
      }
    }
    console.log(`Loaded ${rssEpisodes.length} episodes from RSS feed`);
  } catch (e) {
    console.error(`WARNING: Could not fetch RSS feed: ${e.message}`);
    console.error('Articles will be generated without audio URLs.');
  }
}

function matchAudio(articleTitle) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nt = norm(articleTitle);
  // Exact normalized match
  for (const ep of rssEpisodes) {
    if (norm(ep.title) === nt) return ep.audio;
  }
  // Substring containment
  for (const ep of rssEpisodes) {
    if (nt.includes(norm(ep.title)) || norm(ep.title).includes(nt.slice(0, 30))) {
      return ep.audio;
    }
  }
  // Fuzzy: check if first 4 significant words match
  const words = articleTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 4);
  for (const ep of rssEpisodes) {
    const epLower = ep.title.toLowerCase();
    if (words.length >= 3 && words.filter(w => epLower.includes(w)).length >= 3) {
      return ep.audio;
    }
  }
  return '';
}

// Auto-assign content pillar based on slug and title
function assignPillar(slug, title) {
  const s = (slug + ' ' + title).toLowerCase();
  // Market Intelligence
  if (/market.intelligence|daily.intelligence|intel.report|backlog.rebound|k-shaped|two-tier|haves.vs.have/.test(s)) return 'market-intelligence';
  // Technology
  if (/\bai\b|autonomous|software|3d.print|icon.titan|conexpo|estimat|bim|drone|cyber|seo|cloud.construction|tech.mistake|workflow.automation|contractor.seo/.test(s)) return 'technology';
  // Workforce & Safety
  if (/osha|worker.gap|workforce|labor.shortage|safety|blackrock|man.camp|immigration|women.in.construction|hire|retain|apprentice|training|crew/.test(s)) return 'workforce';
  // Policy & Regulation
  if (/tariff|supreme.court|doge|construction.law|iija|housing.act|license|lien|diesel|fuel|rent.or.own|war.oil|theft|bankrupt|eu.regulated|regulation|compliance|permit|bond|insurance/.test(s)) return 'policy';
  // Business Growth (default for scaling/operations/management content)
  if (/scale|growth|cash.flow|m&a|merger|acqui|operational|secret|contractor.wish|messy.middle|start.*business|bid|price|overhead|profit|estimate|proposal/.test(s)) return 'business-growth';
  return 'business-growth'; // Default
}

// Convert HTML to markdown (simplified but handles our content)
function htmlToMarkdown(html) {
  if (!html) return '';
  let md = html;
  // Remove script blocks (JSON-LD structured data etc) entirely including content
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove the audio player block at the top (it's in our layout now)
  md = md.replace(/<div[^>]*style="background: #1a1a2e[^"]*"[^>]*>[\s\S]*?<\/div>\s*/i, '');
  // Remove sponsored-by blocks (they're in our layout)
  md = md.replace(/<div[^>]*style="background:\s*(?:linear-gradient|#1a1a2e|#161616)[^"]*"[^>]*>[\s\S]*?<\/div>\s*/gi, '');
  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  // Bold and italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  // Links - convert scalinglegends.com links to relative
  md = md.replace(/<a[^>]*href="https?:\/\/scalinglegends\.com\/article\/([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2](/article/$1)');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  // Tables - convert to markdown tables before stripping tags
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, tableContent) => {
    const rows = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const cells = [];
      const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return '';
    const colCount = Math.max(...rows.map(r => r.length));
    let table = '\n| ' + rows[0].map(c => c).join(' | ') + ' |\n';
    table += '| ' + Array(colCount).fill('---').join(' | ') + ' |\n';
    for (let i = 1; i < rows.length; i++) {
      table += '| ' + rows[i].join(' | ') + ' |\n';
    }
    return table + '\n';
  });
  // Lists
  md = md.replace(/<ul[^>]*>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  // Paragraphs and breaks
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  // Blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n');
  // Preserve YouTube embeds as raw HTML before stripping tags
  const ytEmbeds = [];
  md = md.replace(/<div[^>]*>[\s\S]*?<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/([^"]+)"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi, (match, videoId) => {
    const placeholder = `%%YTEMBED_${ytEmbeds.length}%%`;
    ytEmbeds.push(`<iframe src="https://www.youtube.com/embed/${videoId}" style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px;margin:24px 0;" allowfullscreen loading="lazy"></iframe>`);
    return placeholder;
  });
  // Also catch standalone iframes
  md = md.replace(/<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/([^"]+)"[^>]*><\/iframe>/gi, (match, videoId) => {
    const placeholder = `%%YTEMBED_${ytEmbeds.length}%%`;
    ytEmbeds.push(`<iframe src="https://www.youtube.com/embed/${videoId}" style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px;margin:24px 0;" allowfullscreen loading="lazy"></iframe>`);
    return placeholder;
  });
  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  // Restore YouTube embeds
  for (let i = 0; i < ytEmbeds.length; i++) {
    md = md.replace(`%%YTEMBED_${i}%%`, `\n\n${ytEmbeds[i]}\n\n`);
  }
  // Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&bull;/g, '•');
  md = md.replace(/&mdash;/g, '--');
  md = md.replace(/&ndash;/g, '-');
  md = md.replace(/&nbsp;/g, ' ');
  // Remove any remaining JSON-LD structured data that leaked through
  md = md.replace(/\{"@context"[\s\S]*?"@type"[\s\S]*?\}\s*/g, '');
  // Remove "SPONSORED BY" blocks and sponsor sections
  md = md.replace(/\n\s*SPONSORED BY[\s\S]*?(?=\n##|\n\n[A-Z]|\n$)/gi, '');
  // Remove "Listen on:" lines with platform links
  md = md.replace(/\n\s*Listen on:[\s\S]*?(?=\n\n)/gi, '');
  // Remove "Episode sponsored by" / "Presented by" blocks
  md = md.replace(/\n\s*(?:Episode )?(?:sponsored|presented) by[\s\S]*?(?=\n##|\n\n[A-Z]|\n$)/gi, '');
  // Fix indented list items (2-4 space indent causes rendering issues in markdown)
  md = md.replace(/^ {2,4}(- )/gm, '$1');
  // Fix indented bold/link lines
  md = md.replace(/^ {2,4}(\*\*|\[)/gm, '$1');
  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();
  // Remove the H1 title if it matches (it's in frontmatter)
  md = md.replace(/^# .+\n\n/, '');
  return md;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Load live RSS feed for audio URL matching
  await loadRSSFeed();

  // Fetch all articles from Supabase
  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=*&order=created_at.desc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  const articles = await res.json();

  if (!Array.isArray(articles)) {
    console.error('Error fetching articles:', articles);
    process.exit(1);
  }

  console.log(`Fetched ${articles.length} articles from Supabase`);

  let episodeCount = 0;
  let articleCount = 0;

  for (const a of articles) {
    const audioUrl = matchAudio(a.title);
    const content = htmlToMarkdown(a.content);
    const date = a.created_at ? a.created_at.split('T')[0] : '2026-03-05';
    let imageUrl = a.image_url || '/scaling-legends-cover.jpg';
    // Fix broken scalinglegends.com image URLs to local path
    if (imageUrl.includes('scalinglegends.com/scaling-legends-cover')) {
      imageUrl = '/scaling-legends-cover.jpg';
    }

    // Build frontmatter
    const fm = [
      '---',
      `title: ${JSON.stringify(a.title)}`,
      `description: ${JSON.stringify(a.description || '')}`,
      `date: "${date}"`,
      `image: "${imageUrl}"`,
    ];

    if (audioUrl) {
      fm.push(`audioUrl: "${audioUrl}"`);
      episodeCount++;
    } else {
      articleCount++;
    }

    if (a.read_time) fm.push(`readTime: "${a.read_time}"`);
    fm.push(`published: true`);
    fm.push(`season: 2`);

    // SEO keywords from Supabase (stored as JSON string or array)
    let keywords = a.keywords;
    if (typeof keywords === 'string') {
      try { keywords = JSON.parse(keywords); } catch {}
    }
    if (Array.isArray(keywords) && keywords.length > 0) {
      fm.push('keywords:');
      for (const kw of keywords.slice(0, 5)) {
        fm.push(`  - "${kw}"`);
      }
    }

    // Auto-assign pillar based on slug/title keywords
    const pillar = assignPillar(a.slug, a.title);
    if (pillar) fm.push(`pillar: "${pillar}"`);

    fm.push('sponsors:');
    fm.push('  - name: "Smart Business Automator"');
    fm.push('    url: "https://smartbusinessautomator.com"');
    fm.push('    description: "The operations platform helping contractors systematize their businesses so they can scale without the chaos."');

    fm.push('---');

    const fileContent = fm.join('\n') + '\n\n' + content + '\n';
    const filePath = join(OUT_DIR, `${a.slug}.md`);
    writeFileSync(filePath, fileContent);
    console.log(`  ${audioUrl ? '🎧' : '📝'} ${a.slug}`);
  }

  console.log(`\nDone! ${episodeCount} episodes, ${articleCount} articles`);
}

main().catch(console.error);
