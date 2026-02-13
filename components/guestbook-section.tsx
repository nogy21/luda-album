"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import type { GuestbookRow } from "@/lib/guestbook/types";
import {
  DEFAULT_GUESTBOOK_NICKNAME,
  MAX_GUESTBOOK_MESSAGE_LENGTH,
} from "@/lib/guestbook/validation";

type GuestbookApiError = {
  error: string;
};

export function GuestbookSection() {
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<GuestbookRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setFetchError(null);
        const response = await fetch("/api/guestbook", { cache: "no-store" });
        const data = (await response.json()) as GuestbookRow[] | GuestbookApiError;

        if (!response.ok) {
          setFetchError((data as GuestbookApiError).error || "덕담 목록을 불러오지 못했어요.");
          return;
        }

        setMessages(data as GuestbookRow[]);
      } catch {
        setFetchError("네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  const remaining = useMemo(() => MAX_GUESTBOOK_MESSAGE_LENGTH - message.length, [message.length]);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!message.trim()) {
      setSubmitError("덕담 내용을 입력해 주세요.");
      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: GuestbookRow = {
      id: optimisticId,
      nickname: nickname.trim() || DEFAULT_GUESTBOOK_NICKNAME,
      message: message.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((previous) => [optimisticMessage, ...previous]);
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/guestbook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname, message }),
      });

      const data = (await response.json()) as GuestbookRow | GuestbookApiError;

      if (!response.ok) {
        throw new Error((data as GuestbookApiError).error || "덕담 저장에 실패했어요.");
      }

      setMessages((previous) =>
        previous.map((item) => (item.id === optimisticId ? (data as GuestbookRow) : item)),
      );
      setMessage("");
      setNickname("");
    } catch {
      setMessages((previous) => previous.filter((item) => item.id !== optimisticId));
      setSubmitError("잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="guestbook"
      className="enter-fade-up enter-delay-2 scroll-mt-24 w-full rounded-[1.45rem] border border-[color:var(--color-line)]/40 bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-soft)] sm:p-4.5"
    >
      <header className="mb-3.5 space-y-1">
        <h2 className="text-[length:var(--text-title)] font-bold leading-tight text-[color:var(--color-ink)]">덕담 남기기</h2>
        <p className="text-[0.94rem] text-[color:var(--color-muted)]">
          짧은 메시지 한 줄도 좋아요. 닉네임은 비워두면 자동으로 {DEFAULT_GUESTBOOK_NICKNAME}
          으로 저장돼요.
        </p>
      </header>

      <form
        className="space-y-2.5 rounded-[1.12rem] border border-[color:var(--color-line)]/30 bg-[color:var(--color-surface)] p-3 shadow-[0_10px_24px_rgba(17,21,27,0.045)] sm:p-3.5"
        onSubmit={handleSubmit}
      >
        <div>
          <label
            htmlFor="nickname"
            className="mb-1.5 block text-[0.86rem] font-semibold text-[color:var(--color-muted)]"
          >
            닉네임
          </label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            autoComplete="name"
            spellCheck={false}
            placeholder={DEFAULT_GUESTBOOK_NICKNAME}
            className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)]/55 bg-white px-3 py-2.5 text-[0.98rem] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-muted)]/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
          />
        </div>

        <div>
          <label
            htmlFor="message"
            className="mb-1.5 block text-[0.86rem] font-semibold text-[color:var(--color-muted)]"
          >
            덕담
          </label>
          <textarea
            id="message"
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            maxLength={MAX_GUESTBOOK_MESSAGE_LENGTH}
            rows={4}
            className="w-full rounded-xl border border-[color:var(--color-line)]/55 bg-white px-3 py-3 text-[0.98rem] leading-relaxed text-[color:var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
            placeholder="새해 복 많이 받아, 건강하게 자라자…"
          />
          <p className="mt-1.5 text-right text-[0.72rem] font-semibold text-[color:var(--color-muted)]">
            {remaining}자 남음
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-full bg-[color:var(--color-brand)] px-4 py-2.5 text-[0.88rem] font-semibold text-white shadow-[0_12px_26px_rgba(203,83,51,0.42)] transition hover:bg-[#b4472a] active:scale-[0.99] disabled:opacity-70 sm:w-auto"
        >
          {isSubmitting ? "등록 중…" : "덕담 등록"}
        </button>
      </form>

      {submitError ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          {submitError}
        </p>
      ) : null}

      {fetchError ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          {fetchError}
        </p>
      ) : null}

      <div className="mt-5 space-y-2.5" aria-live="polite">
        {isLoading ? (
          <p className="rounded-[1.1rem] border border-[color:var(--color-line)]/25 bg-[color:var(--color-surface)] px-3.5 py-3 text-[0.88rem] text-[color:var(--color-muted)]">
            덕담을 불러오는 중…
          </p>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <p className="rounded-[1.1rem] border border-dashed border-[color:var(--color-line)]/45 bg-[color:var(--color-surface)] px-3.5 py-3 text-[0.88rem] text-[color:var(--color-muted)]">
            첫 번째 덕담을 남겨 주세요.
          </p>
        ) : null}

        {messages.map((entry) => (
          <article
            key={entry.id}
            className="rounded-[1.12rem] border border-[color:var(--color-line)]/30 bg-[color:var(--color-surface)] px-3.5 py-3 shadow-[0_10px_22px_rgba(17,21,27,0.05)]"
          >
            <header className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <strong className="text-[0.96rem] text-[color:var(--color-ink)]">{entry.nickname}</strong>
              <time className="text-[0.72rem] font-medium text-[color:var(--color-muted)]">
                {dateFormatter.format(new Date(entry.created_at))}
              </time>
            </header>
            <p className="whitespace-pre-wrap text-[0.98rem] leading-[1.65] text-[color:var(--color-ink)]">
              {entry.message}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
