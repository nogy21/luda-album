import type { Metadata } from "next";
import { Gowun_Batang } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const paperlogy = localFont({
  variable: "--font-paperlogy",
  display: "swap",
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
      path: "../public/Paperlogy/Paperlogy-7Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
});

const gowunBatang = Gowun_Batang({
  variable: "--font-gowun-batang",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Luda Album | 루다의 첫 설날 앨범",
  description: "루다의 성장 사진과 덕담을 모바일에서 편하게 보는 가족 앨범",
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
        className={`${paperlogy.variable} ${gowunBatang.variable} page-base antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
