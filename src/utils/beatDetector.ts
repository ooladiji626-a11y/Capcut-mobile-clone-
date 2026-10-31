import { BeatMarker, BeatDetectionConfig } from '../types';

/**
 * Generates rhythmic beat markers using transient peak detection and BPM grid heuristics.
 */
export function detectAudioBeats(
  waveformData: number[],
  duration: number,
  mode: 'dynamic-transient' | 'fixed-tempo' | 'chill-half' | 'hype-double' = 'dynamic-transient',
  manualBpm?: number
): { bpm: number; beats: BeatMarker[] } {
  // Estimate BPM based on waveform or mode
  let targetBpm = manualBpm || 124;
  if (!manualBpm) {
    if (mode === 'chill-half') targetBpm = 85;
    else if (mode === 'hype-double') targetBpm = 145;
    else if (waveformData.length > 20) {
      // Estimate tempo from transient spikes in waveform
      let peakCount = 0;
      for (let i = 1; i < waveformData.length - 1; i++) {
        if (waveformData[i] > 0.65 && waveformData[i] > waveformData[i - 1] && waveformData[i] >= waveformData[i + 1]) {
          peakCount++;
        }
      }
      const estimated = Math.round((peakCount / duration) * 60);
      if (estimated >= 65 && estimated <= 180) {
        targetBpm = estimated;
      }
    }
  }

  const secondsPerBeat = 60 / targetBpm;
  const beats: BeatMarker[] = [];
  const beatInterval = mode === 'chill-half' ? secondsPerBeat * 2 : mode === 'hype-double' ? secondsPerBeat / 2 : secondsPerBeat;

  let current = 0;
  let beatIndex = 0;

  while (current < duration) {
    // Determine if it lands near a downbeat (every 4th beat)
    const isDownbeat = beatIndex % 4 === 0;

    // Check transient intensity from waveform if available
    const waveformIndex = Math.min(
      Math.floor((current / duration) * (waveformData.length || 1)),
      (waveformData.length || 1) - 1
    );
    const intensity = waveformData[waveformIndex] || (isDownbeat ? 0.9 : 0.6);

    beats.push({
      time: Number(current.toFixed(3)),
      isDownbeat,
      intensity,
    });

    current += beatInterval;
    beatIndex++;
  }

  return {
    bpm: targetBpm,
    beats,
  };
}

/**
 * Snaps a target time to the nearest beat marker within a given threshold.
 */
export function snapToNearestBeat(
  targetTime: number,
  beatMarkers: (number | BeatMarker)[],
  threshold: number = 0.15
): { snappedTime: number; isSnapped: boolean; isDownbeat: boolean } {
  if (!beatMarkers || beatMarkers.length === 0) {
    return { snappedTime: targetTime, isSnapped: false, isDownbeat: false };
  }

  let closestDiff = Infinity;
  let snappedTime = targetTime;
  let isDownbeat = false;

  for (const marker of beatMarkers) {
    const markerTime = typeof marker === 'number' ? marker : marker.time;
    const markerIsDownbeat = typeof marker === 'number' ? false : marker.isDownbeat;
    const diff = Math.abs(targetTime - markerTime);

    if (diff < closestDiff) {
      closestDiff = diff;
      snappedTime = markerTime;
      isDownbeat = markerIsDownbeat;
    }
  }

  if (closestDiff <= threshold) {
    return { snappedTime, isSnapped: true, isDownbeat };
  }

  return { snappedTime: targetTime, isSnapped: false, isDownbeat: false };
}
