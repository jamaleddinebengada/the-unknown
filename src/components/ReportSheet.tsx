import { useState } from 'react';
import { BottomSheet, SheetAction, useToast } from './Overlay';
import { t, type TKey } from '@/i18n';
import { report } from '@/lib/api';
import { friendlyError } from '@/lib/supabase';

const REASONS = ['spam', 'harassment', 'fake', 'inappropriate', 'underage', 'safety', 'other'] as const;
export type ReportTarget = { user?: string | null; activity?: string | null; post?: string | null } | null;

export function ReportSheet({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet visible={!!target} onClose={onClose} title={t('report.title')}>
      {REASONS.map((r) => (
        <SheetAction key={r} icon="flag-outline" label={t(`report.${r}` as TKey)} onPress={async () => {
          if (busy || !target) return;
          setBusy(true);
          try { await report({ ...target, reason: r }); toast(t('report.sent'), 'success'); onClose(); }
          catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
        }} />
      ))}
    </BottomSheet>
  );
}
