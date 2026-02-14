export const HERO_INTRO_SESSION_KEY = "luda:hero-intro:v1";

type SessionGateStorage = Pick<Storage, "getItem" | "setItem">;

export function shouldRunHeroIntro(storage: SessionGateStorage | null): boolean {
  if (!storage) {
    return false;
  }

  return storage.getItem(HERO_INTRO_SESSION_KEY) !== "seen";
}

export function markHeroIntroSeen(storage: SessionGateStorage | null): void {
  if (!storage) {
    return;
  }

  storage.setItem(HERO_INTRO_SESSION_KEY, "seen");
}

