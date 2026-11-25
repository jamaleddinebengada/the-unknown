import { Screen, StackHeader } from '@/components/Screen';
import { MatchesView } from '@/features/matches/MatchesView';

/** Mystery Match — anonymous matching by mode and interests (identity stays hidden until both agree). */
export default function Mystery() {
  return (
    <Screen edges={['top']}>
      <StackHeader title="Mystery Match" />
      <MatchesView top={null} />
    </Screen>
  );
}
