"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type FixedBottomNavProps = {
  maxWidth: number;
};

const tabs = [
  { href: "/", label: "홈" },
  { href: "/photos", label: "앨범" },
  { href: "/guestbook", label: "덕담" },
];

const isActivePath = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export function FixedBottomNav({ maxWidth }: FixedBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3.5 pt-2 sm:px-5"
      style={{ paddingBottom: "max(0.95rem, env(safe-area-inset-bottom))" }}
      aria-label="하단 메뉴"
    >
      <div
        className="mx-auto grid grid-cols-3 gap-1.5 rounded-[1.3rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-1.5 text-[0.92rem] shadow-[var(--shadow-soft)]"
        style={{ maxWidth }}
      >
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-11 items-center justify-center rounded-[1rem] px-3 py-2.5 text-center text-[0.95rem] font-semibold transition-all ${active
                ? "bg-[color:var(--color-brand)] text-white shadow-[0_4px_10px_rgb(233_106_141/20%)]"
                : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-brand-soft)]"
                }`}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-4 bottom-1 h-[2.5px] rounded-full bg-white/95"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
