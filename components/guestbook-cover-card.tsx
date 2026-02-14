import Image from "next/image";

export function GuestbookCoverCard() {
  return (
    <section className="mb-4 overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-soft)] sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h1 className="text-[1.18rem] font-bold tracking-[-0.02em] text-[color:var(--color-ink)]">루다에게 한 마디</h1>
        <span className="text-[0.74rem] font-medium text-[color:var(--color-muted)]">하이라이트 고정</span>
      </div>
      <div className="relative overflow-hidden rounded-[0.95rem] bg-[color:var(--color-surface)]">
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
