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
  uploaded?: Array<{
    id: string;
    path: string;
    name: string;
    visibility: "family" | "admin";
  }>;
  failed?: Array<{ reason: string; name: string }>;
  error?: { message?: string };
};

type UploadResult = {
  ok: boolean;
  uploadedPath?: string;
  uploadedPhotoId?: string;
  visibility?: "family" | "admin";
  errorReason?: string;
};

const uploadSingleFile = (
  file: File,
  visibility: "family" | "admin",
  onProgress: (progress: number) => void,
): Promise<UploadResult> => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("files", file);
    formData.append("visibility", visibility);

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
        resolve({
          ok: true,
          uploadedPath: uploaded.path,
          uploadedPhotoId: uploaded.id,
          visibility: uploaded.visibility,
        });
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
  const [uploadVisibility, setUploadVisibility] = useState<"family" | "admin">("family");
  const [togglingPhotoId, setTogglingPhotoId] = useState<string | null>(null);
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
      const itemVisibility = item.visibility ?? uploadVisibility;

      setQueue((current) => setUploadProgress(current, item.id, 0, "uploading"));

      const result = await uploadSingleFile(item.file, itemVisibility, (progress) => {
        setQueue((current) =>
          setUploadProgress(current, item.id, progress, "uploading"),
        );
      });

      if (result.ok && result.uploadedPath) {
        const uploadedPath = result.uploadedPath;

        successCount += 1;
        setQueue((current) =>
          markUploadSuccess(current, item.id, uploadedPath, {
            uploadedPhotoId: result.uploadedPhotoId,
            visibility: result.visibility ?? itemVisibility,
          }),
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

    const items = createUploadQueue(Array.from(files), uploadVisibility);
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

  const handleToggleFeatured = async (item: UploadQueueItem) => {
    if (!item.uploadedPhotoId || togglingPhotoId || isUploading) {
      return;
    }

    const previous = Boolean(item.isFeatured);
    const next = !previous;

    setTogglingPhotoId(item.uploadedPhotoId);
    setQueue((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              isFeatured: next,
            }
          : entry,
      ),
    );

    try {
      const response = await fetch(`/api/admin/photos/${item.uploadedPhotoId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isFeatured: next,
          featuredRank: next ? 1 : null,
        }),
      });
      const data = (await response.json()) as {
        item?: { isFeatured?: boolean };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(data.error?.message || "대표컷 저장에 실패했어요.");
      }

      setQueue((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                isFeatured: Boolean(data.item?.isFeatured),
              }
            : entry,
        ),
      );

      setStatusText(next ? "대표컷으로 지정했어요." : "대표컷 지정을 해제했어요.");
    } catch (error) {
      setQueue((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                isFeatured: previous,
              }
            : entry,
        ),
      );
      setStatusText(
        error instanceof Error
          ? error.message
          : "대표컷 설정 중 오류가 발생했어요.",
      );
    } finally {
      setTogglingPhotoId(null);
    }
  };

  if (!ready) {
    return <p className="text-base text-[color:var(--color-muted)]">관리자 세션 확인 중…</p>;
  }

  if (!authenticated) {
    return (
      <section className="ui-surface mx-auto w-full max-w-xl space-y-5 rounded-[var(--radius-lg)] p-5 sm:p-6">
        <h1 className="text-[1.42rem] font-bold tracking-[-0.016em] text-[color:var(--color-ink)]">
          관리자 업로드
        </h1>
        <p className="text-[0.92rem] leading-[1.6] text-[color:var(--color-muted)]">
          사진 업로드는 관리자 계정으로만 가능합니다.
        </p>

        <form
          className="ui-subtle-surface space-y-4 rounded-[var(--radius-md)] p-4"
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
            <label
              htmlFor="admin-password"
              className="text-[0.86rem] font-semibold text-[color:var(--color-muted)]"
            >
              관리자 비밀번호
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="ui-input min-h-11 w-full px-3 text-[0.95rem]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="ui-btn ui-btn-primary px-5"
          >
            {authLoading ? "인증 중…" : "로그인"}
          </button>
        </form>

        <output className="rounded-[0.95rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.85rem] text-[color:var(--color-muted)]">
          {statusText}
        </output>
      </section>
    );
  }

  return (
    <section className="ui-surface mx-auto w-full max-w-3xl space-y-5 rounded-[var(--radius-lg)] p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.4rem] font-bold tracking-[-0.016em] text-[color:var(--color-ink)]">
            관리자 업로드
          </h1>
          <p className="mt-1 text-[0.9rem] leading-[1.56] text-[color:var(--color-muted)]">
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
          className="ui-btn ui-btn-secondary px-4"
        >
          로그아웃
        </button>
      </header>

      <output className="sr-only" aria-live="polite">
        {statusText}
      </output>

      <section className="ui-subtle-surface space-y-4 rounded-[var(--radius-md)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.88rem] font-semibold text-[color:var(--color-ink)]">업로드 범위</p>
          <div className="flex items-center gap-2">
            <label
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[0.76rem] font-semibold ${
                uploadVisibility === "family"
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                  : "border-[color:var(--color-line)] bg-white/90 text-[color:var(--color-muted)]"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value="family"
                checked={uploadVisibility === "family"}
                onChange={() => setUploadVisibility("family")}
              />
              가족 전용
            </label>
            <label
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[0.76rem] font-semibold ${
                uploadVisibility === "admin"
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                  : "border-[color:var(--color-line)] bg-white/90 text-[color:var(--color-muted)]"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value="admin"
                checked={uploadVisibility === "admin"}
                onChange={() => setUploadVisibility("admin")}
              />
              관리자 전용
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            id="admin-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleQueueFiles(event.target.files)}
            className="ui-input min-h-11 flex-1 p-2 text-[0.86rem] text-[color:var(--color-muted)]"
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
            className="ui-btn ui-btn-secondary px-3.5"
          >
            초기화
          </button>
        </div>

        <div className="space-y-2 rounded-[0.95rem] border border-[color:var(--color-line)] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8rem] font-semibold text-[color:var(--color-muted)]">
            <span>전체 진행률</span>
            <span>{Math.round(summary.totalProgress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-brand-soft)]">
            <div
              className="h-full rounded-full bg-[color:var(--color-brand)] transition-all"
              style={{ width: `${Math.round(summary.totalProgress * 100)}%` }}
            />
          </div>
          <p className="text-[0.76rem] leading-[1.45] text-[color:var(--color-muted)]">
            성공 {summary.successCount}개 · 실패 {summary.failureCount}개 · 업로드 중{" "}
            {summary.uploadingCount}개
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runUpload(queuedItems)}
            disabled={isUploading || queuedItems.length === 0}
            className="ui-btn ui-btn-primary px-4 disabled:opacity-60"
          >
            {isUploading ? "업로드 중…" : `대기 파일 업로드 (${queuedItems.length})`}
          </button>
          <button
            type="button"
            onClick={() => void handleRetryFailed()}
            disabled={isUploading || failedItems.length === 0}
            className="ui-btn ui-btn-secondary px-4 disabled:opacity-60"
          >
            실패 항목 재시도 ({failedItems.length})
          </button>
        </div>
      </section>

      <output className="rounded-[0.95rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2 text-[0.84rem] text-[color:var(--color-muted)]">
        {statusText}
      </output>

      {queue.length > 0 ? (
        <ul className="space-y-2.5">
          {queue.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white p-3.5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.9rem] font-semibold text-[color:var(--color-ink)]">{item.file.name}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.7rem] font-semibold text-[color:var(--color-muted)]">
                    {item.visibility === "admin" ? "관리자 전용" : "가족 전용"}
                  </span>
                  <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.7rem] font-semibold text-[color:var(--color-muted)]">
                    {item.status}
                  </span>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-brand-soft)]">
                <div
                  className="h-full rounded-full bg-[color:var(--color-brand)] transition-all"
                  style={{ width: `${Math.round(item.progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[0.74rem] text-[color:var(--color-muted)]">
                {Math.round(item.progress * 100)}% · {(item.file.size / (1024 * 1024)).toFixed(2)}MB
              </p>
              {item.uploadedPath ? (
                <p className="mt-1 text-[0.74rem] text-emerald-700">{item.uploadedPath}</p>
              ) : null}
              {item.errorReason ? (
                <p className="mt-1 text-[0.74rem] text-rose-700">{item.errorReason}</p>
              ) : null}
              {item.uploadedPhotoId ? (
                <button
                  type="button"
                  onClick={() => void handleToggleFeatured(item)}
                  disabled={isUploading || togglingPhotoId === item.uploadedPhotoId}
                  className={`ui-btn mt-2 px-3.5 text-[0.76rem] ${
                    item.isFeatured ? "ui-btn-primary" : "ui-btn-secondary"
                  } disabled:opacity-60`}
                >
                  {togglingPhotoId === item.uploadedPhotoId
                    ? "저장 중…"
                    : item.isFeatured
                      ? "대표컷 해제"
                      : "대표컷으로 지정"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[0.88rem] text-[color:var(--color-muted)]">
          아직 업로드 대기 파일이 없어요.
        </p>
      )}
    </section>
  );
}
