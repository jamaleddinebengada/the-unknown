/** Interest tiles: a 3D-style emoji on a soft pastel card (Choose Your Vibe, profiles). */
export const INTEREST_ART: Record<string, { emoji: string; colors: [string, string] }> = {
  travel: { emoji: '🎈', colors: ['#FFF6D6', '#FFE89A'] },
  music: { emoji: '🎧', colors: ['#E9F5FC', '#CFE8F7'] },
  gaming: { emoji: '🎮', colors: ['#FFEDE8', '#FFD3C9'] },
  sports: { emoji: '🏋️', colors: ['#FFF8E7', '#E6E1D2'] },
  movies: { emoji: '🎬', colors: ['#EAF7F1', '#CDEEDF'] },
  culture: { emoji: '🍲', colors: ['#FFF6D6', '#FFE89A'] },
  education: { emoji: '📚', colors: ['#E9F5FC', '#CFE8F7'] },
  technology: { emoji: '💻', colors: ['#FFEDE8', '#FFD3C9'] },
  business: { emoji: '💼', colors: ['#FFF8E7', '#E6E1D2'] },
  relationships: { emoji: '💞', colors: ['#EAF7F1', '#CDEEDF'] },
  life: { emoji: '🌿', colors: ['#FFF6D6', '#FFE89A'] },
  psychology: { emoji: '🧠', colors: ['#E9F5FC', '#CFE8F7'] },
  adventure: { emoji: '🏔️', colors: ['#FFEDE8', '#FFD3C9'] },
  dreams: { emoji: '🌙', colors: ['#FFF8E7', '#E6E1D2'] },
  philosophy: { emoji: '🔮', colors: ['#EAF7F1', '#CDEEDF'] },
  mystery: { emoji: '🎭', colors: ['#FFF6D6', '#FFE89A'] },
};
export const interestArt = (slug: string) => INTEREST_ART[slug] ?? { emoji: '✨', colors: ['#E9F5FC', '#CFE8F7'] as [string, string] };
