"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { groupGalleryImagesByMonth } from "@/lib/gallery/grouping";
import { galleryImages } from "@/lib/gallery/images";

export function GallerySection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const monthGroups = useMemo(() => groupGalleryImagesByMonth(galleryImages), []);

  const selectedImage = useMemo(
    () => galleryImages.find((image) => image.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <section id="gallery" className="w-full rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200 sm:p-4">
      <div className="mb-3 flex items-end justify-between px-1">
        <h2 className="text-base font-semibold text-zinc-900">최근 추억</h2>
        <p className="text-xs text-zinc-500">총 {galleryImages.length}장</p>
      </div>

      <div className="space-y-4">
        {monthGroups.map((group) => (
          <section
            key={group.key}
            aria-label={group.label}
            style={{ contentVisibility: "auto", containIntrinsicSize: "620px" }}
          >
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{group.label}</h3>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {group.items.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setSelectedId(image.id)}
                  className="group relative overflow-hidden rounded-md bg-zinc-100 text-left"
                  aria-label={`${image.caption} 확대 보기`}
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={320}
                    height={320}
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 220px"
                    className="aspect-square w-full object-cover transition duration-200 group-hover:scale-[1.02] group-active:scale-[0.98]"
                  />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2"
          role="dialog"
          aria-modal="true"
          aria-label="갤러리 이미지 크게 보기"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-black">
            <Image
              src={selectedImage.src}
              alt={selectedImage.alt}
              width={900}
              height={900}
              sizes="(max-width: 768px) 92vw, 600px"
              className="max-h-[78vh] w-full object-contain"
            />
            <div className="flex items-center justify-between gap-3 bg-black px-3 py-2">
              <p className="text-sm font-medium text-white/90">{selectedImage.caption}</p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
