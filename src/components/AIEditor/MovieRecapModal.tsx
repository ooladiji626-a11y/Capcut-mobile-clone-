import React, { useState, useRef } from 'react';
import {
  X,
  Clapperboard,
  Upload,
  FolderArchive,
  FileText,
  Music,
  Video,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
  Layers,
  Film,
  Sliders,
  Eye,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  MovieRecapImportedFile,
  MovieRecapFileType,
  MovieRecapProjectValidation,
  MovieRecapEditMode,
  MovieRecapPacingMode,
  AspectRatio,
  VideoClip,
  AudioTrackClip,
  CaptionClip,
  AIEditCommand,
  MovieRecapSceneCut,
} from '../../types';
import {
  classifyMovieRecapFile,
  validateMovieRecapProject,
  unpackMovieRecapZip,
  getSampleMovieRecapPackage,
  buildMovieRecapTimeline,
  parseCutGuideText,
} from '../../utils/movieRecapBuilder';
import { isZipFile } from '../../utils/zipHandler';

interface MovieRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  aspectRatio: AspectRatio;
  onApplyRecap: (data: {
    videoClips: VideoClip[];
    audioClips: AudioTrackClip[];
    captions: CaptionClip[];
    commands: AIEditCommand[];
    summary: string;
    scriptText?: string;
  }) => void;
}

