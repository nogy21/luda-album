import type { MetadataRoute } from "next";

import {
  PWA_ICON_ROUTE_PATHS,
  getPwaBrandingVersionQuery,
  resolvePwaBranding,
} from "@/lib/pwa/branding";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const supabase = createServerSupabaseClient();
  const branding = await resolvePwaBranding(supabase);
  const versionQuery = getPwaBrandingVersionQuery(branding.version);

  return {
    name: "Luda Album",
    short_name: "Luda",
    description: "루다의 성장 사진과 덕담을 모바일에서 편하게 보는 가족 앨범",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f7fb",
    theme_color: "#8b7cf6",
    lang: "ko",
    orientation: "portrait",
    icons: [
      {
        src: `${PWA_ICON_ROUTE_PATHS.icon192}${versionQuery}`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `${PWA_ICON_ROUTE_PATHS.icon512}${versionQuery}`,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: `${PWA_ICON_ROUTE_PATHS.maskable512}${versionQuery}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${PWA_ICON_ROUTE_PATHS.appleTouch}${versionQuery}`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
