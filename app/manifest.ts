import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
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
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
