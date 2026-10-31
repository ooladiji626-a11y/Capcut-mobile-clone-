import React, { useEffect, useRef } from 'react';
import { playbackClock } from '../../utils/playbackClock';

interface PlayheadProps {
  isPlaying?: boolean;
  pixelsPerSecond?: number;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onBoundaryReached?: (targetScroll: number) => void;
}

export const Playhead: React.FC<PlayheadProps> = React.memo(({
  isPlaying = false,
  pixelsPerSecond = 50,
  scrollContainerRef,
  onBoundaryReached,
}) => {
  const playheadElRef = useRef<HTMLDivElement | null>(null);
  const lastBoundaryAdvanceTimeRef = useRef<number>(0);

  useEffect(() => {
    // When paused, stopped, or scrubbing, playhead is locked to exact 50% center
    if (!isPlaying) {
      if (playheadElRef.current) {
        playheadElRef.current.style.transform = 'translate3d(0px, 0, 0) translateX(-50%)';
      }
      return;
    }

    const unsubscribe = playbackClock.subscribe((time, playing) => {
      if (!playheadElRef.current) return;
      const container = scrollContainerRef?.current;
      if (!playing || !container) {
        playheadElRef.current.style.transform = 'translate3d(0px, 0, 0) translateX(-50%)';
        return;
      }

      const clientWidth = container.clientWidth || window.innerWidth || 400;
      const scrollLeft = container.scrollLeft;
      const playheadTrackX = time * pixelsPerSecond;
      // Screen offset from center line (0 = exact 50% center of container)
      const offsetFromCenter = playheadTrackX - scrollLeft;
      const screenX = (clientWidth / 2) + offsetFromCenter;

      // Boundary paging: when playhead passes 72% of visible viewport (or falls behind 15%)
      const now = performance.now();
      if (screenX >= clientWidth * 0.72 || screenX < clientWidth * 0.15) {
        if (now - lastBoundaryAdvanceTimeRef.current > 400) {
          lastBoundaryAdvanceTimeRef.current = now;
          onBoundaryReached?.(playheadTrackX);
        }
      }

      // Hardware-accelerated GPU translate3d positioning (zero React re-renders)
      playheadElRef.current.style.transform = `translate3d(${offsetFromCenter}px, 0, 0) translateX(-50%)`;
    });

    return () => {
      unsubscribe();
    };
  }, [isPlaying, pixelsPerSecond, scrollContainerRef, onBoundaryReached]);

  return (
    <div
      ref={playheadElRef}
      className="absolute top-0 bottom-0 pointer-events-none z-50 flex flex-col items-center select-none"
      id="fixed-center-white-playhead"
      style={{
        left: '50%',
        transform: 'translate3d(0px, 0, 0) translateX(-50%)',
        willChange: 'transform',
      }}
    >
      {/* CapCut Solid Pure White Top Pointer / Marker (Pointing Downwards at Ruler) */}
      <div className="flex flex-col items-center -top-1 absolute z-50 pointer-events-none">
        {/* Top White Cap */}
        <div
          className="w-4 h-3.5 bg-white rounded-t-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.85)] flex items-center justify-center border-t border-x border-white"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
        </div>
        {/* Downward White Triangle Tip */}
        <div
          className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[7px] border-t-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
          style={{ borderTopColor: '#ffffff' }}
        />
      </div>

      {/* Solid Pure White Line (#FFFFFF) - Hardware Accelerated & Ultra-Sharp */}
      <div
        className="w-[2px] h-full shadow-[0_0_6px_rgba(255,255,255,0.45)]"
        style={{
          backgroundColor: '#ffffff',
          width: '2px',
        }}
      />

      {/* CapCut Bottom Rounded Pure White Stopper */}
      <div
        className="w-3 h-2 bg-white rounded-b-full shadow-[0_2px_6px_rgba(0,0,0,0.85)] absolute bottom-0 z-50 pointer-events-none"
        style={{ backgroundColor: '#ffffff' }}
      />
    </div>
  );
});
