import Image from "next/image";

export function GuestbookCoverCard() {
  return (
    <section className="ui-surface mb-[var(--space-section-md)] overflow-hidden rounded-[var(--radius-xl)] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-[1.16rem] font-bold tracking-[-0.018em] text-[color:var(--color-ink)]">
          루다에게 한 마디
        </h1>
        <span className="text-[var(--text-meta)] font-medium text-[color:var(--color-muted)]">
          하이라이트 고정
        </span>
      </div>
      <div className="relative overflow-hidden rounded-[0.95rem] bg-[color:var(--color-brand-soft)]">
        <Image
          src="/luda.jpg"
          alt="루다 대표 사진"
          width={1200}
          height={900}
          priority
          sizes="(max-width: 780px) 92vw, 720px"
          className="aspect-[5/4] w-full object-cover"
        />
      </div>
    </section>
  );
}
