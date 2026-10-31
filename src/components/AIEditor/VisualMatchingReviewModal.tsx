import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Check,
  Sparkles,
  AlertTriangle,
  Clock,
  Volume2,
  ImageIcon,
  Search,
  RefreshCw,
  Layers,
  Upload,
  FolderOpen,
} from 'lucide-react';
import {
  VisualBeatMatch,
  VisualMatchingSession,
  VisualAssetProfile,
  matchBeatsToVisuals,
  analyzeVisualAssets,
} from '../../engine/visualAudioMatcher';
import { ProjectAsset } from '../../types';
import { CURATED_STOCK_ASSETS } from '../../data/stockMediaAssets';

export interface VisualMatchingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: VisualMatchingSession | null;
  onSwapBeat?: (beatLabelOrId: string, newAsset: ProjectAsset) => void;
  onApproveAndPlace?: (matches: VisualBeatMatch[]) => Promise<void>;
  availableAssets: ProjectAsset[];
  onRegisterAsset?: (newAsset: ProjectAsset) => void;
  isPlacing?: boolean;
  placementProgressText?: string;
  // Backward compatibility props
  beats?: any[];
  onUpdateBeats?: (beats: any[]) => void;
  onCommitToTimeline?: (beats: any[]) => void;
  masterAudio?: ProjectAsset;
  aspectRatio?: string;
}

