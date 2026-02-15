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
        className="mx-auto grid grid-cols-3 gap-1.5 rounded-[1.3rem] bg-white/84 p-1.5 text-[0.92rem] shadow-[0_16px_34px_rgb(85_48_62/18%)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70"
        style={{ maxWidth }}
      >
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-11 items-center justify-center rounded-[1rem] px-3 py-2.5 text-center text-[0.95rem] font-semibold transition-colors ${active
                ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                : "text-[color:var(--color-muted)] hover:bg-white/70 hover:text-[color:var(--color-ink)]"
                }`}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand)]"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
