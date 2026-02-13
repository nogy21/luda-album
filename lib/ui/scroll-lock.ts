export type ScrollLockSnapshot = {
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  htmlOverflow: string;
  scrollY: number;
};

export function lockPageScroll(
  doc: Document = document,
  win: Window = window,
): ScrollLockSnapshot {
  const snapshot: ScrollLockSnapshot = {
    bodyOverflow: doc.body.style.overflow,
    bodyPosition: doc.body.style.position,
    bodyTop: doc.body.style.top,
    bodyWidth: doc.body.style.width,
    htmlOverflow: doc.documentElement.style.overflow,
    scrollY: win.scrollY,
  };

  doc.documentElement.style.overflow = "hidden";
  doc.body.style.overflow = "hidden";
  doc.body.style.position = "fixed";
  doc.body.style.top = `-${snapshot.scrollY}px`;
  doc.body.style.width = "100%";

  return snapshot;
}

export function unlockPageScroll(
  snapshot: ScrollLockSnapshot,
  doc: Document = document,
  win: Window = window,
) {
  doc.documentElement.style.overflow = snapshot.htmlOverflow;
  doc.body.style.overflow = snapshot.bodyOverflow;
  doc.body.style.position = snapshot.bodyPosition;
  doc.body.style.top = snapshot.bodyTop;
  doc.body.style.width = snapshot.bodyWidth;

  win.scrollTo(0, snapshot.scrollY);
}
