import { Redirect } from 'expo-router';

/** Old /matches links now open the Match view of the Discover page. */
export default function MatchesRedirect() {
  return <Redirect href={{ pathname: '/discover', params: { view: 'match' } }} />;
}
