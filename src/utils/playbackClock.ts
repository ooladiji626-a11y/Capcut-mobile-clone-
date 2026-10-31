/**
 * Dedicated High-Frequency Playback Clock
 * 
 * Decouples 60fps playback ticks from root React component trees (App.tsx).
 * Allows isolated leaf components (Playhead, PreviewPlayer) to subscribe to
 * hardware-accelerated continuous time updates without triggering expensive
 * re-renders of the root App, modals, toolbars, and track lists.
 */

export type PlaybackTimeListener = (time: number, isPlaying: boolean) => void;

class PlaybackClock {
  private listeners = new Set<PlaybackTimeListener>();
  private _currentTime: number = 0;
  private _isPlaying: boolean = false;

  get currentTime(): number {
    return this._currentTime;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Broadcast high-frequency playback time to subscribers
   */
  setTime(time: number, isPlaying: boolean = false) {
    this._currentTime = time;
    this._isPlaying = isPlaying;
    this.listeners.forEach((listener) => {
      try {
        listener(time, isPlaying);
      } catch (err) {
        console.error('PlaybackClock listener error:', err);
      }
    });
  }

  /**
   * Subscribe to time updates
   */
  subscribe(listener: PlaybackTimeListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state upon subscription
    listener(this._currentTime, this._isPlaying);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const playbackClock = new PlaybackClock();
