#!/bin/bash
# Auto-pull articles from Supabase, commit, push, and deploy to Cloudflare Pages
set -e

SITE_DIR="/home/nxusdev/scalinglegends-site"
cd "$SITE_DIR"

# Cloudflare credentials
export CLOUDFLARE_API_TOKEN="cfut_WvrBEgy2RqfTdvp1aLUc415ZvaIaWPMRMh9J5jMS7f4c84f9"
export CLOUDFLARE_ACCOUNT_ID="75b49789abaa06a2a9866ff80d1b5335"

echo "$(date) - Starting auto-deploy..."

# Pull latest articles from Supabase
node scripts/pull-supabase-articles.mjs

# Check if anything changed (modified OR new untracked files)
NEW_COUNT=$(git ls-files --others --exclude-standard src/content/articles/ | wc -l)
if git diff --quiet src/content/articles/ && [ "$NEW_COUNT" -eq 0 ]; then
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

# Build and deploy to Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name scalinglegends --branch main --commit-dirty=true

echo "$(date) - Deploy complete. $((CHANGED + NEW)) articles updated on scalinglegends.com"

# GA4 deploy event
curl -s -X POST "https://www.google-analytics.com/mp/collect?measurement_id=G-7CP5LHM69N&api_secret=Vfc4Vu-kRdWHU7Kuarygyw" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"scaling-legends-pipeline\",\"events\":[{\"name\":\"site_deploy_complete\",\"params\":{\"articles_updated\":$((CHANGED + NEW))}}]}" \
  || true
