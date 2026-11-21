import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { CountryField } from '@/components/CountryPicker';
import { useToast } from '@/components/Overlay';
import { CategoryChip, GradientButton, T, TextField } from '@/components/ui';
import { CONVERSATION_PREFS, INTERESTS, LANGUAGES, PERSONALITY_TAGS, POST_TYPES } from '@/constants/content';
import { colors, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { updateMyProfile, type ProfileUpdate } from '@/services/api';
import type { Profile } from '@/types/models';

const GENDERS = [{ key: 'woman', label: 'Woman' }, { key: 'man', label: 'Man' }, { key: 'nonbinary', label: 'Non-binary' }, { key: 'other', label: 'Prefer to self-describe' }];

const toggle = (arr: string[], v: string, max = 99) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.length >= max ? arr : [...arr, v]);

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T v="cardTitle">{title}</T>
        {hint && <T v="caption" color={colors.textMuted}>{hint}</T>}
      </View>
      {children}
    </View>
  );
}

function Chips({ items, value, onChange, max }: { items: { key: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((i) => <CategoryChip key={i.key} label={i.label} selected={value.includes(i.key)} onPress={() => onChange(toggle(value, i.key, max))} />)}
    </View>
  );
}

/** Edit Profile. Everything is optional — no personal information is ever required. */
export function ProfileForm({ profile, submitLabel, onSaved, showPrivacy }: {
  profile: Profile | null; submitLabel: string; onSaved: () => void; showPrivacy?: boolean;
}) {
  const toast = useToast();
  const [country, setCountry] = useState<string | null>(profile?.country_code ?? null);
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [gender, setGender] = useState<string | null>(profile?.gender ?? null);
  const [languages, setLanguages] = useState<string[]>(profile?.languages?.length ? profile.languages : []);
  const [prefs, setPrefs] = useState<string[]>(profile?.conversation_prefs ?? []);
  const [topics, setTopics] = useState<string[]>(profile?.discover_topics ?? []);
  const [tags, setTags] = useState<string[]>(profile?.personality_tags ?? []);
  const [tagline, setTagline] = useState(profile?.tagline ?? '');
  const [showCountry, setShowCountry] = useState(profile?.show_country ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const patch: ProfileUpdate = {
        country_code: country, gender, languages, interests, conversation_prefs: prefs,
        discover_topics: topics, personality_tags: tags, tagline: tagline.trim() || null, show_country: showCountry,
      };
      await updateMyProfile(patch);
      onSaved();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Section title="Interests" hint="Shape your feed and your Mystery Matches.">
          <Chips items={INTERESTS.map((i) => ({ key: i.slug, label: i.label }))} value={interests} onChange={setInterests} />
        </Section>

        <CountryField value={country} onChange={setCountry} label="Country (optional)" />

        <Section title="Gender" hint="Optional.">
          <Chips items={GENDERS} value={gender ? [gender] : []} onChange={(v) => setGender(v.filter((x) => x !== gender)[0] ?? null)} />
        </Section>

        <Section title="Languages you speak" hint="Optional.">
          <Chips items={LANGUAGES.map((l) => ({ key: l.code, label: l.label }))} value={languages} onChange={setLanguages} />
        </Section>

        <Section title="How you like to talk">
          <Chips items={CONVERSATION_PREFS} value={prefs} onChange={setPrefs} />
        </Section>

        <Section title="What you want to discover">
          <Chips items={POST_TYPES.map((p) => ({ key: p.key, label: p.label }))} value={topics} onChange={setTopics} />
        </Section>

        <Section title="Personality" hint="Up to 4 — shown on your mystery profile.">
          <Chips items={PERSONALITY_TAGS.map((t) => ({ key: t, label: t }))} value={tags} onChange={setTags} max={4} />
        </Section>

        <Section title="One line about you" hint="Optional. Shown on your Mystery Match card.">
          <TextField value={tagline} onChangeText={setTagline} maxLength={80} placeholder="Dreams of travelling the world" />
        </Section>

        {showPrivacy && (
          <Section title="Visibility">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T style={{ flex: 1 }}>Show my country</T>
              <Switch value={showCountry} onValueChange={setShowCountry} trackColor={{ true: colors.violet, false: colors.elevated }} />
            </View>
          </Section>
        )}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: 'rgba(9,11,20,0.94)' }}>
        <GradientButton label={submitLabel} loading={busy} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}
