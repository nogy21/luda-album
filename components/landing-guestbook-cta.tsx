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
    <section className="pointer-events-none fixed inset-x-0 z-30 px-4 sm:px-6" style={{ bottom: "calc(max(0.95rem, env(safe-area-inset-bottom)) + 5.6rem)" }}>
      <div className="pointer-events-auto mx-auto w-full max-w-[860px] rounded-[1.1rem] border border-[color:var(--color-line)] bg-white/95 px-3.5 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.15)] backdrop-blur">
        <p className="mb-2 text-[0.84rem] font-semibold text-[color:var(--color-ink)]">루다에게 한 마디</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="한 줄 덕담을 남겨보세요"
            className="min-h-11 flex-1 rounded-full bg-[color:var(--color-surface)] px-3.5 text-[0.86rem] text-[color:var(--color-ink)] outline-none ring-1 ring-[color:var(--color-line)] placeholder:text-[color:var(--color-muted)]/75"
            maxLength={120}
          />
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-4 text-[0.82rem] font-semibold text-white"
          >
            덕담 남기기
          </Link>
        </div>
      </div>
    </section>
  );
}
