import React, { useMemo } from 'react';
import { formatSecondsShort } from '../../utils/time';

interface TimeRulerProps {
  totalDuration: number;
  pixelsPerSecond: number;
  visibleStartPx?: number;
  visibleEndPx?: number;
}

export const TimeRuler: React.FC<TimeRulerProps> = React.memo(({
  totalDuration,
  pixelsPerSecond,
  visibleStartPx,
  visibleEndPx,
}) => {
  // Add extra seconds at the end for comfortable scrolling
  const visibleSeconds = Math.ceil(totalDuration) + 10;

  // Adapt step interval so we don't render thousands of DOM nodes on long timelines
  const step = useMemo(() => {
    if (pixelsPerSecond <= 25) return totalDuration > 120 ? 10 : 5;
    if (pixelsPerSecond <= 45) return totalDuration > 240 ? 5 : (totalDuration > 60 ? 2 : 1);
    return totalDuration > 300 ? 2 : 1;
  }, [pixelsPerSecond, totalDuration]);

  const secondItems = useMemo(() => {
    const minSec = typeof visibleStartPx === 'number'
      ? Math.max(0, Math.floor(visibleStartPx / pixelsPerSecond))
      : 0;
    const maxSec = typeof visibleEndPx === 'number'
      ? Math.min(visibleSeconds, Math.ceil(visibleEndPx / pixelsPerSecond))
      : visibleSeconds;

    // Align to step boundary so ticks don't jump phase when scrolling
    const startAligned = Math.floor(minSec / step) * step;

    const items: number[] = [];
    for (let i = startAligned; i <= maxSec; i += step) {
      items.push(i);
    }
    return items;
  }, [visibleSeconds, step, visibleStartPx, visibleEndPx, pixelsPerSecond]);

  return (
    <div className="h-6 w-full relative select-none border-b border-white/10 flex items-end pb-0.5">
      {secondItems.map((sec) => {
        const leftPos = sec * pixelsPerSecond;
        return (
          <div
            key={sec}
            className="absolute top-0 bottom-0 flex flex-col justify-between"
            style={{ left: `${leftPos}px` }}
          >
            {/* Time label */}
            <span className="text-[9px] font-mono text-zinc-400 pl-1 select-none pointer-events-none">
              {formatSecondsShort(sec)}
            </span>

            {/* Major tick mark */}
            <div className="h-2 w-[1px] bg-zinc-400" />

            {/* Sub ticks (frames / quarter seconds) - only when zoomed in and step is 1 */}
            {pixelsPerSecond >= 50 && step === 1 && (
              <>
                <div
                  className="absolute bottom-0 h-1 w-[1px] bg-zinc-600"
                  style={{ left: `${pixelsPerSecond * 0.25}px` }}
                />
                <div
                  className="absolute bottom-0 h-1.5 w-[1px] bg-zinc-500"
                  style={{ left: `${pixelsPerSecond * 0.5}px` }}
                />
                <div
                  className="absolute bottom-0 h-1 w-[1px] bg-zinc-600"
                  style={{ left: `${pixelsPerSecond * 0.75}px` }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
});

