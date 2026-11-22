import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { seeded } from '@/utils/format';
import { Pressy, T } from './ui';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function VoicePlayer({ uri, seed = 'voice' }: { uri: string; seed?: string }) {
  const player = useAudioPlayer(uri);
  const st = useAudioPlayerStatus(player);
  const bars = useMemo(() => { const r = seeded(seed); return Array.from({ length: 28 }, () => 6 + r() * 20); }, [seed]);
  const progress = st.duration ? st.currentTime / st.duration : 0;
  useEffect(() => { if (st.didJustFinish) player.seekTo(0); }, [st.didJustFinish, player]);
  return (
    <View style={s.wrap}>
      <Pressy accessibilityLabel={st.playing ? 'Pause voice note' : 'Play voice note'} onPress={() => (st.playing ? player.pause() : player.play())} style={s.play}>
        <Ionicons name={st.playing ? 'pause' : 'play'} size={16} color={colors.text} />
      </Pressy>
      <View style={s.bars}>
        {bars.map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: i / bars.length <= progress ? colors.violetSoft : colors.hairlineStrong }} />
        ))}
      </View>
      <T v="caption" color={colors.textSecondary}>{fmt(st.playing ? st.currentTime : st.duration || 0)}</T>
    </View>
  );
}

/** Hold-free recorder: tap to start, tap to stop. Returns the local file uri. */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const start = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission is needed to record a voice note.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };
  const stop = async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    return recorder.uri;
  };
  return { start, stop, isRecording: state.isRecording, seconds: Math.floor(state.durationMillis / 1000) };
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: radius.pill, backgroundColor: colors.elevated, alignSelf: 'flex-start' },
  play: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
});
