import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Atmosphere } from '@/components/Atmosphere';
import { CountrySheet } from '@/components/CountryPicker';
import { PortalMark } from '@/components/Logo';
import { BottomSheet, useToast } from '@/components/Overlay';
import { Screen } from '@/components/Screen';
import { CategoryChip, GradientButton, IconButton, PremiumButton, Pressy, T } from '@/components/ui';
import { useVoiceRecorder, VoicePlayer } from '@/components/VoiceNote';
import { AUDIENCES, INTERESTS, POST_TYPES } from '@/constants/content';
import { flagOf } from '@/constants/countries';
import { colors, fonts, radius, spacing, typeAccent } from '@/constants/theme';
import { GlassCard, ScreenTitle } from '@/components/Effects';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { aiAssist, createPost, getPost, updatePost, uploadPostMedia, type AiAction } from '@/services/api';
import type { Audience, PostType } from '@/types/models';
import { haptic } from '@/utils/format';

const AI_ACTIONS: { key: AiAction; label: string }[] = [
  { key: 'improve', label: 'Improve my post' },
  { key: 'interesting', label: 'Make it more interesting' },
  { key: 'question', label: 'Turn into a question' },
  { key: 'clearer', label: 'Make it clearer' },
  { key: 'title', label: 'Suggest a title' },
];
const MAX = 2000;

