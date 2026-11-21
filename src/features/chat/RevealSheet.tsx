import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { BottomSheet, useToast } from '@/components/Overlay';
import { GradientButton, PremiumButton, T, TextField } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { getRevealedIdentity, setRevealConsent } from '@/services/api';
import { getMyIdentity, saveMyIdentity } from '@/services/identity';
import type { ConversationDetail } from '@/types/models';
import { haptic, unknownName } from '@/utils/format';

type Revealed = Awaited<ReturnType<typeof getRevealedIdentity>>;

/** Mutual-consent identity reveal. Each person chooses exactly what to share. */
export function RevealSheet({ conv, visible, onClose, onChanged }: { conv: ConversationDetail; visible: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [social, setSocial] = useState('');
  const [about, setAbout] = useState('');
  const [shareName, setShareName] = useState(true);
  const [shareSocial, setShareSocial] = useState(false);
  const [shareAbout, setShareAbout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const mutual = conv.my_reveal_consent && conv.other_reveal_consent;
  const minutes = Math.max(1, Math.round((Date.now() - new Date(conv.created_at).getTime()) / 60000));

  useEffect(() => {
    if (!visible) return;
    getMyIdentity().then((i) => { setName(i?.display_name ?? ''); setSocial(i?.social_handle ?? ''); setAbout(i?.about ?? ''); }).catch(() => {});
    if (mutual) getRevealedIdentity(conv.conversation_id).then(setRevealed).catch(() => {});
  }, [visible, mutual, conv.conversation_id]);

  const consent = async (yes: boolean) => {
    setBusy(true);
    try {
      if (yes) await saveMyIdentity({ display_name: name.trim() || null, social_handle: social.trim() || null, about: about.trim() || null });
      const fields = [shareName && 'display_name', shareSocial && 'social', shareAbout && 'about'].filter(Boolean) as string[];
      await setRevealConsent(conv.conversation_id, yes, fields);
      haptic.success();
      toast(yes ? (conv.other_reveal_consent ? 'Revealed. Say hello properly.' : 'Ready. They’ll be asked too — nothing is shown until both agree.') : 'Reveal withdrawn.', 'success');
      onChanged();
      if (!yes || !conv.other_reveal_consent) onClose();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {mutual ? (
        <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
          <Animated.View entering={ZoomIn.springify().damping(10)}><AnonymousAvatar seed={conv.other_avatar_seed ?? 'x'} size={96} revealed /></Animated.View>
          <T v="overline" color={colors.violetSoft}>{unknownName(conv.other_number)} IS</T>
          <T v="screenTitle" style={{ textAlign: 'center' }}>{revealed?.display_name ?? 'Someone who kept their name'}</T>
          {revealed?.social_handle && <T color={colors.cyan}>{revealed.social_handle}</T>}
          {revealed?.about && <T color={colors.textSecondary} style={{ textAlign: 'center' }}>{revealed.about}</T>}
          <PremiumButton tone="ghost" small label="Close" onPress={onClose} />
        </Animated.View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Ionicons name="eye-outline" size={30} color={colors.violetSoft} />
            <T v="section" style={{ textAlign: 'center' }}>Are you ready to discover who they are?</T>
            <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
              You have shared {conv.message_count} messages over {minutes < 60 ? `${minutes} minutes` : `${Math.round(minutes / 60)} hours`}.
              {conv.other_reveal_consent ? ' They are ready to reveal.' : ''}
            </T>
          </View>
          <T v="caption" color={colors.textMuted}>Choose what you reveal. Nothing is shown until both of you agree, and you can withdraw before they accept.</T>
          <TextField label="Name to reveal" value={name} onChangeText={setName} maxLength={60} placeholder="Your first name" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><T style={{ flex: 1 }}>Share my name</T><Switch value={shareName} onValueChange={setShareName} trackColor={{ true: colors.violet, false: colors.elevated }} /></View>
          <TextField label="Social profile (optional)" value={social} onChangeText={setSocial} maxLength={80} autoCapitalize="none" placeholder="@handle" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><T style={{ flex: 1 }}>Share my social profile</T><Switch value={shareSocial} onValueChange={setShareSocial} trackColor={{ true: colors.violet, false: colors.elevated }} /></View>
          <TextField label="A few words about you (optional)" value={about} onChangeText={setAbout} maxLength={300} multiline />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><T style={{ flex: 1 }}>Share this note</T><Switch value={shareAbout} onValueChange={setShareAbout} trackColor={{ true: colors.violet, false: colors.elevated }} /></View>
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
