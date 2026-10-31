import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  VideoClip,
  CaptionClip,
  AudioTrackClip,
  OverlayClip,
  ActiveTool,
  AspectRatio,
  Transition,
  AppScreen,
  ProjectItem,
  TemplatePreset,
  ZipImportResult,
} from './types';
import {
  INITIAL_VIDEO_CLIPS,
  INITIAL_CAPTIONS,
  INITIAL_AUDIO_CLIPS,
  INITIAL_OVERLAYS,
} from './data/sampleDocumentaryData';
import { SAMPLE_PROJECTS } from './data/sampleProjectsData';
import { HomeScreen } from './components/HomeScreen/HomeScreen';
import { EditorHeader } from './components/Header/EditorHeader';
import { PreviewPlayer } from './components/PreviewPlayer';
import { Timeline } from './components/Timeline/Timeline';
import { BottomToolbar } from './components/Toolbar/BottomToolbar';
import { TransitionModal } from './components/Modals/TransitionModal';
import { AutoCaptionsModal } from './components/Modals/AutoCaptionsModal';
import { CoverModal } from './components/Modals/CoverModal';
import { ExportModal } from './components/Modals/ExportModal';
import { SpeedModal } from './components/Modals/SpeedModal';
import { VolumeModal } from './components/Modals/VolumeModal';
import { KeyframeModal } from './components/Modals/KeyframeModal';
import { FilterAdjustModal } from './components/Modals/FilterAdjustModal';
import { VoiceEffectsTTSModal } from './components/Modals/VoiceEffectsTTSModal';
import { SmartHighlightsModal } from './components/Modals/SmartHighlightsModal';
import { ChromaKeyCutoutModal } from './components/Modals/ChromaKeyCutoutModal';
import { VideoEffectsModal } from './components/Modals/VideoEffectsModal';
import { PIPBlendMaskModal } from './components/Modals/PIPBlendMaskModal';
import { BeatDetectorModal } from './components/Modals/BeatDetectorModal';
import { ChartModal } from './components/Modals/ChartModal';
import {
  Keyframe,
  ColorAdjustments,
  FilterPreset,
  SpeedSettings,
  BlendMode,
  ShapeMaskConfig,
  BeatMarker,
  BeatDetectionConfig,
  ChartConfig,
  ChartType,
  AIChatMessage,
  AIEditPlan,
  AIEditCommand,
  EditingStyle,
  ProjectAsset,
  AIHistorySession,
  TimelineOperation,
  TimelineState,
  CreativePlan,
  RecapActionPlan,
  FullTimelineSnapshot,
} from './types';
import { findKeyframeNear, getNextKeyframeTime, getPrevKeyframeTime, interpolateKeyframes } from './utils/keyframe';
import { calculateSpeedAdjustedDuration } from './utils/speed';
import { extractWaveformDataFromFile, generateRealisticAudioWaveform } from './utils/audioWaveform';
import { detectAudioBeats } from './utils/beatDetector';
import { FloatingAIButton } from './components/AIEditor/FloatingAIButton';
import { AIActivityBadge } from './components/AIEditor/AIActivityBadge';
import { AIChatDrawer } from './components/AIEditor/AIChatDrawer';
import { applyOperations } from './engine/timelineEngine';
import { planGeneralEdit } from './engine/generalAIPlanner';
import { buildRecapActionPlan, isCutGuideOrEDLText } from './engine/recapGenPlanner';
import {
  parseAuthoritativeScriptBeats,
  transcribeAndTimestampAudio,
  analyzeVisualAssets,
  matchBeatsToVisuals,
  swapVisualForBeat,
  buildTimelineClipsFromApprovedMatches,
  verifyMatchedTimelineState,
  VisualBeatMatch,
  VisualMatchingSession,
} from './engine/visualAudioMatcher';
import { isSrtFormat, parseSrtText, convertSrtCuesToBeats, separateScriptAndSrt } from './engine/srtParser';
import { VisualMatchingReviewModal } from './components/AIEditor/VisualMatchingReviewModal';
import { applyAutoKenBurnsToClips } from './utils/cinematicMotion';
import { AudioSeekCoalescer, CoalescedSeekTarget } from './utils/audioSeekCoalescer';
import { playbackClock } from './utils/playbackClock';
import { detectChatIntent, EditorContextSnapshot } from './engine/chatIntentDetector';
import { generateConversationalReply } from './engine/chatConversationalResponder';
import { executeAndVerifyEditorAction, executeMultiEditorActions } from './engine/chatActionExecutor';
import {
  BUILTIN_EDITING_STYLES,
  generateAIEditPlan,
  generateFallbackAssets,
  handleConversationalCorrection,
} from './utils/aiReasoningFallback';
import { applyAICommand, verifyAIExecution, ExecutionContext } from './utils/aiCommandEngine';
import { createProjectAssetFromFile, deduplicateAndMergeAssets } from './utils/assetManager';
import { processUploadFilesOrZips, isZipFile } from './utils/zipHandler';
import { AssetBinModal } from './components/AssetBin/AssetBinModal';
import { GeneralEditorProjectSnapshot } from './utils/chatSessionStorage';
import {
  getDatabase,
  checkStorageQuota,
  persistAssetsBatch,
  deleteAsset,
  restoreAllAssets,
  persistProject,
  getAllPersistedProjects,
  deletePersistedProject,
  persistAppState,
  getAppState,
  reconnectTimelineToAssets,
  exportProjectArchive,
  importProjectArchive,
  StoredProjectRecord,
} from './utils/persistentStorage';
import { ensureAudioClipHasUrl } from './utils/cinematicAudioSynthesizer';

