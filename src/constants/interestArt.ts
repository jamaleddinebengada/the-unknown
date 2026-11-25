/** Interest tiles: a 3D-style emoji on a soft pastel card (Choose Your Vibe, profiles). */
export const INTEREST_ART: Record<string, { emoji: string; colors: [string, string] }> = {
  travel: { emoji: '🎈', colors: ['#EAF5FF', '#D6EBFF'] },
  music: { emoji: '🎧', colors: ['#E9F5FC', '#CFE8F7'] },
  gaming: { emoji: '🎮', colors: ['#FFF1F4', '#FFE1E8'] },
  sports: { emoji: '🏋️', colors: ['#F1F5F9', '#E2E8F0'] },
  movies: { emoji: '🎬', colors: ['#EAF7F1', '#CDEEDF'] },
  culture: { emoji: '🍲', colors: ['#EAF5FF', '#D6EBFF'] },
  education: { emoji: '📚', colors: ['#E9F5FC', '#CFE8F7'] },
  technology: { emoji: '💻', colors: ['#FFF1F4', '#FFE1E8'] },
  business: { emoji: '💼', colors: ['#F1F5F9', '#E2E8F0'] },
  relationships: { emoji: '💞', colors: ['#EAF7F1', '#CDEEDF'] },
  life: { emoji: '🌿', colors: ['#EAF5FF', '#D6EBFF'] },
  psychology: { emoji: '🧠', colors: ['#E9F5FC', '#CFE8F7'] },
  adventure: { emoji: '🏔️', colors: ['#FFF1F4', '#FFE1E8'] },
  dreams: { emoji: '🌙', colors: ['#F1F5F9', '#E2E8F0'] },
  philosophy: { emoji: '🔮', colors: ['#EAF7F1', '#CDEEDF'] },
  mystery: { emoji: '🎭', colors: ['#EAF5FF', '#D6EBFF'] },
};
export const interestArt = (slug: string) => INTEREST_ART[slug] ?? { emoji: '✨', colors: ['#E9F5FC', '#CFE8F7'] as [string, string] };
