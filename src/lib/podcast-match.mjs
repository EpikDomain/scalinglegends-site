// Build-time matching: specific title phrases and page keywords beat generic overlap.
const STOP = new Set('a an and are as at be been business by can company companies construction contractor contractors do does for from get guide how in into is it its new of on or our page podcast scaling legends smart automator that the their this to us what when which who why will with you your'.split(' '));
const GROUPS = [
  ['wip', 'work in progress', 'margin fade', 'overbilling', 'underbilling', 'job costing', 'cost to complete'],
  ['cash flow', 'receivables', 'accounts receivable', 'collections', 'payment', 'invoice', 'invoicing', 'retainage'],
  ['certified payroll', 'prevailing wage', 'davis bacon', 'payroll'],
  ['rfi', 'submittal', 'request for information'],
  ['change order', 'change orders', 'changed work'],
  ['hiring', 'recruiting', 'recruitment', 'employee retention', 'labor shortage'],
  ['safety', 'osha', 'toolbox talk', 'fall protection'],
  ['estimating', 'estimate', 'bidding', 'bid', 'takeoff', 'pricing'],
  ['automation', 'workflow', 'systems', 'integration', 'handoff'],
  ['public works', 'government contracting', 'federal contracts', 'public work'],
  ['leadership', 'superintendent', 'foreman', 'management'],
  ['insurance', 'surety', 'bonding', 'bond'],
  ['scheduling', 'schedule', 'delay', 'delays'],
];

export const normalize = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = text => [...new Set(normalize(text).split(' ').filter(t => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)))];
const contains = (text, phrase) => (` ${text} `).includes(` ${normalize(phrase)} `);

export function createMatcher(episodes, stateNames = []) {
  // A full published transcript is required so every embedded episode can be read.
  const candidates = episodes.filter(e => e.audio?.startsWith('https://') && e.transcript?.length);
  if (!candidates.length) throw new Error('No playable episodes with transcripts');
  const docs = candidates.map(episode => {
    const title = normalize(episode.title);
    const summary = normalize(episode.summary.join(' '));
    return { episode, title, summary, words: new Set(tokens(title + ' ' + summary)),
      groups: GROUPS.map(g => g.some(p => contains(title + ' ' + summary, p))),
      regions: stateNames.map(normalize).filter(s => contains(title, s)),
    };
  });
  const frequency = new Map();
  for (const d of docs) for (const w of d.words) frequency.set(w, (frequency.get(w) ?? 0) + 1);
  const idf = w => Math.log(1 + docs.length / (1 + (frequency.get(w) ?? 0)));
  const general = docs.find(d => d.episode.id === '3094071') ?? docs.find(d => !d.regions.length) ?? docs[0];

  return function match(context) {
    const keywords = context.keywords ?? [];
    const title = normalize(context.title);
    const text = normalize([context.title, ...keywords, context.category, context.section, context.description].filter(Boolean).join(' '));
    const titleWords = new Set(tokens(context.title + ' ' + keywords.join(' ')));
    const words = tokens(text);
    const region = normalize(context.state);
    const groups = GROUPS.map(g => g.some(p => contains(text, p)));
    const ranked = docs.map(d => {
      // Never present a different state's legal/regional episode as a state-page match.
      if (region && d.regions.length && !d.regions.includes(region)) return { d, score: -Infinity };
      let score = 0;
      let specific = 0;
      for (const w of words) {
        if (!d.words.has(w)) continue;
        score += idf(w) * (titleWords.has(w) ? 2 : .4) * (contains(d.title, w) ? 2 : 1);
        if (titleWords.has(w)) specific++;
      }
      for (const phrase of keywords) {
        if (tokens(phrase).length < 2) continue;
        if (contains(d.title, phrase)) score += 24;
        else if (contains(d.summary, phrase)) score += 10;
      }
      let groupMatches = 0;
      groups.forEach((yes, i) => { if (yes && d.groups[i]) { score += 12; groupMatches++; } });
      if (region && d.regions.includes(region)) score += 18;
      // An isolated generic term is not enough to claim a topical match.
      if (specific < 2 && !groupMatches) score = 0;
      return { d, score };
    }).sort((a, b) => b.score - a.score || a.d.episode.id.localeCompare(b.d.episode.id));
    const best = ranked[0];
    return best.score >= 12
      ? { episode: best.d.episode, kind: 'related', score: best.score }
      : { episode: general.episode, kind: 'general', score: 0 };
  };
}