export default function CreatePost() {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuth();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [type, setType] = useState<PostType>('thought');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>('everyone');
  const [countries, setCountries] = useState<string[]>([]);
  const [countrySheet, setCountrySheet] = useState(false);
  const [image, setImage] = useState<{ uri: string; mime: string } | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [ai, setAi] = useState<{ action: AiAction; result?: string; loading: boolean } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!edit);
  const rec = useVoiceRecorder();
  const meta = POST_TYPES.find((p) => p.key === type)!;

  useEffect(() => {
    if (!edit) return;
    getPost(edit).then((p) => {
      if (!p || !p.is_mine) { toast('You can only edit your own posts.', 'error'); router.back(); return; }
      setType(p.type); setContent(p.content); setCategory(p.category); setAudience(p.audience);
    }).catch((e) => toast(friendlyError(e), 'error')).finally(() => setLoadingEdit(false));
  }, [edit, router, toast]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
    if (!res.canceled && res.assets[0]) setImage({ uri: res.assets[0].uri, mime: res.assets[0].mimeType ?? 'image/jpeg' });
  };

  const toggleRecord = async () => {
    try {
      if (rec.isRecording) { const uri = await rec.stop(); if (uri) setVoice(uri); }
      else { setVoice(null); await rec.start(); haptic.soft(); }
    } catch (e) { toast(friendlyError(e), 'error'); }
  };

  const runAi = async (action: AiAction) => {
    if (!content.trim()) return toast('Write a few words first — AI only helps polish your own ideas.');
    setAi({ action, loading: true });
    try {
      const result = await aiAssist(action, content, { type });
      setAi({ action, result, loading: false });
    } catch (e) { setAi(null); toast(friendlyError(e), 'error'); }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      if (edit) {
        await updatePost(edit, { content: content.trim(), category, audience, audience_countries: audience === 'countries' ? countries : [] });
        toast('Post updated.', 'success');
        router.back();
        return;
      }
      const image_path = image ? await uploadPostMedia(image.uri, 'image', image.mime) : null;
      const voice_path = voice ? await uploadPostMedia(voice, 'voice', 'audio/m4a') : null;
      await createPost({
        type, content: content.trim(), category, audience, audience_countries: audience === 'countries' ? countries : [],
        image_path, voice_path, language: profile?.languages?.[0] ?? null,
      });
      haptic.success();
      setPublished(true);
      setTimeout(() => router.back(), 2300);
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setPublishing(false); }
  };

  const canPublish = content.trim().length > 0 && content.length <= MAX && (audience !== 'countries' || countries.length > 0) && !rec.isRecording;

  if (published) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xl }}>
        <Atmosphere stars={60} />
        <Animated.View entering={ZoomIn.springify().damping(12)}><PortalMark size={140} /></Animated.View>
        <Animated.View entering={FadeInDown.delay(300).springify()} style={{ gap: 8 }}>
          <T v="section" style={{ textAlign: 'center' }}>Your post is now out there.</T>
          <T color={colors.textSecondary} style={{ textAlign: 'center' }}>Someone may be waiting to discover it.</T>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.header}>
        <IconButton label="Close" name="close" onPress={() => router.back()} />
        <T v="cardTitle" style={{ flex: 1, textAlign: 'center' }}>{edit ? 'Edit post' : 'New post'}</T>
        <GradientButton small label={edit ? 'Save' : 'Publish'} disabled={!canPublish} loading={publishing} onPress={publish} />
      </View>
      {loadingEdit ? <ActivityIndicator color={colors.violet} style={{ marginTop: 60 }} /> : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeIn} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <ScreenTitle overline={edit ? 'EDIT' : 'SHARE ANONYMOUSLY'} title="What is on your mind?" />
            </Animated.View>

            {!edit && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, padding: spacing.lg, paddingBottom: spacing.sm }}>
                {POST_TYPES.map((p) => {
                  const on = p.key === type;
                  return (
                    <Pressy key={p.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { haptic.tap(); setType(p.key as PostType); }}
                      style={[s.type, on && s.typeOn, on && { borderColor: typeAccent[p.key][1], shadowColor: typeAccent[p.key][0] }]}>
                      {on && <LinearGradient colors={[typeAccent[p.key][0], `${typeAccent[p.key][1]}AA`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />}
                      <Ionicons name={p.icon} size={20} color={on ? colors.text : typeAccent[p.key][0]} />
                      <T v="caption" color={on ? colors.text : colors.textSecondary} style={{ fontFamily: fonts.semibold }}>{p.action}</T>
                    </Pressy>
                  );
                })}
              </ScrollView>
            )}

            <GlassCard accent={typeAccent[type]} glow style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm }} padding={spacing.md}>
            <View style={{ gap: spacing.sm }}>
              <TextInput value={content} onChangeText={setContent} placeholder={meta.placeholder} placeholderTextColor={colors.textMuted}
                multiline autoFocus={!edit} maxLength={MAX + 50} selectionColor={colors.violet} style={s.input} accessibilityLabel="Post text" />
              {image && (
                <View>
                  <Image source={{ uri: image.uri }} style={s.preview} contentFit="cover" />
                  <IconButton label="Remove image" name="close" size={16} onPress={() => setImage(null)} style={{ position: 'absolute', top: 8, right: 8 }} />
                </View>
              )}
              {voice && !rec.isRecording && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <VoicePlayer uri={voice} seed="draft" />
                  <IconButton label="Remove voice note" name="trash-outline" size={16} onPress={() => setVoice(null)} />
                </View>
              )}
              <View style={s.toolbar}>
                {!edit && <IconButton label="Add image" name="image-outline" onPress={pickImage} />}
                {!edit && <IconButton label={rec.isRecording ? 'Stop recording' : 'Record voice'} name={rec.isRecording ? 'stop-circle' : 'mic-outline'}
                  color={rec.isRecording ? colors.danger : colors.text} onPress={toggleRecord} />}
                {rec.isRecording && <T v="caption" color={colors.danger}>Recording · {rec.seconds}s</T>}
                <View style={{ flex: 1 }} />
                <T v="caption" color={content.length > MAX ? colors.danger : colors.textMuted}>{content.length}/{MAX}</T>
              </View>
            </View>
            </GlassCard>

            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={14} color={colors.cyan} />
                <T v="overline" color={colors.cyan}>AI ASSIST · OPTIONAL</T>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {AI_ACTIONS.map((a) => <CategoryChip key={a.key} label={a.label} onPress={() => runAi(a.key)} />)}
              </ScrollView>
            </View>

            <View style={s.section}>
              <T v="overline" color={colors.textMuted}>TOPIC</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {INTERESTS.map((i) => (
                  <CategoryChip key={i.slug} label={i.label} icon={i.icon} selected={category === i.slug}
                    onPress={() => setCategory(category === i.slug ? null : i.slug)} />
                ))}
              </View>
            </View>

            <View style={s.section}>
              <T v="overline" color={colors.textMuted}>WHO CAN DISCOVER IT</T>
              {AUDIENCES.map((a) => {
                const on = audience === a.key;
                return (
                  <Pressy key={a.key} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    onPress={() => { setAudience(a.key as Audience); if (a.key === 'countries') setCountrySheet(true); }} style={[s.audience, on && s.audienceOn]}>
                    <Ionicons name={a.icon} size={18} color={on ? colors.violetSoft : colors.textSecondary} />
                    <T style={{ flex: 1 }}>{a.label}
                      {a.key === 'countries' && countries.length > 0 ? `  ${countries.map(flagOf).join(' ')}` : ''}
                    </T>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.violet : colors.textMuted} />
                  </Pressy>
                );
              })}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="eye-off-outline" size={14} color={colors.textMuted} />
                <T v="caption" color={colors.textMuted}>Always anonymous — you appear as UNKNOWN #{profile?.unknown_number}.</T>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <CountrySheet visible={countrySheet} onClose={() => setCountrySheet(false)} selected={countries} title="Choose countries"
        onPick={(c) => setCountries((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c].slice(0, 10)))} />

      <BottomSheet visible={!!ai} onClose={() => setAi(null)} title={AI_ACTIONS.find((a) => a.key === ai?.action)?.label}>
        {ai?.loading ? (
          <View style={{ alignItems: 'center', padding: spacing.xl, gap: 12 }}>
            <ActivityIndicator color={colors.cyan} />
            <T v="caption" color={colors.textSecondary}>Thinking with you…</T>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={s.aiBox}><T>{ai?.result}</T></View>
            <T v="caption" color={colors.textMuted}>Nothing is published until you tap Publish.</T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PremiumButton tone="ghost" label="Keep mine" style={{ flex: 1 }} onPress={() => setAi(null)} />
              <GradientButton label={ai?.action === 'title' ? 'Add as title' : 'Use this'} style={{ flex: 1 }} onPress={() => {
                if (!ai?.result) return;
                setContent(ai.action === 'title' ? `${ai.result}\n\n${content}` : ai.result);
                setAi(null);
              }} />
            </View>
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  type: { width: 112, height: 84, padding: 12, borderRadius: radius.md, overflow: 'hidden', backgroundColor: 'rgba(22,27,43,0.85)', borderWidth: 1, borderColor: colors.hairline, justifyContent: 'space-between' },
  typeOn: { shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  input: { minHeight: 150, color: colors.text, fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, textAlignVertical: 'top', outlineStyle: 'none' } as object,
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline },
  audienceOn: { borderColor: colors.violet },
  aiBox: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(103,232,249,0.3)' },
});
