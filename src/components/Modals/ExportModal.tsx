import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Check,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Share2,
  FileCode,
  Film,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Volume2,
  VolumeX,
  Layers,
  ArrowUpRight,
  MonitorPlay,
  HardDrive,
  Info,
} from 'lucide-react';
import {
  VideoClip,
  CaptionClip,
  OverlayClip,
  AudioTrackClip,
  AspectRatio,
} from '../../types';
import {
  ExportSettings,
  renderAndExportVideo,
  exportProjectJSON,
  triggerFileDownload,
  getDimensions,
} from '../../utils/videoExporter';
import { formatSecondsShort } from '../../utils/time';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalDuration: number;
  totalVideoDuration?: number;
  projectTitle?: string;
  videoClips?: VideoClip[];
  captions?: CaptionClip[];
  overlays?: OverlayClip[];
  audioClips?: AudioTrackClip[];
  aspectRatio?: AspectRatio;
  coverThumbnail?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  totalDuration = 15,
  totalVideoDuration,
  projectTitle = 'My CapCut Video',
  videoClips = [],
  captions = [],
  overlays = [],
  audioClips = [],
  aspectRatio = '9:16' as AspectRatio,
  coverThumbnail,
}) => {
  // Config state
  const [resolution, setResolution] = useState<'720p' | '1080p' | '2k' | '4k'>('1080p');
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(60);
  const [bitratePreset, setBitratePreset] = useState<'standard' | 'high' | 'ultra'>('high');
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm' | 'json'>('mp4');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [watermark, setWatermark] = useState(false);

  // Range detection: Prioritize video sequence duration when video clips are present
  const computedVideoDuration = useMemo(() => {
    const clipsDur = videoClips.reduce((acc, c) => acc + (c.duration || 0), 0);
    if (clipsDur > 0) return clipsDur;
    if (totalVideoDuration && totalVideoDuration > 0) return totalVideoDuration;
    return totalDuration;
  }, [videoClips, totalVideoDuration, totalDuration]);

  const hasDiscrepancy = totalDuration > computedVideoDuration + 1.0;
  const [exportRange, setExportRange] = useState<'video-sequence' | 'full-timeline'>('video-sequence');

  const effectiveDuration = (hasDiscrepancy && exportRange === 'video-sequence')
    ? computedVideoDuration
    : (exportRange === 'video-sequence' && computedVideoDuration > 0 ? computedVideoDuration : totalDuration);

  // Export execution state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [currentStageText, setCurrentStageText] = useState('Ready');
  const [currentFrameNum, setCurrentFrameNum] = useState(0);
  const [totalFrameCount, setTotalFrameCount] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [estimatedRemainingSecs, setEstimatedRemainingSecs] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // Result state
  const [exportResult, setExportResult] = useState<{
    url: string;
    blob: Blob;
    filename: string;
    sizeBytes: number;
    mimeType: string;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [previewIsPlaying, setPreviewIsPlaying] = useState(true);

  // Canvas ref for live encoding preview
  const monitorCanvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<{ aborted: boolean }>({ aborted: false });
  const resultVideoRef = useRef<HTMLVideoElement>(null);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setDownloadToast(null);
      if (computedVideoDuration > 0 && totalDuration > computedVideoDuration + 1.0) {
        setExportRange('video-sequence');
      }
      if (!isExporting && !exportResult) {
        setExportProgress(0);
        setCurrentStageText('Ready to export');
      }
    } else {
      // Cleanup if user closed during render
      abortControllerRef.current.aborted = true;
    }
  }, [isOpen, computedVideoDuration, totalDuration]);

  if (!isOpen) return null;

  const { width: pixelWidth, height: pixelHeight } = getDimensions(resolution, aspectRatio);
  const estimatedSizeMB = (
    effectiveDuration *
    (resolution === '4k' ? 4.5 : resolution === '2k' ? 2.8 : resolution === '1080p' ? 1.8 : 0.9) *
    (frameRate === 60 ? 1.35 : 1.0) *
    (bitratePreset === 'ultra' ? 1.5 : bitratePreset === 'high' ? 1.2 : 0.9)
  ).toFixed(1);

  // Main Export Handler
  const handleStartExport = async () => {
    setErrorMessage(null);

    // 1. If format is JSON project archive, download directly
    if (exportFormat === 'json') {
      const jsonRes = exportProjectJSON({
        title: projectTitle,
        aspectRatio,
        videoClips,
        captions,
        overlays,
        audioClips,
        totalDuration: effectiveDuration,
      });

      triggerFileDownload(jsonRes.url, jsonRes.filename);

      setExportResult({
        url: jsonRes.url,
        blob: jsonRes.blob,
        filename: jsonRes.filename,
        sizeBytes: jsonRes.blob.size,
        mimeType: 'application/json',
      });
      return;
    }

    // 2. Video Render Pipeline
    setIsExporting(true);
    setExportProgress(0);
    abortControllerRef.current = { aborted: false };

    const settings: ExportSettings = {
      resolution,
      frameRate,
      bitratePreset,
      format: exportFormat,
      includeAudio,
      watermark,
    };

    try {
      const result = await renderAndExportVideo({
        videoClips,
        captions,
        overlays,
        audioClips,
        aspectRatio,
        totalDuration: effectiveDuration,
        projectTitle,
        settings,
        abortSignal: abortControllerRef.current,
        onProgress: (prog) => {
          setExportProgress(prog.percent);
          setCurrentStageText(prog.stage);
          setCurrentFrameNum(prog.currentFrame);
          setTotalFrameCount(prog.totalFrames);
          setElapsedSecs(prog.elapsedSeconds);
          setEstimatedRemainingSecs(prog.estimatedRemainingSeconds);

          // Update live preview monitor canvas
          if (prog.renderedCanvas && monitorCanvasRef.current) {
            const destCtx = monitorCanvasRef.current.getContext('2d');
            if (destCtx) {
              destCtx.drawImage(
                prog.renderedCanvas,
                0,
                0,
                monitorCanvasRef.current.width,
                monitorCanvasRef.current.height
              );
            }
          }
        },
      });

      setExportResult(result);
      setExportProgress(100);
      setCurrentStageText('Export completed successfully!');

      // Automatically trigger download
      triggerFileDownload(result.url, result.filename);
    } catch (err: any) {
      if (err?.message !== 'Export cancelled by user') {
        console.error('Export failed:', err);
        setErrorMessage(err?.message || 'Video export encountered an unexpected error.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancelExport = () => {
    abortControllerRef.current.aborted = true;
    setIsExporting(false);
    setExportProgress(0);
    setCurrentStageText('Export cancelled');
  };

  const handleCopyBlobLink = () => {
    if (!exportResult?.url) return;
    try {
      navigator.clipboard.writeText(exportResult.url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.warn('Clipboard copy error:', e);
    }
  };

  const handleDownloadAgain = () => {
    if (exportResult) {
      triggerFileDownload(exportResult.url, exportResult.filename);
      setDownloadToast('Downloading video file to your device...');
      setTimeout(() => setDownloadToast(null), 3500);
    }
  };

  const handleShareVideo = async () => {
    if (!exportResult) return;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        const file = new File([exportResult.blob], exportResult.filename, {
          type: exportResult.mimeType,
        });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: projectTitle,
            text: `Exported from CapCut Web: ${projectTitle}`,
          });
          setDownloadToast('Video saved / shared successfully!');
          setTimeout(() => setDownloadToast(null), 3000);
          return;
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    }
    triggerFileDownload(exportResult.url, exportResult.filename);
    setDownloadToast('Downloading video file to your device...');
    setTimeout(() => setDownloadToast(null), 3500);
  };

  const handleResetForNewExport = () => {
    setExportResult(null);
    setExportProgress(0);
    setCurrentStageText('Ready to export');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      id="export-video-modal-overlay"
    >
      <div
        className="w-full max-w-xl bg-[#141418] rounded-t-2xl sm:rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        id="export-video-modal-card"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#101014] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                {exportResult ? 'Export Complete' : 'Export & Compile Video'}
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white/10 text-zinc-300">
                  {aspectRatio} • {resolution}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Drift-Proof Audio Sync
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 truncate max-w-xs">{projectTitle}</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isExporting) handleCancelExport();
              onClose();
            }}
            className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            id="export-modal-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* VIEW A: SUCCESS SCREEN WITH PREVIEW PLAYER */}
          {exportResult ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Export Complete!</span>
                    <span className="text-[11px] font-mono text-emerald-400">({formatSecondsShort(effectiveDuration)})</span>
                  </div>
                  <div className="text-[11px] text-emerald-200/80">
                    Your video is ready. Tap below to save it to your phone or share it.
                  </div>
                </div>
              </div>

              {/* Toast alert if triggered */}
              {downloadToast && (
                <div className="p-2.5 bg-blue-500/20 border border-blue-400/40 rounded-xl text-xs font-semibold text-blue-200 text-center animate-pulse">
                  {downloadToast}
                </div>
              )}

              {/* Video Player Preview if media is video */}
              {exportResult.mimeType.startsWith('video') && exportResult.url && exportResult.url.trim() !== '' && (
                <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center group shadow-lg">
                  <video
                    ref={resultVideoRef}
                    src={exportResult.url}
                    controls
                    autoPlay
                    loop
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {/* Primary: Direct Save Video Button */}
                <button
                  onClick={handleDownloadAgain}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl active:scale-95 transition-all cursor-pointer"
                  id="export-save-file-btn"
                >
                  <Download className="w-5 h-5 text-white" />
                  <span>Save Video to Phone ({formatSecondsShort(effectiveDuration)})</span>
                </button>

                {/* Secondary: Mobile Native Share / Save */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleShareVideo}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    id="export-share-btn"
                  >
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span>Save to Photos / Share</span>
                  </button>

                  <button
                    onClick={handleCopyBlobLink}
                    className="py-2.5 px-3 rounded-xl bg-[#222228] hover:bg-[#2c2c34] border border-white/10 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    id="export-copy-link-btn"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-zinc-400" />
                        <span>Copy Video Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Helpful Tip for Mobile Phones */}
              <div className="p-3 bg-[#161622] rounded-xl border border-white/5 space-y-1 text-[11px] text-zinc-400">
                <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Where is my video saved?</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Tapping <b>"Save Video to Phone"</b> downloads the file to your phone's <b>Downloads</b> or <b>Files</b> app. Tapping <b>"Save to Photos / Share"</b> lets you save directly to Google Photos or send to WhatsApp/TikTok.
                </p>
              </div>

              {/* Project Metadata Summary */}
              <div className="bg-[#1a1a20] rounded-xl p-3 border border-white/5 space-y-1.5 text-[11px] text-zinc-400">
                <div className="flex justify-between">
                  <span>Resolution Output:</span>
                  <span className="text-zinc-200 font-mono">
                    {pixelWidth} × {pixelHeight} ({resolution.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Frame Rate & Codec:</span>
                  <span className="text-zinc-200 font-mono">
                    {frameRate} FPS • {exportResult.mimeType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sequence Length:</span>
                  <span className="text-zinc-200 font-mono">{formatSecondsShort(effectiveDuration)}</span>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW B: EXPORT CONFIGURATION & LIVE ENCODING */
            <div className="space-y-4">
              {/* Duration Range Selector when audio is longer than video clips */}
              {hasDiscrepancy && (
                <div className="bg-[#181822] p-3 rounded-xl border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Export Duration Range
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Video: {formatSecondsShort(computedVideoDuration)} • Audio: {formatSecondsShort(totalDuration)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportRange('video-sequence')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        exportRange === 'video-sequence'
                          ? 'border-cyan-500 bg-cyan-500/15 text-white shadow-sm'
                          : 'border-white/10 bg-[#121216] text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-bold text-cyan-200">
                        Video Sequence ({formatSecondsShort(computedVideoDuration)})
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Fast export (recommended)
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportRange('full-timeline')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        exportRange === 'full-timeline'
                          ? 'border-cyan-500 bg-cyan-500/15 text-white shadow-sm'
                          : 'border-white/10 bg-[#121216] text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-bold text-zinc-200">
                        Full Timeline ({formatSecondsShort(totalDuration)})
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Entire audio duration
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Format selection */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setExportFormat('mp4')}
                    disabled={isExporting}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      exportFormat === 'mp4'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300 shadow-sm'
                        : 'border-white/10 bg-[#1c1c22] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5 text-blue-400" />
                    <span>MP4 Video</span>
                  </button>

                  <button
                    onClick={() => setExportFormat('webm')}
                    disabled={isExporting}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      exportFormat === 'webm'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-sm'
                        : 'border-white/10 bg-[#1c1c22] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    <MonitorPlay className="w-3.5 h-3.5 text-cyan-400" />
                    <span>WebM Video</span>
                  </button>

                  <button
                    onClick={() => setExportFormat('json')}
                    disabled={isExporting}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      exportFormat === 'json'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300 shadow-sm'
                        : 'border-white/10 bg-[#1c1c22] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>CapCut Archive</span>
                  </button>
                </div>
              </div>

              {exportFormat !== 'json' && (
                <>
                  {/* Resolution selector */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-zinc-300">Resolution</label>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {pixelWidth} × {pixelHeight} px
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(['720p', '1080p', '2k', '4k'] as const).map((res) => (
                        <button
                          key={res}
                          onClick={() => setResolution(res)}
                          disabled={isExporting}
                          className={`py-2 rounded-xl border text-xs font-bold uppercase transition-all ${
                            resolution === res
                              ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                              : 'border-white/10 bg-[#1c1c22] text-zinc-300 hover:border-white/30'
                          }`}
                        >
                          {res}
                          {res === '1080p' && (
                            <span className="block text-[8px] font-normal text-blue-200 lowercase">
                              recommended
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frame Rate & Bitrate selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                        Frame Rate
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([24, 30, 60] as const).map((fps) => (
                          <button
                            key={fps}
                            onClick={() => setFrameRate(fps)}
                            disabled={isExporting}
                            className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                              frameRate === fps
                                ? 'border-white bg-white text-zinc-950 shadow-sm'
                                : 'border-white/10 bg-[#1c1c22] text-zinc-300 hover:border-white/30'
                            }`}
                          >
                            {fps} fps
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                        Bitrate Preset
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['standard', 'high', 'ultra'] as const).map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setBitratePreset(preset)}
                            disabled={isExporting}
                            className={`py-1.5 rounded-lg border text-xs font-semibold capitalize transition-all ${
                              bitratePreset === preset
                                ? 'border-white bg-white text-zinc-950 shadow-sm'
                                : 'border-white/10 bg-[#1c1c22] text-zinc-300 hover:border-white/30'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Options (Audio & Watermark) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setIncludeAudio(!includeAudio)}
                      disabled={isExporting}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
                        includeAudio
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/10 bg-[#1c1c22] text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {includeAudio ? (
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-zinc-500" />
                        )}
                        <span>Include Audio</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase">
                        {includeAudio ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      onClick={() => setWatermark(!watermark)}
                      disabled={isExporting}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
                        watermark
                          ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                          : 'border-white/10 bg-[#1c1c22] text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span>CapCut Watermark</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase">
                        {watermark ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>

                  {/* Estimated File Size bar */}
                  <div className="bg-[#1c1c22] p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Estimated Output Size:</span>
                    </div>
                    <span className="font-mono text-zinc-200 font-bold">~{estimatedSizeMB} MB</span>
                  </div>
                </>
              )}

              {/* LIVE ENCODING MONITOR & PROGRESS */}
              {isExporting && (
                <div className="space-y-3 pt-2 bg-[#121216] p-4 rounded-xl border border-blue-500/30 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400 animate-spin" />
                      <span className="text-xs font-semibold text-zinc-200 truncate max-w-[220px]">
                        {currentStageText}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-blue-400">
                      {exportProgress}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 rounded-full transition-all duration-150"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>

                  {/* Live Render Canvas Monitor */}
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-14 rounded-lg overflow-hidden bg-black border border-white/10 flex items-center justify-center shrink-0">
                      <canvas
                        ref={monitorCanvasRef}
                        width={160}
                        height={100}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[11px] text-zinc-400 space-y-0.5">
                      <div className="font-mono text-zinc-300">
                        Frame: {currentFrameNum} / {totalFrameCount}
                      </div>
                      <div>
                        Elapsed: <span className="font-mono text-zinc-300">{elapsedSecs}s</span> •
                        Remaining:{' '}
                        <span className="font-mono text-zinc-300">{estimatedRemainingSecs}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#101014] border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Hardware audio-clock locked (48kHz sample-accurate, zero cumulative drift)</span>
          </div>

          <div className="flex items-center gap-2">
            {exportResult ? (
              <>
                <button
                  onClick={handleResetForNewExport}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Export Another
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                  id="export-done-btn"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Done (Back to Timeline)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={isExporting ? handleCancelExport : onClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                  id="export-modal-cancel-btn"
                >
                  {isExporting ? 'Cancel Export' : 'Cancel'}
                </button>

                <button
                  onClick={handleStartExport}
                  disabled={isExporting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  id="start-export-btn"
                >
                  {isExporting ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Encoding Video ({exportProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Video Now</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
