import { PeopleListScreen } from '@/features/people/PeopleListScreen';
import { getFavorites } from '@/services/api';

const load = async () => ({ people: await getFavorites() });

export default function Favorites() {
  return <PeopleListScreen title="Favorites" load={load} emptyTitle="No favorites yet" emptyBody="Tap the heart on someone’s card to keep them here." />;
}
