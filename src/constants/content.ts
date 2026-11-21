import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export const INTERESTS: { slug: string; label: string; icon: IconName; blurb: string }[] = [
  { slug: 'travel', label: 'Travel', icon: 'airplane-outline', blurb: 'Places, journeys, new lives' },
  { slug: 'business', label: 'Business', icon: 'briefcase-outline', blurb: 'Ideas, startups, money' },
  { slug: 'technology', label: 'Technology', icon: 'hardware-chip-outline', blurb: 'AI, code, the future' },
  { slug: 'relationships', label: 'Relationships', icon: 'heart-outline', blurb: 'Love, friends, family' },
  { slug: 'life', label: 'Life', icon: 'leaf-outline', blurb: 'Everyday moments' },
  { slug: 'psychology', label: 'Psychology', icon: 'pulse-outline', blurb: 'Why we do what we do' },
  { slug: 'adventure', label: 'Adventure', icon: 'compass-outline', blurb: 'Risk, thrill, the wild' },
  { slug: 'music', label: 'Music', icon: 'musical-notes-outline', blurb: 'Sounds that move you' },
  { slug: 'movies', label: 'Movies', icon: 'film-outline', blurb: 'Stories on screen' },
  { slug: 'gaming', label: 'Gaming', icon: 'game-controller-outline', blurb: 'Worlds to play in' },
  { slug: 'sports', label: 'Sports', icon: 'football-outline', blurb: 'Games, fitness, rivalry' },
  { slug: 'culture', label: 'Culture', icon: 'globe-outline', blurb: 'Traditions, languages, food' },
  { slug: 'education', label: 'Education', icon: 'school-outline', blurb: 'Learning and growth' },
  { slug: 'dreams', label: 'Dreams', icon: 'moon-outline', blurb: 'Ambitions and night visions' },
  { slug: 'philosophy', label: 'Philosophy', icon: 'infinite-outline', blurb: 'Big questions' },
  { slug: 'mystery', label: 'Mystery', icon: 'help-circle-outline', blurb: 'The unexplained' },
];

export const interestLabel = (slug: string) => INTERESTS.find((i) => i.slug === slug)?.label ?? slug;

export const FEED_CATEGORIES = [
  { key: 'for_you', label: 'For You' },
  { key: 'worldwide', label: 'Worldwide' },
  { key: 'trending', label: 'Trending' },
  { key: 'my_country', label: 'My Country' },
  { key: 'thought', label: 'Deep Thoughts' },
  { key: 'question', label: 'Questions' },
  { key: 'secret', label: 'Secrets' },
  { key: 'dream', label: 'Dreams' },
  { key: 'advice', label: 'Advice' },
  { key: 'debate', label: 'Debate' },
] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number]['key'];

export const POST_TYPES: { key: string; label: string; action: string; icon: IconName; placeholder: string }[] = [
  { key: 'thought', label: 'Thought', action: 'Write something', icon: 'create-outline', placeholder: 'A thought you keep coming back to…' },
  { key: 'question', label: 'Question', action: 'Ask a question', icon: 'help-outline', placeholder: 'What do you want the world to answer?' },
  { key: 'secret', label: 'Secret', action: 'Share a secret', icon: 'lock-closed-outline', placeholder: 'Something you have never said out loud…' },
  { key: 'story', label: 'Story', action: 'Tell a story', icon: 'book-outline', placeholder: 'It started when…' },
  { key: 'advice', label: 'Advice', action: 'Ask for advice', icon: 'hand-left-outline', placeholder: 'I need an honest opinion about…' },
  { key: 'debate', label: 'Debate', action: 'Start a debate', icon: 'git-compare-outline', placeholder: 'Unpopular opinion:' },
  { key: 'dream', label: 'Dream', action: 'Share a dream', icon: 'moon-outline', placeholder: 'One day I want to…' },
  { key: 'challenge', label: 'Challenge', action: 'Create a challenge', icon: 'flash-outline', placeholder: 'I challenge anyone to…' },
  { key: 'travel', label: 'Travel', action: 'Share a journey', icon: 'airplane-outline', placeholder: 'The place that changed me…' },
  { key: 'business', label: 'Business Idea', action: 'Pitch an idea', icon: 'bulb-outline', placeholder: 'What if there was an app that…' },
];
export const postTypeLabel = (key: string) => POST_TYPES.find((p) => p.key === key)?.label ?? key;

export const AUDIENCES = [
  { key: 'everyone', label: 'Everyone', icon: 'earth-outline' as IconName },
  { key: 'topic', label: 'People into this topic', icon: 'sparkles-outline' as IconName },
  { key: 'my_country', label: 'My country', icon: 'flag-outline' as IconName },
  { key: 'countries', label: 'Selected countries', icon: 'map-outline' as IconName },
];

export const CONVERSATION_PREFS = [
  { key: 'deep', label: 'Deep talks' },
  { key: 'casual', label: 'Casual chat' },
  { key: 'language', label: 'Language exchange' },
  { key: 'advice', label: 'Giving advice' },
  { key: 'debate', label: 'Friendly debate' },
  { key: 'listening', label: 'Just listening' },
];

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ru', label: 'Русский' },
];

export const MATCH_MODES: { key: string; label: string; blurb: string; icon: IconName }[] = [
  { key: 'world', label: 'World Match', blurb: 'Someone from another country', icon: 'earth-outline' },
  { key: 'random', label: 'Random', blurb: 'Any compatible soul', icon: 'shuffle-outline' },
  { key: 'dream', label: 'Dream Match', blurb: 'Similar dreams and ambitions', icon: 'moon-outline' },
  { key: 'deep', label: 'Deep Talk', blurb: 'For meaningful conversations', icon: 'water-outline' },
  { key: 'interest', label: 'Interest Match', blurb: 'Shared passions first', icon: 'sparkles-outline' },
  { key: 'language', label: 'Language Exchange', blurb: 'Practice a language together', icon: 'language-outline' },
];

export const MYSTERY_QUESTIONS = [
  'What is something you have never told anyone?',
  'What would you do if money was no longer a problem?',
  'What is your biggest dream?',
  'Do you believe people can change?',
  'What is the most important decision you have made?',
  'Which city would you disappear to for a year?',
  'What is a belief you changed your mind about?',
  'Who taught you the most without knowing it?',
  'What does a perfect ordinary day look like for you?',
  'What are you secretly proud of?',
  'If you could relive one hour of your life, which one?',
  'What is something small that makes you irrationally happy?',
];

export const REPORT_REASONS = [
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'hate', label: 'Hate speech' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'threat', label: 'Threats or violence' },
  { key: 'minor', label: 'May be under 18' },
  { key: 'self_harm', label: 'Self-harm concern' },
  { key: 'other', label: 'Something else' },
];

export const PERSONALITY_TAGS = ['Explorer', 'Curious', 'Dreamer', 'Ambitious', 'Night Owl', 'Listener', 'Storyteller', 'Rebel', 'Calm', 'Creative', 'Thinker', 'Wanderer'];
