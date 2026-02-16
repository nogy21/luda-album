"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function FixedBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav)] pt-1"
      style={{ paddingBottom: "var(--bottom-nav-edge-offset)" }}
      aria-label="하단 메뉴"
    >
      <div className="layout-container">
        <div className="ui-bottom-nav-shell grid min-h-[var(--bottom-nav-height)] grid-cols-3 items-stretch gap-1 rounded-[1.08rem] p-1 text-[0.88rem]">
          {tabs.map((tab) => {
            const active = isActivePath(pathname, tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="ui-bottom-nav-tab px-2.5 py-2 text-center"
                data-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
              >
                <span>{tab.label}</span>
                {active ? (
                  <span aria-hidden="true" className="ui-bottom-nav-tab-indicator" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