export const MovieRecapModal: React.FC<MovieRecapModalProps> = ({
  isOpen,
  onClose,
  aspectRatio: initialAspect,
  onApplyRecap,
}) => {
  const [importTab, setImportTab] = useState<'package' | 'individual'>('package');
  const [importedFiles, setImportedFiles] = useState<MovieRecapImportedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [editMode, setEditMode] = useState<MovieRecapEditMode>('auto');
  const [pacingMode, setPacingMode] = useState<MovieRecapPacingMode>('longform');
  const [selectedAspect, setSelectedAspect] = useState<AspectRatio>(initialAspect || '16:9');
  
  // Review step state for 'manual-review'
  const [reviewScenes, setReviewScenes] = useState<MovieRecapSceneCut[] | null>(null);
  const [pendingRecapResult, setPendingRecapResult] = useState<{
    videoClips: VideoClip[];
    audioClips: AudioTrackClip[];
    captions: CaptionClip[];
    commands: AIEditCommand[];
    summary: string;
    scriptText?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validation: MovieRecapProjectValidation = validateMovieRecapProject(importedFiles);

  // Load Built-in Demo Package
  const handleLoadDemoPackage = () => {
    setIsProcessing(true);
    setProcessingStatus('Loading Cyberpunk Detective Movie Recap package...');
    setTimeout(() => {
      const demoFiles = getSampleMovieRecapPackage();
      setImportedFiles(demoFiles);
      setIsProcessing(false);
      setProcessingStatus('');
    }, 400);
  };

  // Handle uploaded files (ZIP or Individual)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus('Analyzing files and detecting movie recap components...');

    try {
      const newImported: MovieRecapImportedFile[] = [...importedFiles];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (isZipFile(file)) {
          setProcessingStatus(`Unpacking ZIP package "${file.name}"...`);
          const extracted = await unpackMovieRecapZip(file);
          newImported.push(...extracted);
        } else {
          let rawContent: string | undefined;
          let parsedData: any = undefined;

          const lower = file.name.toLowerCase();
          if (lower.endsWith('.txt') || lower.endsWith('.json') || lower.endsWith('.csv') || lower.endsWith('.srt') || lower.endsWith('.vtt')) {
            rawContent = await file.text();
            const classified = classifyMovieRecapFile(file.name, file.type, rawContent);
            if (classified === 'cut_guide') {
              parsedData = { scenes: parseCutGuideText(rawContent) };
            } else if (classified === 'script') {
              parsedData = { scriptText: rawContent };
            }
          }

          const fileUrl = URL.createObjectURL(file);
          const classifiedType = classifyMovieRecapFile(file.name, file.type, rawContent);

          newImported.push({
            id: `file-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            name: file.name,
            size: file.size,
            type: classifiedType,
            file,
            url: fileUrl,
            rawContent,
            parsedData,
          });
        }
      }

      setImportedFiles(newImported);
    } catch (err: any) {
      console.error('Error processing recap files:', err);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      if (event.target) event.target.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    setImportedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpdateFileType = (id: string, newType: MovieRecapFileType) => {
    setImportedFiles((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          return { ...f, type: newType };
        }
        return f;
      })
    );
  };

  // Build the recap
  const handleBuildRecap = async () => {
    if (!validation.canContinue && importedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus('Building synchronized movie recap timeline...');

    try {
      const result = await buildMovieRecapTimeline({
        files: importedFiles.length > 0 ? importedFiles : getSampleMovieRecapPackage(),
        aspectRatio: selectedAspect,
        pacingMode,
        editMode,
      });

      const scriptContent = importedFiles.find((f) => f.type === 'script')?.rawContent;

      if (editMode === 'manual-review') {
        // Open manual review inspector
        setReviewScenes(result.recapScenes);
        setPendingRecapResult({
          videoClips: result.videoClips,
          audioClips: result.audioClips,
          captions: result.captions,
          commands: result.commands,
          summary: result.recapSummary,
          scriptText: scriptContent,
        });
        setIsProcessing(false);
        return;
      }

      // Auto Build or Manual Edit mode
      onApplyRecap({
        videoClips: result.videoClips,
        audioClips: result.audioClips,
        captions: result.captions,
        commands: result.commands,
        summary: result.recapSummary,
        scriptText: scriptContent,
      });

      onClose();
    } catch (err) {
      console.error('Failed to build recap:', err);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Confirm Manual Review
  const handleConfirmReview = () => {
    if (pendingRecapResult) {
      onApplyRecap(pendingRecapResult);
      onClose();
    }
  };

  const getTypeBadge = (type: MovieRecapFileType) => {
    switch (type) {
      case 'video':
        return { label: 'Movie Video', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: Video };
      case 'voiceover':
        return { label: 'Voiceover Audio', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: Music };
      case 'script':
        return { label: 'Recap Script', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: FileText };
      case 'cut_guide':
        return { label: 'Scene Cut Guide', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: Film };
      case 'timing_data':
        return { label: 'Timing / Align Data', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', icon: Clock };
      default:
        return { label: 'Media Asset', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40', icon: Layers };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl bg-[#14141c] border border-purple-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/60 via-[#181824] to-[#121218] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Movie Recap Project Importer
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
                  RECAP GEN READY
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Import movie video, voiceover, cut guides & scripts to build a synchronized recap timeline
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Accepted Formats Ribbon */}
        <div className="px-4 sm:px-5 py-2 bg-[#0e0e14] border-b border-white/5 flex items-center justify-between flex-wrap gap-2 text-[11px] text-zinc-400 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">Accepted:</span>
            {['MP4', 'MOV', 'WEBM', 'MP3', 'WAV', 'JSON', 'CSV', 'TXT', 'ZIP'].map((fmt) => (
              <span key={fmt} className="px-1.5 py-0.2 rounded bg-white/5 text-zinc-300 font-mono text-[10px]">
                {fmt}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleLoadDemoPackage}
            className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 font-medium transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample Movie Recap</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 no-scrollbar">
          {/* If in Review Mode */}
          {reviewScenes && reviewScenes.length > 0 ? (
            <div className="space-y-4">
              <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">Manual Review: Inspect Every Scene Cut</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewScenes(null)}
                  className="text-[11px] text-purple-300 hover:underline"
                >
                  ← Back to Project Files
                </button>
              </div>

              <div className="space-y-2.5">
                {reviewScenes.map((scene, idx) => (
                  <div
                    key={scene.id || idx}
                    className="p-3 rounded-2xl bg-[#181824] border border-white/10 flex items-start gap-3"
                  >
                    {scene.thumbnailUrl && scene.thumbnailUrl.trim() !== '' && (
                      <img
                        src={scene.thumbnailUrl}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">
                          Scene {idx + 1}: {scene.title}
                        </span>
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-cyan-300 rounded font-mono text-[10px]">
                          {scene.duration.toFixed(1)}s
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 line-clamp-2 italic">
                        "{scene.narrationText || scene.description}"
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-1">
                        <span>Motion: <b className="text-purple-300">{scene.motionEffect || 'slow-zoom'}</b></span>
                        <span>•</span>
                        <span>Transition: <b className="text-blue-300">{scene.transition || 'dissolve'}</b></span>
                        {scene.sfx && (
                          <>
                            <span>•</span>
                            <span className="text-amber-300 font-medium">⚡ {scene.sfx}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Import Tabs */}
              <div className="flex items-center gap-2 p-1 bg-[#101018] rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setImportTab('package')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    importTab === 'package'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Upload Recap Package (.ZIP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportTab('individual')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    importTab === 'individual'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Add Files Individually</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => {
                  if (importTab === 'package') {
                    zipInputRef.current?.click();
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="border-2 border-dashed border-purple-500/30 hover:border-purple-500/80 bg-[#161622]/60 hover:bg-purple-950/20 rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all space-y-3 group"
              >
                <input
                  type="file"
                  ref={zipInputRef}
                  accept="*/*,.zip,application/zip,application/x-zip-compressed,audio/*,video/*,.mp3,.wav,.m4a,.aac"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="*/*,application/octet-stream,text/*,.srt,.vtt,.txt,audio/*,video/*,image/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.caf,.aiff,.aif,.wma,.opus,.m4r,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp4,.mov,.json,.csv,.zip"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <div className="w-14 h-14 mx-auto rounded-3xl bg-purple-500/10 group-hover:bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 transition-all shadow-inner">
                  {importTab === 'package' ? (
                    <FolderArchive className="w-7 h-7" />
                  ) : (
                    <Upload className="w-7 h-7" />
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">
                    {importTab === 'package'
                      ? 'Drop Movie Recap ZIP Package Here'
                      : 'Drop Movie, Voiceover, Script or Cut Guide Files'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {importTab === 'package'
                      ? 'Automatically unpacks and categorizes movie, audio, script, and cut guide'
                      : 'Supports MP4, MOV, MP3, WAV, JSON cut sheets, and TXT scripts'}
                  </p>
                </div>
              </div>

              {/* Imported Files List */}
              {importedFiles.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold px-1">
                    <span>Imported Project Assets ({importedFiles.length})</span>
                    <button
                      type="button"
                      onClick={() => setImportedFiles([])}
                      className="text-red-400 hover:text-red-300 text-[11px]"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                    {importedFiles.map((file) => {
                      const badge = getTypeBadge(file.type);
                      const BadgeIcon = badge.icon;

                      return (
                        <div
                          key={file.id}
                          className="p-2.5 rounded-2xl bg-[#161622] border border-white/10 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 shrink-0">
                              <BadgeIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white truncate">{file.name}</div>
                              <div className="text-[10px] text-zinc-500">
                                {(file.size / 1024).toFixed(1)} KB
                                {file.parsedData?.scenes && (
                                  <span className="text-purple-300 ml-2">
                                    • {file.parsedData.scenes.length} scene cuts parsed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Role Selector Dropdown */}
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={file.type}
                              onChange={(e) => handleUpdateFileType(file.id, e.target.value as MovieRecapFileType)}
                              className="bg-[#101016] border border-white/15 text-zinc-200 text-[11px] font-medium rounded-xl px-2 py-1 focus:outline-none focus:border-purple-500"
                            >
                              <option value="video">Movie / Video</option>
                              <option value="voiceover">Voiceover Audio</option>
                              <option value="script">Recap Script</option>
                              <option value="cut_guide">Scene Cut Guide</option>
                              <option value="timing_data">Timing Data</option>
                              <option value="unknown">Other Media</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveFile(file.id)}
                              className="p-1 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Project Validation Box */}
              <div className="p-4 rounded-2xl bg-[#111118] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    Movie Recap Project Validation
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    {validation.readinessStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
                    <span className="text-zinc-500 text-[10px]">Video</span>
                    <span className={validation.hasVideo ? 'text-emerald-400 font-bold' : 'text-amber-400 font-medium'}>
                      {validation.hasVideo ? 'Detected' : 'Missing'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
                    <span className="text-zinc-500 text-[10px]">Voiceover</span>
                    <span className={validation.hasVoiceover ? 'text-emerald-400 font-bold' : 'text-amber-400 font-medium'}>
                      {validation.hasVoiceover ? 'Detected' : 'Missing'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
                    <span className="text-zinc-500 text-[10px]">Script</span>
                    <span className={validation.hasScript ? 'text-emerald-400 font-bold' : 'text-zinc-400 font-medium'}>
                      {validation.hasScript ? 'Detected' : 'Auto'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
                    <span className="text-zinc-500 text-[10px]">Cut Guide</span>
                    <span className={validation.hasCutGuide ? 'text-emerald-400 font-bold' : 'text-zinc-400 font-medium'}>
                      {validation.hasCutGuide ? 'Detected' : 'Auto Sync'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
                    <span className="text-zinc-500 text-[10px]">Timing</span>
                    <span className={validation.hasTimingData ? 'text-emerald-400 font-bold' : 'text-zinc-400 font-medium'}>
                      {validation.hasTimingData ? 'Exact' : 'Waveform'}
                    </span>
                  </div>
                </div>

                {validation.missingNotice && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{validation.missingNotice}</span>
                  </div>
                )}
              </div>

              {/* Editing Mode Selector (3 Choices) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white block">
                  Editing Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditMode('auto')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      editMode === 'auto'
                        ? 'bg-purple-950/50 border-purple-500 text-white shadow-md'
                        : 'bg-[#14141c] border-white/10 hover:border-white/20 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Auto Build</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      Automatically assemble scenes, sync voiceover, and adjust clip lengths.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditMode('manual-review')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      editMode === 'manual-review'
                        ? 'bg-purple-950/50 border-purple-500 text-white shadow-md'
                        : 'bg-[#14141c] border-white/10 hover:border-white/20 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Manual Review</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      Create timeline and inspect every scene cut before committing to the editor.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditMode('manual-edit')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      editMode === 'manual-edit'
                        ? 'bg-purple-950/50 border-purple-500 text-white shadow-md'
                        : 'bg-[#14141c] border-white/10 hover:border-white/20 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Manual Edit</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                      Load the cut guide and media into tracks for manual trimming and editing.
                    </p>
                  </button>
                </div>
              </div>

              {/* Pacing & Aspect Ratio Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400">Pacing Style</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPacingMode('shortform')}
                      className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                        pacingMode === 'shortform'
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-[#14141c] border-white/10 text-zinc-300'
                      }`}
                    >
                      ⚡ Shortform (2-4s)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPacingMode('longform')}
                      className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                        pacingMode === 'longform'
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-[#14141c] border-white/10 text-zinc-300'
                      }`}
                    >
                      🎥 Longform (4-8s)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400">Canvas Aspect Ratio</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAspect('16:9')}
                      className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                        selectedAspect === '16:9'
                          ? 'bg-cyan-600 border-cyan-400 text-white'
                          : 'bg-[#14141c] border-white/10 text-zinc-300'
                      }`}
                    >
                      🖥️ 16:9 Cinema
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAspect('9:16')}
                      className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                        selectedAspect === '9:16'
                          ? 'bg-cyan-600 border-cyan-400 text-white'
                          : 'bg-[#14141c] border-white/10 text-zinc-300'
                      }`}
                    >
                      📱 9:16 Vertical
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-[#101018] border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-400">
            {isProcessing ? (
              <span className="text-purple-400 flex items-center gap-1.5 font-medium animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {processingStatus}
              </span>
            ) : (
              <span>Ready to assemble recap timeline</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-all"
            >
              Cancel
            </button>

            {reviewScenes && reviewScenes.length > 0 ? (
              <button
                type="button"
                onClick={handleConfirmReview}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center gap-2"
              >
                <span>Apply Reviewed Timeline</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBuildRecap}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center gap-2"
              >
                <span>{editMode === 'manual-review' ? 'Inspect Scene Cuts' : 'Build Recap'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
