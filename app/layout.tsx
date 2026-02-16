import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { PwaBootstrap } from "@/components/pwa-bootstrap";

import "./globals.css";

const paperlogy = localFont({
  variable: "--font-paperlogy",
  src: [
    {
      path: "../public/Paperlogy/Paperlogy-4Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/Paperlogy/Paperlogy-5Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/Paperlogy/Paperlogy-6SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/Paperlogy/Paperlogy-7Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Luda Album | 루다의 첫 설날 앨범",
  description: "루다의 성장 사진과 덕담을 모바일에서 편하게 보는 가족 앨범",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Luda Album",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#8b7cf6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${paperlogy.variable} page-base antialiased`}
      >
        <PwaBootstrap />
        {children}
      </body>
    </html>
  );
}
