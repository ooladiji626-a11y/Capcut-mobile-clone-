import React, { useState } from 'react';
import {
  VideoClip,
  CaptionClip,
  OverlayClip,
  AudioTrackClip,
  AspectRatio,
  ShapeMaskConfig,
  BlendMode,
} from '../types';
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Sliders,
  X,
  Edit2,
  Palette,
  Check,
  Layers,
  Move,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { formatTimecode } from '../utils/time';
import { interpolateKeyframes } from '../utils/keyframe';
import { getKenBurnsTransform } from '../utils/cinematicMotion';
import { getRawSourceTimeAtProgress } from '../utils/speed';
import { VideoChartOverlay } from './Charts/VideoChartOverlay';
import { playbackClock } from '../utils/playbackClock';

// Helper to compute CSS clip-path for shape masks
export const getClipPathForMask = (mask?: ShapeMaskConfig): string | undefined => {
  if (!mask || mask.type === 'none') return undefined;
  const size = mask.size ?? 80;
  const roundness = mask.roundness ?? 20;

  switch (mask.type) {
    case 'circle':
      return `circle(${size / 2}% at 50% 50%)`;
    case 'rectangle': {
      const inset = Math.max(0, (100 - size) / 2);
      return `inset(${inset}% round ${roundness}%)`;
    }
    case 'heart':
      return `polygon(50% 15%, 62% 2%, 80% 2%, 95% 15%, 98% 35%, 88% 60%, 50% 95%, 12% 60%, 2% 35%, 5% 15%, 20% 2%, 38% 2%)`;
    case 'star':
      return `polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)`;
    case 'split-horizontal':
      return `polygon(0% 0%, ${size}% 0%, ${size}% 100%, 0% 100%)`;
    case 'split-vertical':
      return `polygon(0% 0%, 100% 0%, 100% ${size}%, 0% ${size}%)`;
    case 'filmstrip':
      return `inset(10% 5% 10% 5% round ${roundness}px)`;
    case 'linear-wipe':
      return `polygon(0% 0%, ${size}% 0%, ${Math.max(0, size - 20)}% 100%, 0% 100%)`;
    default:
      return undefined;
  }
};