export default function App() {
  // Application Screen Mode ('home' or 'editor') - CapCut starts directly at Home Dashboard
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [currentProjectTitle, setCurrentProjectTitle] = useState<string>('Ancient Bronze Collapse — Ep 1');
  const [currentProjectId, setCurrentProjectId] = useState<string>('proj-doc-bronze');
  const [projectsList, setProjectsList] = useState<ProjectItem[]>(SAMPLE_PROJECTS);
  const [isRestoringProject, setIsRestoringProject] = useState<boolean>(true);
  const [storageStatusText, setStorageStatusText] = useState<string>('Restoring project...');
  const [storageErrorNotice, setStorageErrorNotice] = useState<string | null>(null);
  const [isStorageSaving, setIsStorageSaving] = useState<boolean>(false);

  // Timeline Data State
  const [videoClips, setVideoClips] = useState<VideoClip[]>(INITIAL_VIDEO_CLIPS);
  const [captions, setCaptions] = useState<CaptionClip[]>(INITIAL_CAPTIONS);
  const [audioClips, setAudioClips] = useState<AudioTrackClip[]>(INITIAL_AUDIO_CLIPS);
  const [overlays, setOverlays] = useState<OverlayClip[]>(INITIAL_OVERLAYS);

  // Playhead & Playback State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const currentTimeRef = useRef<number>(0);
  currentTimeRef.current = currentTime;
  const lastAppRenderTimeRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(45); // Timeline zoom scale
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [coverThumbnail, setCoverThumbnail] = useState<string>(
    INITIAL_VIDEO_CLIPS[0]?.thumbnailUrl || ''
  );

  // Selection States
  const [selectedClipId, setSelectedClipId] = useState<string | null>(INITIAL_VIDEO_CLIPS[0]?.id || null);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // Active Bottom Navigation Tool Tab
  const [activeTool, setActiveTool] = useState<ActiveTool>('root');

  // Modal States
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState<boolean>(false);
  const [activeTransitionIndex, setActiveTransitionIndex] = useState<number>(0);
  const [isAutoCaptionsModalOpen, setIsAutoCaptionsModalOpen] = useState<boolean>(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState<boolean>(false);
  const [isVolumeModalOpen, setIsVolumeModalOpen] = useState<boolean>(false);
  const [isKeyframeModalOpen, setIsKeyframeModalOpen] = useState<boolean>(false);
  const [isFilterAdjustModalOpen, setIsFilterAdjustModalOpen] = useState<boolean>(false);
  const [isVoiceEffectsModalOpen, setIsVoiceEffectsModalOpen] = useState<boolean>(false);
  const [isSmartHighlightsModalOpen, setIsSmartHighlightsModalOpen] = useState<boolean>(false);
  const [isChromaKeyModalOpen, setIsChromaKeyModalOpen] = useState<boolean>(false);
  const [isVideoEffectsModalOpen, setIsVideoEffectsModalOpen] = useState<boolean>(false);
  const [isPIPBlendMaskModalOpen, setIsPIPBlendMaskModalOpen] = useState<boolean>(false);
  const [pipTargetType, setPipTargetType] = useState<'overlay' | 'clip'>('overlay');
  const [pipTargetId, setPipTargetId] = useState<string | null>(null);
  const [isBeatDetectorModalOpen, setIsBeatDetectorModalOpen] = useState<boolean>(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState<boolean>(false);
  const [editingChartOverlayId, setEditingChartOverlayId] = useState<string | null>(null);
  const [chartPresetToOpen, setChartPresetToOpen] = useState<ChartType | undefined>(undefined);
  const [isAssetBinOpen, setIsAssetBinOpen] = useState<boolean>(false);
  const [isImportingAssets, setIsImportingAssets] = useState<boolean>(false);
  const [assetImportProgressText, setAssetImportProgressText] = useState<string>('');
  const [isAutoKenBurnsActive, setIsAutoKenBurnsActive] = useState<boolean>(true);
  const [isAutoDuckingActive, setIsAutoDuckingActive] = useState<boolean>(true);

  // History for Undo / Redo (Full Timeline Tracks Snapshot)
  const [history, setHistory] = useState<FullTimelineSnapshot[]>([
    {
      videoClips: INITIAL_VIDEO_CLIPS,
      audioClips: INITIAL_AUDIO_CLIPS,
      captions: INITIAL_CAPTIONS,
      overlays: INITIAL_OVERLAYS,
      aspectRatio: '9:16',
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // =========================================================
  // AI CONVERSATIONAL EDITING SYSTEM STATE & WORKFLOW
  // =========================================================
  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false);
  const [isAIExecuting, setIsAIExecuting] = useState<boolean>(false);
  const [aiActivityStepIndex, setAiActivityStepIndex] = useState<number>(0);
  const [aiActivityStepText, setAiActivityStepText] = useState<string>('');
  const [currentEditingStyle, setCurrentEditingStyle] = useState<EditingStyle>(BUILTIN_EDITING_STYLES[0]);
  const [customStyles, setCustomStyles] = useState<EditingStyle[]>([]);
  const [registeredAssets, setRegisteredAssets] = useState<ProjectAsset[]>(() => generateFallbackAssets());
  const [aiHistorySessions, setAiHistorySessions] = useState<AIHistorySession[]>([]);
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Hello! I am your AI Video Editor connected directly to your timeline.

Tell me what you'd like to build, or click **"Start a new chat"** / ask a question anytime. For example:
• *"I want to make a ranking video (#5 to #1). Match clips to each rank and add reveal sound effects."*
• *"I want to make a video for my finance channel. Ask me questions first."*
• *"Match each image literally to what's happening in narration (2 to 4s pacing)."*
• *"Explain how this video should be edited."*`,
      timestamp: Date.now(),
    },
  ]);
  const [activeScriptText, setActiveScriptText] = useState<string>('');
  const [activeSrtText, setActiveSrtText] = useState<string>('');
  const [activeMatchingSession, setActiveMatchingSession] = useState<VisualMatchingSession | null>(null);
  const [isMatchingReviewOpen, setIsMatchingReviewOpen] = useState<boolean>(false);
  const [isPlacingMatches, setIsPlacingMatches] = useState<boolean>(false);
  const [placingProgressText, setPlacingProgressText] = useState<string>('');

  // 1. Startup: Asynchronously restore projects and files from IndexedDB
  useEffect(() => {
    let isMounted = true;

    // Hard ceiling: never block the user for more than 1 second
    const maxTimeout = setTimeout(() => {
      if (isMounted) {
        setIsRestoringProject(false);
      }
    }, 1000);

    async function restoreProjectOnStartup() {
      try {
        setStorageStatusText('Opening local database...');
        await Promise.race([
          getDatabase(),
          new Promise((r) => setTimeout(r, 600)),
        ]);

        // Non-blocking quota check
        checkStorageQuota().then((quota) => {
          if (quota && quota.percentUsed > 90) {
            setStorageErrorNotice(
              `Storage warning: ${quota.percentUsed}% of browser storage used (${quota.availableMb}MB remaining).`
            );
          }
        }).catch(() => {});

        setStorageStatusText('Checking saved projects...');
        const [savedProjects, lastActiveId, lastScreen] = await Promise.all([
          getAllPersistedProjects(),
          getAppState<string>('last_active_project_id'),
          getAppState<AppScreen>('last_screen'),
        ]);

        if (savedProjects && savedProjects.length > 0) {
          setStorageStatusText('Restoring saved project...');
          const targetProj =
            (lastActiveId && savedProjects.find((p) => p.id === lastActiveId)) ||
            savedProjects[0];

          if (targetProj) {
            setCurrentProjectId(targetProj.id);
            setCurrentProjectTitle(targetProj.name);
            setAspectRatio(targetProj.aspectRatio || '9:16');
            if (targetProj.activeScriptText) {
              setActiveScriptText(targetProj.activeScriptText);
            }

            // Restore all media files with recreated File instances & object URLs
            setStorageStatusText('Restoring media files & waveforms...');
            const restoredAssets = await restoreAllAssets(targetProj.id);
            if (restoredAssets.length > 0) {
              setRegisteredAssets(restoredAssets);
            }

            // Reconnect video clips & audio clips to restored assets
            const { reconnectedVideoClips, reconnectedAudioClips } = reconnectTimelineToAssets(
              targetProj.videoClips || [],
              targetProj.audioClips || [],
              restoredAssets
            );

            setVideoClips(reconnectedVideoClips);
            setAudioClips(reconnectedAudioClips);
            setCaptions(targetProj.captionClips || []);
            setOverlays(targetProj.overlayClips || []);
            setHistory([reconnectedVideoClips]);
            setHistoryIndex(0);

            if (reconnectedVideoClips.length > 0) {
              setSelectedClipId(reconnectedVideoClips[0].id);
            }
          }

          // Map saved projects into projectsList
          const mappedProjectItems: ProjectItem[] = savedProjects.map((sp) => ({
            id: sp.id,
            name: sp.name,
            thumbnailUrl: sp.thumbnailUrl || (sp.videoClips && sp.videoClips[0]?.thumbnailUrl) || '',
            aspectRatio: sp.aspectRatio,
            duration: sp.duration,
            lastEdited: sp.lastEdited,
            resolution: sp.resolution || '1080P',
            fps: sp.fps || 30,
            videoClips: sp.videoClips || [],
            audioClips: sp.audioClips || [],
            captionClips: sp.captionClips || [],
            overlayClips: sp.overlayClips || [],
            category: sp.category,
            isFavorite: sp.isFavorite,
          }));

          setProjectsList(mappedProjectItems);

          if (lastScreen === 'editor' || lastScreen === 'home') {
            setCurrentScreen(lastScreen);
          }
        } else {
          // First-ever run: Seed initial sample projects in the background without blocking the UI
          setTimeout(async () => {
            try {
              for (const proj of SAMPLE_PROJECTS) {
                const record: StoredProjectRecord = {
                  id: proj.id,
                  name: proj.name,
                  thumbnailUrl: proj.thumbnailUrl,
                  aspectRatio: proj.aspectRatio,
                  duration: proj.duration,
                  lastEdited: proj.lastEdited,
                  resolution: proj.resolution,
                  fps: proj.fps,
                  category: proj.category,
                  isFavorite: proj.isFavorite,
                  videoClips: proj.videoClips || [],
                  audioClips: proj.audioClips || [],
                  captionClips: proj.captionClips || [],
                  overlayClips: proj.overlayClips || [],
                  assetIds: [],
                };
                await persistProject(record);
              }
              await persistAppState('last_active_project_id', 'proj-doc-bronze');
              await persistAppState('last_screen', 'home');
            } catch (seedErr) {
              console.warn('[PersistentStorage] Background seed warning:', seedErr);
            }
          }, 300);
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Startup restore warning:', err);
        setStorageErrorNotice('Local project loaded with initial defaults.');
      } finally {
        clearTimeout(maxTimeout);
        if (isMounted) {
          setIsRestoringProject(false);
        }
      }
    }

    restoreProjectOnStartup();

    return () => {
      isMounted = false;
      clearTimeout(maxTimeout);
    };
  }, []);

  // 2. Debounced Autosave: automatically save timeline, assets, and project settings to IndexedDB
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isRestoringProject) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setIsStorageSaving(true);
    const timer = setTimeout(async () => {
      try {
        const voiceoverAudioClip = audioClips.find(
          (a) => a.category === 'voiceover' || a.id.includes('vo')
        ) || (audioClips.length > 0 && audioClips[0].duration > 0 ? audioClips[0] : null);
        const dur = voiceoverAudioClip && voiceoverAudioClip.duration > 0
          ? voiceoverAudioClip.duration
          : Math.max(videoClips.reduce((acc, c) => acc + (c.duration || 0), 0), 1.0);
        const activeRecord: StoredProjectRecord = {
          id: currentProjectId,
          name: currentProjectTitle,
          thumbnailUrl: videoClips[0]?.thumbnailUrl || coverThumbnail || '',
          aspectRatio,
          duration: Number(dur.toFixed(2)),
          lastEdited: Date.now(),
          resolution: '1080P',
          fps: 30,
          activeScriptText,
          videoClips,
          audioClips,
          captionClips: captions,
          overlayClips: overlays,
          assetIds: registeredAssets.map((a) => a.id),
        };

        await persistProject(activeRecord);
        await persistAppState('last_active_project_id', currentProjectId);
        await persistAppState('last_screen', currentScreen);

        // Keep projectsList synchronized
        setProjectsList((prev) => {
          const idx = prev.findIndex((p) => p.id === currentProjectId);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              name: currentProjectTitle,
              thumbnailUrl: activeRecord.thumbnailUrl || updated[idx].thumbnailUrl,
              aspectRatio,
              duration: activeRecord.duration,
              lastEdited: Date.now(),
              videoClips,
              audioClips,
              captionClips: captions,
              overlayClips: overlays,
            };
            return updated;
          } else {
            return [
              {
                id: currentProjectId,
                name: currentProjectTitle,
                thumbnailUrl: activeRecord.thumbnailUrl || '',
                aspectRatio,
                duration: activeRecord.duration,
                lastEdited: Date.now(),
                resolution: '1080P',
                fps: 30,
                videoClips,
                audioClips,
                captionClips: captions,
                overlayClips: overlays,
              },
              ...prev,
            ];
          }
        });
      } catch (err) {
        console.warn('[PersistentStorage] Autosave failed:', err);
        setStorageErrorNotice('Unable to save changes locally. Your browser storage quota may be full.');
      } finally {
        setIsStorageSaving(false);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [
    isRestoringProject,
    currentProjectId,
    currentProjectTitle,
    videoClips,
    audioClips,
    captions,
    overlays,
    aspectRatio,
    activeScriptText,
    currentScreen,
    coverThumbnail,
    registeredAssets,
  ]);

  const handleClearAIChat = () => {
    setAiMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Started a fresh conversation! 🎬\n\nHow would you like to edit your video? You can tell me the format (e.g. YouTube Longform 16:9 or Short 9:16), describe ranking order (#5 to #1), paste a narration script, or explain your custom editing workflow.`,
        timestamp: Date.now(),
      },
    ]);
  };

  // Restore previous General Editor conversation and its editing/timeline context
  const handleRestoreAISessionContext = (
    snapshot?: GeneralEditorProjectSnapshot,
    sessionMessages?: AIChatMessage[]
  ) => {
    if (snapshot) {
      if (snapshot.videoClips && snapshot.videoClips.length > 0) {
        setVideoClips(snapshot.videoClips);
        pushHistory(snapshot.videoClips);
        setSelectedClipId(snapshot.videoClips[0].id);
      }
      if (snapshot.audioClips) setAudioClips(snapshot.audioClips);
      if (snapshot.captionClips) setCaptions(snapshot.captionClips);
      if (snapshot.overlayClips) setOverlays(snapshot.overlayClips);
      if (snapshot.aspectRatio) setAspectRatio(snapshot.aspectRatio);
      if (snapshot.activeScriptText !== undefined) setActiveScriptText(snapshot.activeScriptText);
    }
    if (sessionMessages && sessionMessages.length > 0) {
      setAiMessages(sessionMessages);
    }
  };

  const AI_EXECUTION_STEPS = [
    'Analyzing narration & cadence',
    'Matching visual assets to phrases',
    'Building video track & keyframes',
    'Generating synchronized captions',
    'Placing background score & SFX',
    'Verifying timeline synchronization',
  ];

  // Upload and register media files or ZIP archives into AI project assets
  const handleUploadAIAssets = async (filesOrAssets: FileList | File[] | ProjectAsset[]) => {
    try {
      let newAssets: ProjectAsset[] = [];
      let scriptText = '';
      let subtitleCaptions: CaptionClip[] = [];
      let zipSummaries: any[] = [];

      if (Array.isArray(filesOrAssets) && filesOrAssets.length > 0 && 'id' in filesOrAssets[0] && 'type' in filesOrAssets[0]) {
        newAssets = filesOrAssets as ProjectAsset[];
      } else {
        const res = await processUploadFilesOrZips(filesOrAssets as FileList | File[]);
        newAssets = res.assets;
        scriptText = res.scriptText || '';
        subtitleCaptions = res.subtitleCaptions || [];
        zipSummaries = res.zipSummaries || [];
      }

      if (scriptText) {
        if (isSrtFormat(scriptText)) {
          setActiveSrtText(scriptText);
        } else {
          setActiveScriptText(scriptText);
        }
      }

      if (newAssets.length > 0) {
        // Persist files and asset metadata to IndexedDB
        persistAssetsBatch(newAssets, currentProjectId).catch((err) => {
          console.warn('[PersistentStorage] Failed to save uploaded files to IndexedDB:', err);
          setStorageErrorNotice('Unable to save some uploaded files locally. Storage quota may be exceeded.');
        });

        setRegisteredAssets((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const toAdd = newAssets.filter((a) => !existingIds.has(a.id));
          return [...prev, ...toAdd];
        });

        const zipInfo =
          zipSummaries.length > 0
            ? `📦 Unpacked ZIP Archive: ${zipSummaries.map((z) => `${z.zipName} (${z.breakdown})`).join(', ')}. `
            : '';

        const scriptInfo = scriptText
          ? isSrtFormat(scriptText)
            ? ` Detected SRT audio timing clock (${parseSrtText(scriptText).length} timestamp cues).`
            : ` Detected narration script (${scriptText.length} characters).`
          : '';

        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-upload-${Date.now()}`,
            role: 'system',
            content: `${zipInfo}Registered ${newAssets.length} project asset${newAssets.length > 1 ? 's' : ''} for AI editing: ${newAssets.map((a) => a.name).join(', ')}.${scriptInfo}`,
            attachedAssets: newAssets,
            timestamp: Date.now(),
          },
        ]);
      } else if (scriptText) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-srt-only-${Date.now()}`,
            role: 'system',
            content: isSrtFormat(scriptText)
              ? `✅ Attached SRT audio timing clock (${parseSrtText(scriptText).length} timestamp cues). Ready to match with your script beats.`
              : `✅ Attached narration script (${scriptText.length} characters).`,
            timestamp: Date.now(),
          },
        ]);
      }

      if (subtitleCaptions && subtitleCaptions.length > 0) {
        setCaptions((prev) => [...prev, ...subtitleCaptions]);
      }
    } catch (err) {
      console.warn('Failed to process uploaded assets / zip:', err);
    }
  };

  // Import media files or ZIP archives into the Asset Bin (Timeline preserved untouched)
  const handleImportMediaToAssetBin = async (files: FileList | File[], openBin = true) => {
    setIsImportingAssets(true);
    setAssetImportProgressText('Processing uploaded files...');
    try {
      const { assets: newAssets, scriptText, subtitleCaptions, zipSummaries } = await processUploadFilesOrZips(
        files,
        (progressText) => {
          setAssetImportProgressText(progressText);
        }
      );

      if (newAssets.length === 0 && (!subtitleCaptions || subtitleCaptions.length === 0)) {
        setIsImportingAssets(false);
        setAssetImportProgressText('');
        return;
      }

      if (scriptText) {
        setActiveScriptText(scriptText);
      }

      // Safe deduplication and merging into registeredAssets: never overwrites or causes collisions
      setRegisteredAssets((prev) => {
        return deduplicateAndMergeAssets(prev, newAssets);
      });

      // Persist newly imported assets to IndexedDB
      persistAssetsBatch(newAssets, currentProjectId).catch((err) => {
        console.warn('[PersistentStorage] Failed to save imported files to IndexedDB:', err);
        setStorageErrorNotice('Unable to save some imported files locally.');
      });

      if (zipSummaries.length > 0 && currentProjectTitle === 'Untitled Project') {
        const primaryZipName = zipSummaries[0].zipName.replace(/\.zip$/i, '');
        setCurrentProjectTitle(primaryZipName);
      }

      const zipInfo =
        zipSummaries.length > 0
          ? `📦 Unpacked ZIP Archive: ${zipSummaries.map((z) => `${z.zipName} (${z.breakdown})`).join(', ')}. `
          : '';

      const scriptInfo = scriptText
        ? ` Detected narration script (${scriptText.length} characters).`
        : '';

      setAiMessages((prev) => [
        ...prev,
        {
          id: `msg-assetbin-import-${Date.now()}`,
          role: 'system',
          content: `${zipInfo}Stored ${newAssets.length} asset(s) safely in the Asset Bin.${scriptInfo} (Timeline preserved intact).`,
          attachedAssets: newAssets,
          timestamp: Date.now(),
        },
      ]);

      if (openBin) {
        setIsAssetBinOpen(true);
      }
    } catch (err) {
      console.warn('Failed to import media to Asset Bin:', err);
    } finally {
      setIsImportingAssets(false);
      setAssetImportProgressText('');
    }
  };

  // Add an asset from the Asset Bin onto the Timeline (User-initiated or AI-approved action)
  const handleAddAssetToTimeline = (asset: ProjectAsset) => {
    if (asset.type === 'video' || asset.type === 'image') {
      const newVideoClip: VideoClip = {
        id: `clip-bin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: asset.name,
        type: asset.type,
        url: asset.url,
        file: asset.file,
        assetId: asset.id,
        sourceAssetId: asset.id,
        color: asset.type === 'video' ? '#2A59FE' : '#8B5CF6',
        thumbnailUrl: asset.thumbnailUrl || asset.url,
        frames: [asset.thumbnailUrl || asset.url, asset.thumbnailUrl || asset.url],
        duration: asset.duration || (asset.type === 'video' ? 5.0 : 4.0),
        startOffset: 0,
        rawDuration: Math.max(asset.duration || 5.0, 10.0),
        volume: 100,
        speed: 1.0,
      };

      setVideoClips((prev) => {
        const updated = [...prev, newVideoClip];
        pushHistory(updated);
        return updated;
      });
      setSelectedClipId(newVideoClip.id);
    } else if (asset.type === 'audio') {
      const startAfterLast = audioClips.reduce((max, a) => Math.max(max, a.startTime + a.duration), 0);
      const newAudioClip: AudioTrackClip = {
        id: `audio-bin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: asset.name,
        category: 'voiceover',
        url: asset.url,
        file: asset.file,
        assetId: asset.id,
        sourceAssetId: asset.id,
        duration: asset.duration || 6.0,
        startTime: startAfterLast,
        volume: 100,
        waveformData:
          asset.waveformData && asset.waveformData.length > 0
            ? asset.waveformData
            : generateRealisticAudioWaveform(asset.duration || 6.0, 'speech'),
      };

      setAudioClips((prev) => [...prev, newAudioClip]);
      setSelectedAudioId(newAudioClip.id);
    } else if (asset.type === 'text') {
      const textPreview = asset.textContent?.slice(0, 80) || asset.name;
      const newCaption: CaptionClip = {
        id: `caption-bin-${Date.now()}`,
        text: textPreview,
        startTime: currentTime,
        duration: 4.0,
        stylePreset: 'hormozi',
      };
      setCaptions((prev) => [...prev, newCaption]);
      setSelectedCaptionId(newCaption.id);
    }
  };

  // Safe removal of asset from Asset Bin (does NOT delete clips already on timeline)
  const handleDeleteAssetFromBin = (assetId: string) => {
    setRegisteredAssets((prev) => prev.filter((a) => a.id !== assetId));
    deleteAsset(assetId).catch((err) => {
      console.warn('[PersistentStorage] Failed to remove asset from IndexedDB:', err);
    });
  };

  // Revert / Undo AI Session
  const handleRevertLastAISession = () => {
    if (aiHistorySessions.length === 0) return;
    const lastSession = aiHistorySessions[aiHistorySessions.length - 1];
    setVideoClips(lastSession.snapshot.videoClips);
    setAudioClips(lastSession.snapshot.audioClips);
    setCaptions(lastSession.snapshot.captionClips);
    setOverlays(lastSession.snapshot.overlayClips);
    setAiHistorySessions((prev) => prev.slice(0, -1));

    setAiMessages((prev) => [
      ...prev,
      {
        id: `msg-revert-${Date.now()}`,
        role: 'system',
        content: `↩ Reverted timeline to state prior to AI editing session: "${lastSession.description}".`,
        timestamp: Date.now(),
      },
    ]);
  };

  // Execute AI Edit Plan onto Real Timeline
  const handleExecuteAIPlan = async (plan: AIEditPlan | RecapActionPlan | CreativePlan) => {
    const planTitle = 'title' in plan ? plan.title : ('format' in plan ? `Creative Edit: ${plan.format}` : 'AI Video Edit');
    
    // 1. Take snapshot for Undo
    const snapshot: AIHistorySession = {
      id: `session-${Date.now()}`,
      timestamp: Date.now(),
      description: planTitle,
      snapshot: {
        videoClips: [...videoClips],
        audioClips: [...audioClips],
        captionClips: [...captions],
        overlayClips: [...overlays],
      },
    };
    setAiHistorySessions((prev) => [...prev, snapshot]);
    setIsAIExecuting(true);

    // If plan has timeline operations (from General AI Planner or RecapGen Planner)
    if ('operations' in plan && Array.isArray(plan.operations) && plan.operations.length > 0) {
      const currentState: TimelineState = {
        videoClips: [...videoClips],
        audioClips: [...audioClips],
        captions: [...captions],
        overlays: [...overlays],
        aspectRatio,
        currentTime,
        registeredAssets,
        selectedClipId,
      };

      // Reset track if building a full recap or complete creative auto-edit
      const isRecapPlan = 'scenes' in plan;
      if (isRecapPlan || ('selectedSections' in plan && plan.operations.some((o) => o.type === 'create_video_clip' || o.type === 'create_recap_clip'))) {
        currentState.videoClips = [];
        currentState.captions = [];
        currentState.overlays = [];
      }

      setAiActivityStepText('Applying timeline operations...');
      const { nextState, batchResult } = applyOperations(plan.operations, currentState);

      setVideoClips(nextState.videoClips);
      setAudioClips(nextState.audioClips);
      setCaptions(nextState.captions);
      setOverlays(nextState.overlays);
      setAspectRatio(nextState.aspectRatio);
      pushHistory({
        videoClips: nextState.videoClips,
        audioClips: nextState.audioClips,
        captions: nextState.captions,
        overlays: nextState.overlays,
        aspectRatio: nextState.aspectRatio,
      });

      if (isRecapPlan && 'title' in plan && plan.title) {
        setCurrentProjectTitle(plan.title);
      }

      if (nextState.videoClips.length > 0) {
        setSelectedClipId(nextState.videoClips[0].id);
      }
      setCurrentTime(0);

      if (isRecapPlan) {
        const recapPlan = plan as RecapActionPlan;
        const voClip = nextState.audioClips.find((a) => a.id.includes('vo') || a.category === 'voiceover' || a.duration > 0);
        const totalDuration = voClip && voClip.duration > 0 ? voClip.duration : ((recapPlan as any).audioDuration || nextState.videoClips.reduce((acc, c) => acc + c.duration, 0));
        const hasVoiceover = nextState.audioClips.some((a) => a.id.includes('vo') || a.category === 'voiceover');
        const isImageStory = nextState.videoClips.every((c) => c.type === 'image' || c.url?.match(/\.(jpeg|jpg|png|webp|gif)/i));
        const finalTitle = (recapPlan.title && !recapPlan.title.includes('WRONG TURN')) ? recapPlan.title : currentProjectTitle;
        const headerTitle = isImageStory ? '### Visual Story Assembly Results' : '### Sequence Assembly Results';
        const sceneLabel = isImageStory ? 'Visual beats' : 'Guide scenes';
        const exclusionNote = isImageStory ? `- **Visual assets matched**: Yes` : `- **Unselected movie sections excluded**: Yes`;

        if (nextState.videoClips.length > 0) {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-recap-success-${Date.now()}`,
              role: 'assistant',
              content: `${headerTitle}\n\n- **${sceneLabel}**: ${recapPlan.totalScenes}\n- **Video clips created**: ${nextState.videoClips.length}\n${exclusionNote}\n- **Voiceover**: ${hasVoiceover ? 'Added' : 'None'}\n- **Timeline duration**: ${totalDuration.toFixed(1)}s\n- **Preview**: Ready\n- **Sequence**: ${finalTitle}`,
              timestamp: Date.now(),
            },
          ]);
        } else {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-recap-fail-${Date.now()}`,
              role: 'assistant',
              content: `### Sequence assembly failed.\n\nThe source assets could not be organized into a sequence.`,
              timestamp: Date.now(),
            },
          ]);
        }
      } else {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-verify-${Date.now()}`,
            role: 'assistant',
            content: `✅ Successfully executed **${batchResult.completedOperations} operations** onto the timeline. ${batchResult.summary}`,
            timestamp: Date.now(),
          },
        ]);
      }

      setIsAIExecuting(false);
      return;
    }

    const legacyPlan = plan as AIEditPlan;
    if (legacyPlan.aspectRatio) {
      setAspectRatio(legacyPlan.aspectRatio);
    }

    // Initial context
    let context: ExecutionContext = {
      videoClips: [...videoClips],
      audioClips: [...audioClips],
      captionClips: [...captions],
      overlayClips: [...overlays],
      registeredAssets,
      aspectRatio: legacyPlan.aspectRatio || aspectRatio,
    };

    // Replace or clean timeline if creating a new comprehensive plan
    if (legacyPlan.commands && legacyPlan.commands.some((c) => c.type === 'ADD_CLIP') && legacyPlan.breakdown?.length >= 2) {
      context.videoClips = [];
      context.captionClips = [];
      context.audioClips = [];
      context.overlayClips = [];
    }

    const totalSteps = AI_EXECUTION_STEPS.length;

    for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
      setAiActivityStepIndex(stepIdx);
      setAiActivityStepText(AI_EXECUTION_STEPS[stepIdx]);

      if (legacyPlan.commands) {
        if (stepIdx === 2) {
          const clipCommands = legacyPlan.commands.filter((c) => c.type === 'ADD_CLIP' || c.type === 'CHANGE_DURATION' || c.type === 'SET_SPEED');
          for (const cmd of clipCommands) {
            const res = applyAICommand(cmd, context);
            context = res.nextContext;
            setVideoClips([...context.videoClips]);
            await new Promise((r) => setTimeout(r, 60));
          }
        } else if (stepIdx === 3) {
          const textCommands = legacyPlan.commands.filter((c) => c.type === 'ADD_CAPTION' || c.type === 'ADD_TEXT' || c.type === 'EDIT_TEXT');
          for (const cmd of textCommands) {
            const res = applyAICommand(cmd, context);
            context = res.nextContext;
            setCaptions([...context.captionClips]);
            setOverlays([...context.overlayClips]);
            await new Promise((r) => setTimeout(r, 50));
          }
        } else if (stepIdx === 4) {
          const audioCommands = legacyPlan.commands.filter((c) => c.type === 'ADD_AUDIO' || c.type === 'ADD_SFX' || c.type === 'REMOVE_DEAD_SPACE');
          for (const cmd of audioCommands) {
            const res = applyAICommand(cmd, context);
            context = res.nextContext;
            setAudioClips([...context.audioClips]);
            await new Promise((r) => setTimeout(r, 50));
          }
        }
      }

      await new Promise((r) => setTimeout(r, 120));
    }

    // Final verification against real project state
    context.aspectRatio = legacyPlan.aspectRatio || aspectRatio;
    const verification = verifyAIExecution(context, {
      requestedAspectRatio: legacyPlan.aspectRatio,
      masterAudioDuration: legacyPlan.audioDuration || legacyPlan.narrationDuration,
      requestedCaptions: legacyPlan.captions,
      requestedSFX: legacyPlan.sfx,
      isCorrection: false,
    });

    setVideoClips(context.videoClips);
    setAudioClips(context.audioClips);
    setCaptions(context.captionClips);
    setOverlays(context.overlayClips);
    if (context.videoClips.length > 0) {
      setSelectedClipId(context.videoClips[0].id);
    }
    setCurrentTime(0);

    const updatedPlan: AIEditPlan = { ...legacyPlan, status: 'completed' };

    setAiMessages((prev) => [
      ...prev.map((m) => (m.editPlan?.id === legacyPlan.id ? { ...m, editPlan: updatedPlan } : m)),
      {
        id: `msg-verify-${Date.now()}`,
        role: 'assistant',
        content: `I have completed the edit on your timeline based on "${legacyPlan.title}". Every visual beat, caption, ranking overlay, and sound effect is now live and fully playable in the preview.`,
        verificationSummary: verification,
        timestamp: Date.now(),
      },
    ]);

    setIsAIExecuting(false);
  };

  // AI Visual/Audio Matching Handlers (General Auto Editor)
  const handleSwapVisualBeat = (beatLabelOrId: string, newAsset: ProjectAsset) => {
    if (!activeMatchingSession) return;
    setRegisteredAssets((prev) => {
      if (!prev.some((a) => a.id === newAsset.id)) {
        return [newAsset, ...prev];
      }
      return prev;
    });
    const updatedMatches = swapVisualForBeat(activeMatchingSession.matches, beatLabelOrId, newAsset);
    const updatedSession: VisualMatchingSession = {
      ...activeMatchingSession,
      matches: updatedMatches,
      strongMatchesCount: updatedMatches.filter((m) => m.status === 'STRONG_MATCH').length,
      needsReviewCount: updatedMatches.filter((m) => m.status === 'NEEDS_REVIEW').length,
      noVisualCount: updatedMatches.filter((m) => m.status === 'NO_SUITABLE_VISUAL').length,
    };
    setActiveMatchingSession(updatedSession);
  };

  const handleApproveAndPlaceMatches = async (approvedMatches: VisualBeatMatch[]) => {
    if (!activeMatchingSession) return;
    setIsPlacingMatches(true);
    setPlacingProgressText('Preparing existing timeline...');
    await new Promise((r) => setTimeout(r, 200));

    setPlacingProgressText('Placing approved visuals at exact audio timestamps...');
    await new Promise((r) => setTimeout(r, 250));

    // Master timeline duration strictly locked to voiceover audio duration
    const masterVoDuration = activeMatchingSession.audioDuration || activeMatchingSession.masterAudio?.duration || 0;

    // Build real timeline clips from approved matches
    const { videoClips: newVideoClips, audioClips: newAudioClips, captions: newCaptions } =
      buildTimelineClipsFromApprovedMatches(approvedMatches, activeMatchingSession.masterAudio);

    // Preserve non-voiceover audio (music, sfx) and ensure master voiceover audio track is active with audio.duration
    let finalAudioClips = [...newAudioClips];
    if (finalAudioClips.length === 0 && (masterVoDuration > 0 || activeMatchingSession.masterAudio)) {
      const existingVo = audioClips.find((a) => a.category === 'voiceover' || a.id.includes('vo'));
      if (existingVo) {
        finalAudioClips.push({ ...existingVo, duration: Math.max(existingVo.duration, masterVoDuration) });
      } else if (activeMatchingSession.masterAudio) {
        finalAudioClips.push({
          id: `audio-master-vo-${Date.now()}`,
          title: activeMatchingSession.masterAudio.name || 'Master Voiceover',
          category: 'voiceover',
          url: activeMatchingSession.masterAudio.url || '',
          file: activeMatchingSession.masterAudio.file,
          duration: masterVoDuration,
          startTime: 0,
          volume: 100,
          waveformData: activeMatchingSession.masterAudio.waveformData || [],
        });
      }
    }
    const preservedAudio = audioClips.filter(
      (a) => a.category !== 'voiceover' && !a.id.includes('vo') && !finalAudioClips.some((fa) => fa.id === a.id)
    );
    finalAudioClips = [...finalAudioClips, ...preservedAudio];

    // Apply to state and persist on EXISTING timeline
    setVideoClips(newVideoClips);
    setAudioClips(finalAudioClips);
    setCaptions(newCaptions);
    setSelectedClipId(newVideoClips[0]?.id || null);
    setCurrentTime(0);

    // Push to history
    pushHistory({
      videoClips: newVideoClips,
      audioClips: finalAudioClips,
      captions: newCaptions,
      overlays,
      aspectRatio,
    });

    setPlacingProgressText('Verifying actual timeline state...');
    await new Promise((r) => setTimeout(r, 200));

    // Verify actual timeline state
    const verification = verifyMatchedTimelineState(
      newVideoClips,
      finalAudioClips,
      approvedMatches,
      activeMatchingSession.audioDuration
    );

    setIsPlacingMatches(false);
    setIsMatchingReviewOpen(false);

    // Report real result to AI Chat
    if (verification.passed) {
      const formatTime = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const rem = (secs % 60).toFixed(2).padStart(5, '0');
        return `${mins}:${rem}`;
      };

      const reportMsg: AIChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: `### Visual/Audio Matching Placed on Timeline\n\n- **Visual clips placed**: ${verification.totalPlaced}\n- **Audio master track**: ${activeMatchingSession.audioAssetName} (${verification.masterAudioPresent ? 'Active' : 'Estimated pacing'})\n- **Timeline span**: 0:00 – ${formatTime(verification.durationCovered)} (${verification.durationCovered.toFixed(2)}s)\n- **Unintended gaps / black frames**: None (continuous coverage)\n- **Timeline State Verification**: Passed ✓\n\nAll approved visuals have been placed directly onto your existing timeline synchronized with your master voiceover.`,
        timestamp: Date.now(),
      };
      setAiMessages((prev) => [...prev, reportMsg]);
    } else {
      const failMsg: AIChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: `### Timeline Placement Incomplete\n\nVerification detected an issue during placement: ${verification.error || 'Clips could not be placed reliably'}.`,
        timestamp: Date.now(),
      };
      setAiMessages((prev) => [...prev, failMsg]);
    }
  };

  // Conversational message handler (Gemini + Local reasoning fallback)
  const handleSendMessage = async (
    text: string,
    attachedAssets?: ProjectAsset[],
    script?: string,
    srt?: string
  ) => {
    // If there are newly attached assets, ensure they are registered in the global project asset library
    let effectiveAssets = [...registeredAssets];
    if (attachedAssets && attachedAssets.length > 0) {
      const existingIds = new Set(registeredAssets.map((a) => a.id));
      const newUnique = attachedAssets.filter((a) => !existingIds.has(a.id));
      if (newUnique.length > 0) {
        effectiveAssets = [...newUnique, ...registeredAssets];
        setRegisteredAssets(effectiveAssets);
      }
    }

    let effectiveSrt = srt || activeSrtText || undefined;
    let effectiveScript = script || activeScriptText || undefined;

    // Check if script contains mixed script + srt or is pure srt
    if (effectiveScript && isSrtFormat(effectiveScript)) {
      const separated = separateScriptAndSrt(effectiveScript);
      if (separated.srtText && !effectiveSrt) {
        effectiveSrt = separated.srtText;
      }
      effectiveScript = separated.scriptText || undefined;
    }

    // Check if prompt text contains srt or mixed script + srt
    if (text && isSrtFormat(text)) {
      const separated = separateScriptAndSrt(text);
      if (separated.srtText && !effectiveSrt) {
        effectiveSrt = separated.srtText;
      }
      if (separated.scriptText && !effectiveScript) {
        effectiveScript = separated.scriptText;
      }
    }

    if (!effectiveScript) {
      // Check if current text contains a numbered script
      const hasNumberedScript = /\b\d+[\.\)]\s+[A-Za-z]/.test(text);
      if (hasNumberedScript) {
        effectiveScript = text;
      } else {
        // Check prior messages in conversation history for attached script or multi-line narration
        for (let i = aiMessages.length - 1; i >= 0; i--) {
          if (aiMessages[i].attachedScript) {
            effectiveScript = aiMessages[i].attachedScript;
            break;
          } else if (aiMessages[i].role === 'user' && (aiMessages[i].content.length > 50 || aiMessages[i].content.includes('\n'))) {
            effectiveScript = aiMessages[i].content;
            break;
          }
        }
      }
    }

    if (effectiveScript && effectiveScript !== activeScriptText) {
      setActiveScriptText(effectiveScript);
    }
    if (effectiveSrt && effectiveSrt !== activeSrtText) {
      setActiveSrtText(effectiveSrt);
    }

    const userMsg: AIChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: text,
      attachedAssets,
      attachedScript: effectiveScript,
      timestamp: Date.now(),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setIsAIExecuting(true);
    setAiActivityStepText('Analyzing your request & timeline...');

    try {
      // 1. Build EditorContextSnapshot of current state
      const snapshot: EditorContextSnapshot = {
        videoClips,
        audioClips,
        captions,
        overlays,
        registeredAssets: effectiveAssets,
        selectedClipId,
        aspectRatio,
        currentTime,
        attachedScript: effectiveScript,
      };

      // 2. Deterministic Chat Intent Detection (Strictly checks Type 1 vs Ambiguous vs Type 2)
      const detectedIntent = detectChatIntent(text, snapshot, aiMessages);

      // =========================================================================
      // BRANCH 1: CHAT / DISCUSSION
      // If the user is asking a question, discussing an idea, asking for advice,
      // explaining something, or talking about their video without explicitly
      // requesting an editor change:
      // → Respond normally in chat.
      // → DO NOT modify the editor.
      // → DO NOT call an editing action.
      // =========================================================================
      if (detectedIntent.type === 'CHAT' || (detectedIntent.type as string) === 'NORMAL_CHAT') {
        let conversationalReply = detectedIntent.conversationalReply;

        // Try querying backend Gemini API endpoint for a conversational response
        try {
          const response = await fetch('/api/ai-editor/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
              chatHistory: aiMessages,
              script: effectiveScript,
              assets: effectiveAssets,
              style: currentEditingStyle,
              currentTimeline: {
                videoClipsCount: videoClips.length,
                audioClipsCount: audioClips.length,
                captionsCount: captions.length,
                duration: totalDuration,
                currentTime,
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (
              data.mode === 'gemini' &&
              data.reply &&
              (!data.operations || data.operations.length === 0) &&
              !data.actionType &&
              (!data.commands || data.commands.length === 0)
            ) {
              conversationalReply = data.reply;
            }
          }
        } catch {
          // Fall back to local conversational responder
        }

        if (!conversationalReply) {
          conversationalReply = generateConversationalReply(text, snapshot, aiMessages);
        }

        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${Date.now()}`,
            role: 'assistant',
            content: conversationalReply,
            timestamp: Date.now(),
          },
        ]);
        setIsAIExecuting(false);
        return;
      }

      // =========================================================================
      // BRANCH 2: NEEDS_CLARIFICATION
      // If the user's message is missing necessary information:
      // → DO NOT guess. Ask a short clarification.
      // → NEVER modify the editor without necessary clarification.
      // =========================================================================
      if (detectedIntent.type === 'NEEDS_CLARIFICATION' || (detectedIntent.type as string) === 'AMBIGUOUS') {
        const clarification =
          detectedIntent.clarificationQuestion ||
          'Which clip would you like me to edit?';

        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${Date.now()}`,
            role: 'assistant',
            content: clarification,
            timestamp: Date.now(),
          },
        ]);
        setIsAIExecuting(false);
        return;
      }

      // =========================================================================
      // BRANCH 3: TYPE 2 — EXPLICIT EDITING COMMAND
      // User clearly instructed the AI to change something in the editor.
      // =========================================================================

      // 1. AI Visual/Audio Matching Commands (General Auto Editor)
      if (detectedIntent.actionType === 'MATCH_VISUALS_TO_AUDIO') {
        setIsAIExecuting(true);
        setAiActivityStepIndex(1);
        setAiActivityStepText('Analyzing voiceover and script beats...');

        let masterAudio: ProjectAsset | undefined =
          effectiveAssets.find((a) => a.type === 'audio') ||
          (audioClips.length > 0 && audioClips[0].url
            ? {
                id: audioClips[0].id,
                name: audioClips[0].title || (audioClips[0] as any).name || 'Master Audio',
                type: 'audio' as const,
                url: audioClips[0].url,
                file: audioClips[0].file,
                duration: audioClips[0].duration,
                thumbnailUrl: '',
                uploadedAt: Date.now(),
                waveformData: audioClips[0].waveformData,
                analysis: {
                  speechIntervals: audioClips[0].speechIntervals,
                  speechSegments: audioClips[0].speechSegments,
                  transcript: audioClips[0].transcript,
                },
              }
            : undefined);

        const visualAssets = effectiveAssets.filter((a) => a.type === 'image' || a.type === 'video');

        // 1. Check for required inputs: attached script or .srt, relevant audio, and project visuals
        // Detect SRT subtitles in:
        //   a) Attached script (user uploaded .srt via chat or pasted .srt)
        //   b) Text assets in Asset Bin (.srt / .vtt file)
        //   c) Input prompt text
        const srtAsset = effectiveAssets.find(
          (a) =>
            a.type === 'text' &&
            (a.name.toLowerCase().endsWith('.srt') ||
              a.name.toLowerCase().endsWith('.vtt') ||
              (a.textContent && isSrtFormat(a.textContent)))
        );

        let scriptContent = effectiveScript;
        let currentSrt = effectiveSrt || activeSrtText;

        // Check if scriptContent contains mixed script and SRT
        if (scriptContent && isSrtFormat(scriptContent)) {
          const separated = separateScriptAndSrt(scriptContent);
          if (separated.srtText && !currentSrt) {
            currentSrt = separated.srtText;
          }
          scriptContent = separated.scriptText || undefined;
        }

        if (!scriptContent) {
          const hasNumberedScript = /\b\d+[\.\)]\s+[A-Za-z]/.test(text);
          if (hasNumberedScript) {
            const separated = separateScriptAndSrt(text);
            scriptContent = separated.scriptText || text;
            if (separated.srtText && !currentSrt) {
              currentSrt = separated.srtText;
            }
          }
        }

        const srtText =
          currentSrt ||
          srtAsset?.textContent ||
          (text && isSrtFormat(text) ? separateScriptAndSrt(text).srtText || text : '');

        const hasSrt = Boolean(srtText && isSrtFormat(srtText));

        // Parse script beats
        let parsedBeats =
          scriptContent && !isSrtFormat(scriptContent)
            ? parseAuthoritativeScriptBeats(scriptContent)
            : [];

        // If no separate numbered script was provided, but an SRT file is present:
        // Parse the SRT cues directly into authoritative beats!
        if (parsedBeats.length === 0 && hasSrt) {
          const cues = parseSrtText(srtText);
          parsedBeats = convertSrtCuesToBeats(cues, false, masterAudio?.duration);
        }

        // If no audio track was attached, but an SRT is present, the SRT provides the master clock
        if (!masterAudio && hasSrt) {
          const cues = parseSrtText(srtText);
          const maxEnd = cues.length > 0 ? Math.max(...cues.map((c) => c.endTime)) : 0;
          masterAudio = {
            id: `asset-srt-clock-${Date.now()}`,
            name: srtAsset?.name || 'SRT Subtitles Master Clock',
            type: 'audio',
            url: srtAsset?.url || '',
            thumbnailUrl: '',
            duration: maxEnd,
            uploadedAt: Date.now(),
          };
        }

        const hasValidScript = parsedBeats.length > 0;
        const hasAudio = Boolean(masterAudio);
        const hasVisuals = visualAssets.length > 0;

        if (!hasValidScript || !hasAudio || !hasVisuals) {
          const missingItems: string[] = [];
          if (!hasValidScript) {
            missingItems.push('• **Narration Script or .SRT**: An attached or pasted script with numbered beats, or an uploaded .srt subtitle file (click the 📄 or Subtitles icon in the chat bar).');
          }
          if (!hasAudio && !hasSrt) {
            missingItems.push('• **Voiceover Audio or .SRT**: A voiceover audio track in the Asset Bin, or an uploaded .srt file to act as the master timeline clock.');
          }
          if (!hasVisuals) {
            missingItems.push('• **Project Visuals**: Image or video assets in the Asset Bin (click **Import Files** in the Asset Bin modal).');
          }

          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content:
                `### Required Inputs for Visual/Audio Matching\n\n` +
                `To process your project assets and match visuals to your narration, I need the following missing input${missingItems.length > 1 ? 's' : ''}:\n\n` +
                missingItems.join('\n') +
                `\n\nOnce provided, I will align the script beats to your voiceover master clock, match the visual assets, and open the review modal without altering your timeline.`,
              timestamp: Date.now(),
            },
          ]);
          setIsAIExecuting(false);
          return;
        }

        // 2. Transcribe and timestamp audio using SRT subtitle parser or voiceover
        if (hasSrt) {
          setAiActivityStepText(`Parsing SRT subtitle timestamps for ${parsedBeats.length} beats...`);
        } else {
          setAiActivityStepText(`Aligning ${parsedBeats.length} script beats with master audio...`);
        }
        await new Promise((r) => setTimeout(r, 40));

        let timingResult: Awaited<ReturnType<typeof transcribeAndTimestampAudio>>;
        try {
          timingResult = await transcribeAndTimestampAudio(parsedBeats, masterAudio!, srtText);
        } catch (alignErr: any) {
          setIsAIExecuting(false);
          const rawErrMsg = alignErr?.message || String(alignErr);
          let userGuidance = 'Please check your Gemini API key configuration and audio file, or upload an .SRT subtitle file for instant zero-quota alignment.';
          if (rawErrMsg.includes('429') || rawErrMsg.includes('RESOURCE_EXHAUSTED')) {
            userGuidance =
              'Your Gemini API key has exceeded its Free Tier quota. You can upload an **.SRT subtitle file** in the chat bar to align all 270 beats instantly with 0 API calls!';
          } else if (rawErrMsg.includes('503')) {
            userGuidance = 'The Gemini API is currently experiencing temporary high traffic spikes. You can upload an **.SRT file** to bypass Gemini entirely.';
          } else if (rawErrMsg.includes('timeout') || rawErrMsg.includes('abort')) {
            userGuidance = 'The audio alignment request timed out after 15 seconds. Ensure your network connection is stable or upload an .SRT file.';
          }

          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content:
                `### ⚠️ Gemini Speech-to-Text Alignment Failed\n\n` +
                `Gemini could not align your script beats to the audio narration:\n\n` +
                `> **Error**: \`${rawErrMsg}\`\n\n` +
                `**Tip**: Upload an **.SRT subtitle file** via the Subtitles icon in the chat bar to parse timestamps directly with **zero API quota and 100% exact cuts**.\n\n` +
                `*Note: The app stopped and did not fall back to broken silence detection.*`,
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        // 3. Analyze visual assets
        setAiActivityStepText(`Analyzing ${visualAssets.length} visual assets...`);
        await new Promise((r) => setTimeout(r, 40));
        const visualProfiles = analyzeVisualAssets(visualAssets);

        // 4. Match visuals to script beats
        setAiActivityStepText(`Matching visuals to ${timingResult.beatsWithTiming.length} beats...`);
        await new Promise((r) => setTimeout(r, 40));
        const matches = matchBeatsToVisuals(timingResult.beatsWithTiming, visualProfiles, srtText, timingResult.audioDuration);

        const audioName = timingResult.audioName;
        const audioDuration = timingResult.audioDuration;

        const session: VisualMatchingSession = {
          id: `session-${Date.now()}`,
          createdAt: Date.now(),
          audioAssetName: audioName,
          audioDuration,
          totalBeats: timingResult.beatsWithTiming.length,
          visualAssetsCount: visualProfiles.length,
          strongMatchesCount: matches.filter((m) => m.status === 'STRONG_MATCH').length,
          needsReviewCount: matches.filter((m) => m.status === 'NEEDS_REVIEW').length,
          noVisualCount: matches.filter((m) => m.status === 'NO_SUITABLE_VISUAL').length,
          matches,
          masterAudio,
        };

        setActiveMatchingSession(session);
        setIsMatchingReviewOpen(true);
        setIsAIExecuting(false);

        const formatTime = (secs: number) => {
          const mins = Math.floor(secs / 60);
          const rem = (secs % 60).toFixed(2).padStart(5, '0');
          return `${mins}:${rem}`;
        };

        // Format sample breakdown in chat
        const previewBeats = matches
          .slice(0, 4)
          .map(
            (m) =>
              `• **Beat ${m.beatLabel}** (\`${formatTime(m.startTime)}–${formatTime(m.endTime)}\`): *"${m.scriptText}"*\n  → **${m.matchedAsset?.assetName || 'Unassigned'}** (${m.status === 'STRONG_MATCH' ? '🟢 Strong match' : '🟡 Needs review'})`
          )
          .join('\n');

        const timingSourceDescription =
          timingResult.alignmentMethod === 'srt_subtitle_parser'
            ? `⚡ **SRT Subtitle Parser** (${timingResult.srtCuesCount || session.totalBeats} subtitle cues parsed directly into continuous cuts, Gemini API bypassed)`
            : timingResult.alignmentMethod === 'gemini_speech_to_text'
            ? '🤖 **Gemini Speech-to-Text**'
            : '⏱️ **Proportional Speech Pacing**';

        const chatResponse =
          `### AI Visual Matching\n\n` +
          `- **Audio / Master Clock**: ${audioName}\n` +
          `- **Timing Source**: ${timingSourceDescription}\n` +
          `- **Duration**: ${formatTime(audioDuration)}\n` +
          `- **Script beats / cuts**: ${session.totalBeats}\n` +
          `- **Visual assets analyzed**: ${session.visualAssetsCount}\n` +
          `- 🟢 **${session.strongMatchesCount} matches ready**\n` +
          `${session.needsReviewCount > 0 ? `- 🟡 **${session.needsReviewCount} matches need review**\n` : ''}` +
          `\n#### Proposed Matches Preview:\n${previewBeats}` +
          (matches.length > 4 ? `\n*...and ${matches.length - 4} more beats.*` : '') +
          `\n\n*The review modal is now open. The timeline has not been modified. You can review, swap any visual, or click **[ APPROVE & ADD TO TIMELINE ]** to commit.*`;

        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${Date.now()}`,
            role: 'assistant',
            content: chatResponse,
            timestamp: Date.now(),
          },
        ]);

        return;
      }

      if (detectedIntent.actionType === 'SHOW_VISUAL_MATCHES') {
        if (activeMatchingSession) {
          setIsMatchingReviewOpen(true);
          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content: `Opened the **AI Visual Matching** review modal (${activeMatchingSession.strongMatchesCount} ready, ${activeMatchingSession.needsReviewCount} need review).`,
              timestamp: Date.now(),
            },
          ]);
        } else {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content: `No visual matching session is currently active. Say *"Match my images to my voiceover"* to begin matching.`,
              timestamp: Date.now(),
            },
          ]);
        }
        setIsAIExecuting(false);
        return;
      }

      if (detectedIntent.actionType === 'SWAP_VISUAL_BEAT') {
        const beatLabel = detectedIntent.parameters?.beatLabel;
        const requestedAsset = detectedIntent.parameters?.assetName;

        if (!activeMatchingSession) {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content: `No active visual matching session found. Say *"Match my images to my voiceover"* to analyze beats first.`,
              timestamp: Date.now(),
            },
          ]);
          setIsAIExecuting(false);
          return;
        }

        if (!beatLabel) {
          setIsMatchingReviewOpen(true);
          setIsAIExecuting(false);
          return;
        }

        let replacementAsset: ProjectAsset | undefined;
        if (requestedAsset) {
          const cleanQ = requestedAsset.toLowerCase().trim();
          replacementAsset = effectiveAssets.find(
            (a) => a.name.toLowerCase().includes(cleanQ) || cleanQ.includes(a.name.toLowerCase())
          );
        }

        if (replacementAsset) {
          handleSwapVisualBeat(beatLabel, replacementAsset);
          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content: `✅ Swapped visual for beat **${beatLabel}** to **"${replacementAsset.name}"**. All other matches and timing were preserved. Say *"Approve"* or open review to apply to timeline.`,
              timestamp: Date.now(),
            },
          ]);
        } else {
          setIsMatchingReviewOpen(true);
          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content: `Opened the review modal so you can choose a visual to swap for beat **${beatLabel}**.`,
              timestamp: Date.now(),
            },
          ]);
        }
        setIsAIExecuting(false);
        return;
      }

      if (detectedIntent.actionType === 'APPROVE_VISUAL_MATCHES') {
        if (!activeMatchingSession) {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content: `There are no proposed visual matches pending approval. Say *"Match my images to my voiceover"* to generate matches.`,
              timestamp: Date.now(),
            },
          ]);
          setIsAIExecuting(false);
          return;
        }

        await handleApproveAndPlaceMatches(activeMatchingSession.matches);
        setIsAIExecuting(false);
        return;
      }

      const isCutIntent = detectedIntent.actionType === 'BUILD_RECAP';

        if (isCutIntent) {
          const movieAsset = effectiveAssets.find((a) => a.type === 'video') ||
            (effectiveAssets.length > 0 && effectiveAssets[0].type === 'image' ? effectiveAssets[0] : undefined) ||
            (videoClips.length > 0 && videoClips[0].url ? {
              id: videoClips[0].assetId || 'source-visual-asset',
              name: videoClips[0].title || currentProjectTitle || 'Project Media Source',
              type: (videoClips[0].type || 'video') as 'video' | 'audio' | 'image',
              url: videoClips[0].url,
              file: videoClips[0].file,
              thumbnailUrl: videoClips[0].thumbnailUrl,
              duration: videoClips[0].rawDuration || videoClips[0].duration || 3600,
            } : undefined) || {
              id: 'source-visual-asset',
              name: currentProjectTitle || 'Project Media Source',
              type: 'video' as const,
              url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
              thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
              duration: 3600,
            };

          const voAsset = effectiveAssets.find((a) => a.type === 'audio');
          const musicAsset = effectiveAssets.filter((a) => a.type === 'audio')[1];

          // Check if an earlier message in the chat history already had a generated plan
          const priorPlanMsg = [...aiMessages].reverse().find((m) => m.recapPlan);
          let recapPlan = priorPlanMsg?.recapPlan;

          if (!recapPlan) {
            let effectiveCutGuide = text;
            if (!isCutGuideOrEDLText(text)) {
              for (let i = aiMessages.length - 1; i >= 0; i--) {
                if (isCutGuideOrEDLText(aiMessages[i].content)) {
                  effectiveCutGuide = aiMessages[i].content;
                  break;
                }
              }
            }

            recapPlan = buildRecapActionPlan(
              movieAsset,
              voAsset,
              effectiveCutGuide,
              effectiveScript,
              musicAsset,
              '16:9',
              effectiveAssets
            );
          }

          // Execute cut plan directly onto the timeline
          const allRegistered = [...effectiveAssets];
          if (movieAsset && !allRegistered.some((a) => a.id === movieAsset.id)) {
            allRegistered.unshift(movieAsset);
          }

          const currentTimelineState: TimelineState = {
            videoClips: [], // Reset previous clips when building full cut sequence
            audioClips: [],
            captions: [],
            overlays: [],
            aspectRatio: '16:9',
            currentTime: 0,
            selectedClipId: null,
            registeredAssets: allRegistered,
          };

          const executionResult = applyOperations(recapPlan.operations, currentTimelineState);
          
          // Verify that real video clips were created on the main track
          const newVideoClips = executionResult.nextState.videoClips;
          if (newVideoClips.length === 0) {
            setAiMessages((prev) => [
              ...prev,
              {
                id: `msg-ai-${Date.now()}`,
                role: 'assistant',
                content: `### Recap build failed.\n\nThe movie was split, but the selected scenes were not assembled into a separate recap sequence.`,
                timestamp: Date.now(),
              },
            ]);
            setIsAIExecuting(false);
            return;
          }

          // Apply to state and persist
          setVideoClips(newVideoClips);
          setAudioClips(executionResult.nextState.audioClips);
          setCaptions(executionResult.nextState.captions);
          setOverlays(executionResult.nextState.overlays);
          setAspectRatio('16:9');
          setSelectedClipId(newVideoClips[0].id);
          setCurrentTime(0);
          pushHistory({
            videoClips: newVideoClips,
            audioClips: executionResult.nextState.audioClips,
            captions: executionResult.nextState.captions,
            overlays: executionResult.nextState.overlays,
            aspectRatio: '16:9',
          });

          if (recapPlan.title) {
            setCurrentProjectTitle(recapPlan.title);
          }

          const totalRecapDuration = newVideoClips.reduce((acc, c) => acc + c.duration, 0);
          const hasVoiceover = executionResult.nextState.audioClips.some((a) => a.id.includes('vo') || a.category === 'voiceover');

          const isImageStory = newVideoClips.every((c) => c.type === 'image' || c.url?.match(/\.(jpeg|jpg|png|webp|gif)/i)) || effectiveAssets.some((a) => a.name?.endsWith('.zip') || a.type === 'image');
          const finalTitle = (recapPlan.title && !recapPlan.title.includes('WRONG TURN')) ? recapPlan.title : currentProjectTitle;
          const headerTitle = isImageStory ? '### ImageSync Audio-Mastered Sequence' : '### Sequence Assembly Results';
          const sceneLabel = isImageStory ? 'Matched visual beats' : 'Guide scenes';
          const exclusionNote = isImageStory ? `- **Audio master clock**: Synchronized with speech timestamps\n- **Visual matching**: Filenames preserved & matched to narration` : `- **Unselected movie sections excluded**: Yes`;

          const sceneBreakdown = recapPlan.scenes
            .map((s, i) => {
              const dur = Math.max(0.1, (s.timelineEnd ?? 0) - (s.timelineStart ?? 0)).toFixed(2);
              const assetName = s.sourceAssetName || s.sceneDescription || `Asset ${i + 1}`;
              const narration = s.narrationText ? ` — *"${s.narrationText}"*` : '';
              if (isImageStory) {
                return `• **Beat ${i + 1} (${assetName})**: \`${(s.timelineStart ?? 0).toFixed(2)}s - ${(s.timelineEnd ?? 0).toFixed(2)}s\` (${dur}s)${narration}`;
              }
              return `• **Scene ${i + 1} (${s.sceneDescription || `Scene ${i + 1}`})**: Source \`${(s.sourceIn ?? 0).toFixed(1)}s - ${(s.sourceOut ?? 0).toFixed(1)}s\` → Timeline \`${(s.timelineStart ?? 0).toFixed(1)}s - ${(s.timelineEnd ?? 0).toFixed(1)}s\` (${dur}s)${narration}`;
            })
            .join('\n');

          const recapReply = `${headerTitle}\n\n- **${sceneLabel}**: ${recapPlan.totalScenes}\n- **Video clips created**: ${newVideoClips.length}\n${exclusionNote}\n- **Voiceover**: ${hasVoiceover ? 'Added' : 'None'}\n- **Timeline duration**: ${totalRecapDuration.toFixed(1)}s\n- **Preview**: Ready\n- **Sequence**: ${finalTitle}\n\n#### Assembled Scene Sequence:\n${sceneBreakdown}`;

          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content: recapReply,
              recapPlan: recapPlan,
              timestamp: Date.now(),
            },
          ]);

          setIsAIExecuting(false);
          return;
        }

        // Sub-case B: Auto Edit Plan (Creative Plan Generation)
        if (detectedIntent.actionType === 'AUTO_EDIT_PLAN') {
          const plan = generateAIEditPlan({
            prompt: text,
            script: effectiveScript,
            assets: effectiveAssets,
            style: currentEditingStyle,
            currentClips: videoClips,
            currentAudio: audioClips,
            currentAspectRatio: aspectRatio,
            subtitleCaptions: captions,
            playheadTime: currentTime,
          });

          const reply = `I have analyzed your request and prepared a creative auto-edit plan tailored for your project.\n\nPlease review the **Project Specification** and **Timeline Breakdown** below. Click **"▶ Execute Edit"** to apply this to your timeline.`;

          setAiMessages((prev) => [
            ...prev,
            {
              id: `msg-ai-${Date.now()}`,
              role: 'assistant',
              content: reply,
              editPlan: plan,
              timestamp: Date.now(),
            },
          ]);
          setIsAIExecuting(false);
          return;
        }

        // Sub-case C: Direct Command Execution with Verification
        const updaters = {
          setVideoClips,
          setAudioClips,
          setCaptions,
          setOverlays,
          setRegisteredAssets: (assets: ProjectAsset[]) => {
            setRegisteredAssets(assets);
            if (assets.length === 0) {
              effectiveAssets.forEach((a) => {
                deleteAsset(a.id).catch(() => {});
              });
            }
          },
          setSelectedClipId,
          setAspectRatio,
          setCurrentTime,
          pushHistory: (entry: any) => {
            pushHistory(entry);
          },
          handleUndo,
          handleRedo,
        };

        const executionOptions = {
          requestText: text,
          executionId: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          isUserCorrection: !!detectedIntent.parameters?.isCorrection || /^(?:i\s+(?:already\s+|just\s+)?said|i\s+told\s+you|i\s+meant)/i.test(text),
          isSeparateCommand: true,
        };

        const result = (detectedIntent.actions && detectedIntent.actions.length > 1)
          ? executeMultiEditorActions(
              detectedIntent.actions,
              snapshot,
              updaters,
              attachedAssets,
              executionOptions
            )
          : executeAndVerifyEditorAction(
              detectedIntent.actionType!,
              detectedIntent.parameters,
              snapshot,
              updaters,
              attachedAssets,
              detectedIntent.condition,
              executionOptions
            );

        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${Date.now()}`,
            role: 'assistant',
            content: result.verifiedMessage,
            timestamp: Date.now(),
          },
        ]);
        setIsAIExecuting(false);
        return;
      } catch (err: any) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            role: 'assistant',
            content: `I couldn't apply that edit because the editor action failed.`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
      setIsAIExecuting(false);
    }
  };


  // Master timeline duration strictly locked to audio.duration (e.g. 534s).
  // Do NOT calculate timeline duration from visual clips.
  const totalVideoDuration = videoClips.reduce((sum, clip) => sum + clip.duration, 0);

  // Maximum duration across voiceover audio clips, all audio tracks, and registered audio assets
  const maxAudioDuration = Math.max(
    ...audioClips.map((a) => (a.startTime || 0) + (a.duration || 0)),
    ...registeredAssets.filter((a) => a.type === 'audio').map((a) => a.duration || 0),
    activeMatchingSession?.audioDuration || 0,
    activeMatchingSession?.masterAudio?.duration || 0,
    0
  );

  // Ensure the timeline ruler always reflects the full audio.duration (534s) so the entire voiceover track is visible.
  const totalDuration = maxAudioDuration > 0
    ? maxAudioDuration
    : Math.max(
        totalVideoDuration,
        captions.reduce((max, c) => Math.max(max, (c.startTime || 0) + (c.duration || 0)), 0),
        overlays.reduce((max, o) => Math.max(max, (o.startTime || 0) + (o.duration || 0)), 0),
        1.0
      );

  // Master Hardware-Synchronized Playback Engine
  const lastTimeRef = useRef<number>(performance.now());
  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioTrackRef = useRef<AudioTrackClip | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const audioClipsRef = useRef(audioClips);
  audioClipsRef.current = audioClips;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const getActiveAudioClip = useCallback((time: number): AudioTrackClip | null => {
    return (
      audioClipsRef.current.find(
        (a) => a.url && a.url.trim() !== '' && time >= a.startTime && time < a.startTime + a.duration
      ) || null
    );
  }, []);

  // Synchronize mute setting directly to master audio element
  useEffect(() => {
    if (masterAudioRef.current) {
      masterAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Automatically synthesize and attach audio URLs lazily ONLY when in the editor, sequentially to prevent memory spikes
  useEffect(() => {
    if (currentScreen !== 'editor') return;
    let isCancelled = false;
    const missingClips = audioClips.filter((c) => !c.url || c.url.trim() === '');
    if (missingClips.length === 0) return;

    const timer = setTimeout(async () => {
      const updatedClips = [...audioClips];
      let hasChanges = false;
      for (let i = 0; i < updatedClips.length; i++) {
        if (isCancelled) return;
        const clip = updatedClips[i];
        if (!clip.url || clip.url.trim() === '') {
          const generatedUrl = await ensureAudioClipHasUrl(clip);
          if (generatedUrl) {
            updatedClips[i] = { ...clip, url: generatedUrl };
            hasChanges = true;
          }
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      if (hasChanges && !isCancelled) {
        setAudioClips(updatedClips);
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [currentScreen, audioClips]);

  // Master Audio Play / Pause Lifecycle
  useEffect(() => {
    const audioEl = masterAudioRef.current;
    if (!audioEl) return;

    if (isPlaying) {
      const activeClip = getActiveAudioClip(currentTime);
      activeAudioTrackRef.current = activeClip;
      if (activeClip && activeClip.url) {
        if (audioEl.src !== activeClip.url) {
          audioEl.src = activeClip.url;
        }
        audioEl.currentTime = Math.max(0, currentTime - activeClip.startTime);
        audioEl.muted = isMutedRef.current;
        audioEl.volume = Math.max(0, Math.min(1, (activeClip.volume ?? 100) / 100));
        audioEl.play().catch(() => {});
      }
    } else {
      audioEl.pause();
    }
  }, [isPlaying, getActiveAudioClip]);

  // 60fps Hardware-Locked Tick Loop with Decoupled High-Frequency Playback Clock
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const audioEl = masterAudioRef.current;
      const activeAudio = activeAudioTrackRef.current;
      let frameTime: number;

      // 1. If an audio track is actively playing, the hardware audio clock is the absolute master truth
      if (activeAudio && audioEl && !audioEl.paused && !audioEl.ended && audioEl.readyState >= 2) {
        const exactAudioTime = activeAudio.startTime + audioEl.currentTime;

        // Clip duration boundary reached
        if (exactAudioTime >= activeAudio.startTime + activeAudio.duration) {
          audioEl.pause();
          const nextClip = getActiveAudioClip(exactAudioTime);
          activeAudioTrackRef.current = nextClip;
          if (nextClip && nextClip.url) {
            audioEl.src = nextClip.url;
            audioEl.currentTime = Math.max(0, exactAudioTime - nextClip.startTime);
            audioEl.muted = isMutedRef.current;
            audioEl.volume = Math.max(0, Math.min(1, (nextClip.volume ?? 100) / 100));
            audioEl.play().catch(() => {});
          }
        }

        if (exactAudioTime >= totalDuration) {
          setIsPlaying(false);
          currentTimeRef.current = totalDuration;
          setCurrentTime(totalDuration);
          playbackClock.setTime(totalDuration, false);
          return;
        }

        frameTime = exactAudioTime;
        lastTimeRef.current = now;
      } else {
        // 2. High-precision real-time clock when no audio track is active
        const deltaSeconds = Math.max(0, (now - lastTimeRef.current) / 1000);
        lastTimeRef.current = now;

        const next = (currentTimeRef.current || 0) + deltaSeconds;
        if (next >= totalDuration) {
          setIsPlaying(false);
          currentTimeRef.current = totalDuration;
          setCurrentTime(totalDuration);
          playbackClock.setTime(totalDuration, false);
          return;
        }

        // Check if playhead entered an audio track boundary
        if (!activeAudio && audioEl) {
          const newlyActiveClip = getActiveAudioClip(next);
          if (newlyActiveClip && newlyActiveClip.url) {
            activeAudioTrackRef.current = newlyActiveClip;
            if (audioEl.src !== newlyActiveClip.url) {
              audioEl.src = newlyActiveClip.url;
            }
            audioEl.currentTime = Math.max(0, next - newlyActiveClip.startTime);
            audioEl.muted = isMutedRef.current;
            audioEl.volume = Math.max(0, Math.min(1, (newlyActiveClip.volume ?? 100) / 100));
            audioEl.play().catch(() => {});
          }
        }

        frameTime = next;
      }

      currentTimeRef.current = frameTime;

      // Broadcast high-frequency 60fps clock to isolated playhead & preview canvas
      playbackClock.setTime(frameTime, true);

      // Decouple: Throttle root App React state re-renders to ~4fps (every 250ms) to avoid thrashing entire UI
      if (now - lastAppRenderTimeRef.current >= 250 || frameTime >= totalDuration) {
        lastAppRenderTimeRef.current = now;
        setCurrentTime(frameTime);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      // Immediately commit exact playhead time to root state when playback stops
      setCurrentTime(currentTimeRef.current);
      playbackClock.setTime(currentTimeRef.current, false);
    };
  }, [isPlaying, totalDuration, getActiveAudioClip]);

  // Audio seek coalescer to prevent audio decoder stalls during rapid timeline scrubbing
  const audioSeekCoalescerRef = useRef<AudioSeekCoalescer | null>(null);

  const commitAudioSeek = useCallback((target: CoalescedSeekTarget) => {
    const audioEl = masterAudioRef.current;
    if (!audioEl) return;

    if (target.activeClipUrl) {
      if (audioEl.src !== target.activeClipUrl) {
        audioEl.src = target.activeClipUrl;
      }
      const targetAudioTime = Math.max(0, target.time - target.clipStartTime);
      if (Math.abs(audioEl.currentTime - targetAudioTime) > 0.02) {
        audioEl.currentTime = targetAudioTime;
      }
      audioEl.muted = target.isMuted;
      audioEl.volume = Math.max(0, Math.min(1, target.volume / 100));
      if (isPlayingRef.current && audioEl.paused) {
        audioEl.play().catch(() => {});
      }
    } else {
      audioEl.pause();
    }
  }, []);

  if (!audioSeekCoalescerRef.current) {
    audioSeekCoalescerRef.current = new AudioSeekCoalescer(commitAudioSeek, 60);
  }

  useEffect(() => {
    return () => {
      audioSeekCoalescerRef.current?.cancel();
    };
  }, []);

  const handleSeek = useCallback((t: number) => {
    const clampedT = Math.max(0, Math.min(totalDuration, t));
    currentTimeRef.current = clampedT;
    // 1. Playhead position and visual preview frame update immediately without throttling
    setCurrentTime(clampedT);
    playbackClock.setTime(clampedT, isPlayingRef.current);

    // 2. Coalesce rapid audio seeks so hardware audio decoder is not thrashed
    const activeClip = getActiveAudioClip(clampedT);
    activeAudioTrackRef.current = activeClip;

    const coalescer = audioSeekCoalescerRef.current;
    if (coalescer) {
      coalescer.seek(
        {
          time: clampedT,
          activeClipUrl: activeClip?.url,
          clipStartTime: activeClip?.startTime || 0,
          volume: activeClip?.volume ?? 100,
          isMuted: isMutedRef.current,
        },
        isPlayingRef.current
      );
    }
  }, [totalDuration, getActiveAudioClip]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(currentTimeRef.current);
    playbackClock.setTime(currentTimeRef.current, false);
    audioSeekCoalescerRef.current?.flush();
    if (masterAudioRef.current) {
      masterAudioRef.current.pause();
    }
  }, []);

  const handleZoomChange = useCallback((newPps: number) => {
    setPixelsPerSecond(newPps);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Keyboard Shortcuts (Space for Play/Pause, Frame steps, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Undo / Redo Shortcuts
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyZ') ||
        ((e.metaKey || e.ctrlKey) && e.code === 'KeyY')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((prev) => Math.max(0, prev - 1 / 30));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((prev) => Math.min(totalDuration, prev + 1 / 30));
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedClipId) {
          handleDeleteClip(selectedClipId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalDuration, selectedClipId, historyIndex, history]);

  // Record History State (Full Timeline Snapshot)
  const pushHistory = useCallback((customSnapshot?: Partial<FullTimelineSnapshot> | VideoClip[]) => {
    let newSnapshot: FullTimelineSnapshot;
    if (Array.isArray(customSnapshot)) {
      newSnapshot = {
        videoClips: JSON.parse(JSON.stringify(customSnapshot)),
        audioClips: JSON.parse(JSON.stringify(audioClips)),
        captions: JSON.parse(JSON.stringify(captions)),
        overlays: JSON.parse(JSON.stringify(overlays)),
        aspectRatio,
      };
    } else {
      newSnapshot = {
        videoClips: JSON.parse(JSON.stringify(customSnapshot?.videoClips ?? videoClips)),
        audioClips: JSON.parse(JSON.stringify(customSnapshot?.audioClips ?? audioClips)),
        captions: JSON.parse(JSON.stringify(customSnapshot?.captions ?? captions)),
        overlays: JSON.parse(JSON.stringify(customSnapshot?.overlays ?? overlays)),
        aspectRatio: customSnapshot?.aspectRatio ?? aspectRatio,
      };
    }

    setHistory((prev) => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      nextHistory.push(newSnapshot);
      if (nextHistory.length > 35) {
        nextHistory.shift();
      }
      return nextHistory;
    });
    setHistoryIndex((prev) => {
      const nextIdx = prev + 1;
      return nextIdx >= 35 ? 34 : nextIdx;
    });
  }, [videoClips, audioClips, captions, overlays, aspectRatio, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const targetState = history[targetIndex];
      if (targetState) {
        setVideoClips(JSON.parse(JSON.stringify(targetState.videoClips)));
        setAudioClips(JSON.parse(JSON.stringify(targetState.audioClips)));
        setCaptions(JSON.parse(JSON.stringify(targetState.captions)));
        setOverlays(JSON.parse(JSON.stringify(targetState.overlays)));
        if (targetState.aspectRatio) {
          setAspectRatio(targetState.aspectRatio);
        }
        if (targetState.videoClips.length > 0) {
          setSelectedClipId(targetState.videoClips[0].id);
        }
      }
      setHistoryIndex(targetIndex);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      const targetState = history[targetIndex];
      if (targetState) {
        setVideoClips(JSON.parse(JSON.stringify(targetState.videoClips)));
        setAudioClips(JSON.parse(JSON.stringify(targetState.audioClips)));
        setCaptions(JSON.parse(JSON.stringify(targetState.captions)));
        setOverlays(JSON.parse(JSON.stringify(targetState.overlays)));
        if (targetState.aspectRatio) {
          setAspectRatio(targetState.aspectRatio);
        }
        if (targetState.videoClips.length > 0) {
          setSelectedClipId(targetState.videoClips[0].id);
        }
      }
      setHistoryIndex(targetIndex);
    }
  }, [historyIndex, history]);

  // Video Clip Trimming
  const handleTrimClip = useCallback((clipId: string, deltaStart: number, deltaEnd: number) => {
    setVideoClips((prevClips) => {
      return prevClips.map((clip) => {
        if (clip.id !== clipId) return clip;

        let newDuration = clip.duration;
        let newOffset = clip.startOffset;

        if (deltaStart !== 0) {
          // Trimming start edge
          const proposedDuration = clip.duration - deltaStart;
          if (proposedDuration >= 0.4) {
            newDuration = proposedDuration;
            newOffset = Math.max(0, clip.startOffset + deltaStart);
          }
        }

        if (deltaEnd !== 0) {
          // Trimming end edge
          const proposedDuration = clip.duration + deltaEnd;
          if (proposedDuration >= 0.4) {
            newDuration = proposedDuration;
          }
        }

        return {
          ...clip,
          duration: newDuration,
          startOffset: newOffset,
        };
      });
    });
  }, []);

  // Move Handlers for Timeline Tracks
  const handleMoveAudio = useCallback((id: string, newStartTime: number) => {
    setAudioClips((prev) =>
      prev.map((a) => (a.id === id ? { ...a, startTime: Math.max(0, newStartTime) } : a))
    );
  }, []);

  const handleMoveCaption = useCallback((id: string, newStartTime: number) => {
    setCaptions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, startTime: Math.max(0, newStartTime) } : c))
    );
  }, []);

  const handleMoveOverlay = useCallback((id: string, newStartTime: number) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, startTime: Math.max(0, newStartTime) } : o))
    );
  }, []);

  const handleReorderVideoClips = useCallback((fromIndex: number, toIndex: number) => {
    setVideoClips((prevClips) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prevClips.length ||
        toIndex >= prevClips.length
      ) {
        return prevClips;
      }
      const reordered = [...prevClips];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      pushHistory(reordered);
      return reordered;
    });
  }, [pushHistory]);

  // Split Clip right at Center Playhead (CapCut Exact Behavior)
  const handleSplitClipAtPlayhead = () => {
    // 1. If an Audio clip is selected
    if (selectedAudioId) {
      const audioIdx = audioClips.findIndex((a) => a.id === selectedAudioId);
      if (audioIdx !== -1) {
        const audio = audioClips[audioIdx];
        const splitPoint = currentTime - audio.startTime;
        if (splitPoint >= 0.1 && splitPoint <= audio.duration - 0.1) {
          const firstPartDuration = splitPoint;
          const secondPartDuration = audio.duration - splitPoint;

          const ratio = firstPartDuration / audio.duration;
          const waveSplitIdx = Math.max(1, Math.floor(audio.waveformData.length * ratio));

          const part1: AudioTrackClip = {
            ...audio,
            id: `audio-${Date.now()}-part1`,
            title: `${audio.title} (Part 1)`,
            duration: firstPartDuration,
            waveformData: audio.waveformData.slice(0, waveSplitIdx),
            beatMarkers: audio.beatMarkers?.filter(
              (b) => (typeof b === 'number' ? b : b.time) < firstPartDuration
            ),
          };

          const part2: AudioTrackClip = {
            ...audio,
            id: `audio-${Date.now()}-part2`,
            title: `${audio.title} (Part 2)`,
            startTime: currentTime,
            duration: secondPartDuration,
            waveformData: audio.waveformData.slice(waveSplitIdx),
            beatMarkers: audio.beatMarkers
              ?.filter((b) => (typeof b === 'number' ? b : b.time) >= firstPartDuration)
              .map((b) =>
                typeof b === 'number'
                  ? b - firstPartDuration
                  : { ...b, time: b.time - firstPartDuration }
              ),
          };

          const newAudioClips = [
            ...audioClips.slice(0, audioIdx),
            part1,
            part2,
            ...audioClips.slice(audioIdx + 1),
          ];
          setAudioClips(newAudioClips);
          setSelectedAudioId(part2.id);
          return;
        }
      }
    }

    // 2. If a Caption/Text clip is selected
    if (selectedCaptionId) {
      const capIdx = captions.findIndex((c) => c.id === selectedCaptionId);
      if (capIdx !== -1) {
        const cap = captions[capIdx];
        const splitPoint = currentTime - cap.startTime;
        if (splitPoint >= 0.1 && splitPoint <= cap.duration - 0.1) {
          const firstPartDuration = splitPoint;
          const secondPartDuration = cap.duration - splitPoint;

          const words = cap.text.split(' ');
          const midWord = Math.max(1, Math.floor(words.length * (firstPartDuration / cap.duration)));
          const text1 = words.slice(0, midWord).join(' ') || cap.text;
          const text2 = words.slice(midWord).join(' ') || cap.text;

          const part1: CaptionClip = {
            ...cap,
            id: `cap-${Date.now()}-part1`,
            duration: firstPartDuration,
            text: text1,
          };

          const part2: CaptionClip = {
            ...cap,
            id: `cap-${Date.now()}-part2`,
            startTime: currentTime,
            duration: secondPartDuration,
            text: text2,
          };

          const newCaptions = [
            ...captions.slice(0, capIdx),
            part1,
            part2,
            ...captions.slice(capIdx + 1),
          ];
          setCaptions(newCaptions);
          setSelectedCaptionId(part2.id);
          return;
        }
      }
    }

    // 3. If an Overlay clip is selected
    if (selectedOverlayId) {
      const ovIdx = overlays.findIndex((o) => o.id === selectedOverlayId);
      if (ovIdx !== -1) {
        const ov = overlays[ovIdx];
        const splitPoint = currentTime - ov.startTime;
        if (splitPoint >= 0.1 && splitPoint <= ov.duration - 0.1) {
          const firstPartDuration = splitPoint;
          const secondPartDuration = ov.duration - splitPoint;

          const part1: OverlayClip = {
            ...ov,
            id: `ov-${Date.now()}-part1`,
            title: `${ov.title} (Part 1)`,
            duration: firstPartDuration,
          };

          const part2: OverlayClip = {
            ...ov,
            id: `ov-${Date.now()}-part2`,
            title: `${ov.title} (Part 2)`,
            startTime: currentTime,
            duration: secondPartDuration,
          };

          const newOverlays = [
            ...overlays.slice(0, ovIdx),
            part1,
            part2,
            ...overlays.slice(ovIdx + 1),
          ];
          setOverlays(newOverlays);
          setSelectedOverlayId(part2.id);
          return;
        }
      }
    }

    // 4. If a Video clip is selected or main timeline split
    let accumulated = 0;
    let targetIndex = -1;
    let splitPointInClip = 0;

    for (let i = 0; i < videoClips.length; i++) {
      const clip = videoClips[i];
      if (currentTime >= accumulated && currentTime < accumulated + clip.duration) {
        targetIndex = i;
        splitPointInClip = currentTime - accumulated;
        break;
      }
      accumulated += clip.duration;
    }

    if (targetIndex !== -1 && splitPointInClip >= 0.1 && splitPointInClip <= videoClips[targetIndex].duration - 0.1) {
      const original = videoClips[targetIndex];
      const firstPartDuration = splitPointInClip;
      const secondPartDuration = original.duration - splitPointInClip;

      const firstClip: VideoClip = {
        ...original,
        id: `clip-${Date.now()}-part1`,
        title: `${original.title} (Part 1)`,
        duration: firstPartDuration,
      };

      const secondClip: VideoClip = {
        ...original,
        id: `clip-${Date.now()}-part2`,
        title: `${original.title} (Part 2)`,
        duration: secondPartDuration,
        startOffset: original.startOffset + firstPartDuration,
      };

      const newClips = [
        ...videoClips.slice(0, targetIndex),
        firstClip,
        secondClip,
        ...videoClips.slice(targetIndex + 1),
      ];

      setVideoClips(newClips);
      pushHistory(newClips);
      setSelectedClipId(secondClip.id);
      return;
    }

    // Fallback: Check if an Audio clip is under playhead if not selected
    const audioUnderPlayhead = audioClips.find(
      (a) => currentTime >= a.startTime + 0.1 && currentTime <= a.startTime + a.duration - 0.1
    );
    if (audioUnderPlayhead) {
      setSelectedAudioId(audioUnderPlayhead.id);
      return;
    }

    // Fallback: Check if an Overlay is under playhead
    const overlayUnderPlayhead = overlays.find(
      (o) => currentTime >= o.startTime + 0.1 && currentTime <= o.startTime + o.duration - 0.1
    );
    if (overlayUnderPlayhead) {
      setSelectedOverlayId(overlayUnderPlayhead.id);
      return;
    }
  };

  // Delete Selected Clip
  const handleDeleteClip = (clipId: string) => {
    if (videoClips.length <= 1) {
      alert('At least one clip must remain in the timeline.');
      return;
    }
    const newClips = videoClips.filter((c) => c.id !== clipId);
    setVideoClips(newClips);
    pushHistory(newClips);
    setSelectedClipId(newClips[0]?.id || null);
  };

  // Duplicate Selected Clip
  const handleDuplicateClip = () => {
    if (selectedAudioId) {
      const audio = audioClips.find((a) => a.id === selectedAudioId);
      if (audio) {
        const copy: AudioTrackClip = {
          ...audio,
          id: `audio-${Date.now()}-copy`,
          title: `${audio.title} (Copy)`,
          startTime: audio.startTime + audio.duration + 0.1,
        };
        setAudioClips((prev) => [...prev, copy]);
        setSelectedAudioId(copy.id);
      }
      return;
    }

    if (selectedCaptionId) {
      const cap = captions.find((c) => c.id === selectedCaptionId);
      if (cap) {
        const copy: CaptionClip = {
          ...cap,
          id: `cap-${Date.now()}-copy`,
          startTime: cap.startTime + cap.duration + 0.1,
        };
        setCaptions((prev) => [...prev, copy]);
        setSelectedCaptionId(copy.id);
      }
      return;
    }

    if (selectedOverlayId) {
      const ov = overlays.find((o) => o.id === selectedOverlayId);
      if (ov) {
        const copy: OverlayClip = {
          ...ov,
          id: `ov-${Date.now()}-copy`,
          title: `${ov.title} (Copy)`,
          startTime: ov.startTime + ov.duration + 0.1,
        };
        setOverlays((prev) => [...prev, copy]);
        setSelectedOverlayId(copy.id);
      }
      return;
    }

    if (selectedClipId) {
      const index = videoClips.findIndex((c) => c.id === selectedClipId);
      if (index === -1) return;

      const original = videoClips[index];
      const copy: VideoClip = {
        ...original,
        id: `clip-${Date.now()}-copy`,
        title: `${original.title} (Copy)`,
      };

      const newClips = [...videoClips.slice(0, index + 1), copy, ...videoClips.slice(index + 1)];
      setVideoClips(newClips);
      pushHistory(newClips);
      setSelectedClipId(copy.id);
    }
  };

  // Add New Video Clip to Timeline
  const handleAddVideoClip = useCallback(() => {
    const documentaryImages = [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524654458049-e36be0b21fa2?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    ];
    const randomImg = documentaryImages[Math.floor(Math.random() * documentaryImages.length)];

    setVideoClips((prevClips) => {
      const newClip: VideoClip = {
        id: `clip-${Date.now()}`,
        title: `0${prevClips.length + 1}. Ancient Artifact Discovery`,
        type: 'video',
        color: '#2A59FE',
        thumbnailUrl: randomImg,
        frames: [randomImg, randomImg],
        duration: 4.5,
        startOffset: 0,
        rawDuration: 10.0,
        volume: 100,
        speed: 1.0,
      };
      const newClips = [...prevClips, newClip];
      pushHistory(newClips);
      setSelectedClipId(newClip.id);
      return newClips;
    });
  }, [pushHistory]);

  // Caption Trimming & Management
  const handleTrimCaption = useCallback((id: string, deltaStart: number, deltaEnd: number) => {
    setCaptions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        let newStart = c.startTime;
        let newDuration = c.duration;
        if (deltaStart !== 0) {
          newStart = Math.max(0, c.startTime + deltaStart);
          newDuration = Math.max(0.5, c.duration - deltaStart);
        }
        if (deltaEnd !== 0) {
          newDuration = Math.max(0.5, c.duration + deltaEnd);
        }
        return { ...c, startTime: newStart, duration: newDuration };
      })
    );
  }, []);

  const handleAddTextClip = () => {
    const newCap: CaptionClip = {
      id: `cap-${Date.now()}`,
      text: 'New Subtitle Text',
      startTime: currentTime,
      duration: 3.0,
      stylePreset: 'hormozi',
    };
    setCaptions((prev) => [...prev, newCap]);
    setSelectedCaptionId(newCap.id);
    setSelectedClipId(null);
    setSelectedOverlayId(null);
    setSelectedAudioId(null);
    setActiveTool('text');
  };

  const handleDeleteCaption = (captionId: string) => {
    const nextCaps = captions.filter((c) => c.id !== captionId);
    setCaptions(nextCaps);
    pushHistory({ captions: nextCaps });
    if (selectedCaptionId === captionId) setSelectedCaptionId(null);
  };

  const handleUpdateCaptionText = (captionId: string, newText: string) => {
    setCaptions((prev) =>
      prev.map((c) => (c.id === captionId ? { ...c, text: newText } : c))
    );
  };

  const handleCycleCaptionStyle = (captionId: string) => {
    const styles: Array<CaptionClip['stylePreset']> = ['hormozi', 'bold-stroke', 'documentary', 'karaoke'];
    setCaptions((prev) =>
      prev.map((c) => {
        if (c.id !== captionId) return c;
        const curStyle = c.stylePreset || 'documentary';
        const nextIdx = (styles.indexOf(curStyle) + 1) % styles.length;
        return { ...c, stylePreset: styles[nextIdx] };
      })
    );
  };

  const handleSelectClip = useCallback((id: string | null) => {
    setSelectedClipId(id);
    if (id) {
      setSelectedCaptionId(null);
      setSelectedAudioId(null);
      setSelectedOverlayId(null);
      setActiveTool('edit');
    }
  }, []);

  const handleSelectCaption = useCallback((id: string | null) => {
    setSelectedCaptionId(id);
    if (id) {
      setSelectedClipId(null);
      setSelectedAudioId(null);
      setSelectedOverlayId(null);
      setActiveTool('text');
    }
  }, []);

  const handleSelectOverlay = useCallback((id: string | null) => {
    setSelectedOverlayId(id);
    if (id) {
      setSelectedClipId(null);
      setSelectedCaptionId(null);
      setSelectedAudioId(null);
      setOverlays((currentOverlays) => {
        const target = currentOverlays.find((o) => o.id === id);
        if (target?.type === 'chart') {
          setActiveTool('chart');
        } else {
          setActiveTool('overlay');
        }
        return currentOverlays;
      });
    }
  }, []);

  const handleSelectAudio = useCallback((id: string | null) => {
    setSelectedAudioId(id);
    if (id) {
      setSelectedClipId(null);
      setSelectedCaptionId(null);
      setSelectedOverlayId(null);
      setActiveTool('audio');
    }
  }, []);

  // Audio Trimming & Management
  const handleTrimAudio = useCallback((id: string, deltaStart: number, deltaEnd: number) => {
    setAudioClips((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        let newStart = a.startTime;
        let newDuration = a.duration;
        if (deltaStart !== 0) {
          newStart = Math.max(0, a.startTime + deltaStart);
          newDuration = Math.max(0.5, a.duration - deltaStart);
        }
        if (deltaEnd !== 0) {
          newDuration = Math.max(0.5, a.duration + deltaEnd);
        }
        return { ...a, startTime: newStart, duration: newDuration };
      })
    );
  }, []);

  const handleAddAudioClip = () => {
    const duration = 7.5;
    const waveform = generateRealisticAudioWaveform(duration, 'epic');
    const detected = detectAudioBeats(waveform, duration, 'dynamic-transient', 128);

    const newAudio: AudioTrackClip = {
      id: `audio-${Date.now()}`,
      title: 'Dramatic Tension Orchestral.wav',
      artist: 'Documentary Stems',
      duration,
      startTime: currentTime,
      volume: 80,
      waveformData: waveform,
      beatMarkers: detected.beats,
      beatConfig: {
        bpm: detected.bpm,
        offset: 0,
        autoDetectMode: 'dynamic-transient',
        snappingEnabled: true,
      },
    };
    setAudioClips((prev) => [...prev, newAudio]);
    setSelectedAudioId(newAudio.id);
  };

  const handleUploadAudioFile = async (file: File) => {
    try {
      const { duration, waveformData } = await extractWaveformDataFromFile(file);
      const detected = detectAudioBeats(waveformData, duration, 'dynamic-transient');
      const blobUrl = URL.createObjectURL(file);
      const newAudio: AudioTrackClip = {
        id: `audio-${Date.now()}`,
        title: file.name || 'Uploaded Audio Track',
        artist: 'User Media',
        duration: Number(duration.toFixed(2)),
        startTime: currentTime,
        volume: 85,
        url: blobUrl,
        file: file,
        waveformData,
        beatMarkers: detected.beats,
        beatConfig: {
          bpm: detected.bpm,
          offset: 0,
          autoDetectMode: 'dynamic-transient',
          snappingEnabled: true,
        },
      };
      setAudioClips((prev) => [...prev, newAudio]);
      setSelectedAudioId(newAudio.id);
      setSelectedClipId(null);
      setSelectedCaptionId(null);
      setSelectedOverlayId(null);
    } catch (err) {
      console.error('Failed to parse uploaded audio file:', err);
    }
  };

  const handleDeleteAudio = (audioId: string) => {
    setAudioClips((prev) => prev.filter((a) => a.id !== audioId));
    if (selectedAudioId === audioId) setSelectedAudioId(null);
  };

  // Overlay Trimming & Management
  const handleTrimOverlay = useCallback((id: string, deltaStart: number, deltaEnd: number) => {
    setOverlays((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        let newStart = o.startTime;
        let newDuration = o.duration;
        if (deltaStart !== 0) {
          newStart = Math.max(0, o.startTime + deltaStart);
          newDuration = Math.max(0.5, o.duration - deltaStart);
        }
        if (deltaEnd !== 0) {
          newDuration = Math.max(0.5, o.duration + deltaEnd);
        }
        return { ...o, startTime: newStart, duration: newDuration };
      })
    );
  }, []);

  const handleAddOverlayClip = () => {
    const newOverlay: OverlayClip = {
      id: `ov-${Date.now()}`,
      title: 'Documentary Parchment Texture',
      thumbnailUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=300&auto=format&fit=crop&q=80',
      startTime: currentTime,
      duration: 5.0,
      type: 'motion-graphic',
      opacity: 0.4,
    };
    setOverlays((prev) => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
  };

  // Chart Overlay Handlers
  const handleOpenChartModal = (presetType?: ChartType) => {
    setEditingChartOverlayId(null);
    setChartPresetToOpen(presetType);
    setIsChartModalOpen(true);
  };

  const handleEditSelectedChart = (overlayId?: string) => {
    const targetId = overlayId || selectedOverlayId;
    if (!targetId) return;
    const target = overlays.find((o) => o.id === targetId);
    if (target) {
      setEditingChartOverlayId(targetId);
      setChartPresetToOpen(target.chartConfig?.type || 'bar');
      setIsChartModalOpen(true);
    }
  };

  const handleSaveChartConfig = (config: ChartConfig) => {
    if (editingChartOverlayId) {
      setOverlays((prev) =>
        prev.map((o) => {
          if (o.id === editingChartOverlayId) {
            return {
              ...o,
              title: config.title || 'Data Infographic',
              chartConfig: config,
            };
          }
          return o;
        })
      );
    } else {
      const newChartOverlay: OverlayClip = {
        id: `chart-${Date.now()}`,
        title: config.title || `${config.type.toUpperCase()} Chart`,
        thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&auto=format&fit=crop&q=80',
        startTime: currentTime,
        duration: 5.0,
        type: 'chart',
        opacity: 0.95,
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
        },
        chartConfig: config,
      };

      setOverlays((prev) => [...prev, newChartOverlay]);
      setSelectedOverlayId(newChartOverlay.id);
      setSelectedClipId(null);
      setSelectedCaptionId(null);
      setSelectedAudioId(null);
      setActiveTool('chart');
    }
    setIsChartModalOpen(false);
    setEditingChartOverlayId(null);
  };

  // Transition Handler
  const handleOpenTransition = useCallback((fromIndex: number) => {
    setActiveTransitionIndex(fromIndex);
    setIsTransitionModalOpen(true);
  }, []);

  const handleApplyTransition = (transition: Transition | undefined, applyToAll: boolean) => {
    let newClips: VideoClip[];
    if (applyToAll) {
      newClips = videoClips.map((c, i) =>
        i < videoClips.length - 1 ? { ...c, transitionAfter: transition } : c
      );
    } else {
      newClips = videoClips.map((c, i) =>
        i === activeTransitionIndex ? { ...c, transitionAfter: transition } : c
      );
    }
    setVideoClips(newClips);
    pushHistory({ videoClips: newClips });
  };

  // Step Frame
  const handleStepFrame = (direction: -1 | 1) => {
    const frameDuration = 1 / 30; // 30 fps
    setCurrentTime((prev) => Math.max(0, Math.min(totalDuration, prev + direction * frameDuration)));
  };

  // Selected Element helper for keyframes
  let selectedItemKeyframes: Keyframe[] | undefined;
  let selectedItemLocalTime = 0;
  let selectedItemTitle = 'Selected Element';

  if (selectedClipId) {
    let acc = 0;
    const clip = videoClips.find((c) => c.id === selectedClipId);
    if (clip) {
      for (const c of videoClips) {
        if (c.id === clip.id) break;
        acc += c.duration;
      }
      selectedItemLocalTime = Math.max(0, currentTime - acc);
      selectedItemKeyframes = clip.keyframes;
      selectedItemTitle = clip.title;
    }
  } else if (selectedCaptionId) {
    const cap = captions.find((c) => c.id === selectedCaptionId);
    if (cap) {
      selectedItemLocalTime = Math.max(0, currentTime - cap.startTime);
      selectedItemKeyframes = cap.keyframes;
      selectedItemTitle = `Subtitle: "${cap.text}"`;
    }
  } else if (selectedOverlayId) {
    const ov = overlays.find((o) => o.id === selectedOverlayId);
    if (ov) {
      selectedItemLocalTime = Math.max(0, currentTime - ov.startTime);
      selectedItemKeyframes = ov.keyframes;
      selectedItemTitle = `Overlay: ${ov.title}`;
    }
  } else if (selectedAudioId) {
    const aud = audioClips.find((a) => a.id === selectedAudioId);
    if (aud) {
      selectedItemLocalTime = Math.max(0, currentTime - aud.startTime);
      selectedItemKeyframes = aud.keyframes;
      selectedItemTitle = `Audio: ${aud.title}`;
    }
  }

  const currentNearKeyframe = findKeyframeNear(selectedItemKeyframes, selectedItemLocalTime, 0.2);
  const hasKeyframeAtPlayhead = Boolean(currentNearKeyframe);

  // Keyframe Action Handlers
  const handleToggleKeyframe = () => {
    // If no clip is explicitly selected, auto-select the active clip under playhead!
    let targetClipId = selectedClipId;
    if (!targetClipId && !selectedCaptionId && !selectedOverlayId && !selectedAudioId) {
      // Find clip at playhead
      let acc = 0;
      for (const c of videoClips) {
        if (currentTime >= acc && currentTime < acc + c.duration) {
          targetClipId = c.id;
          setSelectedClipId(c.id);
          break;
        }
        acc += c.duration;
      }
      if (!targetClipId && videoClips.length > 0) {
        targetClipId = videoClips[0].id;
        setSelectedClipId(targetClipId);
      }
    }

    if (targetClipId) {
      let acc = 0;
      for (const c of videoClips) {
        if (c.id === targetClipId) break;
        acc += c.duration;
      }
      const localTime = Math.max(0, currentTime - acc);
      const clip = videoClips.find((c) => c.id === targetClipId);
      if (!clip) return;

      const existingKfs = clip.keyframes || [];
      const nearKf = findKeyframeNear(existingKfs, localTime, 0.2);

      let newKfs: Keyframe[];
      if (nearKf) {
        // Remove keyframe
        newKfs = existingKfs.filter((k) => k.id !== nearKf.id);
      } else {
        // Add keyframe with smooth defaults or current interpolation
        const currentTransform = interpolateKeyframes(existingKfs, localTime);
        const newKf: Keyframe = {
          id: `kf-${Date.now()}`,
          time: Number(localTime.toFixed(2)),
          scale: existingKfs.length === 0 ? 1.25 : currentTransform.scale,
          x: currentTransform.x,
          y: currentTransform.y,
          rotation: currentTransform.rotation,
          opacity: currentTransform.opacity,
        };
        newKfs = [...existingKfs, newKf].sort((a, b) => a.time - b.time);
      }

      setVideoClips((prev) =>
        prev.map((c) => (c.id === targetClipId ? { ...c, keyframes: newKfs } : c))
      );
    } else if (selectedCaptionId) {
      const cap = captions.find((c) => c.id === selectedCaptionId);
      if (!cap) return;
      const localTime = Math.max(0, currentTime - cap.startTime);
      const existingKfs = cap.keyframes || [];
      const nearKf = findKeyframeNear(existingKfs, localTime, 0.2);

      let newKfs: Keyframe[];
      if (nearKf) {
        newKfs = existingKfs.filter((k) => k.id !== nearKf.id);
      } else {
        newKfs = [
          ...existingKfs,
          {
            id: `kf-cap-${Date.now()}`,
            time: Number(localTime.toFixed(2)),
            scale: 1.2,
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
          },
        ].sort((a, b) => a.time - b.time);
      }
      setCaptions((prev) =>
        prev.map((c) => (c.id === selectedCaptionId ? { ...c, keyframes: newKfs } : c))
      );
    } else if (selectedOverlayId) {
      const ov = overlays.find((o) => o.id === selectedOverlayId);
      if (!ov) return;
      const localTime = Math.max(0, currentTime - ov.startTime);
      const existingKfs = ov.keyframes || [];
      const nearKf = findKeyframeNear(existingKfs, localTime, 0.2);

      let newKfs: Keyframe[];
      if (nearKf) {
        newKfs = existingKfs.filter((k) => k.id !== nearKf.id);
      } else {
        newKfs = [
          ...existingKfs,
          {
            id: `kf-ov-${Date.now()}`,
            time: Number(localTime.toFixed(2)),
            scale: 1.15,
            x: 5,
            y: -5,
            rotation: 2,
            opacity: 1,
          },
        ].sort((a, b) => a.time - b.time);
      }
      setOverlays((prev) =>
        prev.map((o) => (o.id === selectedOverlayId ? { ...o, keyframes: newKfs } : o))
      );
    }
  };

  const handleNextKeyframe = () => {
    if (!selectedItemKeyframes || selectedItemKeyframes.length === 0) return;
    const nextTime = getNextKeyframeTime(selectedItemKeyframes, selectedItemLocalTime);
    if (nextTime !== null) {
      let offset = 0;
      if (selectedClipId) {
        for (const c of videoClips) {
          if (c.id === selectedClipId) break;
          offset += c.duration;
        }
      } else if (selectedCaptionId) {
        offset = captions.find((c) => c.id === selectedCaptionId)?.startTime || 0;
      } else if (selectedOverlayId) {
        offset = overlays.find((o) => o.id === selectedOverlayId)?.startTime || 0;
      }
      setCurrentTime(offset + nextTime);
    }
  };

  const handlePrevKeyframe = () => {
    if (!selectedItemKeyframes || selectedItemKeyframes.length === 0) return;
    const prevTime = getPrevKeyframeTime(selectedItemKeyframes, selectedItemLocalTime);
    if (prevTime !== null) {
      let offset = 0;
      if (selectedClipId) {
        for (const c of videoClips) {
          if (c.id === selectedClipId) break;
          offset += c.duration;
        }
      } else if (selectedCaptionId) {
        offset = captions.find((c) => c.id === selectedCaptionId)?.startTime || 0;
      } else if (selectedOverlayId) {
        offset = overlays.find((o) => o.id === selectedOverlayId)?.startTime || 0;
      }
      setCurrentTime(offset + prevTime);
    }
  };

  const handleSaveKeyframeValues = (values: Partial<Keyframe>) => {
    if (selectedClipId) {
      const clip = videoClips.find((c) => c.id === selectedClipId);
      if (!clip) return;
      const kfs = clip.keyframes || [];
      const nearKf = findKeyframeNear(kfs, selectedItemLocalTime, 0.25);
      let updatedKfs: Keyframe[];
      if (nearKf) {
        updatedKfs = kfs.map((k) => (k.id === nearKf.id ? { ...k, ...values } : k));
      } else {
        const newKf: Keyframe = {
          id: `kf-${Date.now()}`,
          time: Number(selectedItemLocalTime.toFixed(2)),
          scale: values.scale ?? 1.25,
          x: values.x ?? 0,
          y: values.y ?? 0,
          rotation: values.rotation ?? 0,
          opacity: values.opacity ?? 1.0,
        };
        updatedKfs = [...kfs, newKf].sort((a, b) => a.time - b.time);
      }
      setVideoClips((prev) =>
        prev.map((c) => (c.id === selectedClipId ? { ...c, keyframes: updatedKfs } : c))
      );
    }
  };

  const handleApplyKeyframePreset = (presetName: string) => {
    if (!selectedClipId) return;
    const clip = videoClips.find((c) => c.id === selectedClipId);
    if (!clip) return;

    let newKfs: Keyframe[] = [];
    if (presetName === 'ken-burns-in') {
      newKfs = [
        { id: `kf-1-${Date.now()}`, time: 0, scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1 },
        { id: `kf-2-${Date.now()}`, time: clip.duration, scale: 1.35, x: 5, y: -4, rotation: 0, opacity: 1 },
      ];
    } else if (presetName === 'ken-burns-out') {
      newKfs = [
        { id: `kf-1-${Date.now()}`, time: 0, scale: 1.35, x: -6, y: 4, rotation: 0, opacity: 1 },
        { id: `kf-2-${Date.now()}`, time: clip.duration, scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1 },
      ];
    } else if (presetName === 'pan-horizontal') {
      newKfs = [
        { id: `kf-1-${Date.now()}`, time: 0, scale: 1.2, x: -15, y: 0, rotation: 0, opacity: 1 },
        { id: `kf-2-${Date.now()}`, time: clip.duration, scale: 1.2, x: 15, y: 0, rotation: 0, opacity: 1 },
      ];
    } else if (presetName === 'dramatic-tilt') {
      newKfs = [
        { id: `kf-1-${Date.now()}`, time: 0, scale: 1.1, x: 0, y: 0, rotation: -3, opacity: 1 },
        { id: `kf-2-${Date.now()}`, time: clip.duration, scale: 1.25, x: 0, y: 0, rotation: 3, opacity: 1 },
      ];
    }

    setVideoClips((prev) =>
      prev.map((c) => (c.id === selectedClipId ? { ...c, keyframes: newKfs } : c))
    );
  };

  // Selected Clip object helper
  const activeSelectedClip = videoClips.find((c) => c.id === selectedClipId);

  const handleSaveAdjustments = (
    adjustments: ColorAdjustments,
    filterPreset: FilterPreset,
    chromaKey?: { enabled: boolean; color: string; intensity: number; shadow: number },
    backgroundBlur?: number,
    applyToAll?: boolean
  ) => {
    if (applyToAll) {
      setVideoClips((prev) =>
        prev.map((c) => ({
          ...c,
          adjustments,
          filterPreset,
          chromaKey,
          backgroundBlur,
        }))
      );
    } else {
      const targetId = selectedClipId || videoClips[0]?.id;
      if (!targetId) return;
      setVideoClips((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                adjustments,
                filterPreset,
                chromaKey,
                backgroundBlur,
              }
            : c
        )
      );
    }
  };

  const handleSaveSpeed = (
    speed: number,
    speedSettings?: SpeedSettings,
    applyToAll?: boolean
  ) => {
    if (applyToAll) {
      setVideoClips((prev) =>
        prev.map((c) => {
          const rawSpan = c.rawDuration || c.duration;
          const newDuration = calculateSpeedAdjustedDuration(rawSpan, speed, speedSettings);
          const scaleRatio = newDuration / Math.max(0.1, c.duration);
          const updatedKeyframes = c.keyframes?.map((kf) => ({
            ...kf,
            time: kf.time * scaleRatio,
          }));
          return {
            ...c,
            speed,
            speedSettings,
            duration: Math.round(newDuration * 100) / 100,
            keyframes: updatedKeyframes,
          };
        })
      );
    } else {
      const targetId = selectedClipId || videoClips[0]?.id;
      if (!targetId) return;
      setVideoClips((prev) =>
        prev.map((c) => {
          if (c.id !== targetId) return c;
          const rawSpan = c.rawDuration || c.duration;
          const newDuration = calculateSpeedAdjustedDuration(rawSpan, speed, speedSettings);
          const scaleRatio = newDuration / Math.max(0.1, c.duration);
          const updatedKeyframes = c.keyframes?.map((kf) => ({
            ...kf,
            time: kf.time * scaleRatio,
          }));
          return {
            ...c,
            speed,
            speedSettings,
            duration: Math.round(newDuration * 100) / 100,
            keyframes: updatedKeyframes,
          };
        })
      );
    }
  };

  // PIP & Blend & Mask Handlers
  const handleOpenPIPBlendModal = (targetId: string, type: 'overlay' | 'clip') => {
    setPipTargetId(targetId);
    setPipTargetType(type);
    setIsPIPBlendMaskModalOpen(true);
  };

  const handleUpdateOverlayTransform = (
    overlayId: string,
    transform: { x: number; y: number; scale: number; rotation: number }
  ) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === overlayId ? { ...o, transform } : o))
    );
  };

  const handleDeleteOverlay = (overlayId: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== overlayId));
    if (selectedOverlayId === overlayId) {
      setSelectedOverlayId(null);
    }
  };

  const handleUpdatePIPBlendSettings = (
    id: string,
    settings: {
      opacity?: number;
      blendMode?: BlendMode;
      mask?: ShapeMaskConfig;
      transform?: {
        x: number;
        y: number;
        scale: number;
        rotation: number;
      };
    }
  ) => {
    if (pipTargetType === 'overlay') {
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                opacity: settings.opacity !== undefined ? settings.opacity : o.opacity,
                blendMode: settings.blendMode !== undefined ? settings.blendMode : o.blendMode,
                mask: settings.mask !== undefined ? settings.mask : o.mask,
                transform: settings.transform !== undefined ? settings.transform : o.transform,
              }
            : o
        )
      );
    } else {
      setVideoClips((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                blendMode: settings.blendMode !== undefined ? settings.blendMode : c.blendMode,
                mask: settings.mask !== undefined ? settings.mask : c.mask,
              }
            : c
        )
      );
    }
  };

  // Beat Detection & Auto-Cut Handlers
  const handleApplyBeats = (
    audioId: string,
    beatMarkers: BeatMarker[],
    beatConfig: BeatDetectionConfig
  ) => {
    setAudioClips((prev) =>
      prev.map((a) =>
        a.id === audioId
          ? {
              ...a,
              beatMarkers,
              beatConfig,
            }
          : a
      )
    );
  };

  const handleAutoCutClipsToBeats = (beatMarkers: BeatMarker[]) => {
    if (!beatMarkers || beatMarkers.length === 0 || videoClips.length === 0) return;

    // Filter to primary downbeats or spaced beats (at least 1.0s apart) to make musically coherent cuts
    const validCutPoints = beatMarkers
      .map((b) => (typeof b === 'number' ? b : b.time))
      .filter((t) => t > 0.8 && t < totalDuration - 0.5);

    if (validCutPoints.length === 0) return;

    // Re-slice existing video clips or adapt their durations to match beat boundaries
    const newClips: VideoClip[] = [];
    let currentClipIdx = 0;
    let accumulatedTime = 0;

    for (let i = 0; i < validCutPoints.length; i++) {
      const beatTime = validCutPoints[i];
      const sliceDuration = Number((beatTime - accumulatedTime).toFixed(2));

      if (sliceDuration >= 0.5) {
        const sourceClip = videoClips[currentClipIdx % videoClips.length];
        newClips.push({
          ...sourceClip,
          id: `clip-beat-${Date.now()}-${i}`,
          title: `${sourceClip.title} [Beat ${i + 1}]`,
          duration: sliceDuration,
          startTime: 0,
        });
        accumulatedTime = beatTime;
        currentClipIdx++;
      }
    }

    // Remaining tail clip
    const remainingTime = Number((totalDuration - accumulatedTime).toFixed(2));
    if (remainingTime > 0.5) {
      const sourceClip = videoClips[currentClipIdx % videoClips.length];
      newClips.push({
        ...sourceClip,
        id: `clip-beat-${Date.now()}-tail`,
        title: `${sourceClip.title} [Outro]`,
        duration: remainingTime,
        startTime: 0,
      });
    }

    if (newClips.length > 0) {
      setVideoClips(newClips);
      setSelectedClipId(newClips[0].id);
    }
  };

  // Home Screen Navigation & Action Handlers
  const handleNewVideo = () => {
    const newId = `proj-${Date.now()}`;
    setCurrentProjectId(newId);
    setCurrentProjectTitle('New Video Project');
    setVideoClips([]);
    setAudioClips([]);
    setCaptions([]);
    setOverlays([]);
    setCurrentTime(0);
    setIsPlaying(false);
    setCurrentScreen('editor');
  };

  const handleEditPhoto = () => {
    const newId = `proj-photo-${Date.now()}`;
    setCurrentProjectId(newId);
    setCurrentProjectTitle('Photo Project');
    setAspectRatio('9:16');
    setVideoClips([]);
    setAudioClips([]);
    setCaptions([]);
    setOverlays([]);
    setCurrentTime(0);
    setIsPlaying(false);
    setCurrentScreen('editor');
  };

  const handleOpenAIEditorFromHome = () => {
    setCurrentScreen('editor');
    setIsAIChatOpen(true);
  };

  const handleOpenProjectFromHome = async (project: ProjectItem) => {
    setCurrentProjectId(project.id);
    setCurrentProjectTitle(project.name);
    setAspectRatio(project.aspectRatio);
    setCurrentTime(0);
    setIsPlaying(false);

    try {
      const projectAssets = await restoreAllAssets(project.id);
      if (projectAssets.length > 0) {
        setRegisteredAssets(projectAssets);
      }

      const { reconnectedVideoClips, reconnectedAudioClips } = reconnectTimelineToAssets(
        project.videoClips || [],
        project.audioClips || [],
        projectAssets
      );

      setVideoClips(reconnectedVideoClips);
      setAudioClips(reconnectedAudioClips);
      if (reconnectedVideoClips.length > 0) {
        setSelectedClipId(reconnectedVideoClips[0].id);
      }
    } catch {
      if (project.videoClips && project.videoClips.length > 0) {
        setVideoClips(project.videoClips);
        setSelectedClipId(project.videoClips[0].id);
      }
      if (project.audioClips) {
        setAudioClips(project.audioClips);
      }
    }

    if (project.captions || project.captionClips) {
      setCaptions(project.captions || project.captionClips || []);
    }
    if (project.overlays || project.overlayClips) {
      setOverlays(project.overlays || project.overlayClips || []);
    }
    setCurrentScreen('editor');
  };

  const handleDeleteProjectFromHome = (projectId: string) => {
    setProjectsList((prev) => prev.filter((p) => p.id !== projectId));
    deletePersistedProject(projectId).catch((err) => {
      console.warn('[PersistentStorage] Failed to delete project from storage:', err);
    });
  };

  const handleDuplicateProjectFromHome = async (project: ProjectItem) => {
    const newId = `proj-${Date.now()}`;
    const dup: ProjectItem = {
      ...project,
      id: newId,
      name: `${project.name} (Copy)`,
      lastEdited: Date.now(),
    };
    setProjectsList((prev) => [dup, ...prev]);

    try {
      const record: StoredProjectRecord = {
        id: newId,
        name: dup.name,
        thumbnailUrl: dup.thumbnailUrl,
        aspectRatio: dup.aspectRatio,
        duration: dup.duration,
        lastEdited: Date.now(),
        resolution: dup.resolution,
        fps: dup.fps,
        category: dup.category,
        isFavorite: dup.isFavorite,
        videoClips: dup.videoClips || [],
        audioClips: dup.audioClips || [],
        captionClips: dup.captionClips || dup.captions || [],
        overlayClips: dup.overlayClips || dup.overlays || [],
        assetIds: [],
      };
      await persistProject(record);
    } catch (err) {
      console.warn('[PersistentStorage] Error duplicating project in storage:', err);
    }
  };

  const handleRenameProjectFromHome = (projectId: string, newName: string) => {
    setProjectsList((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name: newName, lastEdited: Date.now() } : p))
    );
    if (currentProjectId === projectId || currentProjectTitle === projectId) {
      setCurrentProjectTitle(newName);
    }
  };

  const handleUseTemplateFromHome = (template: TemplatePreset) => {
    const newId = `proj-template-${Date.now()}`;
    setCurrentProjectId(newId);
    setCurrentProjectTitle(template.title);
    setAspectRatio(template.aspectRatio);
    setCurrentTime(0);
    setIsPlaying(false);
    if (template.videoClips && template.videoClips.length > 0) {
      setVideoClips(template.videoClips);
      setSelectedClipId(template.videoClips[0].id);
    }
    if (template.captions) {
      setCaptions(template.captions);
    }
    if (template.audioClips) {
      setAudioClips(template.audioClips);
    }
    if (template.overlays) {
      setOverlays(template.overlays);
    }
    setCurrentScreen('editor');
  };

  const handleImportZipSuccessFromHome = (result: ZipImportResult) => {
    const newProjId = `proj-${Date.now()}`;
    setCurrentProjectId(newProjId);

    if (result.assets && result.assets.length > 0) {
      setRegisteredAssets(result.assets);
      persistAssetsBatch(result.assets, newProjId).catch((err) => {
        console.warn('[PersistentStorage] Failed to persist zip assets to IndexedDB:', err);
      });
    }
    if (result.scriptText) {
      setActiveScriptText(result.scriptText);
    }
    if (result.captions && result.captions.length > 0) {
      setCaptions(result.captions);
    }
    // Auto-generate video clips from visual assets if none provided
    let finalVideoClips = result.videoClips || [];
    if (finalVideoClips.length === 0 && result.assets && result.assets.length > 0) {
      const visualAssets = result.assets.filter((a): a is ProjectAsset & { type: 'video' | 'image' } => a.type === 'video' || a.type === 'image');
      if (visualAssets.length > 0) {
        finalVideoClips = visualAssets.map((a, idx) => {
          const dur = a.type === 'video' ? Math.max(1, a.duration || 5) : 3;
          const frameImg = a.thumbnailUrl || a.url;
          const clip: VideoClip = {
            id: `clip-${Date.now()}-${idx}`,
            assetId: a.id,
            title: a.name,
            type: a.type,
            color: '#2A59FE',
            url: a.url,
            thumbnailUrl: frameImg,
            frames: [frameImg],
            duration: dur,
            startOffset: 0,
            rawDuration: Math.max(dur, a.duration || dur),
            speed: 1,
            volume: 100,
          };
          return clip;
        });
      }
    }

    // Auto-generate audio clips from audio assets if none provided
    let finalAudioClips = result.audioClips || [];
    if (finalAudioClips.length === 0 && result.assets && result.assets.length > 0) {
      const audioAssets = result.assets.filter((a) => a.type === 'audio');
      if (audioAssets.length > 0) {
        let audioStartTime = 0;
        finalAudioClips = audioAssets.map((a, idx) => {
          const clipDuration = Math.max(1, a.duration || 10);
          const clip: AudioTrackClip = {
            id: `audio-${Date.now()}-${idx}`,
            assetId: a.id,
            title: a.name,
            artist: 'Imported Audio',
            duration: Number(clipDuration.toFixed(2)),
            startTime: audioStartTime,
            volume: 85,
            url: a.url,
            waveformData: a.waveformData || [0.2, 0.5, 0.8, 0.4, 0.6, 0.3],
            beatMarkers: [],
            beatConfig: {
              bpm: 120,
              offset: 0,
              autoDetectMode: 'dynamic-transient',
              snappingEnabled: true,
            },
          };
          audioStartTime += clipDuration;
          return clip;
        });
      }
    }

    // If audio was imported without visual clips, provide an ambient background so canvas renders
    if (finalVideoClips.length === 0 && finalAudioClips.length > 0) {
      const totalAudioDur = finalAudioClips.reduce((sum, c) => Math.max(sum, c.startTime + c.duration), 5);
      const bgImg = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280&q=80';
      finalVideoClips = [
        {
          id: `clip-${Date.now()}-bg`,
          title: 'Audio Visualizer Canvas',
          type: 'image',
          color: '#2A59FE',
          url: bgImg,
          thumbnailUrl: bgImg,
          frames: [bgImg],
          duration: totalAudioDur,
          startOffset: 0,
          rawDuration: totalAudioDur,
          speed: 1,
          volume: 0,
        },
      ];
    }

    if (finalVideoClips.length > 0) {
      setVideoClips(finalVideoClips);
      setSelectedClipId(finalVideoClips[0].id);
    }
    if (finalAudioClips.length > 0) {
      setAudioClips(finalAudioClips);
      setSelectedAudioId(finalAudioClips[0].id);
    }
    if (result.overlays && result.overlays.length > 0) {
      setOverlays(result.overlays);
    }
    const archiveName = result.assets[0]?.name ? result.assets[0].name.replace(/\.[^/.]+$/, '') : 'Imported Project';
    setCurrentProjectTitle(`Imported: ${archiveName}`);
    setCurrentTime(0);
    setIsPlaying(false);
    setCurrentScreen('editor');
  };

  const handleExportProjectBackup = async () => {
    try {
      const blob = await exportProjectArchive(currentProjectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProjectTitle.replace(/[^a-z0-9]/gi, '_')}-backup.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.warn('[PersistentStorage] Export backup failed:', err);
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSelectQuickToolFromHome = (toolKey: string) => {
    setCurrentScreen('editor');
    setTimeout(() => {
      switch (toolKey) {
        case 'auto-captions':
          setIsAutoCaptionsModalOpen(true);
          break;
        case 'chroma-cutout':
          setIsChromaKeyModalOpen(true);
          break;
        case 'smart-highlights':
          setIsSmartHighlightsModalOpen(true);
          break;
        case 'voice-tts':
          setIsVoiceEffectsModalOpen(true);
          break;
        case 'beat-detect':
          setIsBeatDetectorModalOpen(true);
          break;
        case 'speed-ramp':
          setIsSpeedModalOpen(true);
          break;
        case 'video-effects':
          setIsVideoEffectsModalOpen(true);
          break;
        case 'filter-adjust':
          setIsFilterAdjustModalOpen(true);
          break;
        case 'ai-script-video':
          setIsAIChatOpen(true);
          break;
        case 'chart-overlay':
          setIsChartModalOpen(true);
          break;
        default:
          break;
      }
    }, 50);
  };

  const handleBackToHome = () => {
    setIsPlaying(false);
    setCurrentScreen('home');
  };

  // Memoized handlers to decouple Timeline and chrome re-renders from 60fps playback updates
  const handleOpenAssetBin = useCallback(() => setIsAssetBinOpen(true), []);
  const handleOpenExportModal = useCallback(() => setIsExportModalOpen(true), []);
  const handleOpenSmartHighlightsModal = useCallback(() => setIsSmartHighlightsModalOpen(true), []);
  const handleOpenAIChat = useCallback(() => setIsAIChatOpen(true), []);
  const handleOpenCoverPicker = useCallback(() => setIsCoverModalOpen(true), []);
  const handleOpenSpeedModal = useCallback(() => setIsSpeedModalOpen(true), []);
  const handleOpenVolumeModal = useCallback(() => setIsVolumeModalOpen(true), []);
  const handleOpenFilterAdjustModal = useCallback(() => setIsFilterAdjustModalOpen(true), []);
  const handleOpenChromaKeyModal = useCallback(() => setIsChromaKeyModalOpen(true), []);
  const handleOpenVideoEffectsModal = useCallback(() => setIsVideoEffectsModalOpen(true), []);
  const handleOpenVoiceEffectsModal = useCallback(() => setIsVoiceEffectsModalOpen(true), []);
  const handleOpenAutoCaptionsModal = useCallback(() => setIsAutoCaptionsModalOpen(true), []);
  const handleOpenKeyframeModal = useCallback(() => setIsKeyframeModalOpen(true), []);
  const handleTogglePlay = useCallback(() => setIsPlaying((prev) => !prev), []);
  const handleToggleMutePreview = useCallback(() => setIsMuted((prev) => !prev), []);
  const handleDismissStorageNotice = useCallback(() => setStorageErrorNotice(null), []);
  const handleImportMediaTimeline = useCallback(
    (files: FileList | File[]) => handleImportMediaToAssetBin(files, true),
    [handleImportMediaToAssetBin]
  );
  const handleDeselectAll = useCallback(() => {
    setSelectedClipId(null);
    setSelectedAudioId(null);
    setSelectedOverlayId(null);
    setSelectedCaptionId(null);
  }, []);
  const handleDeleteSelected = useCallback(() => {
    if (selectedClipId) handleDeleteClip(selectedClipId);
    else if (selectedAudioId) handleDeleteAudio(selectedAudioId);
    else if (selectedOverlayId) handleDeleteOverlay(selectedOverlayId);
    else if (selectedCaptionId) handleDeleteCaption(selectedCaptionId);
  }, [selectedClipId, selectedAudioId, selectedOverlayId, selectedCaptionId]);
  const handleOpenPIPBlendModalAction = useCallback(() => {
    if (selectedOverlayId) {
      handleOpenPIPBlendModal(selectedOverlayId, 'overlay');
    } else if (selectedClipId) {
      handleOpenPIPBlendModal(selectedClipId, 'clip');
    } else if (overlays.length > 0) {
      handleOpenPIPBlendModal(overlays[0].id, 'overlay');
    } else if (videoClips.length > 0) {
      handleOpenPIPBlendModal(videoClips[0].id, 'clip');
    }
  }, [selectedOverlayId, selectedClipId, overlays, videoClips, handleOpenPIPBlendModal]);
  const handleOpenBeatDetectorAction = useCallback(() => {
    if (!selectedAudioId && audioClips.length > 0) {
      setSelectedAudioId(audioClips[0].id);
    }
    setIsBeatDetectorModalOpen(true);
  }, [selectedAudioId, audioClips]);

  const pipTargetItem =
    pipTargetType === 'overlay'
      ? overlays.find((o) => o.id === pipTargetId) || overlays[0] || null
      : videoClips.find((c) => c.id === pipTargetId) || videoClips[0] || null;

  // Render Project Restore Loading Screen on startup
  if (isRestoringProject) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0e0e14] text-white select-none">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-[#161622] border border-white/10 shadow-2xl max-w-sm w-full text-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center absolute inset-0 m-auto text-[10px] font-bold text-cyan-300">
              C
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-white tracking-tight">{storageStatusText}</h3>
            <p className="text-xs text-zinc-400">Restoring your local timeline, assets & audio tracks from browser storage</p>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full animate-pulse w-3/4" />
          </div>
          <button
            type="button"
            onClick={() => setIsRestoringProject(false)}
            className="mt-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition-all cursor-pointer"
          >
            Open Editor Now →
          </button>
        </div>
      </div>
    );
  }

  // Render Home Dashboard if currentScreen is 'home'
  if (currentScreen === 'home') {
    return (
      <HomeScreen
        projects={projectsList}
        onNewVideo={handleNewVideo}
        onEditPhoto={handleEditPhoto}
        onOpenAIEditor={handleOpenAIEditorFromHome}
        onOpenProject={handleOpenProjectFromHome}
        onDeleteProject={handleDeleteProjectFromHome}
        onDuplicateProject={handleDuplicateProjectFromHome}
        onRenameProject={handleRenameProjectFromHome}
        onUseTemplate={handleUseTemplateFromHome}
        onImportZipSuccess={handleImportZipSuccessFromHome}
        onSelectQuickTool={handleSelectQuickToolFromHome}
      />
    );
  }

  // Render Full Video Editor Timeline Workspace
  return (
    <div
      className="flex flex-col h-screen w-screen bg-[#121212] text-white overflow-hidden"
      id="capcut-app-root"
    >
      {/* Master Audio Hardware Output Element */}
      <audio ref={masterAudioRef} preload="auto" className="hidden" />

      {/* Storage Notification Banner */}
      {storageErrorNotice && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 px-4 py-1.5 text-xs text-amber-200 flex items-center justify-between z-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>{storageErrorNotice}</span>
          </div>
          <button
            onClick={handleDismissStorageNotice}
            className="text-amber-400 hover:text-white text-[11px] underline ml-3 shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <EditorHeader
        projectTitle={currentProjectTitle}
        onBackToHome={handleBackToHome}
        onOpenExport={handleOpenExportModal}
        onOpenSmartHighlights={handleOpenSmartHighlightsModal}
        onOpenAIEditor={handleOpenAIChat}
        onOpenAssetBin={handleOpenAssetBin}
        assetCount={registeredAssets.length}
        onImportMedia={handleImportMediaTimeline}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        resolution="1080P"
        isStorageSaving={isStorageSaving}
        onExportBackup={handleExportProjectBackup}
      />

      {/* Video Preview Player Canvas with Direct On-Screen Selection */}
      <PreviewPlayer
        currentTime={currentTime}
        totalDuration={totalDuration}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onStepFrame={handleStepFrame}
        videoClips={videoClips}
        captions={captions}
        overlays={overlays}
        audioClips={audioClips}
        aspectRatio={aspectRatio}
        isMuted={isMuted}
        onToggleMute={handleToggleMutePreview}
        selectedClipId={selectedClipId}
        selectedCaptionId={selectedCaptionId}
        selectedAudioId={selectedAudioId}
        selectedOverlayId={selectedOverlayId}
        onSelectClip={handleSelectClip}
        onSelectCaption={handleSelectCaption}
        onSelectOverlay={handleSelectOverlay}
        onDeleteCaption={handleDeleteCaption}
        onUpdateCaptionText={handleUpdateCaptionText}
        onCycleCaptionStyle={handleCycleCaptionStyle}
        onOpenPIPBlendModal={handleOpenPIPBlendModal}
        onDeleteOverlay={handleDeleteOverlay}
        onOpenEditChart={handleEditSelectedChart}
        onUpdateOverlayTransform={handleUpdateOverlayTransform}
        hasKeyframeAtPlayhead={hasKeyframeAtPlayhead}
        onToggleKeyframe={handleToggleKeyframe}
        onPrevKeyframe={selectedItemKeyframes && selectedItemKeyframes.length > 1 ? handlePrevKeyframe : undefined}
        onNextKeyframe={selectedItemKeyframes && selectedItemKeyframes.length > 1 ? handleNextKeyframe : undefined}
        onOpenKeyframeModal={handleOpenKeyframeModal}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Mobile-First CapCut Timeline Component */}
      <Timeline
        currentTime={currentTime}
        totalDuration={totalDuration}
        isPlaying={isPlaying}
        onSeek={handleSeek}
        onPause={handlePause}
        pixelsPerSecond={pixelsPerSecond}
        onZoomChange={handleZoomChange}
        isAutoKenBurnsActive={isAutoKenBurnsActive}
        onToggleAutoKenBurns={() => {
          setIsAutoKenBurnsActive((prev) => {
            const next = !prev;
            setVideoClips((clips) => applyAutoKenBurnsToClips(clips, next));
            pushHistory({ videoClips: applyAutoKenBurnsToClips(videoClips, next) });
            return next;
          });
        }}
        isAutoDuckingActive={isAutoDuckingActive}
        onToggleAutoDucking={() => setIsAutoDuckingActive((prev) => !prev)}
        // Video Clips
        videoClips={videoClips}
        selectedClipId={selectedClipId}
        onSelectClip={handleSelectClip}
        onTrimClip={handleTrimClip}
        onOpenTransition={handleOpenTransition}
        onReorderVideoClips={handleReorderVideoClips}
        onAddVideoClip={handleAddVideoClip}
        onOpenAssetBin={handleOpenAssetBin}
        onImportMedia={handleImportMediaTimeline}
        // Captions
        captions={captions}
        selectedCaptionId={selectedCaptionId}
        onSelectCaption={handleSelectCaption}
        onTrimCaption={handleTrimCaption}
        onMoveCaption={handleMoveCaption}
        // Audio
        audioClips={audioClips}
        selectedAudioId={selectedAudioId}
        onSelectAudio={handleSelectAudio}
        onTrimAudio={handleTrimAudio}
        onMoveAudio={handleMoveAudio}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        // Overlays
        overlays={overlays}
        selectedOverlayId={selectedOverlayId}
        onSelectOverlay={handleSelectOverlay}
        onTrimOverlay={handleTrimOverlay}
        onMoveOverlay={handleMoveOverlay}
        // Cover
        coverThumbnail={coverThumbnail}
        onOpenCoverPicker={handleOpenCoverPicker}
        onOpenSmartHighlightsModal={handleOpenSmartHighlightsModal}
      />

      {/* Fixed Bottom Navigation Toolbar (Categorized tools with nested submenus) */}
      <BottomToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onOpenAssetBin={handleOpenAssetBin}
        assetCount={registeredAssets.length}
        isAutoKenBurnsActive={isAutoKenBurnsActive}
        onToggleAutoKenBurns={() => {
          setIsAutoKenBurnsActive((prev) => {
            const next = !prev;
            setVideoClips((clips) => applyAutoKenBurnsToClips(clips, next));
            pushHistory({ videoClips: applyAutoKenBurnsToClips(videoClips, next) });
            return next;
          });
        }}
        isAutoDuckingActive={isAutoDuckingActive}
        onToggleAutoDucking={() => setIsAutoDuckingActive((prev) => !prev)}
        onSplitClipAtPlayhead={handleSplitClipAtPlayhead}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={handleDuplicateClip}
        onOpenSpeedModal={handleOpenSpeedModal}
        onOpenVolumeModal={handleOpenVolumeModal}
        onOpenFilterAdjustModal={handleOpenFilterAdjustModal}
        onOpenChromaKeyModal={handleOpenChromaKeyModal}
        onOpenVideoEffectsModal={handleOpenVideoEffectsModal}
        onOpenPIPBlendMaskModal={handleOpenPIPBlendModalAction}
        selectedClipId={selectedClipId}
        selectedOverlayId={selectedOverlayId}
        selectedAudioId={selectedAudioId}
        selectedCaptionId={selectedCaptionId}
        onDeselectAll={handleDeselectAll}
        hasKeyframeAtPlayhead={hasKeyframeAtPlayhead}
        onToggleKeyframe={handleToggleKeyframe}
        onOpenKeyframeModal={handleOpenKeyframeModal}
        onOpenAutoCaptions={handleOpenAutoCaptionsModal}
        onOpenSmartHighlightsModal={handleOpenSmartHighlightsModal}
        onAddTextClip={handleAddTextClip}
        onAddAudioClip={handleAddAudioClip}
        onUploadAudioFile={handleUploadAudioFile}
        onOpenVoiceEffectsTTSModal={handleOpenVoiceEffectsModal}
        onOpenBeatDetectorModal={handleOpenBeatDetectorAction}
        onAddOverlayClip={handleAddOverlayClip}
        onOpenChartModal={handleOpenChartModal}
        isChartSelected={Boolean(
          selectedOverlayId &&
            overlays.find((o) => o.id === selectedOverlayId)?.type === 'chart'
        )}
        onEditSelectedChart={() => handleEditSelectedChart(selectedOverlayId || undefined)}
        onOpenAIEditor={handleOpenAIChat}
        onOpenExport={handleOpenExportModal}
        aspectRatio={aspectRatio}
        onSelectAspectRatio={setAspectRatio}
      />

      {/* Modal Dialogs */}
      <SmartHighlightsModal
        isOpen={isSmartHighlightsModalOpen}
        onClose={() => setIsSmartHighlightsModalOpen(false)}
        videoClips={videoClips}
        audioClips={audioClips}
        onApplyHighlights={(newClips, newCaptions, newAudio) => {
          setVideoClips(newClips);
          if (newCaptions) {
            setCaptions(newCaptions);
          }
          if (newAudio) {
            setAudioClips(newAudio);
          }
          setCurrentTime(0);
          if (newClips.length > 0) {
            setSelectedClipId(newClips[0].id);
          }
          pushHistory({
            videoClips: newClips,
            captions: newCaptions || captions,
            audioClips: newAudio || audioClips,
          });
        }}
      />
      <FilterAdjustModal
        isOpen={isFilterAdjustModalOpen}
        onClose={() => setIsFilterAdjustModalOpen(false)}
        targetClip={activeSelectedClip || videoClips[0]}
        onSaveAdjustments={handleSaveAdjustments}
      />

      <TransitionModal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        fromClipTitle={videoClips[activeTransitionIndex]?.title || 'Clip'}
        toClipTitle={videoClips[activeTransitionIndex + 1]?.title || 'Next Clip'}
        currentTransition={videoClips[activeTransitionIndex]?.transitionAfter}
        onApplyTransition={handleApplyTransition}
      />

      <AutoCaptionsModal
        isOpen={isAutoCaptionsModalOpen}
        onClose={() => setIsAutoCaptionsModalOpen(false)}
        totalDuration={totalDuration}
        onGenerateCaptions={(newCaptions) => {
          setCaptions(newCaptions);
          setActiveTool('text');
        }}
      />

      <CoverModal
        isOpen={isCoverModalOpen}
        onClose={() => setIsCoverModalOpen(false)}
        videoClips={videoClips}
        currentCover={coverThumbnail}
        onSaveCover={(url) => setCoverThumbnail(url)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        totalDuration={totalDuration}
        totalVideoDuration={totalVideoDuration}
        projectTitle={currentProjectTitle}
        videoClips={videoClips}
        captions={captions}
        overlays={overlays}
        audioClips={audioClips}
        aspectRatio={aspectRatio}
        coverThumbnail={coverThumbnail}
      />

      <SpeedModal
        isOpen={isSpeedModalOpen}
        onClose={() => setIsSpeedModalOpen(false)}
        targetClip={activeSelectedClip || videoClips[0]}
        currentSpeed={activeSelectedClip?.speed || 1.0}
        currentSpeedSettings={activeSelectedClip?.speedSettings}
        onSaveSpeed={handleSaveSpeed}
      />

      <VolumeModal
        isOpen={isVolumeModalOpen}
        onClose={() => setIsVolumeModalOpen(false)}
        currentVolume={activeSelectedClip?.volume ?? 100}
        onSaveVolume={(vol) => {
          if (!selectedClipId) return;
          setVideoClips((prev) =>
            prev.map((c) => (c.id === selectedClipId ? { ...c, volume: vol } : c))
          );
        }}
      />

      <KeyframeModal
        isOpen={isKeyframeModalOpen}
        onClose={() => setIsKeyframeModalOpen(false)}
        targetTitle={selectedItemTitle}
        currentKeyframe={currentNearKeyframe}
        onSaveKeyframe={handleSaveKeyframeValues}
        onApplyPreset={handleApplyKeyframePreset}
      />

      <VoiceEffectsTTSModal
        isOpen={isVoiceEffectsModalOpen}
        onClose={() => setIsVoiceEffectsModalOpen(false)}
        playheadTime={currentTime}
        selectedAudioClip={audioClips.find((a) => a.id === selectedAudioId)}
        onAddVoiceoverClip={(newClip) => {
          setAudioClips((prev) => [...prev, newClip]);
          setSelectedAudioId(newClip.id);
        }}
        onUpdateAudioClip={(id, updates) => {
          setAudioClips((prev) =>
            prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
          );
        }}
      />

      <ChromaKeyCutoutModal
        isOpen={isChromaKeyModalOpen}
        onClose={() => setIsChromaKeyModalOpen(false)}
        selectedClip={activeSelectedClip || videoClips[0]}
        onUpdateClipCutout={(clipId, chromaKey, cutout) => {
          setVideoClips((prev) =>
            prev.map((c) =>
              c.id === clipId ? { ...c, chromaKey, cutout } : c
            )
          );
        }}
      />

      <VideoEffectsModal
        isOpen={isVideoEffectsModalOpen}
        onClose={() => setIsVideoEffectsModalOpen(false)}
        selectedClip={activeSelectedClip || videoClips[0]}
        onUpdateEffects={(clipId, videoEffects) => {
          setVideoClips((prev) =>
            prev.map((c) =>
              c.id === clipId ? { ...c, videoEffects } : c
            )
          );
        }}
      />

      <PIPBlendMaskModal
        isOpen={isPIPBlendMaskModalOpen}
        onClose={() => setIsPIPBlendMaskModalOpen(false)}
        targetTitle={
          pipTargetItem
            ? ('title' in pipTargetItem ? (pipTargetItem as any).title : 'Target Layer')
            : 'Overlay PIP'
        }
        targetType={pipTargetType}
        initialOpacity={
          pipTargetItem && 'opacity' in pipTargetItem && typeof pipTargetItem.opacity === 'number'
            ? pipTargetItem.opacity
            : 1
        }
        initialBlendMode={
          pipTargetItem?.blendMode || (pipTargetType === 'overlay' ? 'screen' : 'normal')
        }
        initialMask={pipTargetItem?.mask}
        initialTransform={
          pipTargetItem && 'transform' in pipTargetItem && (pipTargetItem as any).transform
            ? (pipTargetItem as any).transform
            : undefined
        }
        onUpdateSettings={(settings) => {
          if (pipTargetItem) {
            handleUpdatePIPBlendSettings(pipTargetItem.id, settings);
          }
        }}
      />

      <BeatDetectorModal
        isOpen={isBeatDetectorModalOpen}
        onClose={() => setIsBeatDetectorModalOpen(false)}
        selectedAudio={
          audioClips.find((a) => a.id === selectedAudioId) || audioClips[0] || null
        }
        videoClips={videoClips}
        onApplyBeats={handleApplyBeats}
        onAutoCutClipsToBeats={handleAutoCutClipsToBeats}
      />

      <ChartModal
        isOpen={isChartModalOpen}
        onClose={() => {
          setIsChartModalOpen(false);
          setEditingChartOverlayId(null);
        }}
        onSaveChart={handleSaveChartConfig}
        initialConfig={
          editingChartOverlayId
            ? overlays.find((o) => o.id === editingChartOverlayId)?.chartConfig
            : undefined
        }
        presetType={chartPresetToOpen}
      />

      {/* Asset Bin / Media Storage Central Repository */}
      <AssetBinModal
        isOpen={isAssetBinOpen}
        onClose={() => setIsAssetBinOpen(false)}
        assets={registeredAssets}
        onImportFiles={(files) => handleImportMediaToAssetBin(files, false)}
        onUploadFiles={(files) => handleImportMediaToAssetBin(files, false)}
        onAddToTimeline={handleAddAssetToTimeline}
        onDeleteAsset={handleDeleteAssetFromBin}
        videoClips={videoClips}
        audioClips={audioClips}
        isImporting={isImportingAssets}
        isUploading={isImportingAssets}
        importProgressText={assetImportProgressText}
        uploadProgressText={assetImportProgressText}
      />

      {/* Floating AI Editor Entry Button (CapCut Signature Movable Button) */}
      <FloatingAIButton
        isOpen={isAIChatOpen}
        onToggle={() => setIsAIChatOpen(!isAIChatOpen)}
        isExecuting={isAIExecuting}
        statusText={aiActivityStepText}
      />

      {/* Live AI Timeline Execution Activity Badge */}
      <AIActivityBadge
        isVisible={isAIExecuting}
        currentStepIndex={aiActivityStepIndex}
        steps={AI_EXECUTION_STEPS}
        onOpenFullChat={() => setIsAIChatOpen(true)}
      />

      {/* Conversational AI Video Editing Assistant Drawer */}
      <AIChatDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        messages={aiMessages}
        onSendMessage={handleSendMessage}
        onExecutePlan={handleExecuteAIPlan}
        onRevertLastAISession={handleRevertLastAISession}
        canRevert={aiHistorySessions.length > 0}
        onClearChat={handleClearAIChat}
        onStartNewChat={handleClearAIChat}
        onRestoreSessionContext={handleRestoreAISessionContext}
        registeredAssets={registeredAssets}
        onUploadAssets={handleUploadAIAssets}
        activeScriptText={activeScriptText}
        activeSrtText={activeSrtText}
        currentStyle={currentEditingStyle}
        onSelectStyle={(s) => setCurrentEditingStyle(s)}
        customStyles={customStyles}
        onSaveCustomStyle={(s) => setCustomStyles((prev) => [...prev, s])}
        isExecuting={isAIExecuting}
        activeActivityStep={aiActivityStepText}
        onRunAssemblerSkill={async (options) => {
          if (options.aspectRatio) {
            setAspectRatio(options.aspectRatio);
          }
          if (typeof options.autoDucking === 'boolean') {
            setIsAutoDuckingActive(options.autoDucking);
          }
          if (typeof options.autoKenBurns === 'boolean') {
            setIsAutoKenBurnsActive(options.autoKenBurns);
            setVideoClips((clips) => applyAutoKenBurnsToClips(clips, options.autoKenBurns!));
          }
          if (activeMatchingSession && activeMatchingSession.matches.length > 0) {
            await handleApproveAndPlaceMatches(activeMatchingSession.matches);
          } else {
            handleSendMessage(`Assemble my video in ${options.aspectRatio} aspect ratio`);
          }
        }}
        timelineState={{
          videoClips,
          audioClips,
          captions,
          overlays,
          aspectRatio,
          currentTime,
          registeredAssets,
          selectedClipId,
          projectName: currentProjectTitle,
        }}
      />

      {/* AI Visual/Audio Matching Review & Approval Modal */}
      <VisualMatchingReviewModal
        isOpen={isMatchingReviewOpen}
        onClose={() => setIsMatchingReviewOpen(false)}
        session={activeMatchingSession}
        onSwapBeat={handleSwapVisualBeat}
        onApproveAndPlace={handleApproveAndPlaceMatches}
        availableAssets={registeredAssets}
        onRegisterAsset={(newAsset) => {
          setRegisteredAssets((prev) => {
            if (!prev.some((a) => a.id === newAsset.id)) {
              return [newAsset, ...prev];
            }
            return prev;
          });
        }}
        isPlacing={isPlacingMatches}
        placementProgressText={placingProgressText}
      />
    </div>
  );
}
