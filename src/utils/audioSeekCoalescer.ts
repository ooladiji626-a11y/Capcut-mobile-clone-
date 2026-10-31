/**
 * Audio Seek Coalescer for Smooth Timeline Scrubbing
 * 
 * During rapid scrubbing on touch screens or mouse drags, hundreds of seek events
 * can be fired per second. Direct assignment to HTML5 audio elements on every
 * event causes audio hardware decoders to constantly stall and restart.
 * 
 * This coalescer keeps the visual preview and playhead responsive at full speed
 * while coalescing underlying audio element seeks, guaranteeing that the final
 * scrubbed position is committed accurately.
 */

export interface CoalescedSeekTarget {
  time: number;
  activeClipUrl?: string;
  clipStartTime: number;
  volume: number;
  isMuted: boolean;
}

export class AudioSeekCoalescer {
  private pendingTarget: CoalescedSeekTarget | null = null;
  private commitTimer: any = null;
  private lastCommitTime: number = 0;
  private minIntervalMs: number;
  private onCommitAudioSeek: (target: CoalescedSeekTarget) => void;

  constructor(
    onCommitAudioSeek: (target: CoalescedSeekTarget) => void,
    minIntervalMs: number = 60
  ) {
    this.onCommitAudioSeek = onCommitAudioSeek;
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Submits a seek request.
   * If immediate is true (e.g. while actively playing), commits without delay.
   * During scrubbing (immediate = false), coalesces rapid events.
   */
  public seek(target: CoalescedSeekTarget, immediate: boolean = false): void {
    this.pendingTarget = target;

    if (immediate) {
      this.flush();
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastCommitTime;

    if (elapsed >= this.minIntervalMs) {
      this.flush();
    } else {
      if (this.commitTimer) {
        clearTimeout(this.commitTimer);
      }
      const delay = Math.max(10, this.minIntervalMs - elapsed);
      this.commitTimer = setTimeout(() => {
        this.flush();
      }, delay);
    }
  }

  /**
   * Flushes any pending seek to ensure the exact final position is committed.
   */
  public flush(): void {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    if (this.pendingTarget) {
      const target = this.pendingTarget;
      this.pendingTarget = null;
      this.lastCommitTime = Date.now();
      this.onCommitAudioSeek(target);
    }
  }

  /**
   * Cancels any pending scheduled seek without executing it.
   */
  public cancel(): void {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    this.pendingTarget = null;
  }

  /**
   * Returns whether a seek is currently queued.
   */
  public hasPendingSeek(): boolean {
    return this.pendingTarget !== null;
  }
}
