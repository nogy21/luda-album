"use client";

type PhotoRefreshButtonProps = {
  onRefresh?: () => void;
};

export function PhotoRefreshButton({ onRefresh }: PhotoRefreshButtonProps = {}) {
  return (
    <section className="layout-container mt-[var(--space-section-sm)]">
      <div className="ui-subtle-surface flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] px-3.5 py-3">
        <div>
          <p className="text-[0.86rem] font-semibold text-[color:var(--color-ink)]">새 사진이 안 보이나요?</p>
          <p className="text-[0.76rem] text-[color:var(--color-muted)]">
            아래로 당겨 새로고침이 안 되면 이 버튼을 눌러주세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onRefresh) {
              onRefresh();
              return;
            }

            window.location.reload();
          }}
          className="ui-btn ui-btn-primary min-h-11 shrink-0 rounded-full px-4"
          aria-label="새 사진 불러오기"
        >
          새 사진 불러오기
        </button>
      </div>
    </section>
  );
}
