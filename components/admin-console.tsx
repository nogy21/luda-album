"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  createUploadQueue,
  getQueueSummary,
  markUploadError,
  markUploadSuccess,
  pickRetryTargets,
  setUploadProgress,
  type UploadQueueItem,
} from "@/lib/admin/upload-queue";

type UploadApiResult = {
  uploaded?: Array<{ path: string; name: string }>;
  failed?: Array<{ reason: string; name: string }>;
  error?: { message?: string };
};

type UploadResult = {
  ok: boolean;
  uploadedPath?: string;
  errorReason?: string;
};

const uploadSingleFile = (
  file: File,
  onProgress: (progress: number) => void,
): Promise<UploadResult> => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("files", file);

    xhr.open("POST", "/api/admin/upload");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(event.loaded / event.total);
    };

    xhr.onload = () => {
      const body = (xhr.response ?? {}) as UploadApiResult;
      const uploaded = body.uploaded?.[0];
      const failed = body.failed?.[0];

      if (xhr.status >= 200 && xhr.status < 300 && uploaded) {
        resolve({ ok: true, uploadedPath: uploaded.path });
        return;
      }

      resolve({
        ok: false,
        errorReason:
          body.error?.message ||
          failed?.reason ||
          "업로드에 실패했어요. 잠시 후 다시 시도해 주세요.",
      });
    };

    xhr.onerror = () => {
      resolve({
        ok: false,
        errorReason: "네트워크 오류가 발생했어요. 연결 상태를 확인해 주세요.",
      });
    };

    xhr.send(formData);
  });
};