export const VisualMatchingReviewModal: React.FC<VisualMatchingReviewModalProps> = ({
  isOpen,
  onClose,
  session,
  onSwapBeat,
  onApproveAndPlace,
  availableAssets,
  onRegisterAsset,
  isPlacing = false,
  placementProgressText = '',
  beats,
  onUpdateBeats,
  onCommitToTimeline,
  masterAudio,
}) => {
  const [assetPickerBeat, setAssetPickerBeat] = useState<VisualBeatMatch | null>(null);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [pickerTab, setPickerTab] = useState<'all' | 'project' | 'matched' | 'stock'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'needs_review' | 'strong'>('all');
  const [localMatchesOverride, setLocalMatchesOverride] = useState<VisualBeatMatch[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize session from either new session prop or legacy beats prop
  const currentSession: VisualMatchingSession | null = useMemo(() => {
    if (session) {
      if (localMatchesOverride) {
        return {
          ...session,
          matches: localMatchesOverride,
          strongMatchesCount: localMatchesOverride.filter((m) => m.status === 'STRONG_MATCH').length,
          needsReviewCount: localMatchesOverride.filter((m) => m.status === 'NEEDS_REVIEW').length,
          noVisualCount: localMatchesOverride.filter((m) => m.status === 'NO_SUITABLE_VISUAL').length,
        };
      }
      return session;
    }

    if (!beats || beats.length === 0) return null;

    const mappedMatches: VisualBeatMatch[] = beats.map((b: any, idx: number) => {
      const beatLabel = b.beatIndex ? String(b.beatIndex) : String(idx + 1);
      const isStrong = b.matchScore >= 0.7 && !b.isUnmatched;
      const isReview = (b.matchScore >= 0.4 && b.matchScore < 0.7) || b.isUnmatched;

      const profile: VisualAssetProfile | undefined = b.matchedAssetId
        ? {
            assetId: b.matchedAssetId,
            assetName: b.matchedAssetName || 'Visual Asset',
            url: b.matchedAssetUrl || '',
            thumbnailUrl: b.matchedAssetThumbnail || b.matchedAssetUrl || '',
            type: 'image',
            peoplePresent: false,
            detectedActions: [],
            detectedObjects: [],
            environment: 'general',
            sceneConcepts: [],
            isActionShot: false,
            visualTokens: new Set(),
            cleanFileName: b.matchedAssetName || '',
            dominantBrightness: 'normal',
          }
        : undefined;

      return {
        beatId: b.id || `beat-${idx}`,
        beatLabel,
        scriptText: b.text || b.fullSentence || '',
        startTime: b.startTime || 0,
        endTime: b.endTime || (b.startTime + b.duration) || 0,
        duration: b.duration || 2.5,
        status: isStrong ? 'STRONG_MATCH' : isReview ? 'NEEDS_REVIEW' : 'NO_SUITABLE_VISUAL',
        matchReason: b.matchReason || b.suggestedVisualDescription,
        matchedAsset: profile,
      };
    });

    const matchesToUse = localMatchesOverride || mappedMatches;
    const totalDur = matchesToUse.length > 0 ? matchesToUse[matchesToUse.length - 1].endTime : 60;

    return {
      id: 'legacy-session',
      createdAt: Date.now(),
      audioAssetName: masterAudio?.name || 'Voiceover Audio',
      audioDuration: masterAudio?.duration || totalDur,
      totalBeats: matchesToUse.length,
      visualAssetsCount: availableAssets.length,
      strongMatchesCount: matchesToUse.filter((m) => m.status === 'STRONG_MATCH').length,
      needsReviewCount: matchesToUse.filter((m) => m.status === 'NEEDS_REVIEW').length,
      noVisualCount: matchesToUse.filter((m) => m.status === 'NO_SUITABLE_VISUAL').length,
      matches: matchesToUse,
      masterAudio,
    };
  }, [session, beats, masterAudio, availableAssets, localMatchesOverride]);

  // 1. Compute all selectable visual assets across Project Assets, Matched Video Assets, and Curated Stock (unconditional Hook)
  const allSelectableAssets = useMemo(() => {
    const assetMap = new Map<string, ProjectAsset & { source: 'project' | 'matched' | 'stock' }>();

    // Registered project assets passed in
    const directVisuals = (availableAssets || []).filter(
      (a) => a.type === 'image' || a.type === 'video' || (!a.type && Boolean(a.url))
    );
    for (const a of directVisuals) {
      assetMap.set(a.id, { ...a, source: 'project' });
    }

    // Assets already matched or evaluated in this session
    if (currentSession?.matches) {
      for (const m of currentSession.matches) {
        if (m.matchedAsset && m.matchedAsset.url) {
          const id = m.matchedAsset.assetId || `matched-${m.beatId}`;
          if (!assetMap.has(id)) {
            assetMap.set(id, {
              id,
              name: m.matchedAsset.assetName || 'Visual Asset',
              type: (m.matchedAsset.type as any) || 'image',
              url: m.matchedAsset.url,
              thumbnailUrl: m.matchedAsset.thumbnailUrl || m.matchedAsset.url,
              file: m.matchedAsset.file instanceof File ? m.matchedAsset.file : undefined,
              duration: m.duration || 5.0,
              uploadedAt: Date.now(),
              source: 'matched',
            });
          }
        }
        if (m.candidateList) {
          for (const cand of m.candidateList) {
            if (cand.asset && cand.asset.url) {
              const id = cand.asset.assetId || `cand-${cand.asset.assetName}`;
              if (!assetMap.has(id)) {
                assetMap.set(id, {
                  id,
                  name: cand.asset.assetName || 'Candidate Visual',
                  type: (cand.asset.type as any) || 'image',
                  url: cand.asset.url,
                  thumbnailUrl: cand.asset.thumbnailUrl || cand.asset.url,
                  file: cand.asset.file instanceof File ? cand.asset.file : undefined,
                  duration: 5.0,
                  uploadedAt: Date.now(),
                  source: 'matched',
                });
              }
            }
          }
        }
      }
    }

    // Curated Stock Library (Nature, Clean Water, Daily Life, Action, Finance, City, etc.)
    for (const stock of CURATED_STOCK_ASSETS) {
      if (!assetMap.has(stock.id)) {
        assetMap.set(stock.id, { ...stock, source: 'stock' });
      }
    }

    return Array.from(assetMap.values());
  }, [availableAssets, currentSession]);

  // 2. Filter selectable assets by active tab and search query (unconditional Hook)
  const searchFilteredAssets = useMemo(() => {
    let list = allSelectableAssets;

    if (pickerTab === 'project') {
      list = list.filter((a) => a.source === 'project');
    } else if (pickerTab === 'matched') {
      list = list.filter((a) => a.source === 'matched');
    } else if (pickerTab === 'stock') {
      list = list.filter((a) => a.source === 'stock');
    }

    if (!assetSearchQuery.trim()) return list;

    const q = assetSearchQuery.toLowerCase().trim();
    return list.filter((a) => {
      const nameMatch = a.name.toLowerCase().includes(q);
      const tagMatch = a.tags && a.tags.some((t) => t.toLowerCase().includes(q));
      const descMatch = a.analysis?.description?.toLowerCase().includes(q);
      return nameMatch || tagMatch || descMatch;
    });
  }, [allSelectableAssets, pickerTab, assetSearchQuery]);

  const matches = currentSession?.matches || [];

  // 3. Direct local file upload right from the swap modal
  const handleUploadNewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const objectUrl = URL.createObjectURL(file);
    const newAsset: ProjectAsset = {
      id: `asset-upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      url: objectUrl,
      thumbnailUrl: objectUrl,
      file,
      duration: 5.0,
      uploadedAt: Date.now(),
      tags: [file.name.toLowerCase()],
    };

    if (onRegisterAsset) {
      onRegisterAsset(newAsset);
    }
    handleSelectSwapAsset(newAsset);

    // Reset file input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleSelectSwapAsset = (asset: ProjectAsset) => {
    if (!assetPickerBeat) return;

    if (onRegisterAsset) {
      onRegisterAsset(asset);
    }

    if (onSwapBeat) {
      onSwapBeat(assetPickerBeat.beatLabel, asset);
    }

    // Always update local override as well for immediate UI reactivity
    const updated = matches.map((m) => {
      if (m.beatLabel === assetPickerBeat.beatLabel || m.beatId === assetPickerBeat.beatId) {
        const profile: VisualAssetProfile = {
          assetId: asset.id,
          assetName: asset.name,
          url: asset.url,
          thumbnailUrl: asset.thumbnailUrl || asset.url,
          file: asset.file,
          type: (asset.type === 'video' ? 'video' : 'image'),
          peoplePresent: false,
          detectedActions: [],
          detectedObjects: [],
          environment: 'general',
          sceneConcepts: [],
          isActionShot: true,
          visualTokens: new Set([asset.name.toLowerCase()]),
          cleanFileName: asset.name,
          dominantBrightness: 'normal',
        };
        return {
          ...m,
          matchedAsset: profile,
          status: 'STRONG_MATCH' as const,
          isUserOverridden: true,
          matchReason: `User manually assigned: "${asset.name}". Original filename preserved.`,
          matchScore: 1.0,
        };
      }
      return m;
    });
    setLocalMatchesOverride(updated);

    if (onUpdateBeats && beats) {
      const legacyUpdated = beats.map((b) => {
        if (String(b.beatIndex) === assetPickerBeat.beatLabel || b.id === assetPickerBeat.beatId) {
          return {
            ...b,
            matchedAssetId: asset.id,
            matchedAssetName: asset.name,
            matchedThumbnail: asset.thumbnailUrl || asset.url,
            matchedAssetUrl: asset.url,
            isUnmatched: false,
            matchScore: 1.0,
          };
        }
        return b;
      });
      onUpdateBeats(legacyUpdated);
    }

    setAssetPickerBeat(null);
    setAssetSearchQuery('');
  };

  const handleApprove = async () => {
    if (onApproveAndPlace) {
      await onApproveAndPlace(matches);
    } else if (onCommitToTimeline) {
      onCommitToTimeline(beats || []);
      onClose();
    }
  };

  // Safe early return AFTER all hooks have executed
  if (!isOpen || !currentSession) return null;

  const {
    audioAssetName,
    audioDuration,
    totalBeats,
    visualAssetsCount,
    strongMatchesCount,
    needsReviewCount,
    noVisualCount,
  } = currentSession;

  // Format seconds to mm:ss.ms (e.g. "0:42.10")
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = (secs % 60).toFixed(2);
    const padded = remSecs.padStart(5, '0');
    return `${mins}:${padded}`;
  };

  const handleRematchByFilenames = () => {
    if (!currentSession || availableAssets.length === 0) return;
    const visualProfiles = analyzeVisualAssets(availableAssets);
    const authoritativeBeats = currentSession.matches.map((m, idx) => ({
      id: m.beatId,
      beatIndex: idx + 1,
      beatLabel: m.beatLabel,
      numberPart: idx + 1,
      letterPart: '',
      rawText: m.scriptText,
      normalizedText: m.scriptText.toLowerCase(),
      startTime: m.startTime,
      endTime: m.endTime,
      duration: m.duration,
      requiredConcepts: [],
      actionVerbs: [],
      keyObjects: [],
      peopleOrCharacters: [],
      environmentKeywords: [],
    }));

    const newMatches = matchBeatsToVisuals(authoritativeBeats, visualProfiles);
    setLocalMatchesOverride(newMatches);
  };

  const filteredMatches = matches.filter((m) => {
    if (filterMode === 'needs_review') {
      return m.status === 'NEEDS_REVIEW' || m.status === 'NO_SUITABLE_VISUAL';
    }
    if (filterMode === 'strong') {
      return m.status === 'STRONG_MATCH';
    }
    return true;
  });

  return (
    <div
      id="visual-matching-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      <div
        id="visual-matching-review-container"
        className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-stone-900 text-stone-100 shadow-2xl border border-stone-800 overflow-hidden font-sans"
        style={{ backgroundColor: '#1c1917', color: '#f5f5f4' }}
      >
        {/* ========================================== */}
        {/* 1. HEADER SECTION (Prompt-specified stats) */}
        {/* ========================================== */}
        <div className="flex flex-col border-b border-stone-800 bg-stone-950 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-white uppercase">
                  AI Visual Matching
                </h2>
                <p className="text-xs text-stone-400">
                  Audio-mastered timing • Exact script beats • General Auto Editor
                </p>
              </div>
            </div>

            <button
              id="btn-close-matching-modal"
              onClick={onClose}
              disabled={isPlacing}
              className="rounded-lg p-2 text-stone-400 hover:bg-stone-800 hover:text-white transition disabled:opacity-50 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Prompt-specified summary stats */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-stone-900/90 p-3 border border-stone-800 text-xs">
            <div className="flex flex-col">
              <span className="text-[11px] text-stone-400 flex items-center gap-1">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" /> Audio
              </span>
              <span className="font-semibold text-white truncate" title={audioAssetName}>
                {audioAssetName}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] text-stone-400 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-400" /> Duration
              </span>
              <span className="font-semibold text-white font-mono">
                {formatTime(audioDuration)}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] text-stone-400 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-purple-400" /> Script beats
              </span>
              <span className="font-semibold text-white font-mono">{totalBeats}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] text-stone-400 flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5 text-amber-400" /> Visual assets analyzed
              </span>
              <span className="font-semibold text-white font-mono">{visualAssetsCount}</span>
            </div>
          </div>

          {/* Match Readiness Indicators & Filter */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {strongMatchesCount} matches ready
              </span>
              {(needsReviewCount > 0 || noVisualCount > 0) && (
                <span className="flex items-center gap-1.5 font-medium text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {needsReviewCount + noVisualCount} matches need review
                </span>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex rounded-lg bg-stone-900 p-0.5 border border-stone-800">
              <button
                onClick={() => setFilterMode('all')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-stone-800 text-white'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                All ({totalBeats})
              </button>
              <button
                onClick={() => setFilterMode('needs_review')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                  filterMode === 'needs_review'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Needs Review ({needsReviewCount + noVisualCount})
              </button>
              <button
                onClick={() => setFilterMode('strong')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                  filterMode === 'strong'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Strong ({strongMatchesCount})
              </button>
            </div>

            {/* 1-Tap Rematch by Image Filenames */}
            <button
              onClick={handleRematchByFilenames}
              className="flex items-center gap-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/90 text-blue-300 border border-blue-800/60 px-2.5 py-1 text-[11px] font-medium transition cursor-pointer shadow-sm"
              title="Align every beat directly with its corresponding image using filenames carrying the sentence"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Rematch by Image Names</span>
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. COMPACT SCROLLABLE BEATS LIST */}
        {/* ========================================== */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-stone-800/60">
          {filteredMatches.map((m) => {
            const isStrong = m.status === 'STRONG_MATCH';
            const isReview = m.status === 'NEEDS_REVIEW';
            const isMissing = m.status === 'NO_SUITABLE_VISUAL';

            return (
              <div
                key={m.beatId}
                id={`beat-row-${m.beatLabel}`}
                className="pt-2.5 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl p-3 bg-stone-950/40 hover:bg-stone-950/80 border border-stone-800/80 transition"
              >
                {/* Left: Beat Label, Timing, Script Text */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Authoritative Beat Label badge (e.g. 23a, 23b, 14) */}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="flex min-w-[2.75rem] px-2 h-7 items-center justify-center rounded-md bg-stone-800 font-mono text-xs font-bold text-stone-200 border border-stone-700">
                      {m.beatLabel}
                    </span>
                    <span className="mt-1 font-mono text-[10px] text-stone-500">
                      {m.duration.toFixed(1)}s
                    </span>
                  </div>

                  {/* Timestamp range & exact script text */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900/40">
                        {formatTime(m.startTime)}–{formatTime(m.endTime)}
                      </span>

                      {/* Status badge */}
                      {isStrong && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Strong match
                        </span>
                      )}
                      {isReview && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Needs review
                        </span>
                      )}
                      {isMissing && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50">
                          <AlertTriangle className="h-3 w-3" />
                          No suitable visual
                        </span>
                      )}

                      {m.isUserOverridden && (
                        <span className="text-[10px] text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                          Manually assigned
                        </span>
                      )}
                    </div>

                    {/* Preserved exact script text */}
                    <p className="text-xs sm:text-sm font-medium text-stone-100 leading-snug break-words">
                      "{m.scriptText}"
                    </p>

                    {/* Match reason note */}
                    {m.matchReason && (
                      <p className="text-[10px] text-stone-400 truncate">
                        {m.matchReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Matched Visual Thumbnail, Filename & [Swap] Button */}
                <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-800/80">
                  {m.matchedAsset ? (
                    <div className="flex items-center gap-2.5">
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-stone-800 border border-stone-700">
                        <img
                          src={m.matchedAsset.thumbnailUrl || m.matchedAsset.url}
                          alt={m.matchedAsset.assetName}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col max-w-[130px] sm:max-w-[160px]">
                        <span
                          className="font-mono text-xs font-medium text-white truncate"
                          title={m.matchedAsset.assetName}
                        >
                          {m.matchedAsset.assetName}
                        </span>
                        <span className="text-[10px] text-stone-500 capitalize">
                          {m.matchedAsset.isActionShot ? 'Action shot' : 'Scene visual'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md bg-amber-950/30 px-2.5 py-1.5 border border-amber-900/40 text-amber-300 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      <span>Unassigned</span>
                    </div>
                  )}

                  {/* Explicit [Swap] Button */}
                  <button
                    id={`btn-swap-${m.beatLabel}`}
                    onClick={() => setAssetPickerBeat(m)}
                    disabled={isPlacing}
                    className="flex items-center gap-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1.5 text-xs font-semibold border border-stone-700 hover:border-stone-600 transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>Swap</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ========================================== */}
        {/* 3. EXECUTION PROGRESS & APPROVAL BAR */}
        {/* ========================================== */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-800 bg-stone-950 px-6 py-4">
          <div className="text-xs text-stone-400">
            {isPlacing ? (
              <span className="flex items-center gap-2 text-blue-400 font-medium">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                {placementProgressText || 'Placing approved visuals onto existing timeline...'}
              </span>
            ) : (
              <span>
                Timeline will NOT be modified until you explicitly approve.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isPlacing}
              className="rounded-lg bg-stone-800 px-4 py-2.5 text-xs font-medium text-stone-300 hover:bg-stone-700 hover:text-white transition disabled:opacity-50 cursor-pointer"
            >
              Close
            </button>

            {/* Explicit [ APPROVE & ADD TO TIMELINE ] Button */}
            <button
              id="btn-approve-add-to-timeline"
              onClick={handleApprove}
              disabled={isPlacing}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 text-xs font-bold tracking-wide uppercase shadow-lg shadow-emerald-900/30 transition disabled:opacity-50 cursor-pointer"
            >
              {isPlacing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Placing onto Timeline...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Approve & Add to Timeline</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 4. ASSET SWAP PICKER MODAL */}
      {/* ========================================== */}
      {assetPickerBeat && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs">
          <div className="flex h-[82vh] w-full max-w-3xl flex-col rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-800 p-5 bg-stone-950/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-400 font-mono">
                    Beat {assetPickerBeat.beatLabel}
                  </span>
                  <span className="text-xs text-stone-400 font-mono">
                    {formatTime(assetPickerBeat.startTime)} - {formatTime(assetPickerBeat.endTime)} ({assetPickerBeat.duration.toFixed(2)}s)
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-semibold text-white">
                  Swap Visual for Beat {assetPickerBeat.beatLabel}
                </h3>
                <p className="mt-0.5 text-xs text-stone-400 line-clamp-1 italic max-w-xl">
                  "{assetPickerBeat.scriptText}"
                </p>
              </div>
              <button
                onClick={() => setAssetPickerBeat(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Visual Preview & Quick Upload */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 px-5 py-2.5 bg-stone-900/40 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-stone-400 font-medium">Currently Assigned:</span>
                {assetPickerBeat.matchedAsset?.thumbnailUrl || assetPickerBeat.matchedAsset?.url ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={assetPickerBeat.matchedAsset.thumbnailUrl || assetPickerBeat.matchedAsset.url}
                      alt={assetPickerBeat.matchedAsset.assetName}
                      referrerPolicy="no-referrer"
                      className="h-7 w-12 rounded object-cover border border-stone-700"
                    />
                    <span className="font-mono text-stone-200 truncate max-w-[220px]">
                      {assetPickerBeat.matchedAsset.assetName}
                    </span>
                  </div>
                ) : (
                  <span className="text-amber-400 italic">None (No visual currently assigned)</span>
                )}
              </div>

              {/* Upload New Image Button */}
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition cursor-pointer shadow-sm">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Image</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleUploadNewFile}
                  className="hidden"
                />
              </label>
            </div>

            {/* Search & Category Filter Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 pb-2 border-b border-stone-800/60 bg-stone-950/30">
              {/* Category Tabs */}
              <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800 text-xs">
                <button
                  type="button"
                  onClick={() => setPickerTab('all')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    pickerTab === 'all'
                      ? 'bg-stone-800 text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  All ({allSelectableAssets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('project')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    pickerTab === 'project'
                      ? 'bg-stone-800 text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Project ({allSelectableAssets.filter((a) => a.source === 'project').length})
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('matched')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    pickerTab === 'matched'
                      ? 'bg-stone-800 text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Video ({allSelectableAssets.filter((a) => a.source === 'matched').length})
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('stock')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    pickerTab === 'stock'
                      ? 'bg-stone-800 text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Stock Library ({allSelectableAssets.filter((a) => a.source === 'stock').length})
                </button>
              </div>

              {/* Search input */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-500" />
                <input
                  type="text"
                  placeholder="Search by keyword, filename, or tag..."
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-stone-950 pl-8 pr-7 py-1.5 text-xs text-white placeholder-stone-500 border border-stone-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {assetSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAssetSearchQuery('')}
                    className="absolute right-2 top-2 text-stone-500 hover:text-stone-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Grid of available images */}
            <div className="flex-1 overflow-y-auto p-4 pt-3">
              {searchFilteredAssets.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {searchFilteredAssets.map((asset) => {
                    const isCurrentlySelected =
                      assetPickerBeat.matchedAsset?.assetId === asset.id ||
                      assetPickerBeat.matchedAsset?.url === asset.url;

                    return (
                      <div
                        key={asset.id}
                        onClick={() => handleSelectSwapAsset(asset)}
                        className={`group relative flex flex-col rounded-xl bg-stone-950 border overflow-hidden cursor-pointer transition hover:border-blue-500 hover:shadow-lg ${
                          isCurrentlySelected
                            ? 'border-blue-500 ring-2 ring-blue-500/30'
                            : 'border-stone-800'
                        }`}
                      >
                        <div className="aspect-video w-full overflow-hidden bg-stone-900 flex items-center justify-center relative">
                          {asset.thumbnailUrl || asset.url ? (
                            <img
                              src={asset.thumbnailUrl || asset.url}
                              alt={asset.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-stone-500">
                              <ImageIcon className="h-6 w-6" />
                              <span className="text-[10px] font-mono">No Preview</span>
                            </div>
                          )}

                          {isCurrentlySelected && (
                            <div className="absolute top-2 right-2 rounded-full bg-blue-600 p-1 text-white shadow-md">
                              <Check className="h-3 w-3" />
                            </div>
                          )}

                          <div className="absolute bottom-1.5 left-1.5">
                            <span className="rounded bg-black/70 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-medium text-stone-300 uppercase">
                              {asset.source === 'stock'
                                ? 'Stock'
                                : asset.source === 'matched'
                                ? 'Video'
                                : 'Asset Bin'}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5">
                          <span
                            className="font-mono text-xs font-medium text-stone-200 truncate block group-hover:text-blue-400 transition"
                            title={asset.name}
                          >
                            {asset.name}
                          </span>
                          {asset.tags && asset.tags.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 overflow-hidden">
                              <span className="text-[10px] text-stone-500 truncate">
                                {asset.tags.slice(0, 3).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="rounded-full bg-stone-800/80 p-3 text-stone-400 mb-3">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">No images found</h4>
                  <p className="mt-1 text-xs text-stone-400 max-w-sm">
                    {assetSearchQuery
                      ? `No visuals matched "${assetSearchQuery}". Try clearing your search, selecting another tab, or uploading an image.`
                      : 'No images available in this category. You can upload an image or browse the Stock Library.'}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    {assetSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAssetSearchQuery('')}
                        className="rounded-lg bg-stone-800 hover:bg-stone-700 px-3 py-1.5 text-xs text-stone-200 cursor-pointer"
                      >
                        Clear Search
                      </button>
                    )}
                    {pickerTab !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setPickerTab('all')}
                        className="rounded-lg bg-stone-800 hover:bg-stone-700 px-3 py-1.5 text-xs text-stone-200 cursor-pointer"
                      >
                        Show All Images
                      </button>
                    )}
                    <label className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs text-white font-medium cursor-pointer">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleUploadNewFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-stone-800 bg-stone-950/40">
              <span className="text-xs text-stone-400">
                Showing <strong className="text-stone-200">{searchFilteredAssets.length}</strong> available visual{searchFilteredAssets.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setAssetPickerBeat(null)}
                className="rounded-lg bg-stone-800 px-4 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
