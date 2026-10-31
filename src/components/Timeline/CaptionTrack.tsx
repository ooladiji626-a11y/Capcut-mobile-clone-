import React, { useRef, useState } from 'react';
import { CaptionClip } from '../../types';

interface CaptionTrackProps {
  captions: CaptionClip[];
  selectedCaptionId: string | null;
  onSelectCaption: (id: string | null) => void;
  onTrimCaption: (id: string, deltaStart: number, deltaEnd: number) => void;
  onMoveCaption?: (id: string, newStartTime: number) => void;
  pixelsPerSecond: number;
}

export const CaptionTrack: React.FC<CaptionTrackProps> = React.memo(({
  captions,
  selectedCaptionId,
  onSelectCaption,
  onTrimCaption,
  onMoveCaption,
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
      onTrimCaption(id, deltaSeconds, 0);
    } else {
      onTrimCaption(id, 0, deltaSeconds);
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

    // 240ms hold threshold to activate drag-to-move mode
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      if (clipDragRef.current && !clipDragRef.current.hasMoved) {
        clipDragRef.current.isHoldActive = true;
        setHeldClipId(id);
        onSelectCaption(id);
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
    if (onMoveCaption) {
      const deltaSeconds = deltaX / pixelsPerSecond;
      const newStart = Math.max(0, clipDragRef.current.initialStartTime + deltaSeconds);
      onMoveCaption(clipDragRef.current.id, newStart);
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
        onSelectCaption(selectedCaptionId === clipId ? null : clipId);
      }
    }
  };

  // Group captions/text clips into stacked collision-free sub-lanes
  const lanes: CaptionClip[][] = [];
  const sortedCaptions = [...captions].sort((a, b) => a.startTime - b.startTime);

  for (const item of sortedCaptions) {
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

  const effectiveLanes = lanes.length > 0 ? lanes : [captions];

  return (
    <div className="flex flex-col border-b border-white/5 bg-[#121212]" id="text-multi-tracks">
      {effectiveLanes.map((lane, laneIdx) => (
        <div
          key={`text-lane-${laneIdx}`}
          className="h-10 relative border-b border-white/5 last:border-b-0 flex items-center bg-[#151515]"
        >
          {lane.map((caption) => {
            const isSelected = selectedCaptionId === caption.id;
            const isHeld = heldClipId === caption.id;
            const leftPos = caption.startTime * pixelsPerSecond;
            const width = Math.max(38, caption.duration * pixelsPerSecond);

            return (
              <div
                key={caption.id}
                onPointerDown={(e) => handleClipPointerDown(e, caption.id, caption.startTime)}
                onPointerMove={handleClipPointerMove}
                onPointerUp={(e) => handleClipPointerUp(e, caption.id)}
                onPointerCancel={(e) => handleClipPointerUp(e, caption.id)}
                className={`absolute top-1 bottom-1 rounded-sm flex items-center justify-center select-none transition-transform duration-75 ${
                  isHeld
                    ? 'z-40 scale-[1.04] ring-2 ring-yellow-400 bg-[#ea580c] shadow-[0_8px_24px_rgba(0,0,0,0.85)] cursor-grabbing touch-none'
                    : isSelected
                    ? 'ring-2 ring-white bg-[#f97316] z-20 shadow-md cursor-pointer touch-pan-x'
                    : 'bg-[#ea580c] hover:bg-[#f97316] z-10 cursor-pointer touch-pan-x'
                }`}
                style={{
                  left: `${leftPos}px`,
                  width: `${width}px`,
                }}
                id={`caption-clip-${caption.id}`}
              >
                {/* Visual Hold Indicator */}
                {isHeld && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-zinc-950 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow pointer-events-none whitespace-nowrap">
                    Moving {caption.startTime.toFixed(1)}s
                  </div>
                )}

                {/* Clean CapCut Centered Text Label */}
                <span className="text-[11px] font-bold text-white tracking-wide truncate px-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] pointer-events-none">
                  {caption.text}
                </span>

                {/* Selection Trimming Handles (CapCut Solid White with Dark Vertical Grip) */}
                {isSelected && !isHeld && (
                  <>
                    <div
                      onPointerDown={(e) => handleHandlePointerDown(e, caption.id, 'left')}
                      onPointerMove={handleHandlePointerMove}
                      onPointerUp={handleHandlePointerUp}
                      onPointerCancel={handleHandlePointerUp}
                      className="trim-handle absolute left-0 top-0 bottom-0 w-3.5 bg-white rounded-l-xs flex items-center justify-center cursor-ew-resize z-30 touch-none shadow-sm"
                    >
                      <div className="w-[1.5px] h-3 bg-zinc-900 rounded-full pointer-events-none" />
                    </div>
                    <div
                      onPointerDown={(e) => handleHandlePointerDown(e, caption.id, 'right')}
                      onPointerMove={handleHandlePointerMove}
                      onPointerUp={handleHandlePointerUp}
                      onPointerCancel={handleHandlePointerUp}
                      className="trim-handle absolute right-0 top-0 bottom-0 w-3.5 bg-white rounded-r-xs flex items-center justify-center cursor-ew-resize z-30 touch-none shadow-sm"
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
