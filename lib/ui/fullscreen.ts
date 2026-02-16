type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type FullscreenDocumentEventMap = {
  fullscreenchange: Event;
  webkitfullscreenchange: Event;
  MSFullscreenChange: Event;
};

const toPromise = (result: Promise<void> | void) => Promise.resolve(result);

export const getFullscreenElement = (doc: Document = document): Element | null => {
  const fullscreenDoc = doc as FullscreenDocument;

  return (
    fullscreenDoc.fullscreenElement ??
    fullscreenDoc.webkitFullscreenElement ??
    fullscreenDoc.msFullscreenElement ??
    null
  );
};

export const canUseFullscreen = (
  target: HTMLElement | null | undefined,
  doc: Document = document,
): target is FullscreenTarget => {
  if (!target) {
    return false;
  }

  const fullTarget = target as FullscreenTarget;
  const fullDoc = doc as FullscreenDocument;

  const hasRequest =
    typeof fullTarget.requestFullscreen === "function" ||
    typeof fullTarget.webkitRequestFullscreen === "function" ||
    typeof fullTarget.msRequestFullscreen === "function";
  const hasExit =
    typeof fullDoc.exitFullscreen === "function" ||
    typeof fullDoc.webkitExitFullscreen === "function" ||
    typeof fullDoc.msExitFullscreen === "function";

  return hasRequest && hasExit;
};

export const isFullscreenSupported = (doc: Document = document) => {
  const fullDoc = doc as FullscreenDocument;
  const root = fullDoc.documentElement as FullscreenTarget;

  const hasRequest =
    typeof root?.requestFullscreen === "function" ||
    typeof root?.webkitRequestFullscreen === "function" ||
    typeof root?.msRequestFullscreen === "function";
  const hasExit =
    typeof fullDoc.exitFullscreen === "function" ||
    typeof fullDoc.webkitExitFullscreen === "function" ||
    typeof fullDoc.msExitFullscreen === "function";

  return hasRequest && hasExit;
};

export const requestFullscreen = async (target: HTMLElement): Promise<void> => {
  const fullTarget = target as FullscreenTarget;

  if (typeof fullTarget.requestFullscreen === "function") {
    await toPromise(fullTarget.requestFullscreen());
    return;
  }

  if (typeof fullTarget.webkitRequestFullscreen === "function") {
    await toPromise(fullTarget.webkitRequestFullscreen());
    return;
  }

  if (typeof fullTarget.msRequestFullscreen === "function") {
    await toPromise(fullTarget.msRequestFullscreen());
  }
};

export const exitFullscreen = async (doc: Document = document): Promise<void> => {
  const fullDoc = doc as FullscreenDocument;

  if (typeof fullDoc.exitFullscreen === "function") {
    await toPromise(fullDoc.exitFullscreen());
    return;
  }

  if (typeof fullDoc.webkitExitFullscreen === "function") {
    await toPromise(fullDoc.webkitExitFullscreen());
    return;
  }

  if (typeof fullDoc.msExitFullscreen === "function") {
    await toPromise(fullDoc.msExitFullscreen());
  }
};

export const addFullscreenChangeListener = (
  listener: () => void,
  doc: Document = document,
) => {
  const handler = () => {
    listener();
  };

  const events: Array<keyof FullscreenDocumentEventMap> = [
    "fullscreenchange",
    "webkitfullscreenchange",
    "MSFullscreenChange",
  ];

  for (const eventName of events) {
    doc.addEventListener(eventName, handler as EventListener);
  }

  return () => {
    for (const eventName of events) {
      doc.removeEventListener(eventName, handler as EventListener);
    }
  };
};
