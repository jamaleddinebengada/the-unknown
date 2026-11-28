import { supabase } from '@/lib/supabase';

let seq = 0;
/** Every subscriber gets its own channel. supabase-js reuses a channel when the name
 *  repeats, and adding listeners to an already-subscribed channel throws — which used
 *  to crash the app when two screens watched the same thing. */
export const uniqueChannel = (name: string, opts?: Parameters<typeof supabase.channel>[1]) =>
  supabase.channel(`${name}:${Date.now().toString(36)}${(seq++).toString(36)}`, opts);
