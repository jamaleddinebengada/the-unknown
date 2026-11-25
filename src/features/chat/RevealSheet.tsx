import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';
import { MaskAvatar } from '@/components/PersonAvatar';
import { BottomSheet, useToast } from '@/components/Overlay';
import { GradientButton, PremiumButton, T, TextField } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { usePersonMeta } from '@/hooks/usePersonMeta';
import { friendlyError } from '@/lib/supabase';
import { getRevealedIdentity, setRevealConsent } from '@/services/api';
import { getMyIdentity, saveMyIdentity } from '@/services/identity';
import { invalidateMeta } from '@/services/photos';
import type { ConversationDetail } from '@/types/models';
import { haptic, unknownName } from '@/utils/format';

type Revealed = Awaited<ReturnType<typeof getRevealedIdentity>>;

/** Blur-to-clear portrait: only rendered after mutual consent (the photo URL is only issued then). */
function RevealPortrait({ number, seed, size }: { number: number; seed: string; size: number }) {
  const meta = usePersonMeta(number || null);
  const photo = meta?.photoUrl;
  const blur = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => { if (photo) blur.set(reduce ? 0 : withDelay(350, withTiming(0, { duration: 1800, easing: Easing.out(Easing.cubic) }))); }, [photo, reduce, blur]);
  const veil = useAnimatedStyle(() => ({ opacity: blur.value }));
  const zoom = useAnimatedStyle(() => ({ transform: [{ scale: 1.08 - (1 - blur.value) * 0.08 }] }));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: 4, borderColor: colors.primary, backgroundColor: colors.cream }}>
      {photo ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, zoom]}><Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Revealed photo" /></Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, veil]}><Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} /></Animated.View>
        </>
      ) : <MaskAvatar seed={seed} size={size - 8} />}
    </View>
  );
}

/** Mutual-consent identity reveal. Each person chooses exactly what to share. */
export function RevealSheet({ conv, visible, onClose, onChanged }: { conv: ConversationDetail; visible: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [social, setSocial] = useState('');
  const [about, setAbout] = useState('');
  const [shareName, setShareName] = useState(true);
  const [shareSocial, setShareSocial] = useState(false);
  const [shareAbout, setShareAbout] = useState(false);
  const [sharePhoto, setSharePhoto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const mutual = conv.my_reveal_consent && conv.other_reveal_consent;
  const minutes = Math.max(1, Math.round((Date.now() - new Date(conv.created_at).getTime()) / 60000));

  useEffect(() => {
    if (!visible) return;
    getMyIdentity().then((i) => { setName(i?.display_name ?? ''); setSocial(i?.social_handle ?? ''); setAbout(i?.about ?? ''); }).catch(() => {});
    if (mutual) { if (conv.other_number) invalidateMeta(conv.other_number); getRevealedIdentity(conv.conversation_id).then(setRevealed).catch(() => {}); }
  }, [visible, mutual, conv.conversation_id, conv.other_number]);

  const consent = async (yes: boolean) => {
    setBusy(true);
    try {
      if (yes) await saveMyIdentity({ display_name: name.trim() || null, social_handle: social.trim() || null, about: about.trim() || null });
      const fields = [shareName && 'display_name', sharePhoto && 'photo', shareSocial && 'social', shareAbout && 'about'].filter(Boolean) as string[];
      await setRevealConsent(conv.conversation_id, yes, fields);
      haptic.success();
      toast(yes ? (conv.other_reveal_consent ? 'Revealed. Say hello properly.' : 'Ready. They’ll be asked too — nothing is shown until both agree.') : 'Reveal withdrawn.', 'success');
      if (conv.other_number) invalidateMeta(conv.other_number);
      onChanged();
      if (!yes || !conv.other_reveal_consent) onClose();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {mutual ? (
        <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
          <Animated.View entering={ZoomIn.springify().damping(10)}><RevealPortrait number={conv.other_number ?? 0} seed={conv.other_avatar_seed ?? 'x'} size={150} /></Animated.View>
          <T v="overline" color={colors.coral}>{unknownName(conv.other_number)} IS</T>
          <T v="screenTitle" style={{ textAlign: 'center' }}>{revealed?.display_name ?? 'Someone who kept their name'}</T>
          {revealed?.social_handle && <T color={colors.coral} style={{ fontFamily: fonts.semibold }}>{revealed.social_handle}</T>}
          {revealed?.about && <T color={colors.textSecondary} style={{ textAlign: 'center' }}>{revealed.about}</T>}
          <PremiumButton tone="ghost" small label="Close" onPress={onClose} />
        </Animated.View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, overflow: 'hidden', borderWidth: 3, borderColor: colors.primary }}>
              <MaskAvatar seed={conv.other_avatar_seed ?? 'x'} size={90} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(248,250,252,0.55)', alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="lock-closed" size={26} color={colors.text} /></View>
            </View>
            <T v="section" style={{ textAlign: 'center' }}>Are you ready to discover who they are?</T>
            <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
              You have shared {conv.message_count} messages over {minutes < 60 ? `${minutes} minutes` : `${Math.round(minutes / 60)} hours`}.
              {conv.other_reveal_consent ? ' They are ready to reveal.' : ''}
            </T>
          </View>
          <T v="caption" color={colors.textMuted}>Choose what you reveal. Nothing is shown until both of you agree, and you can withdraw before they accept.</T>
          <TextField label="Name to reveal" value={name} onChangeText={setName} maxLength={60} placeholder="Your first name" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><T style={{ flex: 1 }}>Share my name</T><Switch value={shareName} onValueChange={setShareName} trackColor={{ true: colors.primaryDeep, false: colors.elevated }} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><T>Share my photos</T><T v="caption" color={colors.textMuted}>Unless your photo privacy is set to “Nobody”</T></View>
            <Switch value={sharePhoto} onValueChange={setSharePhoto} trackColor={{ true: colors.primaryDeep, false: colors.elevated }} />
          </View>
          <TextField label="Social profile (optional)" value={social} onChangeText={setSocial} maxLength={80} autoCapitalize="none" placeholder="@handle" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><T style={{ flex: 1 }}>Share my social profile</T><Switch value={shareSocial} onValueChange={setShareSocial} trackColor={{ true: colors.primaryDeep, false: colors.elevated }} /></View>
          <TextField label="A few words about you (optional)" value={about} onChangeText={setAbout} maxLength={300} multiline />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><T style={{ flex: 1 }}>Share this note</T><Switch value={shareAbout} onValueChange={setShareAbout} trackColor={{ true: colors.primaryDeep, false: colors.elevated }} /></View>
          {conv.my_reveal_consent ? (
            <PremiumButton tone="ghost" label="Withdraw my reveal" loading={busy} onPress={() => consent(false)} />
          ) : (
            <GradientButton label="REVEAL IDENTITY" icon="sparkles" loading={busy} onPress={() => consent(true)} />
          )}
        </View>
      )}
    </BottomSheet>
  );
}
