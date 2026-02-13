import type { Metadata } from "next";
import { Gowun_Batang, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const paperlogy = Noto_Sans_KR({
  variable: "--font-paperlogy",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
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
