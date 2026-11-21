import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { T } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileForm } from '@/features/profile/ProfileForm';

export default function ProfileSetup() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  return (
    <Screen atmosphere>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: 6 }}>
        <T v="overline" color={colors.violetSoft}>STEP 1 OF 2</T>
        <T v="screenTitle">Shape your mystery</T>
        <T color={colors.textSecondary}>
          {profile ? `You’ll appear as UNKNOWN #${profile.unknown_number}. ` : ''}Only what helps us find the right people.
        </T>
      </View>
      <ProfileForm profile={profile} submitLabel="Continue" onSaved={async () => { await refreshProfile(); router.push('/setup/interests'); }} />
    </Screen>
  );
}
