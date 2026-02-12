"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

const tabs = [
  { href: "/photos", label: "사진" },
  { href: "/guestbook", label: "덕담" },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f8f9fb] pb-24">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <Link href="/photos" className="text-lg font-semibold tracking-tight text-zinc-900">
            Luda Photos
          </Link>
          <div className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">가족 앨범</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-2 text-sm">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-xl px-3 py-2 text-center font-medium ${
                  isActive ? "bg-zinc-900 text-white" : "text-zinc-700 active:bg-zinc-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function CoverCard() {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
      <div className="relative h-48 w-full sm:h-60">
        <Image
          src="/luda.jpg"
          alt="한복을 입고 웃고 있는 루다"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 720px"
          className="object-cover"
        />
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">2026 Lunar New Year</p>
        <h2 className="text-xl font-semibold text-zinc-900">우리 루다의 첫 설날 앨범</h2>
        <p className="text-sm leading-relaxed text-zinc-600">사진이 늘어나도 빠르게 볼 수 있도록 정리했어요.</p>
      </div>
    </section>
  );
}
