import catalog from '../data/podcast.json';
import { STATE_NAMES } from './podcast-states';
import { createMatcher } from './podcast-match.mjs';

// Construct the search index once per build, rather than once per generated page.
export const matchPodcast = createMatcher(catalog.episodes, Object.values(STATE_NAMES));
