#!/usr/bin/env node
// Pull all articles from Supabase + match RSS.com audio URLs → write Astro markdown files

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://yzlcegvoqenqjxbdmxns.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bGNlZ3ZvcWVucWp4YmRteG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1ODI5ODEsImV4cCI6MjA4ODE1ODk4MX0.Zz4hmSen0ksyVuHrmANHWdfphS7JBT5tvAXuJm06InM';
const RSS_FEED = 'https://media.rss.com/scalinglegends/feed.xml';
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'content', 'articles');

// RSS.com episode title → audio URL mapping
const rssEpisodes = [
  { title: "Contractor Marketing and SEO in 2026", audio: "https://content.rss.com/episodes/332597/2608724/scalinglegends/2026_03_07_18_22_00_b259ba4d-04d2-4b85-80b9-9627870d295c.mp3" },
  { title: "Construction Project Management Software in 2026", audio: "https://content.rss.com/episodes/332597/2609071/scalinglegends/2026_03_07_21_45_58_8872c400-b540-4361-a955-77671faf4e60.mp3" },
  { title: "Construction Market Intelligence: March 7, 2026", audio: "https://content.rss.com/episodes/332597/2608591/scalinglegends/2026_03_07_16_27_36_221fdc98-1d8a-469a-ad39-62152b1a4e99.mp3" },
  { title: "Starting a Construction Business Under 30", audio: "https://content.rss.com/episodes/332597/2608580/scalinglegends/2026_03_07_16_17_55_65de69e2-f5cf-4e4c-b747-fbda36911a57.mp3" },
  { title: "Employee Transportation Services for Construction", audio: "https://content.rss.com/episodes/332597/2608578/scalinglegends/2026_03_07_16_17_09_cd1d188b-2a26-4be5-84aa-93dd607ba75b.mp3" },
  { title: "Construction's $15 Million Blind Spot", audio: "https://content.rss.com/episodes/332597/2605990/scalinglegends/2026_03_06_15_53_22_82e3f141-57a8-4b43-b9ab-7e09d9e42abc.mp3" },
  { title: "The AI Estimating Revolution", audio: "https://content.rss.com/episodes/332597/2605930/scalinglegends/2026_03_06_15_33_12_55079e6f-67d6-4809-911d-83aaba420cdd.mp3" },
  { title: "CONEXPO 2026 Decoded", audio: "https://content.rss.com/episodes/332597/2605872/scalinglegends/2026_03_06_15_05_22_47e2ab42-0cb1-4b0b-bd24-bedb21c45c91.mp3" },
  { title: "The IIJA Countdown", audio: "https://content.rss.com/episodes/332597/2605822/scalinglegends/2026_03_06_14_42_32_877dea37-448e-4669-a8ad-99b0ff02d0b0.mp3" },
  { title: "Construction Market Intelligence: March 6, 2026", audio: "https://content.rss.com/episodes/332597/2605805/scalinglegends/2026_03_06_14_28_19_e5f1052c-421b-42f5-a789-f7f1ad7070a6.mp3" },
  { title: "Scaling Legends Daily Intelligence Report - March 5", audio: "https://content.rss.com/episodes/332597/2604819/scalinglegends/2026_03_05_23_26_33_09d56a8f-cae7-4604-a579-2936ae33f8b7.mp3" },
  { title: "The OSHA 2026 Crackdown", audio: "https://content.rss.com/episodes/332597/2604783/scalinglegends/2026_03_05_23_03_41_912280a3-5213-48b8-b6cb-e6479946538d.mp3" },
  { title: "Scaling Without Bleeding Cash", audio: "https://content.rss.com/episodes/332597/2604763/scalinglegends/2026_03_05_22_49_44_d4b8ee13-5ce7-4561-aeb7-391907768bdc.mp3" },
  { title: "AI Goes Agentic", audio: "https://content.rss.com/episodes/332597/2604689/scalinglegends/2026_03_05_22_18_26_4a87af53-c1d6-4ad7-a796-2fbe66e667a1.mp3" },
  { title: "Tariff Survival Playbook", audio: "https://content.rss.com/episodes/332597/2604313/scalinglegends/2026_03_05_19_17_46_ab0893a2-345c-4158-a30a-b9a7cb3b3b67.mp3" },
  { title: "The 500K Worker Gap", audio: "https://content.rss.com/episodes/332597/2604270/scalinglegends/2026_03_05_18_57_35_78342106-4ba5-459f-92fd-e2faf9201b59.mp3" },
  { title: "Building Roads and Breaking Barriers", audio: "https://content.rss.com/episodes/332597/2599090/scalinglegends/2026_03_04_02_50_56_167b6101-01d1-4b04-bb13-0326eed8072a.mp3" },
  { title: "Surviving the Messy Middle", audio: "https://content.rss.com/episodes/332597/2598785/scalinglegends/2026_03_04_00_32_22_742cd069-905c-4f7f-ae0e-5e8ee5368867.mp3" },
  { title: "AI Drives Data Center Boom", audio: "https://content.rss.com/episodes/332597/2470708/scalinglegends/2026_01_19_22_24_06_40e919e2-f4e9-4846-bf3d-3424b1779fdf.mp3" },
  { title: "The Expectation Gap", audio: "https://content.rss.com/episodes/332597/2401198/scalinglegends/2025_12_19_16_25_37_58c08bb8-e45a-4866-a32c-3ccfd60dbd98.mp3" },
  { title: "NYC Housing Lottery", audio: "https://content.rss.com/episodes/332597/2138668/scalinglegends/2025_07_27_00_56_41_862ead88-6da8-4e29-b584-80aea3396f72.mp3" },
  { title: "The Flourishing Empire of Fluor", audio: "https://content.rss.com/episodes/332597/2138654/scalinglegends/2025_07_27_00_21_42_b8388901-b844-4928-a5cf-48a025d233e4.mp3" },
  { title: "Florida Construction Leaders", audio: "https://content.rss.com/episodes/332597/2086385/scalinglegends/2025_06_24_01_27_29_92c7850a-f11f-4a3e-8eef-1f82137483ee.mp3" },
  { title: "Construction Specialist", audio: "https://content.rss.com/episodes/332597/2086382/scalinglegends/2025_06_24_01_23_30_73458880-a8ab-4148-ae87-9bf1c1d22729.mp3" },
  { title: "California Construction Legends", audio: "https://content.rss.com/episodes/332597/2086380/scalinglegends/2025_06_24_01_18_32_1dd545a4-5273-4941-a13b-64df5fc0d01b.mp3" },
  { title: "Welcome to the Scaling Legends Podcast", audio: "https://content.rss.com/episodes/332597/2061050/scalinglegends/2025_06_06_00_08_36_56b78d5a-5374-4bee-b114-357f4ad23b5e.mp3" },
];

function matchAudio(articleTitle) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nt = norm(articleTitle);
  for (const ep of rssEpisodes) {
    if (nt.includes(norm(ep.title)) || norm(ep.title).includes(nt.slice(0, 30))) {
      return ep.audio;
    }
  }
  // fuzzy: check if first 4 significant words match
  const words = articleTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 4);
  for (const ep of rssEpisodes) {
    const epLower = ep.title.toLowerCase();
    if (words.length >= 3 && words.filter(w => epLower.includes(w)).length >= 3) {
      return ep.audio;
    }
  }
  return '';
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
  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
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
  // Fix indented list items (4-space indent makes code blocks in markdown)
  md = md.replace(/^    (- )/gm, '$1');
  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();
  // Remove the H1 title if it matches (it's in frontmatter)
  md = md.replace(/^# .+\n\n/, '');
  return md;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

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
