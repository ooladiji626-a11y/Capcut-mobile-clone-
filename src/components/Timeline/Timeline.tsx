import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { VideoClip, AudioTrackClip, CaptionClip, OverlayClip } from '../../types';
import { TimeRuler } from './TimeRuler';
import { VideoTrack } from './VideoTrack';
import { AudioTrack } from './AudioTrack';
import { CaptionTrack } from './CaptionTrack';
import { OverlayTrack } from './OverlayTrack';
import { TrackHeaders } from './TrackHeaders';
import { Playhead } from './Playhead';
import { Plus, ZoomIn, ZoomOut, Upload, FolderArchive, Wand2, Volume2, Sparkles } from 'lucide-react';
import { snapToNearestBeat } from '../../utils/beatDetector';

interface TimelineProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onPause?: () => void;
  pixelsPerSecond: number;
  onZoomChange: (pps: number) => void;
  onOpenAssetBin?: () => void;
  // Video Clips
  videoClips: VideoClip[];
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  onTrimClip: (clipId: string, deltaStart: number, deltaEnd: number) => void;
  onOpenTransition: (fromIndex: number) => void;
  onReorderVideoClips?: (fromIndex: number, toIndex: number) => void;
  onAddVideoClip: () => void;
  onImportMedia?: (files: FileList | File[]) => void;
  // Captions
  captions: CaptionClip[];
  selectedCaptionId: string | null;
  onSelectCaption: (id: string | null) => void;
  onTrimCaption: (id: string, deltaStart: number, deltaEnd: number) => void;
  onMoveCaption?: (id: string, newStartTime: number) => void;
  // Audio
  audioClips: AudioTrackClip[];
  selectedAudioId: string | null;
  onSelectAudio: (id: string | null) => void;
  onTrimAudio: (id: string, deltaStart: number, deltaEnd: number) => void;
  onMoveAudio?: (id: string, newStartTime: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  // Overlays
  overlays: OverlayClip[];
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
  onTrimOverlay: (id: string, deltaStart: number, deltaEnd: number) => void;
  onMoveOverlay?: (id: string, newStartTime: number) => void;
  // Cover
  coverThumbnail: string;
  onOpenCoverPicker: () => void;
  onOpenSmartHighlightsModal?: () => void;
  // Sound & Motion Controls
  isAutoKenBurnsActive?: boolean;
  onToggleAutoKenBurns?: () => void;
  isAutoDuckingActive?: boolean;
  onToggleAutoDucking?: () => void;
}

