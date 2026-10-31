/**
 * One-Click "Auto Ken Burns" Cinematic Motion Engine
 * 
 * Alternates subtle slow zooms and drift pans across all 300+ timeline clips
 * so static photos feel alive and dynamic across 12-20 minute documentary stories.
 */

import { VideoClip, Keyframe } from '../types';

export type KenBurnsMode = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';

export interface KenBurnsConfig {
  mode: KenBurnsMode;
  startScale: number;
  endScale: number;
  startX: number; // percentage offset -100 to 100
  endX: number;
  startY: number;
  endY: number;
}

/**
 * Returns the alternating motion configuration for clip at index i.
 */
export function getAlternatingKenBurnsConfig(index: number): KenBurnsConfig {
  const pattern = index % 4;
  switch (pattern) {
    case 0:
      // Subtle Zoom In (centered)
      return {
        mode: 'zoom-in',
        startScale: 1.00,
        endScale: 1.08,
        startX: 0,
        endX: 0,
        startY: 0,
        endY: 0,
      };
    case 1:
      // Gentle Pan Left with slight zoom cushion
      return {
        mode: 'pan-left',
        startScale: 1.05,
        endScale: 1.05,
        startX: 2.5,
        endX: -2.5,
        startY: 0,
        endY: 0,
      };
    case 2:
      // Subtle Zoom Out (centered)
      return {
        mode: 'zoom-out',
        startScale: 1.08,
        endScale: 1.00,
        startX: 0,
        endX: 0,
        startY: 0,
        endY: 0,
      };
    case 3:
    default:
      // Gentle Pan Right with slight zoom cushion
      return {
        mode: 'pan-right',
        startScale: 1.05,
        endScale: 1.05,
        startX: -2.5,
        endX: 2.5,
        startY: 0,
        endY: 0,
      };
  }
}

/**
 * Applies alternating Ken Burns cinematic motion keyframes across all clips in the project.
 */
export function applyAutoKenBurnsToClips(
  clips: VideoClip[],
  enabled: boolean = true
): VideoClip[] {
  return clips.map((clip, index) => {
    if (!enabled) {
      // Remove auto Ken Burns keyframes
      const filteredKeyframes = (clip.keyframes || []).filter(
        (kf: any) => !kf.isAutoKenBurns
      );
      return {
        ...clip,
        keyframes: filteredKeyframes,
        kenBurns: undefined,
      };
    }

    const cfg = getAlternatingKenBurnsConfig(index);
    const clipDur = Math.max(0.2, clip.duration);

    // Create 2 standard keyframes: at t=0 and t=clipDur
    const kfStart: Keyframe & { isAutoKenBurns?: boolean } = {
      id: `kf-kb-start-${clip.id}`,
      time: 0,
      properties: {
        scale: cfg.startScale,
        positionX: cfg.startX,
        positionY: cfg.startY,
        rotation: 0,
        opacity: 1,
      },
      isAutoKenBurns: true,
    } as any;

    const kfEnd: Keyframe & { isAutoKenBurns?: boolean } = {
      id: `kf-kb-end-${clip.id}`,
      time: clipDur,
      properties: {
        scale: cfg.endScale,
        positionX: cfg.endX,
        positionY: cfg.endY,
        rotation: 0,
        opacity: 1,
      },
      isAutoKenBurns: true,
    } as any;

    // Preserve any existing user manual keyframes that aren't auto-Ken Burns
    const nonAutoKeyframes = (clip.keyframes || []).filter(
      (kf: any) => !kf.isAutoKenBurns
    );

    return {
      ...clip,
      kenBurns: {
        enabled: true,
        mode: cfg.mode,
        startScale: cfg.startScale,
        endScale: cfg.endScale,
        startX: cfg.startX,
        endX: cfg.endX,
        startY: cfg.startY,
        endY: cfg.endY,
      },
      keyframes: [...nonAutoKeyframes, kfStart, kfEnd],
    };
  });
}

/**
 * Computes instantaneous Ken Burns transformation at normalized progress t in [0, 1].
 */
export function getKenBurnsTransform(
  clip: VideoClip,
  progress: number // 0.0 to 1.0
): { scale: number; translateXPercent: number; translateYPercent: number } {
  const p = Math.max(0, Math.min(1, progress));
  const kb = clip.kenBurns;

  if (!kb || !kb.enabled) {
    return { scale: 1.0, translateXPercent: 0, translateYPercent: 0 };
  }

  // Smooth ease-in-out curve
  const ease = 0.5 * (1 - Math.cos(p * Math.PI));

  const scale = kb.startScale + (kb.endScale - kb.startScale) * ease;
  const startX = kb.startX ?? 0;
  const endX = kb.endX ?? 0;
  const startY = kb.startY ?? 0;
  const endY = kb.endY ?? 0;

  const translateXPercent = startX + (endX - startX) * ease;
  const translateYPercent = startY + (endY - startY) * ease;

  return { scale, translateXPercent, translateYPercent };
}