export function AdminConsole() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState("업로드할 사진을 선택해 주세요.");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/admin/session", {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json()) as { authenticated?: boolean };

        if (!mounted) {
          return;
        }

        setAuthenticated(Boolean(body.authenticated));
      } catch {
        if (!mounted) {
          return;
        }

        setAuthenticated(false);
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => getQueueSummary(queue), [queue]);
  const queuedItems = useMemo(
    () => queue.filter((item) => item.status === "queued"),
    [queue],
  );
  const failedItems = useMemo(() => pickRetryTargets(queue), [queue]);

  const runUpload = async (targets: UploadQueueItem[]) => {
    if (targets.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setStatusText(`${targets.length}개 파일 업로드를 시작합니다.`);

    let successCount = 0;
    let failureCount = 0;

    for (const item of targets) {
      setQueue((current) => setUploadProgress(current, item.id, 0, "uploading"));

      const result = await uploadSingleFile(item.file, (progress) => {
        setQueue((current) =>
          setUploadProgress(current, item.id, progress, "uploading"),
        );
      });

      if (result.ok && result.uploadedPath) {
        successCount += 1;
        setQueue((current) =>
          markUploadSuccess(current, item.id, result.uploadedPath as string),
        );
        continue;
      }

      failureCount += 1;
      setQueue((current) =>
        markUploadError(
          current,
          item.id,
          result.errorReason ?? "업로드에 실패했어요.",
        ),
      );
    }

    setIsUploading(false);
    setStatusText(
      `업로드 완료: 성공 ${successCount}개 · 실패 ${failureCount}개`,
    );
  };

  const handleQueueFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const items = createUploadQueue(Array.from(files));
    setQueue((current) => [...current, ...items]);
    setStatusText(`${items.length}개 파일을 업로드 대기열에 추가했어요.`);
  };

  const handleRetryFailed = async () => {
    if (failedItems.length === 0 || isUploading) {
      return;
    }

    setQueue((current) =>
      current.map((item) =>
        item.status === "error"
          ? {
              ...item,
              status: "queued",
              progress: 0,
              errorReason: undefined,
            }
          : item,
      ),
    );
    await runUpload(failedItems);
  };

  if (!ready) {
    return <p className="text-base text-[color:var(--color-muted)]">관리자 세션 확인 중…</p>;
  }

  if (!authenticated) {
    return (
      <section className="mx-auto w-full max-w-xl space-y-4 rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">관리자 업로드</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          사진 업로드는 관리자 계정으로만 가능합니다.
        </p>

        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setAuthLoading(true);
            setStatusText("관리자 인증을 확인하고 있어요.");

            try {
              const response = await fetch("/api/admin/auth", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ password }),
              });
              const body = (await response.json()) as { error?: string };

              if (!response.ok) {
                throw new Error(body.error || "로그인에 실패했어요.");
              }

              setAuthenticated(true);
              setPassword("");
              setStatusText("로그인되었습니다.");
            } catch (error) {
              setStatusText(
                error instanceof Error
                  ? error.message
                  : "로그인에 실패했습니다. 다시 시도해 주세요.",
              );
            } finally {
              setAuthLoading(false);
            }
          }}
        >
          <div className="space-y-2">
            <label htmlFor="admin-password" className="text-base font-semibold text-[color:var(--color-ink)]">
              관리자 비밀번호
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 w-full rounded-[0.95rem] border border-[color:var(--color-line)] bg-white px-3 text-base"
              required
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-5 text-base font-semibold text-white disabled:opacity-60"
          >
            {authLoading ? "인증 중…" : "로그인"}
          </button>
        </form>

        <p className="rounded-[0.95rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-sm text-[color:var(--color-muted)]" role="status">
          {statusText}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">관리자 업로드</h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            파일별 진행률과 부분 실패를 확인하고 재시도할 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            setAuthenticated(false);
            setQueue([]);
            setStatusText("로그아웃되었습니다.");
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--color-line)] px-4 text-sm font-semibold text-[color:var(--color-muted)]"
        >
          로그아웃
        </button>
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {statusText}
      </p>

      <section className="space-y-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            id="admin-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleQueueFiles(event.target.files)}
            className="min-h-11 flex-1 rounded-[0.95rem] border border-[color:var(--color-line)] bg-white p-2 text-sm text-[color:var(--color-muted)]"
          />
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              setQueue([]);
              setStatusText("업로드 대기열을 비웠어요.");
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--color-line)] px-3.5 text-sm font-semibold text-[color:var(--color-muted)]"
          >
            초기화
          </button>
        </div>

        <div className="space-y-2 rounded-[0.95rem] border border-[color:var(--color-line)] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[0.82rem] font-semibold text-[color:var(--color-muted)]">
            <span>전체 진행률</span>
            <span>{Math.round(summary.totalProgress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-brand-soft)]">
            <div
              className="h-full rounded-full bg-[color:var(--color-brand)] transition-all"
              style={{ width: `${Math.round(summary.totalProgress * 100)}%` }}
            />
          </div>
          <p className="text-[0.78rem] text-[color:var(--color-muted)]">
            성공 {summary.successCount}개 · 실패 {summary.failureCount}개 · 업로드 중{" "}
            {summary.uploadingCount}개
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runUpload(queuedItems)}
            disabled={isUploading || queuedItems.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(233,106,141,0.3)] disabled:opacity-60"
          >
            {isUploading ? "업로드 중…" : `대기 파일 업로드 (${queuedItems.length})`}
          </button>
          <button
            type="button"
            onClick={() => void handleRetryFailed()}
            disabled={isUploading || failedItems.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--color-line)] px-4 text-sm font-semibold text-[color:var(--color-muted)] disabled:opacity-60"
          >
            실패 항목 재시도 ({failedItems.length})
          </button>
        </div>
      </section>

      <p className="rounded-[0.95rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-muted)]" role="status">
        {statusText}
      </p>

      {queue.length > 0 ? (
        <ul className="space-y-2.5">
          {queue.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white p-3"
            >
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[color:var(--color-ink)]">{item.file.name}</p>
                <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.72rem] font-semibold text-[color:var(--color-muted)]">
                  {item.status}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-brand-soft)]">
                <div
                  className="h-full rounded-full bg-[color:var(--color-brand)] transition-all"
                  style={{ width: `${Math.round(item.progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[0.76rem] text-[color:var(--color-muted)]">
                {Math.round(item.progress * 100)}% · {(item.file.size / (1024 * 1024)).toFixed(2)}MB
              </p>
              {item.uploadedPath ? (
                <p className="mt-1 text-[0.76rem] text-emerald-700">{item.uploadedPath}</p>
              ) : null}
              {item.errorReason ? (
                <p className="mt-1 text-[0.76rem] text-rose-700">{item.errorReason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 py-3 text-sm text-[color:var(--color-muted)]">
          아직 업로드 대기 파일이 없어요.
        </p>
      )}
    </section>
  );
}

