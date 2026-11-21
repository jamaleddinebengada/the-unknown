import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { T } from './ui';

/* ---------------- BottomSheet ---------------- */
export function BottomSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
            <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
          </Animated.View>
          <Animated.View entering={SlideInDown.springify().damping(20)} exiting={SlideOutDown.duration(180)}
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.grabber} />
            {title && <T v="cardTitle" style={{ marginBottom: spacing.md }}>{title}</T>}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

export function SheetAction({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.elevated }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.violetDeep} />
      <Text style={[styles.actionLabel, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------------- Toast ---------------- */
type ToastKind = 'info' | 'success' | 'error';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((msg: string, kind: ToastKind = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  const icon = toast?.kind === 'success' ? 'checkmark-circle' : toast?.kind === 'error' ? 'alert-circle' : 'sparkles';
  const tint = toast?.kind === 'success' ? colors.success : toast?.kind === 'error' ? colors.danger : colors.violetSoft;
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View key={toast.id} entering={FadeInDown.springify().damping(18)} exiting={FadeOutUp.duration(200)}
          pointerEvents="none" style={[styles.toast, { top: insets.top + 8 }]} accessibilityLiveRegion="polite">
          <Ionicons name={icon} size={18} color={tint} />
          <Text style={styles.toastLabel}>{toast.msg}</Text>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingTop: spacing.sm, borderWidth: 1, borderColor: colors.hairline },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.hairlineStrong, marginBottom: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 8, borderRadius: radius.md },
  actionLabel: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.text },
  toast: { position: 'absolute', left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.hairlineStrong, zIndex: 999 },
  toastLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
});
