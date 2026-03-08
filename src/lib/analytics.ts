/**
 * Scaling Legends - Client-side analytics
 * Tracks page views and audio play events via Supabase
 */

const SUPABASE_URL = 'https://yzlcegvoqenqjxbdmxns.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bGNlZ3ZvcWVucWp4YmRteG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1ODI5ODEsImV4cCI6MjA4ODE1ODk4MX0.Zz4hmSen0ksyVuHrmANHWdfphS7JBT5tvAXuJm06InM';

function getSessionId(): string {
  let sid = sessionStorage.getItem('sl_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('sl_sid', sid);
  }
  return sid;
}

async function supabaseInsert(table: string, row: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(row),
    });
  } catch {
    // Analytics should never break the site
  }
}

// ── Page View Tracking ──────────────────────────────────────────────

export function trackPageView() {
  supabaseInsert('page_views', {
    page_path: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
    session_id: getSessionId(),
  });
}

// ── Audio Play Tracking ─────────────────────────────────────────────

let audioTracked = false;

export function trackAudioPlays() {
  if (audioTracked) return;
  audioTracked = true;
  const audioElements = document.querySelectorAll<HTMLAudioElement>('audio');

  audioElements.forEach((audio) => {
    const articleTitle = document.querySelector('h1')?.textContent || '';
    const audioUrl = audio.querySelector('source')?.src || audio.src || '';
    let lastProgressReport = 0;

    function sendEvent(eventType: string) {
      supabaseInsert('audio_plays', {
        page_path: window.location.pathname,
        article_title: articleTitle,
        audio_url: audioUrl,
        event_type: eventType,
        current_time: Math.round(audio.currentTime),
        duration: Math.round(audio.duration) || 0,
        session_id: getSessionId(),
      });
    }

    audio.addEventListener('play', () => sendEvent('play'));
    audio.addEventListener('pause', () => {
      if (!audio.ended) sendEvent('pause');
    });
    audio.addEventListener('ended', () => sendEvent('ended'));

    // Report progress every 25% of the way through
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const pct = Math.floor((audio.currentTime / audio.duration) * 4) * 25;
      if (pct > lastProgressReport && pct > 0) {
        lastProgressReport = pct;
        sendEvent(`progress_${pct}`);
      }
    });
  });
}
