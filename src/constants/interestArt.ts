/** Interest tiles: a 3D-style emoji on a soft pastel card (Choose Your Vibe, profiles). */
export const INTEREST_ART: Record<string, { emoji: string; colors: [string, string] }> = {
  travel: { emoji: '🎈', colors: ['#FFF0E6', '#FBD9E4'] },
  music: { emoji: '🎧', colors: ['#F8E1F1', '#E9C8EC'] },
  gaming: { emoji: '🎮', colors: ['#EFE6FB', '#DCCDF5'] },
  sports: { emoji: '🏋️', colors: ['#F3E5F7', '#E5CFEF'] },
  movies: { emoji: '🎬', colors: ['#FCE8EC', '#F3D1DB'] },
  culture: { emoji: '🍲', colors: ['#FFF3E2', '#FBE0C4'] },
  education: { emoji: '📚', colors: ['#FDF0E4', '#F6DCCB'] },
  technology: { emoji: '💻', colors: ['#EAF0FB', '#D9E2F6'] },
  business: { emoji: '💼', colors: ['#F7EFE6', '#ECDCC8'] },
  relationships: { emoji: '💞', colors: ['#FDE6EE', '#F7CADB'] },
  life: { emoji: '🌿', colors: ['#EEF7EC', '#D9EDD5'] },
  psychology: { emoji: '🧠', colors: ['#FBE9F0', '#F1D2E2'] },
  adventure: { emoji: '🏔️', colors: ['#EAF3F8', '#D5E6F0'] },
  dreams: { emoji: '🌙', colors: ['#EFE9FA', '#DCD1F2'] },
  philosophy: { emoji: '🔮', colors: ['#F4E8F8', '#E5D0EF'] },
  mystery: { emoji: '🎭', colors: ['#F9E6EF', '#EBCADB'] },
};
export const interestArt = (slug: string) => INTEREST_ART[slug] ?? { emoji: '✨', colors: ['#FCEEF3', '#F3D6E6'] as [string, string] };
