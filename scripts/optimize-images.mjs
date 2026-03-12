#!/usr/bin/env node
/**
 * optimize-images.mjs - Build-time image optimization pipeline
 *
 * Downloads remote images from Supabase storage, converts to WebP,
 * resizes for each use case, and rewrites article frontmatter to point
 * to local optimized files. Images then ship from Vercel CDN instead
 * of Supabase storage, cutting 1-1.4MB PNGs down to 30-80KB WebP.
 *
 * Usage:
 *   node scripts/optimize-images.mjs          # optimize all articles
 *   node scripts/optimize-images.mjs --force  # re-download everything
 *
 * Run AFTER pull-supabase-articles.mjs and BEFORE astro build.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import sharp from 'sharp';

const SCRIPT_DIR = import.meta.dirname;
const PROJECT_ROOT = join(SCRIPT_DIR, '..');
const ARTICLES_DIR = join(PROJECT_ROOT, 'src', 'content', 'articles');
const OUTPUT_DIR = join(PROJECT_ROOT, 'public', 'img', 'articles');
const SUPABASE_HOST = 'yzlcegvoqenqjxbdmxns.supabase.co';

// Image size presets (width in px)
const SIZES = {
  hero:  600,   // article hero image (max display width)
  card:  400,   // home page card view
  ep:    320,   // podcast episode square
  thumb:  56,   // sidebar thumbnail
};

// WebP quality (0-100). 80 is a good balance of size vs quality for photos.
const WEBP_QUALITY = 80;

// ── Helpers ────────────────────────────────────────────────────────────

function slugFromFilename(filename) {
  return basename(filename, '.md');
}

function isSupabaseUrl(url) {
  return url && url.includes(SUPABASE_HOST);
}

async function downloadImage(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function processImage(buffer, slug, isEpisode) {
  const outputs = [];

  // Hero/main image
  const heroWidth = isEpisode ? SIZES.ep : SIZES.hero;
  const heroPath = join(OUTPUT_DIR, `${slug}-hero.webp`);
  await sharp(buffer)
    .resize(heroWidth, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(heroPath);
  const heroStats = readFileSync(heroPath);
  outputs.push({ type: 'hero', path: heroPath, size: heroStats.length, width: heroWidth });

  // Card image (for home/podcast listing)
  const cardPath = join(OUTPUT_DIR, `${slug}-card.webp`);
  await sharp(buffer)
    .resize(SIZES.card, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(cardPath);
  const cardStats = readFileSync(cardPath);
  outputs.push({ type: 'card', path: cardPath, size: cardStats.length, width: SIZES.card });

  // Thumbnail (square crop for sidebar)
  const thumbPath = join(OUTPUT_DIR, `${slug}-thumb.webp`);
  await sharp(buffer)
    .resize(SIZES.thumb, SIZES.thumb, { fit: 'cover' })
    .webp({ quality: WEBP_QUALITY })
    .toFile(thumbPath);
  const thumbStats = readFileSync(thumbPath);
  outputs.push({ type: 'thumb', path: thumbPath, size: thumbStats.length, width: SIZES.thumb });

  return outputs;
}

// ── Frontmatter parsing ────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { frontmatter: '', body: content, raw: '' };
  return {
    raw: match[1],
    frontmatter: match[1],
    body: content.slice(match[0].length),
    fullMatch: match[0],
  };
}

function getImageUrl(frontmatter) {
  const match = frontmatter.match(/^image:\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

function hasAudioUrl(frontmatter) {
  return /^audioUrl:/m.test(frontmatter);
}

function rewriteImageUrl(content, oldUrl, newUrl) {
  return content.replace(
    `image: "${oldUrl}"`,
    `image: "${newUrl}"\nimageOriginal: "${oldUrl}"`
  );
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const forceRedownload = process.argv.includes('--force');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
  console.log(`Scanning ${files.length} articles for remote images...`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;

  for (const file of files) {
    const slug = slugFromFilename(file);
    const filePath = join(ARTICLES_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter } = parseFrontmatter(content);
    const imageUrl = getImageUrl(frontmatter);

    // Skip non-Supabase images
    if (!isSupabaseUrl(imageUrl)) {
      continue;
    }

    // Check if already optimized (hero file exists)
    const heroFile = join(OUTPUT_DIR, `${slug}-hero.webp`);
    if (existsSync(heroFile) && !forceRedownload) {
      // Already have frontmatter pointing to local?
      if (content.includes('imageOriginal:')) {
        skipped++;
        continue;
      }
    }

    const isEpisode = hasAudioUrl(frontmatter);

    try {
      process.stdout.write(`  ${slug}... `);

      // Download original
      const buffer = await downloadImage(imageUrl);
      totalOriginalBytes += buffer.length;

      // Process into multiple sizes
      const outputs = await processImage(buffer, slug, isEpisode);
      const heroOutput = outputs.find(o => o.type === 'hero');
      totalOptimizedBytes += outputs.reduce((s, o) => s + o.size, 0);

      // Rewrite frontmatter to use local path
      const localHeroPath = `/img/articles/${slug}-hero.webp`;
      const newContent = rewriteImageUrl(content, imageUrl, localHeroPath);
      writeFileSync(filePath, newContent);

      const savedPct = Math.round((1 - heroOutput.size / buffer.length) * 100);
      console.log(
        `${(buffer.length / 1024).toFixed(0)}KB -> ${(heroOutput.size / 1024).toFixed(0)}KB (${savedPct}% smaller)`
      );
      downloaded++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n--- Image Optimization Summary ---`);
  console.log(`  Processed: ${downloaded}`);
  console.log(`  Skipped (already done): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  if (totalOriginalBytes > 0) {
    console.log(`  Original total: ${(totalOriginalBytes / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Optimized total: ${(totalOptimizedBytes / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  Savings: ${Math.round((1 - totalOptimizedBytes / totalOriginalBytes) * 100)}%`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