export const Timeline: React.FC<TimelineProps> = React.memo(({
  currentTime,
  totalDuration,
  isPlaying,
  onSeek,
  onPause,
  pixelsPerSecond,
  onZoomChange,
  onOpenAssetBin,
  isAutoKenBurnsActive = true,
  onToggleAutoKenBurns,
  isAutoDuckingActive = true,
  onToggleAutoDucking,
  videoClips,
  selectedClipId,
  onSelectClip,
  onTrimClip,
  onOpenTransition,
  onReorderVideoClips,
  onAddVideoClip,
  onImportMedia,
  captions,
  selectedCaptionId,
  onSelectCaption,
  onTrimCaption,
  onMoveCaption,
  audioClips,
  selectedAudioId,
  onSelectAudio,
  onTrimAudio,
  onMoveAudio,
  isMuted,
  onToggleMute,
  overlays,
  selectedOverlayId,
  onSelectOverlay,
  onTrimOverlay,
  onMoveOverlay,
  coverThumbnail,
  onOpenCoverPicker,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScroll = useRef(false);
  const isUserScrolling = useRef(false);
  const isUserInteractingRef = useRef(false);
  const lastProgrammaticScrollRef = useRef<number>(-1);
  const scrollEndTimer = useRef<number | null>(null);
  const rafSeekId = useRef<number | null>(null);
  const mouseRafSeekId = useRef<number | null>(null);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const lastDispatchedTime = useRef<number>(-1);
  const isPlayingRef = useRef(isPlaying);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      isUserInteractingRef.current = false;
      isUserScrolling.current = false;
      isMouseDownRef.current = false;
      pendingSeekTimeRef.current = null;
      if (rafSeekId.current) {
        cancelAnimationFrame(rafSeekId.current);
        rafSeekId.current = null;
      }
      if (mouseRafSeekId.current) {
        cancelAnimationFrame(mouseRafSeekId.current);
        mouseRafSeekId.current = null;
      }
    } else {
      if (rafSeekId.current) {
        cancelAnimationFrame(rafSeekId.current);
        rafSeekId.current = null;
      }
      if (mouseRafSeekId.current) {
        cancelAnimationFrame(mouseRafSeekId.current);
        mouseRafSeekId.current = null;
      }
      isProgrammaticScroll.current = false;
      lastProgrammaticScrollRef.current = -1;
    }
  }, [isPlaying]);

  // Horizontal Viewport Windowing (Safe buffer of 700px on either side)
  const [viewportRange, setViewportRange] = useState<{ startPx: number; endPx: number } | null>(null);
  const lastViewportUpdatePx = useRef<number>(-1);

  const updateViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollLeft = container.scrollLeft;
    const clientWidth = container.clientWidth || window.innerWidth || 1000;
    const bufferPx = 700;
    const startPx = Math.max(0, scrollLeft - bufferPx);
    const endPx = scrollLeft + clientWidth + bufferPx;

    setViewportRange((prev) => {
      // Coalesce updates unless the visible window has moved by at least 150px or wasn't initialized
      if (prev && Math.abs(prev.startPx - startPx) < 150 && Math.abs(prev.endPx - endPx) < 150) {
        return prev;
      }
      lastViewportUpdatePx.current = scrollLeft;
      return { startPx, endPx };
    });
  }, []);

  // Update viewport on mount, window resize, and zoom changes
  useEffect(() => {
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [updateViewport]);

  useEffect(() => {
    updateViewport();
  }, [pixelsPerSecond, totalDuration, updateViewport]);

  // Boundary auto-scroll: advance scrollLeft only when playhead reaches the edge boundary (e.g. 72%)
  const handleBoundaryReached = useCallback((targetScroll: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    isProgrammaticScroll.current = true;
    lastProgrammaticScrollRef.current = targetScroll;
    container.scrollLeft = targetScroll;
    updateViewport();
    requestAnimationFrame(() => {
      isProgrammaticScroll.current = false;
    });
  }, [updateViewport]);

  // Synchronize timeline scroll position when currentTime changes (e.g. seeking, pause, initial load)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || isUserInteractingRef.current || isMouseDownRef.current || isUserScrolling.current) return;

    // Decouple: During active playback, do NOT force container.scrollLeft on every frame (avoids layout thrashing)
    if (isPlaying || isPlayingRef.current) {
      return;
    }

    const targetScroll = currentTime * pixelsPerSecond;
    if (Math.abs(container.scrollLeft - targetScroll) > 0.8) {
      isProgrammaticScroll.current = true;
      lastProgrammaticScrollRef.current = targetScroll;
      container.scrollLeft = targetScroll;
      if (Math.abs(lastViewportUpdatePx.current - targetScroll) > 150) {
        updateViewport();
      }
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false;
      });
    }
  }, [currentTime, isPlaying, pixelsPerSecond, updateViewport]);

  // Gather beat markers across audio clips for magnetic snapping
  const allBeats = useMemo(() => {
    return audioClips.flatMap((c) => {
      if (!c.beatConfig?.snappingEnabled && c.beatConfig !== undefined) return [];
      if (!c.beatMarkers) return [];
      return c.beatMarkers.map((b) => {
        const bTime = typeof b === 'number' ? b : b.time;
        return {
          time: c.startTime + bTime,
          isDownbeat: typeof b === 'number' ? false : b.isDownbeat,
        };
      });
    });
  }, [audioClips]);

  // Ultra-Smooth 60fps Native Momentum Scroll Handler
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Keep viewport window in sync with scroll
    updateViewport();

    // Strict Scroll Gate During Playback: Block timeline scroll-event dispatch from triggering onSeek whenever isPlaying is true
    if (isPlaying || isPlayingRef.current) {
      return;
    }

    // Ignore programmatic updates
    if (isProgrammaticScroll.current) {
      return;
    }

    const scrollLeft = container.scrollLeft;

    isUserScrolling.current = true;
    if (scrollEndTimer.current) {
      clearTimeout(scrollEndTimer.current);
    }
    scrollEndTimer.current = window.setTimeout(() => {
      isUserScrolling.current = false;
      isUserInteractingRef.current = false;
      lastProgrammaticScrollRef.current = -1;
    }, 120);

    if (rafSeekId.current) {
      cancelAnimationFrame(rafSeekId.current);
    }

    rafSeekId.current = requestAnimationFrame(() => {
      rafSeekId.current = null;
      if (isPlayingRef.current || isProgrammaticScroll.current) return;
      const rawTime = Math.max(0, Math.min(totalDuration, scrollLeft / pixelsPerSecond));
      const { snappedTime } = snapToNearestBeat(rawTime, allBeats, 0.12);

      if (Math.abs(snappedTime - lastDispatchedTime.current) > 0.005) {
        lastDispatchedTime.current = snappedTime;
        onSeek(snappedTime);
      }
    });
  }, [pixelsPerSecond, onSeek, allBeats, isPlaying, totalDuration]);

  // PC Support: Mouse wheel (vertical wheel translates to horizontal scroll) & Shift+Wheel or trackpad horizontal
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // If user is holding Ctrl / Meta, let them zoom or prevent default
      if (e.ctrlKey || e.metaKey) {
        return;
      }
      // If there is vertical wheel delta but no horizontal delta, convert vertical scroll to horizontal
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        e.preventDefault();
        isUserInteractingRef.current = true;
        isUserScrolling.current = true;
        isProgrammaticScroll.current = false;
        if (isPlaying && onPause) {
          onPause();
        }
        container.scrollLeft += delta;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [isPlaying, onPause]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only primary left mouse button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag if clicking directly on a trim handle, button, or interactive handle
    if (
      target.closest('.trim-handle') ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    isMouseDownRef.current = true;
    isUserInteractingRef.current = true;
    if (isPlaying && onPause) {
      onPause();
    }
    hasDraggedRef.current = false;
    pendingSeekTimeRef.current = null;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = container.scrollLeft;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.trim-handle') ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }
    isUserInteractingRef.current = true;
    if (isPlaying && onPause) {
      onPause();
    }
  };

  const handlePointerUp = () => {
    if (scrollEndTimer.current) {
      clearTimeout(scrollEndTimer.current);
    }
    scrollEndTimer.current = window.setTimeout(() => {
      isUserInteractingRef.current = false;
      isUserScrolling.current = false;
    }, 80);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const dx = e.clientX - startXRef.current;
      if (Math.abs(dx) > 3) {
        hasDraggedRef.current = true;
      }
      if (hasDraggedRef.current) {
        const newScrollLeft = Math.max(0, startScrollLeftRef.current - dx);
        container.scrollLeft = newScrollLeft;
        const rawTime = Math.max(0, Math.min(totalDuration, newScrollLeft / pixelsPerSecond));
        const { snappedTime } = snapToNearestBeat(rawTime, allBeats, 0.12);
        pendingSeekTimeRef.current = snappedTime;

        if (!mouseRafSeekId.current) {
          mouseRafSeekId.current = requestAnimationFrame(() => {
            mouseRafSeekId.current = null;
            if (pendingSeekTimeRef.current !== null && Math.abs(pendingSeekTimeRef.current - lastDispatchedTime.current) > 0.005) {
              lastDispatchedTime.current = pendingSeekTimeRef.current;
              onSeek(pendingSeekTimeRef.current);
            }
          });
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        if (mouseRafSeekId.current) {
          cancelAnimationFrame(mouseRafSeekId.current);
          mouseRafSeekId.current = null;
        }

        const container = scrollContainerRef.current;
        if (container) {
          if (!hasDraggedRef.current) {
            // Click to seek: clicking anywhere on ruler or tracks centers the playhead at the clicked time
            const rect = container.getBoundingClientRect();
            const clickDistFromCenter = e.clientX - (rect.left + rect.width / 2);
            const targetScroll = Math.max(0, container.scrollLeft + clickDistFromCenter);
            const clickedTime = Math.max(0, Math.min(totalDuration, targetScroll / pixelsPerSecond));
            const { snappedTime } = snapToNearestBeat(clickedTime, allBeats, 0.12);
            lastDispatchedTime.current = snappedTime;
            onSeek(snappedTime);
            container.scrollLeft = snappedTime * pixelsPerSecond;
          } else if (pendingSeekTimeRef.current !== null) {
            // Commit final seek position immediately
            lastDispatchedTime.current = pendingSeekTimeRef.current;
            onSeek(pendingSeekTimeRef.current);
            pendingSeekTimeRef.current = null;
          }
        }
      }
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }
      scrollEndTimer.current = window.setTimeout(() => {
        isUserInteractingRef.current = false;
        isUserScrolling.current = false;
      }, 60);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (mouseRafSeekId.current) {
        cancelAnimationFrame(mouseRafSeekId.current);
        mouseRafSeekId.current = null;
      }
    };
  }, [allBeats, onSeek, pixelsPerSecond, totalDuration]);

  // Attach non-blocking passive touch and scroll listeners
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onPassiveScroll = () => {
      handleScroll();
    };

    container.addEventListener('scroll', onPassiveScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', onPassiveScroll);
    };
  }, [handleScroll]);

  const totalTrackWidth = useMemo(
    () =>
      Math.max(
        videoClips.reduce((sum, c) => sum + c.duration, 0) * pixelsPerSecond,
        totalDuration * pixelsPerSecond
      ),
    [videoClips, pixelsPerSecond, totalDuration]
  );

  // Group overlays into lanes count for track header alignment
  const overlayLaneCount = useMemo(() => {
    const overlayLanes: OverlayClip[][] = [];
    const sortedOverlays = [...overlays].sort((a, b) => a.startTime - b.startTime);
    for (const item of sortedOverlays) {
      let placed = false;
      for (const lane of overlayLanes) {
        const last = lane[lane.length - 1];
        if (item.startTime >= last.startTime + last.duration - 0.05) {
          lane.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        overlayLanes.push([item]);
      }
    }
    return Math.max(1, overlayLanes.length);
  }, [overlays]);

  return (
    <div
      className="relative w-full bg-[#121212] select-none flex flex-col border-t border-white/10 isolate z-10 overflow-hidden"
      id="capcut-timeline-container"
    >
      {/* Top Duration & Zoom Controls Header */}
      <div className="h-7 px-3 flex items-center justify-between bg-[#161616] border-b border-white/5 text-[11px] text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-300 font-medium">
            {currentTime.toFixed(2)}s / {totalDuration.toFixed(1)}s
          </span>

          <span className="text-zinc-600 hidden sm:inline">|</span>

          {/* Auto Ken Burns Cinematic Motion Toggle */}
          {onToggleAutoKenBurns && (
            <button
              onClick={onToggleAutoKenBurns}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all active:scale-95 cursor-pointer ${
                isAutoKenBurnsActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
              title="Toggle Auto Ken Burns alternating zooms & pans across clips"
              id="timeline-auto-ken-burns-btn"
            >
              <Wand2 className="w-3 h-3 text-cyan-400" />
              <span>Auto Ken Burns: {isAutoKenBurnsActive ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {/* Smart Auto-Ducking Status */}
          {onToggleAutoDucking && (
            <button
              onClick={onToggleAutoDucking}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all active:scale-95 cursor-pointer ${
                isAutoDuckingActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
              title="Smart Auto-Ducking: dips BGM to 18%, 400ms swell to 70% during speech pauses"
              id="timeline-auto-ducking-btn"
            >
              <Volume2 className="w-3 h-3 text-emerald-400" />
              <span>Auto-Duck: {isAutoDuckingActive ? '18% / 70%' : 'OFF'}</span>
            </button>
          )}
        </div>

        {/* Timeline Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onZoomChange(Math.max(20, pixelsPerSecond - 15))}
            className="p-1 hover:text-white rounded hover:bg-white/5 active:scale-95 transition-all text-zinc-400"
            title="Zoom Out Timeline"
            id="zoom-out-btn"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-zinc-400 w-9 text-center">
            {Math.round((pixelsPerSecond / 50) * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(160, pixelsPerSecond + 15))}
            className="p-1 hover:text-white rounded hover:bg-white/5 active:scale-95 transition-all text-zinc-400"
            title="Zoom In Timeline"
            id="zoom-in-btn"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Timeline Viewport */}
      <div className="relative w-full overflow-hidden flex bg-[#121212]">
        {/* Pinned Left-Side Track Headers */}
        <TrackHeaders
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          coverThumbnail={coverThumbnail}
          onOpenCoverPicker={onOpenCoverPicker}
          hasCaptions={captions.length > 0}
          hasAudio={audioClips.length > 0}
          hasOverlay={overlays.length > 0}
          overlayLaneCount={overlayLaneCount}
        />

        {/* Scrollable Tracks Area with Fixed Center White Playhead (CTI) */}
        <div className="relative flex-1 overflow-hidden flex flex-col">
          {/* 1. GPU-ACCELERATED PLAYHEAD (CTI) - Isolated translate3d movement with boundary auto-scroll */}
          <Playhead
            isPlaying={isPlaying}
            pixelsPerSecond={pixelsPerSecond}
            scrollContainerRef={scrollContainerRef}
            onBoundaryReached={handleBoundaryReached}
          />

          {/* 2. SCROLLABLE TIMELINE TRACKS CONTAINER - 60fps Native Momentum Scrolling & GPU Acceleration */}
          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="timeline-momentum-scroller w-full h-full overflow-x-auto overflow-y-hidden no-scrollbar cursor-grab active:cursor-grabbing touch-pan-x"
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
              transform: 'translateZ(0)',
            }}
            id="timeline-scroll-area"
          >
            {/* Track wrapper with 50% left & right padding so media start (0:00) and end reach the center line */}
            <div
              className="min-h-full flex flex-col"
              style={{
                paddingLeft: '50%',
                paddingRight: '50%',
                width: 'max-content',
                minWidth: `calc(100% + ${totalTrackWidth}px)`,
              }}
            >
              {/* Top Time Ruler */}
              <TimeRuler
                totalDuration={totalDuration}
                pixelsPerSecond={pixelsPerSecond}
                visibleStartPx={viewportRange?.startPx}
                visibleEndPx={viewportRange?.endPx}
              />

              {/* 1. Main Video Track (Top): Core storyline footage, border-radius: 8px */}
              <div className="flex items-center">
                <VideoTrack
                  clips={videoClips}
                  selectedClipId={selectedClipId}
                  onSelectClip={onSelectClip}
                  onTrimClip={onTrimClip}
                  onOpenTransition={onOpenTransition}
                  onReorderClips={onReorderVideoClips}
                  pixelsPerSecond={pixelsPerSecond}
                  visibleStartPx={viewportRange?.startPx}
                  visibleEndPx={viewportRange?.endPx}
                />

                {/* Add Clip Button at end of Main Track */}
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  {onOpenAssetBin && (
                    <button
                      onClick={onOpenAssetBin}
                      className="h-12 px-3 rounded-lg bg-[#1a1a26] border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-300 hover:text-white flex items-center gap-1.5 active:scale-95 transition-all text-xs font-semibold cursor-pointer shadow-sm"
                      title="Open Asset Bin to add assets or import new media"
                      id="timeline-open-asset-bin-btn"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add from Bin</span>
                    </button>
                  )}
                  <label
                    className="h-12 px-3 rounded-lg bg-[#222222] border border-dashed border-white/20 hover:border-white/50 text-zinc-400 hover:text-white flex items-center gap-1.5 active:scale-95 transition-all text-xs font-medium cursor-pointer"
                    title="Import media / .ZIP to Asset Bin"
                    id="add-media-clip-btn"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      multiple
                      accept="*/*,application/octet-stream,text/*,.srt,.vtt,.txt,audio/*,video/*,image/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.caf,.aiff,.aif,.wma,.opus,.m4r,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp4,.mov,.m4v,.webm,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.json,.zip,application/zip,application/x-zip-compressed,application/x-zip,multipart/x-zip"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          if (onImportMedia) {
                            onImportMedia(e.target.files);
                          } else {
                            onAddVideoClip();
                          }
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* 2. Overlay Track: Positioned directly below the main video */}
              {overlays.length > 0 && (
                <OverlayTrack
                  overlays={overlays}
                  selectedOverlayId={selectedOverlayId}
                  onSelectOverlay={onSelectOverlay}
                  onTrimOverlay={onTrimOverlay}
                  onMoveOverlay={onMoveOverlay}
                  pixelsPerSecond={pixelsPerSecond}
                />
              )}

              {/* 3. Audio Track: Positioned below overlay with visible waveforms */}
              {audioClips.length > 0 && (
                <AudioTrack
                  audioClips={audioClips}
                  selectedAudioId={selectedAudioId}
                  onSelectAudio={onSelectAudio}
                  onTrimAudio={onTrimAudio}
                  onMoveAudio={onMoveAudio}
                  pixelsPerSecond={pixelsPerSecond}
                  isAutoDuckingActive={isAutoDuckingActive}
                />
              )}

              {/* 4. Text / Caption Track (Bottom): Styled as smaller orange blocks */}
              {captions.length > 0 && (
                <CaptionTrack
                  captions={captions}
                  selectedCaptionId={selectedCaptionId}
                  onSelectCaption={onSelectCaption}
                  onTrimCaption={onTrimCaption}
                  onMoveCaption={onMoveCaption}
                  pixelsPerSecond={pixelsPerSecond}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
