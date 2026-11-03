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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok && res.status === 404) {
      // Table doesn't exist yet -- silently skip to avoid console noise
      return;
    }
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

// ── Outbound Click Tracking (GA4) ───────────────────────────────────
// Listen and SBA clicks are the site's conversions until an email list exists.

const OUTBOUND: Record<string, string> = {
  'podcasts.apple.com': 'apple_podcasts',
  'open.spotify.com': 'spotify',
  'www.youtube.com': 'youtube',
  'youtube.com': 'youtube',
  'smartbusinessautomator.com': 'smart_business_automator',
  'www.smartbusinessautomator.com': 'smart_business_automator',
};

export function trackOutboundClicks() {
  document.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link) return;
    let url: URL;
    try { url = new URL(link.href); } catch { return; }
    const destination = OUTBOUND[url.hostname];
    if (!destination) return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.('event', 'outbound_click', {
      destination,
      link_url: link.href,
      page_path: window.location.pathname,
      cta_location: link.closest('[data-follow-location]')?.getAttribute('data-follow-location') || undefined,
      transport_type: 'beacon',
    });
  }, { capture: true });
}
