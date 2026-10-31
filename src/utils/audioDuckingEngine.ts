/**
 * Smart Auto-Ducking Engine
 * 
 * Automatically ducks background music (BGM) to 18% during active voiceover narration,
 * and smoothly swells music to 70% during speech pauses exceeding 1.5 seconds with
 * a 400ms organic transition curve.
 */

import { AudioTrackClip } from '../types';

export interface DuckingInterval {
  start: number; // in seconds
  end: number;   // in seconds
}

export interface DuckingPoint {
  time: number;  // in seconds
  gain: number;  // 0.0 to 1.0
}

export interface DuckingConfig {
  duckToPercent: number;    // default: 18 (0.18)
  pauseSwellPercent: number;// default: 70 (0.70)
  pauseThresholdSec: number;// default: 1.5 (1.5 seconds)
  rampUpMs: number;         // default: 400 (400ms swell)
  rampDownMs: number;       // default: 250 (250ms dip)
}

export const DEFAULT_DUCKING_CONFIG: DuckingConfig = {
  duckToPercent: 18,
  pauseSwellPercent: 70,
  pauseThresholdSec: 1.5,
  rampUpMs: 400,
  rampDownMs: 250,
};

/**
 * Extracts all active speech intervals from voiceover track clips.
 */
export function extractSpeechIntervals(
  audioClips: AudioTrackClip[],
  totalDuration: number
): DuckingInterval[] {
  const intervals: DuckingInterval[] = [];

  // Filter for voiceover clips
  const voiceClips = audioClips.filter(
    (c) => c.category === 'voiceover' || c.trackIndex === 1 || (!c.category && c.title.toLowerCase().includes('voice'))
  );

  for (const clip of voiceClips) {
    const clipStart = clip.startTime || 0;
    const clipEnd = clipStart + clip.duration;

    if (Array.isArray(clip.speechIntervals) && clip.speechIntervals.length > 0) {
      for (const sp of clip.speechIntervals) {
        if (!sp.isSilence) {
          intervals.push({
            start: Math.max(0, clipStart + sp.start),
            end: Math.min(totalDuration, clipStart + sp.end),
          });
        }
      }
    } else if (Array.isArray(clip.speechSegments) && clip.speechSegments.length > 0) {
      for (const seg of clip.speechSegments) {
        intervals.push({
          start: Math.max(0, clipStart + seg.start),
          end: Math.min(totalDuration, clipStart + seg.end),
        });
      }
    } else {
      // Entire clip treated as active voiceover interval
      intervals.push({
        start: Math.max(0, clipStart),
        end: Math.min(totalDuration, clipEnd),
      });
    }
  }

  // Sort by start time and merge overlapping intervals
  intervals.sort((a, b) => a.start - b.start);
  const merged: DuckingInterval[] = [];
  for (const cur of intervals) {
    if (merged.length === 0) {
      merged.push({ ...cur });
    } else {
      const prev = merged[merged.length - 1];
      if (cur.start <= prev.end + 0.1) {
        prev.end = Math.max(prev.end, cur.end);
      } else {
        merged.push({ ...cur });
      }
    }
  }

  return merged;
}

/**
 * Generates an automated gain curve across the timeline for Background Music.
 */
export function generateDuckingGainEnvelope(
  audioClips: AudioTrackClip[],
  totalDuration: number,
  config: DuckingConfig = DEFAULT_DUCKING_CONFIG
): DuckingPoint[] {
  const speechIntervals = extractSpeechIntervals(audioClips, totalDuration);

  const duckGain = config.duckToPercent / 100;       // e.g. 0.18
  const swellGain = config.pauseSwellPercent / 100;  // e.g. 0.70
  const rampUpSec = config.rampUpMs / 1000;          // e.g. 0.40s
  const rampDownSec = config.rampDownMs / 1000;      // e.g. 0.25s

  if (speechIntervals.length === 0) {
    // No voiceover found: full music volume
    return [
      { time: 0, gain: 1.0 },
      { time: Math.max(1, totalDuration), gain: 1.0 },
    ];
  }

  const points: DuckingPoint[] = [];

  // Initial state before first speech
  const first = speechIntervals[0];
  if (first.start > 0) {
    points.push({ time: 0, gain: swellGain });
    const dipStart = Math.max(0, first.start - rampDownSec);
    if (dipStart > 0) {
      points.push({ time: dipStart, gain: swellGain });
    }
  }
  points.push({ time: first.start, gain: duckGain });

  for (let i = 0; i < speechIntervals.length; i++) {
    const cur = speechIntervals[i];
    const next = speechIntervals[i + 1];

    // Maintain ducked level during speech
    points.push({ time: cur.end, gain: duckGain });

    if (next) {
      const gapDuration = next.start - cur.end;
      if (gapDuration >= config.pauseThresholdSec) {
        // Gap is long enough: swell music to 70%
        const swellStart = cur.end;
        const swellPeak = Math.min(next.start - rampDownSec, swellStart + rampUpSec);
        const swellEnd = Math.max(swellPeak, next.start - rampDownSec);

        points.push({ time: swellPeak, gain: swellGain });
        if (swellEnd > swellPeak) {
          points.push({ time: swellEnd, gain: swellGain });
        }
        points.push({ time: next.start, gain: duckGain });
      } else {
        // Short breath pause: remain ducked to prevent jarring volume jumps
        points.push({ time: next.start, gain: duckGain });
      }
    } else {
      // After final speech ends: swell back up to outro volume if audio continues past speech
      if (cur.end < totalDuration) {
        const swellPeak = Math.min(totalDuration, cur.end + rampUpSec);
        points.push({ time: swellPeak, gain: swellGain });
        if (totalDuration > swellPeak) {
          points.push({ time: totalDuration, gain: swellGain });
        }
      }
    }
  }

  // Deduplicate and ensure monotonic time points
  points.sort((a, b) => a.time - b.time);
  const deduped: DuckingPoint[] = [];
  for (const pt of points) {
    if (deduped.length === 0 || Math.abs(deduped[deduped.length - 1].time - pt.time) > 0.005) {
      deduped.push({ time: Number(pt.time.toFixed(3)), gain: Number(pt.gain.toFixed(3)) });
    } else {
      deduped[deduped.length - 1].gain = Number(pt.gain.toFixed(3));
    }
  }

  return deduped;
}

/**
 * Calculates ducking multiplier at any exact point in time (for canvas frame rendering or playback).
 */
export function getDuckingMultiplierAtTime(
  envelope: DuckingPoint[],
  currentTime: number
): number {
  if (!envelope || envelope.length === 0) return 1.0;
  if (currentTime <= envelope[0].time) return envelope[0].gain;
  if (currentTime >= envelope[envelope.length - 1].time) {
    return envelope[envelope.length - 1].gain;
  }

  // Binary search for surrounding envelope points
  let low = 0;
  let high = envelope.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (envelope[mid].time === currentTime) return envelope[mid].gain;
    if (envelope[mid].time < currentTime) low = mid + 1;
    else high = mid - 1;
  }

  const p0 = envelope[high];
  const p1 = envelope[low];
  if (!p0 || !p1) return 1.0;

  const alpha = (currentTime - p0.time) / Math.max(0.0001, p1.time - p0.time);
  // Smooth cosine s-curve interpolation
  const smoothAlpha = 0.5 * (1 - Math.cos(alpha * Math.PI));
  return p0.gain + (p1.gain - p0.gain) * smoothAlpha;
}
