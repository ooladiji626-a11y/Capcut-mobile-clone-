import React, { useRef, useState } from 'react';
import { OverlayClip } from '../../types';
import { BarChart3 } from 'lucide-react';

interface OverlayTrackProps {
  overlays: OverlayClip[];
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
  onTrimOverlay: (id: string, deltaStart: number, deltaEnd: number) => void;
  onMoveOverlay?: (id: string, newStartTime: number) => void;
  pixelsPerSecond: number;
}

export const OverlayTrack: React.FC<OverlayTrackProps> = React.memo(({
  overlays,
  selectedOverlayId,
  onSelectOverlay,
  onTrimOverlay,
  onMoveOverlay,
  pixelsPerSecond,
}) => {
  const [heldClipId, setHeldClipId] = useState<string | null>(null);

  const trimDragRef = useRef<{
    id: string;
    handle: 'left' | 'right';
    startX: number;
  } | null>(null);

  const holdTimerRef = useRef<number | null>(null);
  const clipDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    initialStartTime: number;
    isHoldActive: boolean;
    hasMoved: boolean;
  } | null>(null);

  // Handle Trimming
  const handleHandlePointerDown = (e: React.PointerEvent, id: string, handle: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    trimDragRef.current = {
      id,
      handle,
      startX: e.clientX,
    };
  };

  const handleHandlePointerMove = (e: React.PointerEvent) => {
    if (!trimDragRef.current) return;
    const { id, handle, startX } = trimDragRef.current;
    const deltaPixels = e.clientX - startX;
    if (Math.abs(deltaPixels) < 1) return;
    trimDragRef.current.startX = e.clientX;
    const deltaSeconds = deltaPixels / pixelsPerSecond;

    if (handle === 'left') {
      onTrimOverlay(id, deltaSeconds, 0);
    } else {
      onTrimOverlay(id, 0, deltaSeconds);
    }
  };

  const handleHandlePointerUp = (e: React.PointerEvent) => {
    if (trimDragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      trimDragRef.current = null;
    }
  };

  // Hold & Drag to Move (CapCut exact mechanic)
  const handleClipPointerDown = (e: React.PointerEvent, id: string, startTime: number) => {
    if ((e.target as HTMLElement).closest('.trim-handle')) return;

    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    clipDragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialStartTime: startTime,
      isHoldActive: false,
      hasMoved: false,
    };

    // 240ms hold threshold
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      if (clipDragRef.current && !clipDragRef.current.hasMoved) {
        clipDragRef.current.isHoldActive = true;
        setHeldClipId(id);
        onSelectOverlay(id);
        try {
          if (navigator.vibrate) navigator.vibrate(30);
        } catch {}
      }
    }, 240);
  };

  const handleClipPointerMove = (e: React.PointerEvent) => {
    if (!clipDragRef.current) return;

    const deltaX = e.clientX - clipDragRef.current.startX;
    const deltaY = e.clientY - clipDragRef.current.startY;
    const dist = Math.hypot(deltaX, deltaY);

    if (!clipDragRef.current.isHoldActive) {
      if (dist > 7) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        clipDragRef.current.hasMoved = true;
      }
      return;
    }

    clipDragRef.current.hasMoved = true;
    if (onMoveOverlay) {
      const deltaSeconds = deltaX / pixelsPerSecond;
      const newStart = Math.max(0, clipDragRef.current.initialStartTime + deltaSeconds);
      onMoveOverlay(clipDragRef.current.id, newStart);
    }
  };

  const handleClipPointerUp = (e: React.PointerEvent, clipId: string) => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    if (clipDragRef.current) {
      const { isHoldActive, hasMoved } = clipDragRef.current;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      clipDragRef.current = null;
      setHeldClipId(null);

      if (!isHoldActive && !hasMoved) {
        onSelectOverlay(selectedOverlayId === clipId ? null : clipId);
      }
    }
  };

  // Group overlays into stacked sub-lanes without collision
  const lanes: OverlayClip[][] = [];
  const sortedOverlays = [...overlays].sort((a, b) => a.startTime - b.startTime);

  for (const item of sortedOverlays) {
    let placed = false;
    for (const lane of lanes) {
      const lastInLane = lane[lane.length - 1];
      if (item.startTime >= lastInLane.startTime + lastInLane.duration - 0.05) {
        lane.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
    }
  }

  const effectiveLanes = lanes.length > 0 ? lanes : [overlays];

  return (
    <div className="flex flex-col border-b border-white/5 bg-[#141414]" id="overlay-multi-tracks">
      {effectiveLanes.map((lane, laneIdx) => (
        <div
          key={`lane-${laneIdx}`}
          className="h-12 relative border-b border-white/5 last:border-b-0 flex items-center bg-[#151515]/60"
        >
          {lane.map((item) => {
            const isSelected = selectedOverlayId === item.id;
            const isHeld = heldClipId === item.id;
            const leftPos = item.startTime * pixelsPerSecond;
            const width = Math.max(36, item.duration * pixelsPerSecond);

            return (
              <div
                key={item.id}
                onPointerDown={(e) => handleClipPointerDown(e, item.id, item.startTime)}
                onPointerMove={handleClipPointerMove}
                onPointerUp={(e) => handleClipPointerUp(e, item.id)}
                onPointerCancel={(e) => handleClipPointerUp(e, item.id)}
                className={`absolute top-1 bottom-1 rounded-sm flex items-center select-none transition-transform duration-75 ${
                  isHeld
                    ? 'z-40 scale-[1.04] ring-2 ring-yellow-400 shadow-[0_8px_24px_rgba(0,0,0,0.85)] cursor-grabbing touch-none'
                    : isSelected
                    ? 'ring-2 ring-white z-20 shadow-md cursor-pointer touch-pan-x'
                    : 'border border-white/20 hover:border-white/50 z-10 cursor-pointer touch-pan-x'
                }`}
                style={{
                  left: `${leftPos}px`,
                  width: `${width}px`,
                  backgroundColor: '#27272a',
                }}
                id={`overlay-clip-${item.id}`}
              >
                {/* Visual Hold Indicator */}
                {isHeld && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-zinc-950 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow pointer-events-none whitespace-nowrap">
                    Moving {item.startTime.toFixed(1)}s
                  </div>
                )}

                {/* Visual Thumbnail Frames or Chart Gradient across the clip strip */}
                {item.type === 'chart' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-cyan-950/80 via-blue-950/60 to-indigo-950/80 pointer-events-none overflow-hidden">
                    <BarChart3 className="w-5 h-5 text-cyan-400/40" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center opacity-60 pointer-events-none overflow-hidden">
                    {item.thumbnailUrl && item.thumbnailUrl.trim() !== '' ? (
                      <>
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover grayscale contrast-125"
                        />
                        {width > 80 && (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover grayscale contrast-125 ml-1"
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-zinc-800/70 flex items-center justify-center">
                        <span className="text-[9px] text-zinc-400 font-mono truncate px-1">{item.title}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Duration Badge & Title Pill */}
                <div className={`relative z-10 px-1.5 flex items-center gap-1 backdrop-blur-xs rounded mx-1 pointer-events-none ${
                  item.type === 'chart' ? 'bg-cyan-950/80 border border-cyan-500/30' : 'bg-black/60'
                }`}>
                  {item.type === 'chart' && (
                    <BarChart3 className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
                  )}
                  <span className="text-[8px] font-mono font-bold text-zinc-300">
                    {item.duration.toFixed(1)}s
                  </span>
                  <span className="text-[9px] font-bold text-white tracking-wide truncate max-w-[90px]">
                    {item.title}
                  </span>
                </div>

                {/* Keyframe diamond indicators */}
                {item.keyframes &&
                  item.keyframes.map((kf, kfIdx) => (
                    <div
                      key={kf.id || kfIdx}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-amber-400 border border-black shadow-[0_0_4px_rgba(251,191,36,0.9)] z-20 pointer-events-none"
                      style={{ left: `${kf.time * pixelsPerSecond}px` }}
                    />
                  ))}

                {/* CapCut Solid White Trimming Handles */}
                {isSelected && !isHeld && (
                  <>
                    <div
                      onPointerDown={(e) => handleHandlePointerDown(e, item.id, 'left')}
                      onPointerMove={handleHandlePointerMove}
                      onPointerUp={handleHandlePointerUp}
                      onPointerCancel={handleHandlePointerUp}
                      className="trim-handle absolute left-0 top-0 bottom-0 w-3.5 bg-white flex items-center justify-center cursor-ew-resize z-30 touch-none shadow-sm"
                    >
                      <div className="w-[1.5px] h-3 bg-zinc-900 rounded-full pointer-events-none" />
                    </div>
                    <div
                      onPointerDown={(e) => handleHandlePointerDown(e, item.id, 'right')}
                      onPointerMove={handleHandlePointerMove}
                      onPointerUp={handleHandlePointerUp}
                      onPointerCancel={handleHandlePointerUp}
                      className="trim-handle absolute right-0 top-0 bottom-0 w-3.5 bg-white flex items-center justify-center cursor-ew-resize z-30 touch-none shadow-sm"
                    >
                      <div className="w-[1.5px] h-3 bg-zinc-900 rounded-full pointer-events-none" />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
