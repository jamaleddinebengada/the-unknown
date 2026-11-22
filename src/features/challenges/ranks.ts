const RANKS = ['Newcomer', 'Wanderer', 'Curious', 'Explorer', 'Storyteller', 'Connector', 'Voyager', 'Legend'];
/** Rank name for a level (two levels per rank). */
export const rankOf = (level: number) => RANKS[Math.min(RANKS.length - 1, Math.max(0, Math.floor((level - 1) / 2)))];
