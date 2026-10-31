import { Keyframe } from '../types';

export interface InterpolatedTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  volume: number;
}

const DEFAULT_TRANSFORM: InterpolatedTransform = {
  scale: 1.0,
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1.0,
  volume: 100,
};

export function interpolateKeyframes(
  keyframes: Keyframe[] | undefined,
  localTime: number
): InterpolatedTransform {
  if (!keyframes || keyframes.length === 0) {
    return DEFAULT_TRANSFORM;
  }

  // Sort keyframes by time
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // Before first keyframe
  if (localTime <= sorted[0].time) {
    const first = sorted[0];
    return {
      scale: first.scale ?? 1.0,
      x: first.x ?? 0,
      y: first.y ?? 0,
      rotation: first.rotation ?? 0,
      opacity: first.opacity ?? 1.0,
      volume: first.volume ?? 100,
    };
  }

  // After last keyframe
  if (localTime >= sorted[sorted.length - 1].time) {
    const last = sorted[sorted.length - 1];
    return {
      scale: last.scale ?? 1.0,
      x: last.x ?? 0,
      y: last.y ?? 0,
      rotation: last.rotation ?? 0,
      opacity: last.opacity ?? 1.0,
      volume: last.volume ?? 100,
    };
  }

  // Find surrounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const kf1 = sorted[i];
    const kf2 = sorted[i + 1];

    if (localTime >= kf1.time && localTime <= kf2.time) {
      const span = kf2.time - kf1.time;
      if (span <= 0) {
        return {
          scale: kf2.scale ?? 1.0,
          x: kf2.x ?? 0,
          y: kf2.y ?? 0,
          rotation: kf2.rotation ?? 0,
          opacity: kf2.opacity ?? 1.0,
          volume: kf2.volume ?? 100,
        };
      }

      // Linear progress
      const t = (localTime - kf1.time) / span;
      // Smooth easeInOut curve
      const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const lerp = (start = 0, end = 0) => start + (end - start) * easeT;

      return {
        scale: lerp(kf1.scale ?? 1.0, kf2.scale ?? 1.0),
        x: lerp(kf1.x ?? 0, kf2.x ?? 0),
        y: lerp(kf1.y ?? 0, kf2.y ?? 0),
        rotation: lerp(kf1.rotation ?? 0, kf2.rotation ?? 0),
        opacity: lerp(kf1.opacity ?? 1.0, kf2.opacity ?? 1.0),
        volume: lerp(kf1.volume ?? 100, kf2.volume ?? 100),
      };
    }
  }

  return DEFAULT_TRANSFORM;
}

export function findKeyframeNear(
  keyframes: Keyframe[] | undefined,
  localTime: number,
  tolerance = 0.25
): Keyframe | null {
  if (!keyframes) return null;
  return (
    keyframes.find((kf) => Math.abs(kf.time - localTime) <= tolerance) || null
  );
}

export function getNextKeyframeTime(
  keyframes: Keyframe[] | undefined,
  localTime: number
): number | null {
  if (!keyframes || keyframes.length === 0) return null;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const next = sorted.find((kf) => kf.time > localTime + 0.1);
  return next ? next.time : null;
}

export function getPrevKeyframeTime(
  keyframes: Keyframe[] | undefined,
  localTime: number
): number | null {
  if (!keyframes || keyframes.length === 0) return null;
  const sorted = [...keyframes].sort((a, b) => b.time - a.time);
  const prev = sorted.find((kf) => kf.time < localTime - 0.1);
  return prev ? prev.time : null;
}
