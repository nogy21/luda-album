import { createClient } from "@supabase/supabase-js";

import { isE2EFixtureModeEnabled } from "@/lib/testing/e2e-fixture-mode";

const getSupabaseEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }

  return { url, key };
};

export const createServerSupabaseClient = () => {
  if (isE2EFixtureModeEnabled()) {
    return null;
  }

  const env = getSupabaseEnv();

  if (!env) {
    return null;
  }

  return createClient(env.url, env.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
