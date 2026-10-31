import { SpeedCurvePoint, SpeedSettings, VideoClip } from '../types';

/**
 * Calculates the resulting duration on the timeline for a clip with given speed settings
 */
export function calculateSpeedAdjustedDuration(
  rawSpan: number,
  speed: number,
  speedSettings?: SpeedSettings
): number {
  if (!speedSettings || speedSettings.mode === 'normal') {
    return Math.max(0.1, rawSpan / Math.max(0.1, speed));
  }

  const { curvePoints } = speedSettings;
  if (!curvePoints || curvePoints.length < 2) {
    return Math.max(0.1, rawSpan / Math.max(0.1, speed));
  }

  let totalDuration = 0;
  for (let i = 0; i < curvePoints.length - 1; i++) {
    const p1 = curvePoints[i];
    const p2 = curvePoints[i + 1];
    const segmentSpan = (p2.timeRatio - p1.timeRatio) * rawSpan;
    const avgSpeed = (p1.speedMultiplier + p2.speedMultiplier) / 2;
    totalDuration += segmentSpan / Math.max(0.1, avgSpeed);
  }

  return Math.max(0.1, totalDuration);
}

/**
 * Calculates the raw source time within a clip (for frame selection) given the current elapsed timeline time inside the clip
 */
export function getRawSourceTimeAtProgress(
  clipLocalTimelineTime: number,
  clipTimelineDuration: number,
  clipRawDuration: number,
  speedSettings?: SpeedSettings
): number {
  if (clipTimelineDuration <= 0) return 0;

  // Normal constant speed
  if (!speedSettings || speedSettings.mode === 'normal') {
    const progress = clipLocalTimelineTime / clipTimelineDuration;
    return progress * clipRawDuration;
  }

  const { curvePoints } = speedSettings;
  if (!curvePoints || curvePoints.length < 2) {
    const progress = clipLocalTimelineTime / clipTimelineDuration;
    return progress * clipRawDuration;
  }

  // Calculate cumulative timeline duration for each segment of the curve
  let cumulativeTimelineTime = 0;
  const segments: {
    startTimelineTime: number;
    endTimelineTime: number;
    startRawRatio: number;
    endRawRatio: number;
    startSpeed: number;
    endSpeed: number;
  }[] = [];

  for (let i = 0; i < curvePoints.length - 1; i++) {
    const p1 = curvePoints[i];
    const p2 = curvePoints[i + 1];
    const rawSpan = (p2.timeRatio - p1.timeRatio) * clipRawDuration;
    const avgSpeed = (p1.speedMultiplier + p2.speedMultiplier) / 2;
    const segmentDuration = rawSpan / Math.max(0.1, avgSpeed);

    segments.push({
      startTimelineTime: cumulativeTimelineTime,
      endTimelineTime: cumulativeTimelineTime + segmentDuration,
      startRawRatio: p1.timeRatio,
      endRawRatio: p2.timeRatio,
      startSpeed: p1.speedMultiplier,
      endSpeed: p2.speedMultiplier,
    });

    cumulativeTimelineTime += segmentDuration;
  }

  // Scale timeline time if total curve duration differs from clip.duration
  const timeScale = cumulativeTimelineTime > 0 ? cumulativeTimelineTime / clipTimelineDuration : 1;
  const targetTime = clipLocalTimelineTime * timeScale;

  // Find active segment
  for (const seg of segments) {
    if (targetTime >= seg.startTimelineTime && targetTime <= seg.endTimelineTime) {
      const segSpan = Math.max(0.0001, seg.endTimelineTime - seg.startTimelineTime);
      const segProgress = (targetTime - seg.startTimelineTime) / segSpan;
      const rawRatio = seg.startRawRatio + segProgress * (seg.endRawRatio - seg.startRawRatio);
      return rawRatio * clipRawDuration;
    }
  }

  // Fallback
  return (clipLocalTimelineTime / clipTimelineDuration) * clipRawDuration;
}
