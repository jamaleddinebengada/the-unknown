import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { PostCard } from '@/components/PostCard';
import { Screen, StackHeader } from '@/components/Screen';
import { CategoryChip, EmptyState, ErrorState, T, TextField } from '@/components/ui';
import { INTERESTS } from '@/constants/content';
import { colors, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { searchPosts } from '@/services/api';
import type { FeedPost } from '@/types/models';

export default function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setError(null); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchPosts(term).then((r) => { setResults(r); setError(null); }).catch((e) => setError(friendlyError(e))).finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Search" />
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <TextField icon="search" placeholder="Posts, questions, topics…" value={q} onChangeText={setQ} autoFocus returnKeyType="search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {INTERESTS.map((i) => <CategoryChip key={i.slug} icon={i.icon} label={i.label} selected={q === i.slug} onPress={() => setQ(i.slug)} />)}
        </ScrollView>
      </View>
      {loading ? <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} /> : error ? <ErrorState message={error} /> : (
        <FlatList data={results} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item, index }) => <PostCard post={item} index={index} onChange={(p) => setResults((r) => r.map((x) => (x.id === p.id ? p : x)))} onRemoved={(id) => setResults((r) => r.filter((x) => x.id !== id))} />}
          ListEmptyComponent={q.trim().length >= 2 ? <EmptyState icon="search-outline" title="Nothing found" body="Try another word — or post the question yourself." /> :
            <T color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.xl }}>Search the stories of the world, or tap a topic.</T>} />
      )}
    </Screen>
  );
}
