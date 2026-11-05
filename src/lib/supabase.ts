import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { publicSupabaseConfig } from './supabaseConfig';

const config = publicSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const supabaseConfigured = config !== null;
export const supabase = config
  ? createClient(config.url, config.key, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, lock: processLock },
    })
  : null;
