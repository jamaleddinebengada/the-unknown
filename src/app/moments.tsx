import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { ReportSheet, type ReportTarget } from '@/components/ReportSheet';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, IconButton } from '@/components/ui';
import { Avatar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { deletePost, getFeed, toggleLike } from '@/lib/api';
import { friendlyError, photoUrl } from '@/lib/supabase';
import type { Post } from '@/lib/types';
import { haptic, timeAgo } from '@/utils/format';

/** Live moments: photos, plans and questions from real members. */
export default function Moments() {
  const router = useRouter();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState<Post | null>(null);
  const [reportT, setReportT] = useState<ReportTarget>(null);
  const load = useCallback(() => getFeed().then(setPosts).catch((e) => { toast(friendlyError(e), 'error'); setPosts([]); }), [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const like = async (p: Post) => {
    haptic.tap();
    setPosts((ps) => ps?.map((x) => (x.id === p.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)) ?? null);
    try { await toggleLike(p.id); } catch (e) { toast(friendlyError(e), 'error'); load(); }
  };
  return (
    <Screen>
      <StackHeader title={t('moments.title')} right={<IconButton name="add" label={t('moments.new')} onPress={() => router.push('/moment-new')} />} />
      <FlatList data={posts ?? []} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={posts === null ? <ActivityIndicator color={colors.text} /> : <EmptyState icon="images-outline" title={t('moments.empty')} action={t('moments.new')} onAction={() => router.push('/moment-new')} />}
        renderItem={({ item: p }) => (
          <View style={s.card}>
            <View style={s.head}>
              <Pressable onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.author.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Avatar path={p.author.photo_path} name={p.author.name} size={40} />
                <View style={{ flex: 1 }}><Text style={s.name}>{p.author.name}</Text><Text style={s.meta}>{[p.author.city, timeAgo(p.created_at)].filter(Boolean).join(' · ')}</Text></View>
              </Pressable>
              <Pressable onPress={() => setMenu(p)} hitSlop={10}><Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} /></Pressable>
            </View>
            {!!p.body && <Text style={s.body}>{p.body}</Text>}
            {!!p.media_path && <Image source={{ uri: photoUrl(p.media_path) }} style={s.img} contentFit="cover" transition={150} />}
            <Pressable onPress={() => like(p)} style={s.like} accessibilityRole="button">
              <Ionicons name={p.liked ? 'heart' : 'heart-outline'} size={22} color={p.liked ? colors.coral : colors.text} /><Text style={s.likes}>{p.likes}</Text>
            </Pressable>
          </View>
        )} />
      <BottomSheet visible={!!menu} onClose={() => setMenu(null)}>
        {menu?.mine ? <SheetAction icon="trash-outline" danger label={t('common.delete')} onPress={async () => { const p = menu; setMenu(null); try { await deletePost(p.id); load(); } catch (e) { toast(friendlyError(e), 'error'); } }} />
          : <SheetAction icon="flag-outline" label={t('common.report')} onPress={() => { const p = menu!; setMenu(null); setReportT({ post: p.id, user: p.author.id }); }} />}
      </BottomSheet>
      <ReportSheet target={reportT} onClose={() => setReportT(null)} />
    </Screen>
  );
}
const s = StyleSheet.create({
  card: { gap: 10, padding: 14, borderRadius: 22, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, lineHeight: 22 },
  img: { width: '100%', aspectRatio: 0.8, borderRadius: 16, backgroundColor: colors.bg },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  likes: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
