export type SoftRevealTransition = {
  delay: number;
  duration: number;
  ease?: [number, number, number, number];
};

export function buildSoftRevealTransition(
  reduceMotion: boolean,
  delay = 0,
): SoftRevealTransition {
  if (reduceMotion) {
    return {
      delay: 0,
      duration: 0,
    };
  }

  return {
    delay,
    duration: 0.52,
    ease: [0.22, 1, 0.36, 1],
  };
}
