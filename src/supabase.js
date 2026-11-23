import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloudEnabled = !!(url && key);
export const supabase = cloudEnabled ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
