export const HERO_INTRO_SESSION_KEY = "luda:hero-intro:v1";
export const LANDING_INTRO_SESSION_KEY = "luda:landing-intro:v1";

type SessionGateStorage = Pick<Storage, "getItem" | "setItem">;

export function shouldRunHeroIntro(
  storage: SessionGateStorage | null,
  sessionKey: string = HERO_INTRO_SESSION_KEY,
): boolean {
  if (!storage) {
    return false;
  }

  return storage.getItem(sessionKey) !== "seen";
}

export function markHeroIntroSeen(
  storage: SessionGateStorage | null,
  sessionKey: string = HERO_INTRO_SESSION_KEY,
): void {
  if (!storage) {
    return;
  }

  storage.setItem(sessionKey, "seen");
}
