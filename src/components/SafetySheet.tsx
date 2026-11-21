import { useState } from 'react';
import { View } from 'react-native';
import { REPORT_REASONS } from '@/constants/content';
import { colors, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { report } from '@/services/api';
import { BottomSheet, useToast } from './Overlay';
import { CategoryChip, GradientButton, T, TextField } from './ui';

export type ReportTarget = { type: 'user' | 'post' | 'comment' | 'message'; number?: number; targetId?: string };

/** Report flow shared by posts, comments, messages and profiles. Always free, always available. */
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setReason(null); setDetails(''); onClose(); };
  const submit = async () => {
    if (!target || !reason) return;
    setBusy(true);
    try {
      await report({ ...target, reason, details: details.trim() || undefined });
      toast('Thank you. Our safety team will review this.', 'success');
      close();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally { setBusy(false); }
  };
  return (
    <BottomSheet visible={!!target} onClose={close} title={`Report ${target?.type ?? ''}`}>
      <T color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
        Reports are anonymous. The person will not know who reported them.
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
        {REPORT_REASONS.map((r) => <CategoryChip key={r.key} label={r.label} selected={reason === r.key} onPress={() => setReason(r.key)} />)}
      </View>
      <TextField placeholder="Add details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
      <GradientButton label="Send report" disabled={!reason} loading={busy} onPress={submit} style={{ marginTop: spacing.lg }} />
    </BottomSheet>
  );
}