interface PreviewPlayerProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepFrame: (direction: -1 | 1) => void;
  videoClips: VideoClip[];
  captions: CaptionClip[];
  overlays: OverlayClip[];
  audioClips?: AudioTrackClip[];
  aspectRatio: AspectRatio;
  isMuted: boolean;
  onToggleMute: () => void;
  // Selection and Tap Handlers
  selectedClipId: string | null;
  selectedCaptionId?: string | null;
  selectedAudioId?: string | null;
  selectedOverlayId?: string | null;
  onSelectClip: (clipId: string | null) => void;
  onSelectCaption: (captionId: string | null) => void;
  onSelectOverlay: (overlayId: string | null) => void;
  onDeleteCaption?: (captionId: string) => void;
  onUpdateCaptionText?: (captionId: string, newText: string) => void;
  onCycleCaptionStyle?: (captionId: string) => void;
  onOpenPIPBlendModal?: (targetId: string, type: 'overlay' | 'clip') => void;
  onDeleteOverlay?: (overlayId: string) => void;
  onOpenEditChart?: (overlayId: string) => void;
  onUpdateOverlayTransform?: (
    overlayId: string,
    transform: { x: number; y: number; scale: number; rotation: number }
  ) => void;
  // Keyframe Props
  hasKeyframeAtPlayhead?: boolean;
  onToggleKeyframe?: () => void;
  onPrevKeyframe?: () => void;
  onNextKeyframe?: () => void;
  onOpenKeyframeModal?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = React.memo(({
  currentTime,
  totalDuration,
  isPlaying,
  onTogglePlay,
  onStepFrame,
  videoClips,
  captions,
  overlays,
  audioClips = [],
  aspectRatio,
  isMuted,
  onToggleMute,
  selectedClipId,
  selectedCaptionId,
  selectedAudioId,
  selectedOverlayId,
  onSelectClip,
  onSelectCaption,
  onSelectOverlay,
  onDeleteCaption,
  onUpdateCaptionText,
  onCycleCaptionStyle,
  onOpenPIPBlendModal,
  onDeleteOverlay,
  onOpenEditChart,
  onUpdateOverlayTransform,
  hasKeyframeAtPlayhead = false,
  onToggleKeyframe,
  onPrevKeyframe,
  onNextKeyframe,
  onOpenKeyframeModal,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [editTextValue, setEditTextValue] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const videoElementRef = React.useRef<HTMLVideoElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 1800);
  };

  // High-frequency live playback clock:
  // Decouples PreviewPlayer 60fps frame/Ken Burns animation from parent App re-renders
  const [livePlaybackTime, setLivePlaybackTime] = useState<number>(currentTime);

  React.useEffect(() => {
    setLivePlaybackTime(currentTime);
  }, [currentTime]);

  React.useEffect(() => {
    return playbackClock.subscribe((clockTime, isPlayingNow) => {
      if (isPlayingNow) {
        setLivePlaybackTime(clockTime);
      }
    });
  }, []);

  const effectiveTime = isPlaying ? livePlaybackTime : currentTime;

  // Find active video clip based on effectiveTime
  let accumulatedTime = 0;
  let activeClip: VideoClip | null = null;
  let clipLocalTime = 0;

  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    const cStart = clip.timelineStart !== undefined ? clip.timelineStart : accumulatedTime;
    const cEnd = clip.timelineEnd !== undefined ? clip.timelineEnd : accumulatedTime + clip.duration;
    const isLast = i === videoClips.length - 1;
    if (effectiveTime >= cStart && (effectiveTime < cEnd || (isLast && effectiveTime <= cEnd + 0.05))) {
      activeClip = clip;
      clipLocalTime = effectiveTime - cStart;
      break;
    }
    accumulatedTime += clip.duration;
  }

  // Fallback to first or last clip
  if (!activeClip && videoClips.length > 0) {
    if (effectiveTime >= accumulatedTime) {
      activeClip = videoClips[videoClips.length - 1];
      clipLocalTime = activeClip.duration;
    } else {
      activeClip = videoClips[0];
      clipLocalTime = 0;
    }
  }

  // Video Element Playback & Seek Synchronizer
  const prevVideoPlayingRef = React.useRef(isPlaying);
  React.useEffect(() => {
    if (videoElementRef.current && activeClip?.type === 'video') {
      const vid = videoElementRef.current;
      const isPastVideoClips = effectiveTime >= accumulatedTime;

      if (isPastVideoClips) {
        if (!vid.paused) {
          vid.pause();
        }
        prevVideoPlayingRef.current = isPlaying;
        return;
      }

      const sourceOffset = activeClip.sourceStartSecond !== undefined
        ? activeClip.sourceStartSecond
        : (activeClip.sourceIn !== undefined ? activeClip.sourceIn : (activeClip.startOffset || 0));
      const targetTime = (clipLocalTime * (activeClip.speed || 1)) + sourceOffset;
      const justStarted = isPlaying && !prevVideoPlayingRef.current;
      prevVideoPlayingRef.current = isPlaying;

      const drift = Math.abs(vid.currentTime - targetTime);
      if (justStarted || drift > 1.2) {
        vid.currentTime = targetTime;
      } else if (!isPlaying && drift > 0.05) {
        // Prevent video decoder pipeline bottleneck during fast timeline scrubbing
        if (!vid.seeking) {
          const fastSeekVid = vid as unknown as { fastSeek?: (t: number) => void };
          if (typeof fastSeekVid.fastSeek === 'function') {
            fastSeekVid.fastSeek(targetTime);
          } else {
            vid.currentTime = targetTime;
          }
        }
      }
      if (isPlaying && vid.paused) {
        vid.play().catch(() => {});
      } else if (!isPlaying && !vid.paused) {
        vid.pause();
      }
    } else {
      prevVideoPlayingRef.current = isPlaying;
    }
  }, [effectiveTime, isPlaying, activeClip, clipLocalTime, accumulatedTime]);

  // Find active caption
  const activeCaption = captions.find(
    (c) => effectiveTime >= c.startTime && effectiveTime < c.startTime + c.duration
  );

  // Find active overlay
  const activeOverlay = overlays.find(
    (o) => effectiveTime >= o.startTime && effectiveTime < o.startTime + o.duration
  );

  // Pick frame image based on local clip time progress and speed curve mapping
  let activeFrameImg = activeClip?.thumbnailUrl || activeClip?.url;
  if (activeClip && activeClip.frames && activeClip.frames.length > 0) {
    const rawTime = getRawSourceTimeAtProgress(
      clipLocalTime,
      activeClip.duration,
      activeClip.rawDuration || activeClip.duration,
      activeClip.speedSettings
    );
    const rawTotal = activeClip.rawDuration || activeClip.duration;
    const progress = rawTotal > 0 ? Math.max(0, Math.min(1, rawTime / rawTotal)) : clipLocalTime / Math.max(0.1, activeClip.duration);
    const frameIndex = Math.min(
      activeClip.frames.length - 1,
      Math.max(0, Math.floor(progress * activeClip.frames.length))
    );
    activeFrameImg = activeClip.frames[frameIndex] || activeClip.thumbnailUrl || activeClip.url;
  }

  // Active Transition calculation with Next Clip
  let activeTransition: {
    type: string;
    name: string;
    progress: number;
    nextClipImg?: string;
  } | null = null;

  if (activeClip && activeClip.transitionAfter) {
    const transDuration = activeClip.transitionAfter.duration || 0.5;
    const transStartTime = activeClip.duration - transDuration;
    if (clipLocalTime >= transStartTime) {
      const transProgress = Math.max(
        0,
        Math.min(1, (clipLocalTime - transStartTime) / Math.max(0.01, transDuration))
      );
      const activeClipIdx = videoClips.findIndex((c) => c.id === activeClip?.id);
      const nextClip = activeClipIdx >= 0 && activeClipIdx < videoClips.length - 1 ? videoClips[activeClipIdx + 1] : null;
      activeTransition = {
        type: activeClip.transitionAfter.type,
        name: activeClip.transitionAfter.name,
        progress: transProgress,
        nextClipImg: nextClip?.thumbnailUrl || nextClip?.frames?.[0],
      };
    }
  }

  // Interpolate active clip transform from its keyframes
  const clipTransform = interpolateKeyframes(activeClip?.keyframes, clipLocalTime);

  // Apply Auto Ken Burns cinematic motion if enabled
  if (activeClip?.kenBurns && activeClip.kenBurns.enabled) {
    const kb = getKenBurnsTransform(activeClip, clipLocalTime / Math.max(0.1, activeClip.duration));
    clipTransform.scale = (clipTransform.scale || 1.0) * kb.scale;
    clipTransform.x = (clipTransform.x || 0) + kb.translateXPercent;
    clipTransform.y = (clipTransform.y || 0) + kb.translateYPercent;
  }

  // Color Grade & LUT Filter for active clip
  const computeActiveClipFilter = () => {
    let b = 100 + (activeClip?.adjustments?.brightness || 0);
    let c = 100 + (activeClip?.adjustments?.contrast || 0);
    let s = 100 + (activeClip?.adjustments?.saturation || 0);
    let sepia = 0;
    let hue = 0;
    const filterPreset = activeClip?.filterPreset;

    if (filterPreset === 'oppenheimer') {
      b += 5;
      c += 20;
      s += 15;
      sepia += 25;
    } else if (filterPreset === 'cinematic-teal') {
      c += 25;
      hue += 15;
      s += 20;
    } else if (filterPreset === 'kodak-vintage') {
      c += 10;
      s -= 10;
      sepia += 35;
    } else if (filterPreset === 'dark-noir') {
      s = 0;
      c += 35;
      b -= 5;
    } else if (filterPreset === 'golden-hour') {
      b += 10;
      s += 25;
      sepia += 30;
    } else if (filterPreset === 'bleach-bypass') {
      c += 40;
      s -= 50;
    } else if (filterPreset === 'cyberpunk') {
      c += 30;
      s += 60;
      hue -= 20;
    } else if (filterPreset === 'forest-mood') {
      s -= 20;
      c += 15;
      hue += 10;
    } else if (filterPreset === 'vhs-retro') {
      c += 20;
      s += 40;
      hue += 30;
    }

    if (activeClip?.adjustments?.temperature) {
      sepia += activeClip.adjustments.temperature * 0.4;
    }
    if (activeClip?.adjustments?.tint) {
      hue += activeClip.adjustments.tint * 0.5;
    }

    let filterStr = `brightness(${Math.max(10, b)}%) contrast(${Math.max(10, c)}%) saturate(${Math.max(0, s)}%) sepia(${Math.min(100, Math.max(0, sepia))}%) hue-rotate(${hue}deg)`;

    if (activeClip?.backgroundBlur) {
      filterStr += ` blur(${activeClip.backgroundBlur}px)`;
    }

    if (activeTransition?.type === 'blur-fade') {
      filterStr += ` blur(${activeTransition.progress * 10}px)`;
    } else if (activeTransition?.type === 'glitch') {
      filterStr += ` hue-rotate(${activeTransition.progress * 180}deg) saturate(200%)`;
    }

    return filterStr;
  };

  // Aspect ratio styling
  const aspectClass =
    aspectRatio === '9:16'
      ? 'aspect-[9/16] max-h-[36vh]'
      : aspectRatio === '16:9'
      ? 'aspect-[16/9] max-h-[32vh]'
      : aspectRatio === '1:1'
      ? 'aspect-[1/1] max-h-[32vh]'
      : 'aspect-[4/5] max-h-[36vh]';

  const isCurrentClipSelected = Boolean(selectedClipId && activeClip && selectedClipId === activeClip.id);
  const isCurrentCaptionSelected = Boolean(selectedCaptionId && activeCaption && selectedCaptionId === activeCaption.id);
  const isCurrentOverlaySelected = Boolean(selectedOverlayId && activeOverlay && selectedOverlayId === activeOverlay.id);

  const handleStartEditCaption = (cap: CaptionClip) => {
    setEditingCaptionId(cap.id);
    setEditTextValue(cap.text);
  };

  const handleSaveCaptionText = () => {
    if (editingCaptionId && onUpdateCaptionText) {
      onUpdateCaptionText(editingCaptionId, editTextValue);
    }
    setEditingCaptionId(null);
  };

  return (
    <div
      className="relative w-full flex flex-col items-center justify-between bg-black select-none overflow-hidden"
      id="preview-player-container"
    >
      {/* Video Canvas Stage Container */}
      <div className="relative w-full flex-1 flex items-center justify-center p-2 min-h-[190px]">
        {/* On-screen Toast Notification for CapCut Selection Feedback */}
        {toastMessage && (
          <div className="absolute top-4 z-40 bg-cyan-500/90 text-black font-semibold text-xs px-3 py-1 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
            {toastMessage}
          </div>
        )}

        <div
          onClick={(e) => {
            // Tapping directly on the screen selects the active clip under the playhead
            if (activeClip) {
              onSelectClip(isCurrentClipSelected ? null : activeClip.id);
              showToast(
                isCurrentClipSelected
                  ? 'Deselected'
                  : `Clip "${activeClip.title}" highlighted on timeline`
              );
            }
          }}
          className={`relative ${aspectClass} w-auto max-w-full rounded-lg overflow-hidden bg-[#0c0c0c] shadow-2xl flex items-center justify-center transition-all cursor-pointer ${
            isCurrentClipSelected
              ? 'ring-2 ring-white'
              : 'border border-white/10 hover:border-white/20'
          }`}
          id="video-canvas-stage"
        >
          {/* Backdrop Layer for Chroma Key / Auto Cutout */}
          {activeClip?.cutout?.enabled && activeClip.cutout.backdrop && activeClip.cutout.backdrop !== 'transparent' && (
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              {activeClip.cutout.backdrop === 'cyberpunk-city' ? (
                <img
                  src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80"
                  alt="Backdrop"
                  className="w-full h-full object-cover"
                />
              ) : activeClip.cutout.backdrop === 'studio-gradient' ? (
                <img
                  src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80"
                  alt="Backdrop"
                  className="w-full h-full object-cover"
                />
              ) : activeClip.cutout.backdrop === 'outer-space' ? (
                <img
                  src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80"
                  alt="Backdrop"
                  className="w-full h-full object-cover"
                />
              ) : activeClip.cutout.backdrop === 'blur' ? (
                <div className="w-full h-full bg-gradient-to-tr from-cyan-900/80 via-indigo-900/80 to-purple-900/80 backdrop-blur-2xl" />
              ) : activeClip.cutout.backdrop === 'custom-color' ? (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: activeClip.cutout.backdropColor || '#1e1b4b' }}
                />
              ) : null}
            </div>
          )}

          {/* Active Frame / Scene with Real-Time Transform & Transition Blending (GPU-accelerated translate3d) */}
          <div
            className={`w-full h-full flex items-center justify-center overflow-hidden relative z-5 ${isPlaying ? '' : 'transition-transform duration-75'}`}
            style={{
              transform: `translate3d(${clipTransform.x}%, ${clipTransform.y}%, 0) scale(${clipTransform.scale}) rotate(${clipTransform.rotation}deg)`,
              willChange: 'transform',
              opacity:
                activeTransition?.type === 'dissolve' || activeTransition?.type === 'blur-fade'
                  ? (1 - activeTransition.progress) * (clipTransform.opacity ?? 1)
                  : activeTransition?.type === 'fade-black'
                  ? Math.max(0, 1 - activeTransition.progress * 2) * (clipTransform.opacity ?? 1)
                  : activeTransition?.type === 'zoom-in'
                  ? (1 - activeTransition.progress * 0.7) * (clipTransform.opacity ?? 1)
                  : clipTransform.opacity,
              filter: computeActiveClipFilter(),
              mixBlendMode: (activeClip?.blendMode && activeClip.blendMode !== 'normal') ? (activeClip.blendMode as any) : undefined,
              clipPath: getClipPathForMask(activeClip?.mask),
              maskImage: activeClip?.cutout?.enabled
                ? 'radial-gradient(ellipse 65% 85% at 50% 55%, black 45%, rgba(0,0,0,0.85) 65%, transparent 100%)'
                : activeClip?.chromaKey?.enabled
                ? `radial-gradient(ellipse 70% 85% at 50% 55%, black ${100 - (activeClip.chromaKey.intensity || 50)}%, transparent 100%)`
                : undefined,
              WebkitMaskImage: activeClip?.cutout?.enabled
                ? 'radial-gradient(ellipse 65% 85% at 50% 55%, black 45%, rgba(0,0,0,0.85) 65%, transparent 100%)'
                : activeClip?.chromaKey?.enabled
                ? `radial-gradient(ellipse 70% 85% at 50% 55%, black ${100 - (activeClip.chromaKey.intensity || 50)}%, transparent 100%)`
                : undefined,
            }}
          >
            {activeClip ? (
              activeClip.type === 'video' && activeClip.url && (activeClip.url.startsWith('blob:') || activeClip.url.includes('.mp4') || activeClip.url.includes('.webm') || activeClip.file?.type.startsWith('video/')) ? (
                <video
                  ref={videoElementRef}
                  src={activeClip.url}
                  className="w-full h-full object-cover pointer-events-none"
                  playsInline
                  muted={isMuted}
                  preload="auto"
                />
              ) : (() => {
                const displaySrc =
                  (activeFrameImg && activeFrameImg.trim() !== '')
                    ? activeFrameImg
                    : (activeClip.thumbnailUrl && activeClip.thumbnailUrl.trim() !== '')
                    ? activeClip.thumbnailUrl
                    : (activeClip.url && activeClip.url.trim() !== '')
                    ? activeClip.url
                    : null;
                return displaySrc ? (
                  <img
                    src={displaySrc}
                    alt={activeClip.title || 'Current Frame'}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                    style={{ willChange: 'transform' }}
                  />
                ) : (
                  <div className="w-full h-full bg-[#1e1e1e] flex items-center justify-center text-zinc-500">
                    <span className="text-xs font-medium">{activeClip.title || 'Scene Clip'}</span>
                  </div>
                );
              })()
            ) : (
              <div className="w-full h-full bg-[#1e1e1e] flex items-center justify-center text-zinc-600">
                <span className="text-xs font-medium">No media at playhead</span>
              </div>
            )}

            {/* Neon Subject Outline / Contour */}
            {activeClip?.cutout?.enabled &&
              activeClip.cutout.strokeColor &&
              activeClip.cutout.strokeColor !== 'transparent' && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-full"
                  style={{
                    boxShadow: `0 0 15px 3px ${activeClip.cutout.strokeColor}, inset 0 0 10px 2px ${activeClip.cutout.strokeColor}`,
                    border: `${activeClip.cutout.strokeWidth || 3}px solid ${activeClip.cutout.strokeColor}`,
                    filter: `drop-shadow(0 0 8px ${activeClip.cutout.strokeColor})`,
                    transform: 'scale(0.85)',
                  }}
                />
              )}

            {/* Vignette Edge Effect Overlay */}
            {activeClip?.adjustments?.vignette && activeClip.adjustments.vignette > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: `inset 0 0 ${activeClip.adjustments.vignette * 1.2}px rgba(0,0,0,${
                    activeClip.adjustments.vignette / 100
                  })`,
                }}
              />
            )}

            {/* Film Grain Texture Overlay */}
            {activeClip?.adjustments?.grain && activeClip.adjustments.grain > 0 && (
              <div
                className="absolute inset-0 pointer-events-none bg-repeat opacity-30 mix-blend-overlay"
                style={{
                  backgroundImage: `radial-gradient(rgba(255,255,255,0.5) 1px, transparent 0)`,
                  backgroundSize: '4px 4px',
                }}
              />
            )}

            {/* AI Video Effects Overlays */}
            {activeClip?.videoEffects && activeClip.videoEffects.length > 0 && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* 1. Chromatic RGB Split */}
                {activeClip.videoEffects.includes('rgb-split') && (
                  <div
                    className="absolute inset-0 mix-blend-screen opacity-75"
                    style={{
                      transform: 'translate(4px, -2px) scale(1.02)',
                      filter: 'drop-shadow(-4px 0 0 red) drop-shadow(4px 0 0 cyan)',
                    }}
                  />
                )}

                {/* 2. VHS Retro Camcorder */}
                {activeClip.videoEffects.includes('vhs-retro') && (
                  <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none font-mono text-[10px] text-emerald-400 select-none">
                    <div className="flex justify-between items-center opacity-85">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /> REC [SP]
                      </span>
                      <span>AUTO TRACKING</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 opacity-60 animate-pulse my-auto" />
                    <div className="flex justify-between items-center opacity-85">
                      <span>CH 03</span>
                      <span>PLAY 00:0{Math.floor(effectiveTime)}:24</span>
                    </div>
                  </div>
                )}

                {/* 3. CRT Scanlines */}
                {activeClip.videoEffects.includes('crt-scanlines') && (
                  <div
                    className="absolute inset-0 opacity-40 mix-blend-overlay"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.75) 50%)',
                      backgroundSize: '100% 4px',
                    }}
                  />
                )}

                {/* 4. 8mm Film Vintage Grain */}
                {activeClip.videoEffects.includes('film-grain-8mm') && (
                  <div
                    className="absolute inset-0 bg-amber-900/20 mix-blend-color-burn opacity-70 animate-pulse"
                    style={{
                      backgroundImage: 'radial-gradient(circle, transparent 70%, black 130%)',
                    }}
                  />
                )}

                {/* 5. Lightning Aura */}
                {activeClip.videoEffects.includes('lightning-aura') && (
                  <div
                    className="absolute inset-0 rounded-3xl"
                    style={{
                      boxShadow: 'inset 0 0 35px #facc15, 0 0 25px #eab308',
                      filter: 'drop-shadow(0 0 12px #facc15)',
                      animation: 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }}
                  />
                )}

                {/* 6. Cyber Eyes Flare */}
                {activeClip.videoEffects.includes('cyber-eyes') && (
                  <div className="absolute top-[38%] left-0 right-0 flex justify-center gap-14 pointer-events-none">
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-[0_0_18px_6px_#f43f5e] animate-ping" />
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-[0_0_18px_6px_#f43f5e] animate-ping" />
                  </div>
                )}

                {/* 7. Neon Edge Outline */}
                {activeClip.videoEffects.includes('neon-edge') && (
                  <div
                    className="absolute inset-2 border-2 border-cyan-400 rounded-2xl pointer-events-none"
                    style={{
                      boxShadow: '0 0 20px #22d3ee, inset 0 0 15px #06b6d4',
                    }}
                  />
                )}

                {/* 8. Prism Flare */}
                {activeClip.videoEffects.includes('prism-flare') && (
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/30 to-blue-500/30 mix-blend-screen -rotate-12 scale-125 pointer-events-none animate-pulse"
                  />
                )}

                {/* 9. Thermal Vision */}
                {activeClip.videoEffects.includes('thermal-vision') && (
                  <div
                    className="absolute inset-0 mix-blend-difference bg-gradient-to-b from-purple-700/60 via-orange-500/60 to-yellow-400/60 pointer-events-none"
                  />
                )}

                {/* 10. Cyber Hologram */}
                {activeClip.videoEffects.includes('hologram') && (
                  <div
                    className="absolute inset-0 bg-cyan-900/30 mix-blend-screen pointer-events-none opacity-80"
                    style={{
                      backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)',
                      backgroundSize: '12px 12px',
                    }}
                  />
                )}

                {/* 11. Phantom Echo Clone */}
                {(() => {
                  const cloneSrc =
                    (activeFrameImg && activeFrameImg.trim() !== '')
                      ? activeFrameImg
                      : (activeClip.thumbnailUrl && activeClip.thumbnailUrl.trim() !== '')
                      ? activeClip.thumbnailUrl
                      : (activeClip.url && activeClip.url.trim() !== '')
                      ? activeClip.url
                      : null;
                  if (!activeClip.videoEffects.includes('body-clone') || !cloneSrc) return null;
                  return (
                    <div
                      className="absolute inset-0 opacity-40 mix-blend-screen scale-105 translate-x-2 -translate-y-1 filter blur-[1px]"
                    >
                      <img
                        src={cloneSrc}
                        alt="Phantom Clone"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })()}

                {/* 12. Floating Bokeh Particles */}
                {activeClip.videoEffects.includes('bokeh-particles') && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/5 w-12 h-12 rounded-full bg-amber-400/25 blur-md animate-bounce" />
                    <div className="absolute bottom-1/3 right-1/4 w-16 h-16 rounded-full bg-yellow-300/20 blur-lg animate-pulse" />
                    <div className="absolute top-2/3 left-2/3 w-8 h-8 rounded-full bg-rose-400/25 blur-sm" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Incoming Next Clip during Active Transition */}
          {activeTransition && activeTransition.nextClipImg && activeTransition.nextClipImg.trim() !== '' && (
            <div
              className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-10 transition-all"
              style={{
                opacity:
                  activeTransition.type === 'dissolve'
                    ? activeTransition.progress
                    : activeTransition.type === 'fade-black'
                    ? Math.max(0, (activeTransition.progress - 0.5) * 2)
                    : activeTransition.type === 'blur-fade'
                    ? activeTransition.progress
                    : activeTransition.type === 'slide-left' || activeTransition.type === 'slide-right'
                    ? 1
                    : activeTransition.progress,
                transform:
                  activeTransition.type === 'slide-left'
                    ? `translateX(${(1 - activeTransition.progress) * 100}%)`
                    : activeTransition.type === 'slide-right'
                    ? `translateX(${-(1 - activeTransition.progress) * 100}%)`
                    : activeTransition.type === 'slide-up'
                    ? `translateY(${(1 - activeTransition.progress) * 100}%)`
                    : activeTransition.type === 'zoom-in'
                    ? `scale(${0.7 + activeTransition.progress * 0.3})`
                    : activeTransition.type === 'zoom-out'
                    ? `scale(${1.4 - activeTransition.progress * 0.4})`
                    : activeTransition.type === 'whip-pan-left'
                    ? `translateX(${(1 - activeTransition.progress) * 100}%)`
                    : activeTransition.type === 'whip-pan-right'
                    ? `translateX(${-(1 - activeTransition.progress) * 100}%)`
                    : activeTransition.type === 'spin-cw'
                    ? `rotate(${-(1 - activeTransition.progress) * 180}deg) scale(${0.7 + activeTransition.progress * 0.3})`
                    : 'none',
                filter:
                  activeTransition.type === 'blur-fade'
                    ? `blur(${(1 - activeTransition.progress) * 8}px)`
                    : 'none',
              }}
            >
              <img
                src={activeTransition.nextClipImg}
                alt="Next Frame"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Flash Overexposure FX */}
          {activeTransition?.type === 'flash' && (
            <div
              className="absolute inset-0 pointer-events-none bg-white z-25 transition-opacity"
              style={{
                opacity:
                  activeTransition.progress < 0.5
                    ? activeTransition.progress * 2
                    : (1 - activeTransition.progress) * 2,
              }}
            />
          )}

          {/* Light Leak FX */}
          {activeTransition?.type === 'light-leak' && (
            <div
              className="absolute inset-0 pointer-events-none bg-gradient-to-r from-amber-400/90 via-orange-500/80 to-transparent mix-blend-screen z-25 transition-opacity"
              style={{
                opacity:
                  activeTransition.progress < 0.5
                    ? activeTransition.progress * 2
                    : (1 - activeTransition.progress) * 2,
              }}
            />
          )}

          {/* Film Burn FX */}
          {activeTransition?.type === 'film-burn' && (
            <div
              className="absolute inset-0 pointer-events-none bg-gradient-to-t from-rose-600/90 via-amber-400/80 to-transparent mix-blend-color-dodge z-25 transition-opacity"
              style={{
                opacity:
                  activeTransition.progress < 0.5
                    ? activeTransition.progress * 2
                    : (1 - activeTransition.progress) * 2,
              }}
            />
          )}

          {/* RGB Split Glitch FX */}
          {(activeTransition?.type === 'glitch' || activeTransition?.type === 'rgb-split') && (
            <div
              className="absolute inset-0 pointer-events-none z-25 mix-blend-difference bg-cyan-500/30 animate-pulse"
              style={{
                opacity: Math.sin(activeTransition.progress * Math.PI),
                transform: `translateX(${(activeTransition.progress * 20) % 10 - 5}px)`,
              }}
            />
          )}

          {/* Active Transition Badge indicator on canvas */}
          {activeTransition && (
            <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md border border-cyan-400/50 text-cyan-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-lg z-30 flex items-center gap-1 animate-pulse">
              <span>⧗</span>
              <span>{activeTransition.name}</span>
            </div>
          )}

          {/* Active B-Roll Overlay / PIP with Direct Interactive Handles, Blend Modes & Shape Masks */}
          {activeOverlay && (() => {
            const overlayTransform = activeOverlay.transform || { x: 0, y: 0, scale: 1, rotation: 0 };
            const clipPathStyle = getClipPathForMask(activeOverlay.mask);
            const blendModeStyle = activeOverlay.blendMode || 'screen';

            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOverlay(isCurrentOverlaySelected ? null : activeOverlay.id);
                  showToast(
                    isCurrentOverlaySelected
                      ? 'Deselected overlay'
                      : `Overlay "${activeOverlay.title}" selected`
                  );
                }}
                className={`absolute inset-4 flex items-center justify-center transition-all cursor-pointer ${
                  isCurrentOverlaySelected ? 'ring-2 ring-emerald-400 rounded-xl p-1 z-25' : 'z-20'
                }`}
                style={{
                  transform: `translate(${overlayTransform.x}%, ${overlayTransform.y}%) scale(${overlayTransform.scale}) rotate(${overlayTransform.rotation}deg)`,
                  opacity: activeOverlay.opacity ?? 1,
                }}
                id={`screen-overlay-${activeOverlay.id}`}
              >
                <div
                  className="w-full h-full relative flex items-center justify-center overflow-hidden"
                  style={{
                    clipPath: clipPathStyle,
                    mixBlendMode: blendModeStyle as any,
                    filter: activeOverlay.mask?.feather
                      ? `blur(${activeOverlay.mask.feather * 0.15}px)`
                      : undefined,
                  }}
                >
                  {activeOverlay.type === 'chart' && activeOverlay.chartConfig ? (
                    <VideoChartOverlay
                      chartConfig={activeOverlay.chartConfig}
                      currentTime={Math.max(0, effectiveTime - activeOverlay.startTime)}
                      duration={activeOverlay.duration}
                    />
                  ) : (activeOverlay.thumbnailUrl && activeOverlay.thumbnailUrl.trim() !== '') ? (
                    <img
                      src={activeOverlay.thumbnailUrl}
                      alt="Overlay"
                      className="w-full h-full object-contain pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-800/80 rounded border border-white/10 p-2 text-stone-300 text-xs font-medium">
                      {activeOverlay.title || 'Overlay'}
                    </div>
                  )}
                </div>

                {/* CapCut Direct Action Bounding Box Pill Handles for Overlay */}
                {isCurrentOverlaySelected && (
                  <>
                    {/* Top-Left: Delete Overlay (❌) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteOverlay) onDeleteOverlay(activeOverlay.id);
                      }}
                      className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform z-30"
                      title="Delete Overlay"
                    >
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    {/* Top-Center: Edit Infographic Chart Data (📊) */}
                    {activeOverlay.type === 'chart' && onOpenEditChart && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditChart(activeOverlay.id);
                        }}
                        className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 px-2.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black text-[10px] font-extrabold flex items-center gap-1 shadow-lg active:scale-90 transition-transform z-30 whitespace-nowrap cursor-pointer"
                        title="Edit Infographic Chart Data"
                      >
                        <BarChart3 className="w-3 h-3 stroke-[2.5]" />
                        <span>Edit Data</span>
                      </button>
                    )}

                    {/* Top-Right: Blend & Mask Studio (🎛️) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenPIPBlendModal) onOpenPIPBlendModal(activeOverlay.id, 'overlay');
                      }}
                      className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform z-30"
                      title="Open PIP Blend & Mask Studio"
                    >
                      <Sliders className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Bottom-Left: Rotate Handle (↻) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpdateOverlayTransform) {
                          const nextRot = (overlayTransform.rotation + 45) % 360;
                          onUpdateOverlayTransform(activeOverlay.id, {
                            ...overlayTransform,
                            rotation: nextRot,
                          });
                          showToast(`Rotated to ${nextRot}°`);
                        }
                      }}
                      className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-amber-400 hover:bg-amber-300 text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform z-30"
                      title="Rotate +45°"
                    >
                      <RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Bottom-Right: Scale Toggle Handle (⤡) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpdateOverlayTransform) {
                          const nextScale =
                            overlayTransform.scale >= 1.4 ? 0.5 : overlayTransform.scale + 0.3;
                          onUpdateOverlayTransform(activeOverlay.id, {
                            ...overlayTransform,
                            scale: Number(nextScale.toFixed(1)),
                          });
                          showToast(`Scaled to ${Math.round(nextScale * 100)}%`);
                        }
                      }}
                      className="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform z-30"
                      title="Toggle Scale"
                    >
                      <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Blend Mode & Mask Badge info */}
                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-emerald-400/40 text-[9px] font-mono text-emerald-300 font-bold whitespace-nowrap shadow-lg flex items-center gap-1">
                      <span>{activeOverlay.blendMode || 'screen'}</span>
                      {activeOverlay.mask && activeOverlay.mask.type !== 'none' && (
                        <span className="text-zinc-400">• mask: {activeOverlay.mask.type}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Active Caption / Animated Subtitle with Direct On-Screen Tap Selection */}
          {activeCaption && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelectCaption(isCurrentCaptionSelected ? null : activeCaption.id);
                showToast(`Subtitle highlighted on timeline`);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleStartEditCaption(activeCaption);
              }}
              className={`absolute bottom-5 left-3 right-3 flex justify-center z-30 cursor-pointer group ${
                isCurrentCaptionSelected ? 'scale-105' : ''
              } transition-transform`}
              id={`screen-caption-${activeCaption.id}`}
              title="Tap to select subtitle and highlight in timeline (Double tap to edit)"
            >
              <div
                className={`relative max-w-full transition-all ${
                  isCurrentCaptionSelected
                    ? 'ring-2 ring-cyan-400 bg-black/90 p-2.5 rounded-xl shadow-md'
                    : 'hover:scale-102'
                }`}
              >
                {/* CapCut Text Bounding Box Action Pill Handles */}
                {isCurrentCaptionSelected && (
                  <>
                    {/* Top-Left: Delete button (❌) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteCaption) onDeleteCaption(activeCaption.id);
                      }}
                      className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform z-30"
                      title="Delete Caption"
                    >
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    {/* Top-Right: Edit Text button (✏️) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditCaption(activeCaption);
                      }}
                      className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform z-30"
                      title="Edit Subtitle Text"
                    >
                      <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Bottom-Left: Style Preset Cycle button (🎨) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onCycleCaptionStyle) onCycleCaptionStyle(activeCaption.id);
                      }}
                      className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-amber-400 hover:bg-amber-300 text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform z-30"
                      title="Cycle Subtitle Style Preset"
                    >
                      <Palette className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Bottom-Right: Corner Scale / Rotate Knob (🔄) */}
                    <div className="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-white text-zinc-900 border border-zinc-300 flex items-center justify-center shadow-lg z-30">
                      <RotateCw className="w-3.5 h-3.5 text-zinc-800" />
                    </div>
                  </>
                )}

                {/* Caption Render Style */}
                {activeCaption.stylePreset === 'hormozi' ? (
                  <div className="bg-black/90 px-3 py-1.5 rounded-lg border border-amber-400/50 shadow-2xl">
                    <span className="text-xs sm:text-sm font-black tracking-tight text-white uppercase text-center leading-tight">
                      {activeCaption.text.split(' ').map((word, i) => {
                        const isHighlight = i % 3 === 0;
                        return (
                          <span
                            key={i}
                            className={isHighlight ? 'text-amber-400 font-extrabold mr-1' : 'mr-1'}
                          >
                            {word}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                ) : activeCaption.stylePreset === 'bold-stroke' ? (
                  <div className="bg-black/90 px-3 py-1 rounded-md border border-cyan-400 shadow-lg">
                    <span className="text-xs font-extrabold text-cyan-300 uppercase tracking-wide">
                      {activeCaption.text}
                    </span>
                  </div>
                ) : (
                  <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-md text-center">
                    <span className="text-xs font-medium text-white tracking-wide">
                      {activeCaption.text}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CapCut Video Clip Selection Bounding Box with Solid White Brackets [ ] */}
          {isCurrentClipSelected && (
            <div className="absolute inset-0 pointer-events-none border-2 border-white z-20 shadow-[0_0_12px_rgba(255,255,255,0.35)]">
              {/* White Corner Handles [ ] */}
              <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-zinc-950 rounded-sm shadow-md" />
              <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-zinc-950 rounded-sm shadow-md" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border border-zinc-950 rounded-sm shadow-md" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border border-zinc-950 rounded-sm shadow-md" />

              {/* Top Rotation Pill */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-5.5 h-5.5 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-lg border border-zinc-300 font-bold">
                <RotateCw className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />
              </div>
            </div>
          )}

          {/* Quick Floating Center Play/Pause button when Paused */}
          {!isPlaying && !isCurrentCaptionSelected && !isCurrentOverlaySelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlay();
              }}
              className="absolute inset-0 flex items-center justify-center bg-transparent group z-10 pointer-events-auto"
              id="canvas-play-toggle"
              title="Play Video"
            >
              <div className="w-12 h-12 rounded-full bg-black/65 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl group-hover:scale-110 active:scale-95 transition-transform">
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              </div>
            </button>
          )}

          {/* Top Badges */}
          <div className="absolute top-2 left-2 flex items-center gap-1 pointer-events-none z-10">
            <span className="bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-300 border border-white/10">
              {aspectRatio}
            </span>
          </div>
        </div>
      </div>

      {/* Inline Text Edit Popover if user clicked ✏️ edit on screen caption */}
      {editingCaptionId && (
        <div className="w-full bg-[#181818] border-t border-white/10 px-3 py-2 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-2 duration-150">
          <input
            type="text"
            value={editTextValue}
            onChange={(e) => setEditTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveCaptionText();
              if (e.key === 'Escape') setEditingCaptionId(null);
            }}
            placeholder="Edit subtitle text..."
            className="flex-1 bg-[#222] border border-cyan-500/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            autoFocus
          />
          <button
            onClick={handleSaveCaptionText}
            className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-bold flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            Save
          </button>
          <button
            onClick={() => setEditingCaptionId(null)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 
        EXACT CAPCUT MIDDLE ACTION BAR (As in Screenshots 1, 2, 3, 4, 5, 6)
        Left: [ ] Maximize
        Center: ▶ Play
        Right: Keyframe Button (◇+ / ◆-), ↩ Undo, ↪ Redo
      */}
      <div
        className="w-full px-3 py-1.5 flex items-center justify-between bg-[#121212] border-t border-white/5 text-zinc-400 z-30"
        id="capcut-middle-action-bar"
      >
        {/* Left: Expand / Fullscreen Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
            title="Toggle Fullscreen"
            id="capcut-expand-btn"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {/* Mute button */}
          <button
            onClick={onToggleMute}
            className={`p-1.5 rounded-lg transition-all ${
              isMuted ? 'text-rose-400 bg-rose-950/40' : 'text-zinc-400 hover:text-white'
            }`}
            title={isMuted ? 'Unmute Player' : 'Mute Player'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Center: Main Play / Pause Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={onTogglePlay}
            className="p-2 rounded-full text-white hover:bg-white/10 active:scale-90 transition-transform"
            title={isPlaying ? 'Pause' : 'Play'}
            id="capcut-play-pause-center-btn"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white translate-x-0.5" />
            )}
          </button>
        </div>

        {/* Right: CAPCUT KEYFRAME BUTTON + UNDO + REDO */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* KEYFRAME BUTTON */}
          <div className="flex items-center bg-[#1a1a1a] rounded-lg p-0.5 border border-white/5 shadow-sm">
            {/* Prev keyframe jump arrow */}
            {onPrevKeyframe && (
              <button
                onClick={onPrevKeyframe}
                className="p-1 rounded text-zinc-400 hover:text-white active:scale-90"
                title="Previous Keyframe"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Signature CapCut Diamond Button */}
            <button
              onClick={() => {
                if (onToggleKeyframe) {
                  onToggleKeyframe();
                }
              }}
              onDoubleClick={() => {
                if (onOpenKeyframeModal) onOpenKeyframeModal();
              }}
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all active:scale-90 ${
                hasKeyframeAtPlayhead
                  ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-400/50'
                  : isCurrentClipSelected || isCurrentCaptionSelected || isCurrentOverlaySelected
                  ? 'text-white hover:bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={
                hasKeyframeAtPlayhead
                  ? 'Remove Keyframe at Playhead (◆-)'
                  : 'Add Keyframe at Playhead (◇+)'
              }
              id="capcut-keyframe-diamond-btn"
            >
              <div className="relative flex items-center justify-center">
                {hasKeyframeAtPlayhead ? (
                  <div className="flex items-center gap-0.5">
                    <span className="text-sm font-bold leading-none text-cyan-400">◆</span>
                    <span className="text-[10px] font-black text-cyan-400 leading-none">-</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <span className="text-sm font-bold leading-none text-zinc-100">◇</span>
                    <span className="text-[10px] font-black text-zinc-100 leading-none">+</span>
                  </div>
                )}
              </div>
            </button>

            {/* Next keyframe jump arrow */}
            {onNextKeyframe && (
              <button
                onClick={onNextKeyframe}
                className="p-1 rounded text-zinc-400 hover:text-white active:scale-90"
                title="Next Keyframe"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Fine tune modal trigger */}
            {onOpenKeyframeModal && (isCurrentClipSelected || isCurrentCaptionSelected || isCurrentOverlaySelected) && (
              <button
                onClick={onOpenKeyframeModal}
                className="p-1 rounded text-zinc-400 hover:text-cyan-400 active:scale-90 ml-0.5"
                title="Keyframe Transform Settings"
                id="capcut-keyframe-settings-btn"
              >
                <Sliders className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Undo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg transition-all ${
              canUndo
                ? 'text-zinc-300 hover:text-white hover:bg-white/10 active:scale-90'
                : 'text-zinc-600 opacity-40 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
            id="capcut-undo-btn"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Redo */}
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg transition-all ${
              canRedo
                ? 'text-zinc-300 hover:text-white hover:bg-white/10 active:scale-90'
                : 'text-zinc-600 opacity-40 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
            id="capcut-redo-btn"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

