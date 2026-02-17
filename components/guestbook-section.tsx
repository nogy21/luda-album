"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type { GuestbookRow } from "@/lib/guestbook/types";
import {
  DEFAULT_GUESTBOOK_NICKNAME,
  MAX_GUESTBOOK_MESSAGE_LENGTH,
} from "@/lib/guestbook/validation";

type GuestbookApiError = {
  error: string;
};

type SubmitStatus = "idle" | "posting";
type ToastTone = "success" | "error";
type ToastState = {
  tone: ToastTone;
  message: string;
};

const DEFAULT_ANNOUNCE_MESSAGE = "덕담을 남겨주세요.";

export function GuestbookSection() {
  const searchParams = useSearchParams();
  const hasAppliedPrefillRef = useRef(false);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<GuestbookRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [announceMessage, setAnnounceMessage] = useState(DEFAULT_ANNOUNCE_MESSAGE);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (hasAppliedPrefillRef.current) {
      return;
    }

    const prefill = searchParams.get("prefill");

    if (!prefill) {
      return;
    }

    hasAppliedPrefillRef.current = true;
    setMessage(prefill.slice(0, MAX_GUESTBOOK_MESSAGE_LENGTH));
  }, [searchParams]);

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

  const asyncAnnounceMessage = isLoading
    ? "덕담 목록을 불러오는 중입니다."
    : fetchError || announceMessage;

  const remainingTone =
    remaining <= 20 ? "text-[color:var(--color-brand-strong)]" : "text-[color:var(--color-muted)]";

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const showToast = (tone: ToastTone, nextMessage: string) => {
    setToast({ tone, message: nextMessage });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitStatus === "posting") {
      return;
    }

    if (!message.trim()) {
      const emptyMessage = "덕담 내용을 입력해 주세요.";
      setAnnounceMessage(emptyMessage);
      showToast("error", emptyMessage);
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
    setSubmitStatus("posting");
    setAnnounceMessage("등록 중이에요…");

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
      setSubmitStatus("idle");
      setAnnounceMessage("덕담이 등록되었어요.");
      showToast("success", "덕담이 등록되었어요.");
    } catch {
      setMessages((previous) => previous.filter((item) => item.id !== optimisticId));
      const errorMessage = "덕담 등록에 실패했어요. 잠시 후 다시 시도해 주세요.";
      setSubmitStatus("idle");
      setAnnounceMessage(errorMessage);
      showToast("error", errorMessage);
    }
  };

  return (
    <section
      id="guestbook"
      className="ui-surface scroll-mt-24 flex min-h-[calc(100dvh-var(--page-bottom-content-padding)-1rem)] w-full flex-col overflow-hidden rounded-[var(--radius-lg)] p-4 sm:p-5"
    >
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[85] flex justify-center px-4">
          <p
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto rounded-full border px-4 py-2 text-[0.78rem] font-semibold shadow-[0_10px_26px_rgb(29_26_34/18%)] ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {toast.message}
          </p>
        </div>
      ) : null}

      <output className="sr-only" aria-live="polite">
        {asyncAnnounceMessage}
      </output>

      <header className="mb-3 space-y-1">
        <h2 className="ui-title">덕담 남기기</h2>
        <p className="text-[var(--text-body)] leading-[var(--leading-body)] text-[color:var(--color-muted)]">
          짧게 남겨도 좋아요.
        </p>
      </header>

      <form
        className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white/92 p-3.5 sm:p-4"
        onSubmit={handleSubmit}
      >
        <label htmlFor="nickname" className="sr-only">
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
          placeholder={`닉네임 (비우면 ${DEFAULT_GUESTBOOK_NICKNAME})`}
          className="ui-input w-full bg-white/96 px-3 py-2.5 text-[0.9rem] placeholder:text-[color:var(--color-muted)]"
        />

        <label htmlFor="message" className="sr-only">
          덕담
        </label>
        <textarea
          id="message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          maxLength={MAX_GUESTBOOK_MESSAGE_LENGTH}
          rows={3}
          className="ui-input mt-2.5 w-full bg-white/96 px-3 py-3 text-[0.92rem] leading-[1.62]"
          placeholder="루다에게 전하고 싶은 말을 적어주세요."
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <p className={`text-[0.74rem] font-semibold ${remainingTone}`}>{remaining}자 남음</p>
          <button type="submit" disabled={submitStatus === "posting"} className="ui-btn ui-btn-primary ml-auto px-4">
            {submitStatus === "posting" ? "등록 중…" : "남기기"}
          </button>
        </div>
      </form>

      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-[0.88rem] font-semibold text-[color:var(--color-ink)]">최근 덕담</h3>
        <span className="text-[0.76rem] font-medium text-[color:var(--color-muted)]">{messages.length}개</span>
      </div>

      {fetchError ? (
        <p className="ui-status ui-status-error mt-3" role="alert">
          {fetchError}
        </p>
      ) : null}

      <div id="guestbook-comments" className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1" aria-live="polite">
        {isLoading ? (
          <p className="ui-status ui-status-neutral rounded-[var(--radius-md)] px-3.5 py-3 text-[0.88rem]">
            덕담을 불러오는 중…
          </p>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <p className="ui-status ui-status-neutral rounded-[var(--radius-md)] px-3.5 py-3 text-[0.88rem]">
            첫 번째 덕담을 남겨 주세요.
          </p>
        ) : null}

        {messages.map((entry) => (
          <article
            key={entry.id}
            className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white/92 px-3.5 py-3"
          >
            <header className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <strong className="text-[0.92rem] leading-[1.35] text-[color:var(--color-ink)]">
                {entry.nickname}
              </strong>
              <time className="text-[0.7rem] font-medium text-[color:var(--color-muted)]">
                {dateFormatter.format(new Date(entry.created_at))}
              </time>
            </header>
            <p className="whitespace-pre-wrap text-[0.92rem] leading-[1.68] text-[color:var(--color-ink)]">
              {entry.message}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
