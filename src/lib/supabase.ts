import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureAdapter } from './secureStorage';
import { config, hasBackend } from '../config';

export const supabase = hasBackend
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { storage: secureAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;
