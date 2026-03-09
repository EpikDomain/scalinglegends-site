#!/bin/bash
# Auto-pull articles from Supabase, commit, push, and deploy to Vercel
set -e

SITE_DIR="/home/nxusdev/scalinglegends-site"
cd "$SITE_DIR"

echo "$(date) - Starting auto-deploy..."

# Pull latest articles from Supabase
node scripts/pull-supabase-articles.mjs

# Check if anything changed
if git diff --quiet src/content/articles/; then
  echo "$(date) - No changes detected, skipping deploy."
  exit 0
fi

# Count changes
CHANGED=$(git diff --name-only src/content/articles/ | wc -l)
NEW=$(git ls-files --others --exclude-standard src/content/articles/ | wc -l)
echo "$(date) - $CHANGED modified, $NEW new articles"

# Stage and commit
git add src/content/articles/
git commit -m "Auto-update: $((CHANGED + NEW)) articles from Supabase ($(date '+%Y-%m-%d %H:%M'))"

# Push to GitHub
git push origin main

# Deploy to Vercel
npx vercel --yes --prod

echo "$(date) - Deploy complete. $((CHANGED + NEW)) articles updated on scalinglegends.com"
