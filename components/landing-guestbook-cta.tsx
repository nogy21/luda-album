"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export function LandingGuestbookCta() {
  const [message, setMessage] = useState("");
  const href = useMemo(() => {
    const trimmed = message.trim();

    if (!trimmed) {
      return "/guestbook";
    }

    return `/guestbook?prefill=${encodeURIComponent(trimmed)}`;
  }, [message]);

  return (
    <section className="pointer-events-none fixed inset-x-0 bottom-[var(--floating-guestbook-cta-bottom)] z-[var(--z-bottom-cta)]">
      <div className="layout-container">
        <div className="pointer-events-auto w-full rounded-[1rem] border border-[color:color-mix(in_srgb,var(--color-line)_72%,#fff_28%)] bg-white/86 px-3.5 py-2.5 shadow-[0_8px_22px_rgb(28_18_24/12%)] backdrop-blur">
          <p className="mb-1.5 text-[0.8rem] font-semibold text-[color:var(--color-ink)]">루다에게 따뜻한 한 줄</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="보고 싶은 말 한 줄을 남겨주세요"
              className="ui-input min-h-10 w-full min-w-0 rounded-full bg-[color:var(--color-surface)] px-3.5 text-[0.82rem] placeholder:text-[color:var(--color-muted)] outline-none"
              maxLength={120}
            />
            <Link href={href} className="ui-btn ui-btn-primary min-h-10 shrink-0 rounded-full px-3.5 text-[0.8rem]">
              덕담 쓰기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
