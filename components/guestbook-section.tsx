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
      className="enter-fade-up enter-delay-2 scroll-mt-24 w-full rounded-[1.5rem] border border-[color:var(--color-line)]/45 bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-soft)] sm:p-5"
    >
      <header className="mb-4 space-y-1">
        <h2 className="text-[1.35rem] font-bold leading-tight text-[color:var(--color-ink)]">덕담 남기기</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          짧은 메시지 한 줄도 좋아요. 닉네임은 비워두면 자동으로 {DEFAULT_GUESTBOOK_NICKNAME}
          으로 저장돼요.
        </p>
      </header>

      <form
        className="space-y-3 rounded-2xl border border-[color:var(--color-line)]/35 bg-[color:var(--color-surface)] p-3.5 shadow-[0_7px_16px_rgba(45,27,19,0.04)] sm:p-4"
        onSubmit={handleSubmit}
      >
        <div>
          <label
            htmlFor="nickname"
            className="mb-1.5 block text-sm font-semibold text-[color:var(--color-muted)]"
          >
            닉네임
          </label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={DEFAULT_GUESTBOOK_NICKNAME}
            className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)]/55 bg-white px-3.5 py-2.5 text-base text-[color:var(--color-ink)] placeholder:text-[color:var(--color-muted)]/75"
          />
        </div>

        <div>
          <label
            htmlFor="message"
            className="mb-1.5 block text-sm font-semibold text-[color:var(--color-muted)]"
          >
            덕담
          </label>
          <textarea
            id="message"
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            autoComplete="off"
            maxLength={MAX_GUESTBOOK_MESSAGE_LENGTH}
            rows={4}
            className="w-full rounded-xl border border-[color:var(--color-line)]/55 bg-white px-3.5 py-3 text-[1.02rem] leading-relaxed text-[color:var(--color-ink)]"
            placeholder="새해 복 많이 받아, 건강하게 자라자…"
          />
          <p className="mt-1.5 text-right text-xs font-semibold text-[color:var(--color-muted)]">
            {remaining}자 남음
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-full bg-[color:var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_9px_20px_rgba(178,76,50,0.34)] transition hover:bg-[#a8452d] active:scale-[0.99] disabled:opacity-70 sm:w-auto"
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

      <div className="mt-6 space-y-3.5" aria-live="polite">
        {isLoading ? (
          <p className="rounded-2xl border border-[color:var(--color-line)]/25 bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
            덕담을 불러오는 중…
          </p>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[color:var(--color-line)]/45 bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
            첫 번째 덕담을 남겨 주세요.
          </p>
        ) : null}

        {messages.map((entry) => (
          <article
            key={entry.id}
            className="rounded-2xl border border-[color:var(--color-line)]/35 bg-[color:var(--color-surface)] px-4 py-3.5 shadow-[0_8px_18px_rgba(45,27,19,0.05)]"
          >
            <header className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <strong className="text-base text-[color:var(--color-ink)]">{entry.nickname}</strong>
              <time className="text-[0.78rem] font-medium text-[color:var(--color-muted)]">
                {dateFormatter.format(new Date(entry.created_at))}
              </time>
            </header>
            <p className="whitespace-pre-wrap text-[1.02rem] leading-[1.7] text-[color:var(--color-ink)]">
              {entry.message}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
