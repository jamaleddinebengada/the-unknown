import { PeopleListScreen } from '@/features/people/PeopleListScreen';
import { getMyVisitors } from '@/services/api';

export default function Visitors() {
  return (
    <PeopleListScreen title="Profile visitors" load={getMyVisitors}
      emptyTitle="No visitors in the last 30 days" emptyBody="When people open your profile, they appear here. Members who hide their visits are never shown."
      lockedTitle={(n) => (n ? `${n} ${n === 1 ? 'person' : 'people'} visited your profile` : 'See who visits your profile')}
      lockedBody="VIP members can see who visited them in the last 30 days. People who chose to hide their visits are never shown." />
  );
}
