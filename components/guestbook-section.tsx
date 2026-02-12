"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { MAX_GUESTBOOK_MESSAGE_LENGTH } from "@/lib/guestbook/validation";
import type { GuestbookRow } from "@/lib/guestbook/types";

type GuestbookApiError = {
  error: string;
};

export function GuestbookSection() {
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<GuestbookRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        const response = await fetch("/api/guestbook", { cache: "no-store" });
        const data = (await response.json()) as GuestbookRow[] | GuestbookApiError;

        if (!response.ok) {
          setError((data as GuestbookApiError).error || "덕담 목록을 불러오지 못했어요.");
          return;
        }

        setMessages(data as GuestbookRow[]);
      } catch {
        setError("네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  const remaining = useMemo(() => MAX_GUESTBOOK_MESSAGE_LENGTH - message.length, [message.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

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
        setError((data as GuestbookApiError).error || "덕담 저장에 실패했어요.");
        return;
      }

      setMessages((previous) => [data as GuestbookRow, ...previous]);
      setMessage("");
      setNickname("");
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="guestbook" className="w-full rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-5">
      <h2 className="text-lg font-semibold text-zinc-900">덕담</h2>
      <p className="mt-1 text-sm text-zinc-600">닉네임은 비워두면 익명의 팬으로 저장돼요.</p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="nickname" className="mb-1 block text-sm font-medium text-zinc-700">
            닉네임
          </label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="익명의 팬"
            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none ring-zinc-400 focus:ring"
          />
        </div>

        <div>
          <label htmlFor="message" className="mb-1 block text-sm font-medium text-zinc-700">
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
            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-base outline-none ring-zinc-400 focus:ring"
          />
          <p className="mt-1 text-right text-xs text-zinc-500">{remaining}자 남음</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {isSubmitting ? "등록 중..." : "덕담 등록"}
        </button>
      </form>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {isLoading ? <p className="text-sm text-zinc-500">덕담을 불러오는 중...</p> : null}

        {!isLoading && messages.length === 0 ? (
          <p className="text-sm text-zinc-500">첫 번째 덕담을 남겨 주세요.</p>
        ) : null}

        {messages.map((entry) => (
          <article key={entry.id} className="rounded-xl border border-zinc-200 bg-white p-3">
            <header className="mb-1 flex items-center justify-between gap-2 text-xs">
              <strong className="text-sm text-zinc-900">{entry.nickname}</strong>
              <time className="text-zinc-500">{new Date(entry.created_at).toLocaleDateString("ko-KR")}</time>
            </header>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{entry.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
