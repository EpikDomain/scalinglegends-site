-- Scaling Legends Analytics Tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/yzlcegvoqenqjxbdmxns/sql/new

-- Page views table
CREATE TABLE IF NOT EXISTS page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path text NOT NULL,
  page_title text,
  referrer text,
  user_agent text,
  session_id text,
  created_at timestamptz DEFAULT now()
);

-- Audio play events table
CREATE TABLE IF NOT EXISTS audio_plays (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path text NOT NULL,
  article_title text,
  audio_url text,
  event_type text NOT NULL,
  current_time real DEFAULT 0,
  duration real DEFAULT 0,
  session_id text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_plays ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for client-side tracking from the website)
CREATE POLICY "Allow anonymous page view inserts" ON page_views
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous audio play inserts" ON audio_plays
  FOR INSERT TO anon WITH CHECK (true);

-- Create indexes for common queries
CREATE INDEX idx_page_views_path ON page_views(page_path);
CREATE INDEX idx_page_views_created ON page_views(created_at);
CREATE INDEX idx_audio_plays_path ON audio_plays(page_path);
CREATE INDEX idx_audio_plays_event ON audio_plays(event_type);
CREATE INDEX idx_audio_plays_created ON audio_plays(created_at);
