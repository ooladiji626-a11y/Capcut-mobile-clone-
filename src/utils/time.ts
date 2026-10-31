/**
 * Time formatting helpers for Video Editor
 */

export function formatTimecode(seconds: number, fps: number = 30): string {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  const frames = Math.floor((safeSeconds % 1) * fps);

  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  const ff = frames.toString().padStart(2, '0');

  return `${mm}:${ss}:${ff}`;
}

export function formatSecondsShort(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTime(seconds: number): string {
  return formatSecondsShort(seconds);
}

export function calculateTotalDuration(clips: { duration: number }[]): number {
  return clips.reduce((acc, clip) => acc + clip.duration, 0);
}
