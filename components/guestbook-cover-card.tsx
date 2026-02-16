import Image from "next/image";

export function GuestbookCoverCard() {
  return (
    <section className="ui-surface mb-[var(--space-section-md)] overflow-hidden rounded-[var(--radius-xl)] p-4 sm:p-5">
      <div className="mb-3">
        <h1 className="text-[1.16rem] font-bold tracking-[-0.018em] text-[color:var(--color-ink)]">
          루다에게 한 마디
        </h1>
        <p className="mt-1 text-[0.82rem] leading-[1.5] text-[color:var(--color-muted)]">
          아래에 최근 덕담이 있어요. 먼저 읽고 마음을 남겨주세요.
        </p>
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
      <a
        href="#guestbook-comments"
        className="ui-btn-text mt-2 inline-flex px-0 text-[0.8rem] text-[color:var(--color-brand-strong)]"
      >
        최근 덕담 바로 보기
      </a>
    </section>
  );
}
