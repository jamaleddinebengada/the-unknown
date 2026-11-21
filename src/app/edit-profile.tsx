import { useRouter } from 'expo-router';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileForm } from '@/features/profile/ProfileForm';

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const toast = useToast();
  return (
    <Screen edges={['top']}>
      <StackHeader title="Edit profile" />
      <ProfileForm profile={profile} showPrivacy submitLabel="Save changes" onSaved={async () => { await refreshProfile(); toast('Profile saved.', 'success'); router.back(); }} />
    </Screen>
  );
}
