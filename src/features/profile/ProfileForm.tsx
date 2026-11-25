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

const GENDERS = [{ key: 'woman', label: 'Woman' }, { key: 'man', label: 'Man' }, { key: 'nonbinary', label: 'Non-binary' }, { key: 'other', label: 'Other' }];
const SEEKING = [{ key: 'woman', label: 'Women' }, { key: 'man', label: 'Men' }, { key: 'nonbinary', label: 'Non-binary people' }, { key: 'other', label: 'Everyone else' }];
export const LOOKING_FOR = [{ key: 'friendship', label: 'Friendship' }, { key: 'conversation', label: 'Conversation' }, { key: 'relationship', label: 'Relationship' }] as const;

/** YYYY-MM-DD from three fields, or an error message. */
export function parseBirthDate(d: string, m: string, y: string): { value?: string; error?: string } {
  const dd = Number(d); const mm = Number(m); const yy = Number(y);
  if (!d && !m && !y) return {};
  if (!dd || !mm || !yy || y.length !== 4) return { error: 'Enter your full date of birth.' };
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCDate() !== dd || dt.getUTCMonth() !== mm - 1) return { error: 'This date does not exist.' };
  const now = new Date();
  const age = now.getUTCFullYear() - yy - (now.getUTCMonth() < mm - 1 || (now.getUTCMonth() === mm - 1 && now.getUTCDate() < dd) ? 1 : 0);
  if (age < 18) return { error: 'THE UNKNOWN is for adults 18 and over.' };
  if (age > 100) return { error: 'Please check the year.' };
  return { value: `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}` };
}

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

/** Edit Profile. Everything except an 18+ date of birth is optional. */
export function ProfileForm({ profile, submitLabel, onSaved, showPrivacy }: {
  profile: Profile | null; submitLabel: string; onSaved: () => void; showPrivacy?: boolean;
}) {
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? '');
  const bd = profile?.birth_date?.split('-') ?? [];
  const [dob, setDob] = useState({ d: bd[2] ?? '', m: bd[1] ?? '', y: bd[0] ?? '' });
  const [seeking, setSeeking] = useState<string[]>(profile?.interested_in ?? []);
  const [lookingFor, setLookingFor] = useState<string | null>(profile?.looking_for ?? null);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [showAge, setShowAge] = useState(profile?.show_age ?? true);
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
    const birth = parseBirthDate(dob.d, dob.m, dob.y);
    if (birth.error) { toast(birth.error, 'error'); return; }
    if (name.trim() && name.trim().length > 30) { toast('Your name can be 30 characters at most.', 'error'); return; }
    setBusy(true);
    try {
      const patch: ProfileUpdate = {
        display_name: name.trim() || null, birth_date: birth.value ?? profile?.birth_date ?? null, show_age: showAge,
        interested_in: seeking, looking_for: lookingFor as ProfileUpdate['looking_for'], bio: bio.trim() || null,
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
        <Section title="Your name" hint="Optional — leave it empty to stay anonymous as UNKNOWN #number.">
          <TextField value={name} onChangeText={setName} maxLength={30} placeholder="First name or nickname" />
        </Section>

        <Section title="Date of birth" hint="THE UNKNOWN is for adults 18+. Only your age is shown, never the date.">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><TextField value={dob.d} onChangeText={(t) => setDob((x) => ({ ...x, d: t.replace(/\D/g, '').slice(0, 2) }))} placeholder="DD" keyboardType="number-pad" accessibilityLabel="Day" /></View>
            <View style={{ flex: 1 }}><TextField value={dob.m} onChangeText={(t) => setDob((x) => ({ ...x, m: t.replace(/\D/g, '').slice(0, 2) }))} placeholder="MM" keyboardType="number-pad" accessibilityLabel="Month" /></View>
            <View style={{ flex: 1.4 }}><TextField value={dob.y} onChangeText={(t) => setDob((x) => ({ ...x, y: t.replace(/\D/g, '').slice(0, 4) }))} placeholder="YYYY" keyboardType="number-pad" accessibilityLabel="Year" /></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T style={{ flex: 1 }}>Show my age</T>
            <Switch value={showAge} onValueChange={setShowAge} trackColor={{ true: colors.primary, false: colors.elevated }} thumbColor={colors.white} />
          </View>
        </Section>

        <Section title="I am">
          <Chips items={GENDERS} value={gender ? [gender] : []} onChange={(v) => setGender(v.filter((x) => x !== gender)[0] ?? null)} />
        </Section>

        <Section title="Show me" hint="Who you want to discover in Nearby and Matches.">
          <Chips items={SEEKING} value={seeking} onChange={setSeeking} />
        </Section>

        <Section title="Looking for">
          <Chips items={[...LOOKING_FOR]} value={lookingFor ? [lookingFor] : []} onChange={(v) => setLookingFor(v.filter((x) => x !== lookingFor)[0] ?? null)} />
        </Section>

        <Section title="About me" hint="Optional. Up to 500 characters.">
          <TextField value={bio} onChangeText={setBio} maxLength={500} multiline placeholder="What makes you, you?" />
        </Section>

        <Section title="Interests" hint="Shared interests help people find you.">
          <Chips items={INTERESTS.map((i) => ({ key: i.slug, label: i.label }))} value={interests} onChange={setInterests} />
        </Section>

        <CountryField value={country} onChange={setCountry} label="Country (optional)" />

        <Section title="Languages you speak" hint="Optional.">
          <Chips items={LANGUAGES.map((l) => ({ key: l.code, label: l.label }))} value={languages} onChange={setLanguages} />
        </Section>

        <Section title="How you like to talk">
          <Chips items={CONVERSATION_PREFS} value={prefs} onChange={setPrefs} />
        </Section>

        <Section title="What you want to discover">
          <Chips items={POST_TYPES.map((p) => ({ key: p.key, label: p.label }))} value={topics} onChange={setTopics} />
        </Section>

        <Section title="Personality" hint="Up to 4.">
          <Chips items={PERSONALITY_TAGS.map((t) => ({ key: t, label: t }))} value={tags} onChange={setTags} max={4} />
        </Section>

        <Section title="Headline" hint="Optional. One line shown under your name.">
          <TextField value={tagline} onChangeText={setTagline} maxLength={80} placeholder="Dreams of travelling the world" />
        </Section>

        {showPrivacy && (
          <Section title="Visibility">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T style={{ flex: 1 }}>Show my country</T>
              <Switch value={showCountry} onValueChange={setShowCountry} trackColor={{ true: colors.primary, false: colors.elevated }} thumbColor={colors.white} />
            </View>
          </Section>
        )}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: 'rgba(248,250,252,0.96)', borderTopWidth: 1, borderTopColor: colors.hairline }}>
        <GradientButton label={submitLabel} loading={busy} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}
