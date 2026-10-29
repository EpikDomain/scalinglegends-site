// Use only verified provider URLs. A show fallback is never labeled an episode.
export function platformOptions(episode, config) {
  const result = [];
  function apple(raw, scope) {
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.hostname !== 'podcasts.apple.com' || !/\/id1819064655$/.test(url.pathname)) return;
      const id = url.searchParams.get('i');
      if (scope === 'episode' && !/^\d+$/.test(id ?? '')) return;
      url.search = ''; if (id) url.searchParams.set('i', id);
      const href = url.href; url.hostname = 'embed.podcasts.apple.com'; url.searchParams.set('theme', 'dark');
      result.push({ id: 'apple', name: 'Apple Podcasts', scope, href, embed: url.href, height: scope === 'episode' ? 175 : 450 });
    } catch { /* An unconfigured provider is not rendered. */ }
  }
  if (episode.platforms?.apple) apple(episode.platforms.apple, 'episode');
  if (!result.some(p => p.id === 'apple')) apple(config.appleShow, 'show');
  const episodeUrl = config.spotifyEpisodes?.[episode.id];
  try {
    const url = new URL(episodeUrl || config.spotifyShow);
    const match = url.pathname.match(/^\/(episode|show)\/([A-Za-z0-9]{22})\/?$/);
    if (url.protocol === 'https:' && url.hostname === 'open.spotify.com' && match && (!episodeUrl || match[1] === 'episode')) {
      url.search = '';
      result.push({ id: 'spotify', name: 'Spotify', scope: match[1], href: url.href,
        embed: `https://open.spotify.com/embed/${match[1]}/${match[2]}?theme=0`, height: match[1] === 'episode' ? 232 : 352 });
    }
  } catch { /* Wait for a verified show or episode link. */ }
  return result;
}
