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

type SubmitStatus = "idle" | "posting" | "success" | "error";

type GuestbookSectionProps = {
  prefillMessage?: string;
};

export function GuestbookSection({ prefillMessage }: GuestbookSectionProps) {
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState(() =>
    prefillMessage ? prefillMessage.slice(0, MAX_GUESTBOOK_MESSAGE_LENGTH) : "",
  );
  const [messages, setMessages] = useState<GuestbookRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("메시지를 입력하고 등록해 주세요.");
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    : fetchError || statusMessage;

  const statusTone = {
    idle: "border-[color:var(--color-line)] bg-white/76 text-[color:var(--color-muted)]",
    posting:
      "border-[color:var(--color-brand-soft)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]",
    success: "border-emerald-200/85 bg-emerald-50/86 text-emerald-700",
    error: "border-rose-200/85 bg-rose-50/90 text-rose-700",
  }[submitStatus];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitStatus === "posting") {
      return;
    }

    if (!message.trim()) {
      setSubmitStatus("error");
      setStatusMessage("덕담 내용을 입력해 주세요.");
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
    setStatusMessage("덕담을 등록하고 있어요…");

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
      setSubmitStatus("success");
      setStatusMessage("덕담이 등록됐어요. 따뜻한 마음을 남겨주셔서 고마워요.");
    } catch {
      setMessages((previous) => previous.filter((item) => item.id !== optimisticId));
      setSubmitStatus("error");
      setStatusMessage("등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <section
      id="guestbook"
      className="ui-surface scroll-mt-24 w-full rounded-[var(--radius-lg)] p-4 sm:p-5"
    >
      <output className="sr-only" aria-live="polite">
        {asyncAnnounceMessage}
      </output>

      <header className="mb-5 space-y-1.5">
        <h2 className="ui-title">덕담 남기기</h2>
        <p className="text-[var(--text-body)] leading-[var(--leading-body)] text-[color:var(--color-muted)]">
          짧은 메시지 한 줄도 좋아요. 닉네임은 비워두면 자동으로 {DEFAULT_GUESTBOOK_NICKNAME}
          으로 저장돼요.
        </p>
      </header>

      <form className="ui-subtle-surface space-y-4 rounded-[var(--radius-md)] p-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label
            htmlFor="nickname"
            className="block text-[0.82rem] font-semibold text-[color:var(--color-muted)]"
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
            className="ui-input w-full bg-white/94 px-3 py-2.5 text-[0.94rem] placeholder:text-[color:var(--color-muted)]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="message"
            className="block text-[0.82rem] font-semibold text-[color:var(--color-muted)]"
          >
            덕담
          </label>
          <textarea
            id="message"
            name="message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (submitStatus !== "posting" && submitStatus !== "idle") {
                setSubmitStatus("idle");
                setStatusMessage("메시지를 입력하고 등록해 주세요.");
              }
            }}
            required
            maxLength={MAX_GUESTBOOK_MESSAGE_LENGTH}
            rows={4}
            className="ui-input w-full bg-white/94 px-3 py-3 text-[0.94rem] leading-[1.58]"
            placeholder="새해 복 많이 받아, 건강하게 자라자…"
          />
          <p className="text-right text-[0.72rem] font-semibold text-[color:var(--color-muted)]">
            {remaining}자 남음
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={submitStatus === "posting"}
            className="ui-btn ui-btn-primary px-4"
          >
            {submitStatus === "posting" ? "등록 중…" : "덕담 등록"}
          </button>
          <p
            className={`min-h-11 flex-1 rounded-[0.92rem] border px-3 py-2 text-[0.8rem] font-medium leading-[1.45] ${statusTone}`}
            role={submitStatus === "error" ? "alert" : "status"}
          >
            {statusMessage}
          </p>
        </div>
      </form>

      {fetchError ? (
        <p
          className="mt-3 rounded-[0.92rem] border border-rose-200/85 bg-rose-50/90 px-3 py-2 text-[0.82rem] font-medium text-rose-700"
          role="alert"
        >
          {fetchError}
        </p>
      ) : null}

      <div className="mt-6 space-y-2.5" aria-live="polite">
        {isLoading ? (
          <p className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white/72 px-3.5 py-3 text-[0.88rem] text-[color:var(--color-muted)]">
            덕담을 불러오는 중…
          </p>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white/72 px-3.5 py-3 text-[0.88rem] text-[color:var(--color-muted)]">
            첫 번째 덕담을 남겨 주세요.
          </p>
        ) : null}

        {messages.map((entry) => (
          <article
            key={entry.id}
            className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white/86 px-3.5 py-3"
          >
            <header className="mb-2 flex items-center justify-between gap-2 text-xs">
              <strong className="text-[0.95rem] text-[color:var(--color-ink)]">{entry.nickname}</strong>
              <time className="text-[0.7rem] font-medium text-[color:var(--color-muted)]">
                {dateFormatter.format(new Date(entry.created_at))}
              </time>
            </header>
            <p className="whitespace-pre-wrap text-[0.96rem] leading-[1.62] text-[color:var(--color-ink)]">
              {entry.message}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
