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
      className="fixed inset-x-0 bottom-0 z-40 px-3.5 pt-1.5 sm:px-5"
      style={{ paddingBottom: "max(0.62rem, env(safe-area-inset-bottom))" }}
      aria-label="하단 메뉴"
    >
      <div
        className="mx-auto grid grid-cols-3 gap-1 rounded-[1.08rem] border border-[color:color-mix(in_srgb,var(--color-line)_76%,#fff_24%)] bg-white/82 p-1 text-[0.88rem] shadow-[0_8px_22px_rgb(28_18_24/11%)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/72"
        style={{ maxWidth }}
      >
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-10 items-center justify-center rounded-[0.82rem] px-2.5 py-2 text-center text-[0.84rem] font-semibold transition-colors ${
                active
                  ? "bg-white text-[color:var(--color-ink)] shadow-[inset_0_0_0_1px_rgb(236_226_232/72%)]"
                  : "text-[color:var(--color-muted)] hover:bg-white/78 hover:text-[color:var(--color-ink)]"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span>{tab.label}</span>
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-[0.24rem] h-[2px] w-6 rounded-full bg-[color:var(--color-brand)]"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
