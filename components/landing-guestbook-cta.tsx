"use client";

import Link from "next/link";
import { useState } from "react";

export function LandingGuestbookCta() {
  const [message, setMessage] = useState("");
  const href = `/guestbook${message.trim() ? `?prefill=${encodeURIComponent(message.trim())}` : ""}`;

  return (
    <section className="mx-auto mt-3 w-full max-w-[860px] px-4 pb-10 sm:px-6">
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <h2 className="mb-2 text-[1.05rem] font-semibold text-[color:var(--color-ink)]">루다에게 한 마디</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="한 줄 덕담을 남겨보세요"
            className="min-h-11 flex-1 rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 text-[0.9rem] text-[color:var(--color-ink)]"
            maxLength={120}
          />
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-4 text-[0.85rem] font-semibold text-white"
          >
            덕담 남기기
          </Link>
        </div>
      </div>
    </section>
  );
}
