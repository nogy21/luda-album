import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const getSupabaseRemotePattern = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    const parsed = new URL(supabaseUrl);
    return {
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: "/**",
    };
  } catch {
    return null;
  }
};

const supabaseRemotePattern = getSupabaseRemotePattern();

const nextConfig: NextConfig = {
  images: {
    qualities: [60, 62, 68, 74, 75],
    remotePatterns: supabaseRemotePattern ? [supabaseRemotePattern] : [],
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
