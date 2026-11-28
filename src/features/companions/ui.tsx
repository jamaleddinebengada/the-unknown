import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { BottomSheet } from '@/components/Overlay';
import { GradientButton } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { photoUrl } from '@/lib/supabase';
import { portraitSvg, sceneSvg, type AvatarSpec } from './art';
import type { CompanionCard as Card, CompanionPhoto } from './api';

/** Portrait: admin-uploaded photo if one exists, otherwise the character's original illustration. */
export const Portrait = memo(function Portrait({ avatar, path, size, radius }: { avatar: AvatarSpec; path?: string | null; size: number; radius?: number }) {
  const xml = useMemo(() => portraitSvg(avatar), [avatar]);
  const url = photoUrl(path);
  const r = radius ?? size / 2;
  return (
    <View style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', backgroundColor: avatar.bg?.[1] ?? colors.primarySoft }}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <SvgXml xml={xml} width={size} height={size} />}
    </View>
  );
});

/** Lifestyle picture: scene + emoji + caption + the same character in the corner (consistent look). */
export const ScenePicture = memo(function ScenePicture({ photo, avatar, width, height }: { photo: CompanionPhoto | { scene: string; emoji: string; bg: string[]; caption?: string }; avatar: AvatarSpec; width: number; height: number }) {
  const xml = useMemo(() => sceneSvg({ scene: photo.scene, emoji: photo.emoji, bg: photo.bg, caption: {} }), [photo.scene, photo.emoji, photo.bg]);
  return (
    <View style={{ width, height, borderRadius: 22, overflow: 'hidden' }}>
      <SvgXml xml={xml} width={width} height={height} preserveAspectRatio="xMidYMid slice" />
      <Text style={[sp.emoji, { fontSize: Math.min(width, height) * 0.32 }]}>{photo.emoji}</Text>
      <View style={sp.me}><Portrait avatar={avatar} size={Math.round(Math.min(width, height) * 0.22)} /></View>
      {!!photo.caption && <View style={sp.cap}><Text style={sp.capText} numberOfLines={1}>{photo.caption}</Text></View>}
    </View>
  );
});
const sp = StyleSheet.create({
  emoji: { position: 'absolute', alignSelf: 'center', top: '26%' },
  me: { position: 'absolute', right: 12, bottom: 12, borderRadius: 999, borderWidth: 3, borderColor: colors.white },
  cap: { position: 'absolute', left: 12, bottom: 14, maxWidth: '62%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)' },
  capText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
});

/** Small, discreet but explicit AI indicator. */
export function AiBadge({ full, dark }: { full?: boolean; dark?: boolean }) {
  return (
    <View style={[ab.pill, dark && { backgroundColor: colors.text }]} accessibilityLabel={t('ai.companion')}>
      <Ionicons name="sparkles" size={10} color={dark ? colors.primary : colors.accent} />
      <Text style={[ab.text, dark && { color: colors.white }]}>{full ? t('ai.companion') : t('ai.badge')}</Text>
    </View>
  );
}
const ab = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 10, backgroundColor: colors.accentSoft, alignSelf: 'flex-start' },
  text: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.accent, letterSpacing: 0.2 },
});

/** Discover card — same footprint as a person card, but no distance / availability (companions have none). */
export function CompanionTile({ c, width, onPress }: { c: Card; width: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ct.card, { width }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={`${c.name}, ${t('ai.companion')}`}>
      <Portrait avatar={c.avatar} path={c.portrait_path} size={width} radius={0} />
      <View style={ct.body}>
        <View style={ct.row}><Text style={ct.name} numberOfLines={1}>{c.name}, {c.age}</Text><AiBadge /></View>
        <Text style={ct.job} numberOfLines={1}>{c.occupation}</Text>
        <Text style={ct.tag} numberOfLines={2}>{c.tagline}</Text>
      </View>
    </Pressable>
  );
}
const ct = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  body: { padding: 10, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'space-between' },
  name: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  job: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  tag: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
});

function Dot({ i }: { i: number }) {
  const v = useSharedValue(0.3);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { v.set(0.7); return; }
    v.set(withDelay(i * 160, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.3, { duration: 320 })), -1)));
  }, [i, reduce, v]);
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 3 }] }));
  return <Animated.View style={[td.dot, st]} />;
}
/** Shown only while the server is actually generating the reply. */
export function TypingBubble({ name }: { name: string }) {
  return (
    <View style={td.wrap} accessibilityLiveRegion="polite" accessibilityLabel={t('ai.typing', { name })}>
      <View style={td.bubble}><Dot i={0} /><Dot i={1} /><Dot i={2} /></View>
      <Text style={td.label}>{t('ai.typing', { name })}</Text>
    </View>
  );
}
const td = StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: 3 },
  bubble: { flexDirection: 'row', gap: 5, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 18, borderBottomLeftRadius: 6, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginLeft: 6 },
});

/** Mandatory disclosure before the first conversation. */
export function DisclosureSheet({ visible, name, avatar, path, onClose, onAccept }: { visible: boolean; name: string; avatar: AvatarSpec; path?: string | null; onClose: () => void; onAccept: (memory: boolean) => Promise<void> }) {
  const [memory, setMemory] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={ds.wrap}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Portrait avatar={avatar} path={path} size={76} />
          <AiBadge full />
          <Text style={ds.title}>{t('ai.discloseTitle', { name })}</Text>
        </View>
        {[['person-outline', 'ai.disclose1'], ['chatbubble-ellipses-outline', 'ai.disclose2'], ['shield-checkmark-outline', 'ai.disclose3']].map(([icon, k]) => (
          <View key={k} style={ds.row}><Ionicons name={icon as 'person-outline'} size={20} color={colors.accent} /><Text style={ds.text}>{t(k as 'ai.disclose1', { name })}</Text></View>
        ))}
        <View style={ds.mem}>
          <View style={{ flex: 1 }}><Text style={ds.memT}>{t('ai.memory', { name })}</Text><Text style={ds.memS}>{t('ai.memorySub')}</Text></View>
          <Switch value={memory} onValueChange={setMemory} trackColor={{ true: colors.primaryDeep, false: colors.border }} thumbColor={colors.white} accessibilityLabel={t('ai.memory', { name })} />
        </View>
        <GradientButton label={t('ai.start')} loading={busy} onPress={async () => { setBusy(true); try { await onAccept(memory); } finally { setBusy(false); } }} />
      </View>
    </BottomSheet>
  );
}
const ds = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 6 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text, lineHeight: 20 },
  mem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.bg },
  memT: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  memS: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
