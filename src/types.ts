export type MediaType = 'video' | 'image' | 'audio' | 'text' | 'overlay';

export type TransitionType = 
  | 'dissolve'
  | 'fade-black'
  | 'flash'
  | 'zoom-in'
  | 'zoom-out'
  | 'whip-pan-left'
  | 'whip-pan-right'
  | 'spin-cw'
  | 'spin-ccw'
  | 'glitch'
  | 'rgb-split'
  | 'vhs-noise'
  | 'light-leak'
  | 'film-burn'
  | 'lens-flare'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'blur-fade'
  | 'swirl';

export interface Transition {
  id: string;
  type: TransitionType;
  name: string;
  duration: number; // in seconds (0.1 to 3.0)
  soundEffect?: string; // e.g. 'swoosh', 'glitch-hit', 'riser', 'none'
}

export interface Keyframe {
  id: string;
  time: number; // time in seconds relative to start of clip/element
  scale?: number; // 0.5 to 3.0 (default: 1.0)
  x?: number; // % pan X (-100 to 100)
  y?: number; // % pan Y (-100 to 100)
  rotation?: number; // degrees (-180 to 180)
  opacity?: number; // 0 to 1
  volume?: number; // 0 to 100
}

export interface ColorAdjustments {
  brightness: number; // -100 to 100 (default 0)
  contrast: number; // -100 to 100 (default 0)
  saturation: number; // -100 to 100 (default 0)
  exposure: number; // -100 to 100 (default 0)
  temperature: number; // -100 to 100 (default 0)
  tint: number; // -100 to 100 (default 0)
  vignette: number; // 0 to 100 (default 0)
  sharpen: number; // 0 to 100 (default 0)
  grain: number; // 0 to 100 (default 0)
}

export type FilterPreset =
  | 'none'
  | 'oppenheimer'
  | 'cinematic-teal'
  | 'kodak-vintage'
  | 'dark-noir'
  | 'golden-hour'
  | 'bleach-bypass'
  | 'cyberpunk'
  | 'forest-mood'
  | 'vhs-retro';

export interface SpeedCurvePoint {
  timeRatio: number; // 0.0 to 1.0 (relative position in clip)
  speedMultiplier: number; // 0.1 to 10.0
}

export type SpeedCurvePreset =
  | 'normal'
  | 'montage'
  | 'hero'
  | 'bullet'
  | 'jump-cut'
  | 'flash-in'
  | 'flash-out'
  | 'custom';

export interface SpeedSettings {
  mode: 'normal' | 'curve';
  normalSpeed: number; // 0.1 to 100x
  curvePreset: SpeedCurvePreset;
  curvePoints: SpeedCurvePoint[];
  smoothSlowMo: boolean; // Optical Flow / Frame Blending
  pitchCorrection: boolean; // Keep voice pitch natural
}

export interface VideoClip {
  id: string;
  title: string;
  type: 'video' | 'image';
  color: string;
  url?: string;
  file?: File;
  thumbnailUrl: string;
  frames: string[];
  duration: number; // duration on timeline in seconds (duration = sourceOut - sourceIn)
  startOffset: number; // start trim inside raw media
  rawDuration: number; // total source length
  sourceIn?: number; // start timestamp within raw source asset
  sourceOut?: number; // end timestamp within raw source asset
  timelineStart?: number; // position start on timeline in seconds
  timelineEnd?: number; // position end on timeline in seconds
  assetId?: string; // origin source asset ID
  sourceAssetId?: string;
  sourceStartSecond?: number;
  sourceEndSecond?: number;
  timelineStartSecond?: number;
  timelineEndSecond?: number;
  sceneId?: string;
  trackId?: string; // main-video-track or secondary track
  status?: 'ready' | 'loading' | 'error';
  volume: number; // 0 to 100
  speed: number; // 0.1 to 100
  speedSettings?: SpeedSettings;
  transitionAfter?: Transition;
  effects?: string[];
  aspectFit?: 'cover' | 'contain' | 'fill';
  keyframes?: Keyframe[];
  adjustments?: ColorAdjustments;
  filterPreset?: FilterPreset;
  videoEffects?: VideoEffectPreset[];
  blendMode?: BlendMode;
  mask?: ShapeMaskConfig;
  chromaKey?: {
    enabled: boolean;
    color: string; // hex color or preset 'green' | 'blue' | 'custom'
    intensity: number; // 0 to 100
    shadow: number; // 0 to 100
    feather?: number; // 0 to 100
  };
  cutout?: {
    enabled: boolean;
    mode: 'auto-cutout' | 'chroma-key' | 'custom-mask';
    strokeColor?: string; // e.g. '#00ffcc' neon outline
    strokeWidth?: number; // 0 to 20
    backdrop?: 'transparent' | 'blur' | 'cyberpunk-city' | 'studio-gradient' | 'outer-space' | 'custom-color';
    backdropColor?: string;
  };
  backgroundBlur?: number;
  kenBurns?: {
    enabled: boolean;
    mode: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
    startScale: number;
    endScale: number;
    startX?: number;
    endX?: number;
    startY?: number;
    endY?: number;
  };
}

export type VideoEffectPreset =
  | 'rgb-split'
  | 'vhs-retro'
  | 'neon-edge'
  | 'film-grain-8mm'
  | 'prism-flare'
  | 'lightning-aura'
  | 'cyber-eyes'
  | 'crt-scanlines'
  | 'thermal-vision'
  | 'hologram'
  | 'body-clone'
  | 'bokeh-particles';

export interface CaptionClip {
  id: string;
  text: string;
  startTime: number; // in seconds from 0
  duration: number; // in seconds
  stylePreset: 'hormozi' | 'documentary' | 'bold-stroke' | 'karaoke' | 'minimal';
  highlightWordIndex?: number;
  keyframes?: Keyframe[];
}

export type VoiceEffect =
  | 'none'
  | 'deep-narrator'
  | 'chipmunk'
  | 'robot'
  | 'megaphone'
  | 'studio-mic'
  | 'echo-cave'
  | 'radio-vintage'
  | 'telephone';

export type TTSVoice =
  | 'adam-documentary'
  | 'rachel-storyteller'
  | 'marcus-deep-viral'
  | 'olivia-calm-british'
  | 'charlie-energetic'
  | 'serena-meditation';

export interface BeatMarker {
  time: number; // timestamp in seconds
  isDownbeat: boolean; // primary 1st beat of bar (red vs yellow)
  intensity?: number; // 0.0 - 1.0 (transient peak)
}

export interface BeatDetectionConfig {
  bpm: number;
  offset: number; // in seconds
  autoDetectMode: 'dynamic-transient' | 'fixed-tempo' | 'chill-half' | 'hype-double';
  snappingEnabled: boolean;
}

export interface AudioTrackClip {
  id: string;
  title: string;
  artist?: string;
  category?: 'music' | 'voiceover' | 'sfx';
  url?: string;
  file?: File;
  duration: number; // in seconds
  startTime: number; // in seconds
  volume: number; // 0 to 100
  voiceEffect?: VoiceEffect;
  ttsVoice?: TTSVoice;
  transcript?: string;
  speechSegments?: { text?: string; start: number; end: number; duration: number }[];
  speechIntervals?: { start: number; end: number; duration: number; isSilence?: boolean }[];
  waveformData: number[]; // normalized peaks 0.0 - 1.0
  beatMarkers?: (number | BeatMarker)[]; // timestamps or structured beats
  beatConfig?: BeatDetectionConfig;
  keyframes?: Keyframe[];
  assetId?: string;
  sourceAssetId?: string;
  trackIndex?: number; // 1: Voiceover, 2: BGM, 3: SFX
  isLooping?: boolean;
  duckingConfig?: {
    enabled: boolean;
    duckToPercent?: number;
    pauseSwellPercent?: number;
    pauseThresholdSec?: number;
    rampMs?: number;
  };
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export type ShapeMaskType =
  | 'none'
  | 'rectangle'
  | 'circle'
  | 'heart'
  | 'star'
  | 'filmstrip'
  | 'split-horizontal'
  | 'split-vertical'
  | 'linear-wipe';

export interface ShapeMaskConfig {
  type: ShapeMaskType;
  size: number; // 10 to 100 (% scale of mask)
  feather: number; // 0 to 100 (blur/softness)
  roundness: number; // 0 to 100 (corner radius for rect/star)
  rotation: number; // -180 to 180 deg
  inverted: boolean;
  x?: number; // center offset %
  y?: number; // center offset %
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'metric' | 'progress';
export type ChartTheme = 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose' | 'monochrome';

export interface ChartConfig {
  type: ChartType;
  title: string;
  subtitle?: string;
  data: ChartDataPoint[];
  theme: ChartTheme;
  showBackground: boolean;
  backgroundStyle?: 'glass' | 'solid' | 'transparent';
  unit?: string;
  prefix?: string;
  trendText?: string;
  animated?: boolean;
}

export interface OverlayClip {
  id: string;
  title: string;
  thumbnailUrl: string;
  startTime: number;
  duration: number;
  type: 'b-roll' | 'sticker' | 'motion-graphic' | 'chart';
  opacity: number;
  blendMode?: BlendMode;
  mask?: ShapeMaskConfig;
  chartConfig?: ChartConfig;
  transform?: {
    x: number; // % offset
    y: number; // % offset
    scale: number; // 0.2 to 3.0
    rotation: number; // deg
  };
  keyframes?: Keyframe[];
}

export type ActiveTool = 
  | 'root'
  | 'edit'
  | 'audio'
  | 'text'
  | 'overlay'
  | 'effects'
  | 'filters'
  | 'ratio'
  | 'adjust'
  | 'chart';

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

// ==========================================
// AI CONVERSATIONAL EDITING SYSTEM TYPES
// ==========================================

export interface ProjectAsset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio' | 'text';
  category?: 'music' | 'voiceover' | 'sfx';
  url: string;
  duration: number; // in seconds
  width?: number;
  height?: number;
  thumbnailUrl: string;
  uploadedAt: number;
  createdAt?: number;
  file?: File;
  size?: number; // in bytes
  textContent?: string;
  tags?: string[];
  rankingIndex?: number; // e.g. ranking clip #5, #4, etc.
  sourceRange?: { start: number; end: number };
  waveformData?: number[];
  analysis?: {
    transcript?: string;
    description?: string;
    dominantMood?: string;
    dominantColor?: string;
    brightness?: string;
    isActionShot?: boolean;
    energy?: 'calm' | 'medium' | 'high';
    speechIntervals?: { start: number; end: number; duration: number; isSilence?: boolean }[];
    speechSegments?: { text?: string; start: number; end: number; duration: number }[];
  };
}

export type AICommandType =
  | 'ADD_CLIP'
  | 'REMOVE_CLIP'
  | 'MOVE_CLIP'
  | 'TRIM_CLIP'
  | 'SPLIT_CLIP'
  | 'REPLACE_CLIP'
  | 'ADD_TEXT'
  | 'EDIT_TEXT'
  | 'ADD_CAPTION'
  | 'REMOVE_CAPTION'
  | 'CLEAR_CAPTIONS'
  | 'ADD_AUDIO'
  | 'ADD_SFX'
  | 'ADD_TRANSITION'
  | 'REMOVE_TRANSITION'
  | 'CLEAR_TRANSITIONS'
  | 'ADD_EFFECT'
  | 'ADD_FILTER'
  | 'ADD_KEYFRAME'
  | 'SET_VOLUME'
  | 'SET_OPACITY'
  | 'SET_SPEED'
  | 'SET_POSITION'
  | 'SET_SCALE'
  | 'SET_ROTATION'
  | 'REMOVE_DEAD_SPACE'
  | 'CHANGE_DURATION'
  | 'APPLY_COLOR_GRADE'
  | 'APPLY_MASK';

export interface AIEditCommand {
  id: string;
  type: AICommandType;
  description: string;
  targetId?: string; // Clip ID, Audio ID, Caption ID, or Overlay ID
  targetType?: 'video' | 'image' | 'audio' | 'caption' | 'overlay';
  payload: Record<string, any>;
  status?: 'pending' | 'executing' | 'applied' | 'failed';
  errorMessage?: string;
}

export interface PhraseBreakdownItem {
  id: string;
  phraseIndex: number;
  text: string;
  startTime: number;
  duration: number;
  suggestedVisual: string;
  matchedAssetId?: string;
  matchedAssetName?: string;
  matchedThumbnail?: string;
  isMissingVisual?: boolean;
  missingVisualReason?: string;
  matchJustification?: string; // Clear explanation of why this image was chosen based on visual content vs narration
  matchScore?: number; // 0.0 - 1.0 confidence score of literal visual match
  extractedKeywords?: string[]; // Core action, object, and scene keywords identified in narration
  captionText?: string;
  rankingNumber?: number;
  fullSentence?: string;
  isMultiActionInSentence?: boolean;
  sfx?: string;
  transition?: TransitionType;
  keyframeZoom?: boolean;
  instruction?: string;
}

export interface AIEditPlan {
  id: string;
  title: string;
  projectType: string;
  description: string;
  aspectRatio: AspectRatio;
  narrationDuration: number;
  audioDuration: number;
  audioMasterFile?: string;
  visualAssetCount: number;
  missingVisualCount: number;
  plannedVisualBeats: number;
  captions: boolean;
  deadSpaceRemoval: boolean;
  music: boolean;
  sfx: boolean;
  transitions: 'none' | 'minimal' | 'energetic' | 'cinematic';
  pacing: 'slow' | 'medium' | 'fast' | 'dynamic';
  stylePreset: string;
  breakdown: PhraseBreakdownItem[];
  commands: AIEditCommand[];
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled';
  createdAt: number;
}

export interface EditingStyle {
  id: string;
  name: string;
  isCustom: boolean;
  description: string;
  rules: {
    visualPacing: 'phrase-by-phrase' | 'sentence' | 'fixed-fast' | 'cinematic-slow';
    stillImageMotion: 'slow-zoom' | 'ken-burns' | 'static' | 'pan' | 'punch-in';
    captionStyle: 'hormozi' | 'documentary' | 'bold-stroke' | 'karaoke' | 'minimal';
    transitionPolicy: 'topic-change-only' | 'every-clip' | 'minimal' | 'energetic' | 'none';
    sfxPolicy: 'key-moments-only' | 'ranking-reveals' | 'whoosh-transitions' | 'none';
    rankingStyle?: {
      showBigNumbers: boolean;
      numberPosition: 'top-left' | 'center' | 'bottom-right';
      soundOnReveal: boolean;
    };
    customDirectives?: string[];
  };
}

export interface TimelineVerificationReport {
  overallStatus: 'COMPLETED' | 'INCOMPLETE' | 'FAILED';
  projectDuration: number;
  audioDuration: number;
  audioCovered: boolean;
  audioCoverageDiff?: number;
  aspectRatio: {
    requested?: AspectRatio;
    actual: AspectRatio;
    matched: boolean;
    error?: string;
  };
  videoClipsPlaced: number;
  imageClipsPlaced: number;
  totalVisualsPlaced: number;
  availableVisualAssets: number;
  assetsActuallyUsed: number;
  assetsUnused: number;
  requestedAssetsPlaced?: {
    name: string;
    placed: boolean;
  }[];
  captionSegments: number;
  captionTrackDuration: number;
  captionAudioCoveragePercent: number;
  sfxPlaced: number;
  overlaysPlaced: number;
  requestedChangesCompleted: {
    task: string;
    completed: boolean;
    note?: string;
  }[];
  discrepancies: string[];
  warnings: string[];
  verifiedAt: number;
  // Backward compatibility fields
  placedVisuals?: number;
  totalVisuals?: number;
  synchronizedAudio?: boolean;
  actualAudioDuration?: number;
  timelineDuration?: number;
  captionsAdded?: number;
  missingVisualsReported?: number;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachedAssets?: ProjectAsset[];
  attachedScript?: string;
  attachedSrt?: string;
  editPlan?: AIEditPlan;
  recapPlan?: any;
  commands?: AIEditCommand[];
  verificationSummary?: TimelineVerificationReport;
  status?: 'idle' | 'analyzing' | 'planning' | 'executing' | 'done' | 'error';
  activityStep?: string;
  assemblerSkill?: {
    voiceoverName?: string;
    voiceoverDuration?: number;
    hasVoiceover: boolean;
    imageCount: number;
    scriptBeatCount: number;
    srtCueCount: number;
    status: 'ready' | 'assembling' | 'completed';
    completedClips?: number;
    timelineDuration?: number;
    currentStep?: string;
    aspectRatio?: AspectRatio;
  };
}

export interface AIHistorySession {
  id: string;
  timestamp: number;
  description: string;
  snapshot: {
    videoClips: VideoClip[];
    audioClips: AudioTrackClip[];
    captionClips: CaptionClip[];
    overlayClips: OverlayClip[];
  };
}

export type AppScreen = 'home' | 'editor' | 'chart';

export interface ChartChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  chart?: ChartConfig | null;
}

export interface ChartSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChartChatMessage[];
  activeChart?: ChartConfig | null;
}

export type HomeNavTab = 'edit' | 'templates' | 'ailab' | 'projects' | 'inbox' | 'me';

export interface ProjectItem {
  id: string;
  name: string;
  thumbnailUrl: string;
  aspectRatio: AspectRatio;
  duration: number; // total seconds
  lastEdited: number; // timestamp
  resolution: string; // e.g. "1080P", "4K", "720P"
  fps: number; // e.g. 60, 30
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captionClips: CaptionClip[];
  overlayClips: OverlayClip[];
  captions?: CaptionClip[];
  overlays?: OverlayClip[];
  registeredAssets?: ProjectAsset[];
  category?: string;
  isFavorite?: boolean;
  sizeBytes?: number;
}

export interface TemplatePreset {
  id: string;
  title: string;
  category: 'trending' | 'countdown' | 'talking-head' | 'cinematic' | 'vlog' | 'gaming' | 'business' | 'shorts' | 'movie-recap';
  thumbnailUrl: string;
  previewVideoUrl?: string;
  duration: number;
  aspectRatio: AspectRatio;
  usesCount: string;
  creator: {
    name: string;
    avatarUrl: string;
    badge?: string;
  };
  audioTrackName: string;
  description: string;
  tags: string[];
  videoClips?: VideoClip[];
  audioClips?: AudioTrackClip[];
  captionClips?: CaptionClip[];
  captions?: CaptionClip[];
  overlayClips?: OverlayClip[];
  overlays?: OverlayClip[];
  templateData: {
    videoClips: VideoClip[];
    audioClips: AudioTrackClip[];
    captionClips: CaptionClip[];
    overlayClips: OverlayClip[];
  };
}

export interface ZipImportResult {
  assets: ProjectAsset[];
  scriptText?: string;
  captions?: CaptionClip[];
  videoClips?: VideoClip[];
  audioClips?: AudioTrackClip[];
  overlays?: OverlayClip[];
  zipSummaries?: {
    zipName: string;
    count: number;
    breakdown: string;
  }[];
}

export interface QuickToolItem {
  id: string;
  name: string;
  description: string;
  iconName: string;
  badge?: 'AI' | 'PRO' | 'HOT' | 'NEW';
  category: 'ai' | 'audio' | 'video' | 'effects';
  color: string;
  actionKey: string;
}

export type MovieRecapFileType = 'video' | 'voiceover' | 'script' | 'cut_guide' | 'timing_data' | 'unknown';

export interface MovieRecapSceneCut {
  id: string;
  sceneIndex: number;
  title?: string;
  description?: string;
  narrationText?: string;
  videoStartTime?: number;
  videoEndTime?: number;
  duration: number;
  voiceoverStartTime?: number;
  voiceoverEndTime?: number;
  transition?: TransitionType;
  motionEffect?: 'slow-zoom' | 'ken-burns' | 'pan-right' | 'punch-in' | 'static';
  sfx?: string;
  matchedAssetId?: string;
  matchedAssetName?: string;
  thumbnailUrl?: string;
  confidence?: number;
}

export interface MovieRecapImportedFile {
  id: string;
  name: string;
  size: number;
  type: MovieRecapFileType;
  file?: File;
  url?: string;
  rawContent?: string;
  parsedData?: {
    scenes?: MovieRecapSceneCut[];
    scriptText?: string;
    duration?: number;
    wordTimestamps?: { word: string; start: number; end: number }[];
    sentenceTimestamps?: { text: string; start: number; end: number }[];
  };
}

export interface MovieRecapProjectValidation {
  hasVideo: boolean;
  hasVoiceover: boolean;
  hasScript: boolean;
  hasCutGuide: boolean;
  hasTimingData: boolean;
  videoFiles: MovieRecapImportedFile[];
  voiceoverFiles: MovieRecapImportedFile[];
  scriptFiles: MovieRecapImportedFile[];
  cutGuideFiles: MovieRecapImportedFile[];
  timingFiles: MovieRecapImportedFile[];
  otherFiles: MovieRecapImportedFile[];
  canContinue: boolean;
  missingNotice?: string;
  readinessStatus: string;
}

export type MovieRecapEditMode = 'auto' | 'manual-review' | 'manual-edit';
export type MovieRecapPacingMode = 'shortform' | 'longform' | 'custom';

// ==========================================
// CENTRAL SHARED TIMELINE OPERATION ENGINE
// ==========================================

export type TimelineOperationType =
  | 'import_media'
  | 'create_video_clip'
  | 'create_recap_clip'
  | 'create_audio_clip'
  | 'create_image_clip'
  | 'split_clip'
  | 'trim_clip'
  | 'move_clip'
  | 'delete_clip'
  | 'duplicate_clip'
  | 'replace_clip'
  | 'reorder_clips'
  | 'resize_clip'
  | 'crop_clip'
  | 'rotate_clip'
  | 'set_clip_speed'
  | 'reverse_clip'
  | 'freeze_frame'
  | 'set_volume'
  | 'mute_clip'
  | 'fade_audio'
  | 'add_voiceover'
  | 'add_background_music'
  | 'add_sound_effect'
  | 'duck_music_under_voice'
  | 'remove_silence'
  | 'detect_scenes'
  | 'add_text'
  | 'add_title'
  | 'add_caption'
  | 'add_subtitle'
  | 'remove_caption'
  | 'clear_captions'
  | 'add_transition'
  | 'remove_transition'
  | 'clear_transitions'
  | 'add_effect'
  | 'add_filter'
  | 'add_zoom'
  | 'add_pan'
  | 'add_overlay'
  | 'add_sticker'
  | 'add_image_overlay'
  | 'add_video_overlay'
  | 'add_mask'
  | 'add_blur'
  | 'add_background'
  | 'change_aspect_ratio'
  | 'change_canvas_size'
  | 'align_to_narration'
  | 'create_highlight'
  | 'render_preview'
  | 'save_project'
  | 'undo'
  | 'redo'
  | 'export_video';

export interface FullTimelineSnapshot {
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captions: CaptionClip[];
  overlays: OverlayClip[];
  aspectRatio?: AspectRatio;
}

export interface TimelineOperation {
  id: string;
  type: TimelineOperationType;
  description: string;
  targetId?: string;
  targetTrack?: 'video' | 'b-roll' | 'audio' | 'voiceover' | 'music' | 'sfx' | 'captions' | 'text' | 'overlay' | 'effects';
  parameters: Record<string, any>;
  timestamp?: number;
}

export interface OperationResult {
  success: boolean;
  operationId: string;
  operationType: TimelineOperationType;
  message: string;
  error?: string;
  affectedClipIds?: string[];
  undoableSnapshot?: any;
}

export interface BatchOperationResult {
  success: boolean;
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  results: OperationResult[];
  summary: string;
}

export interface TimelineState {
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captions: CaptionClip[];
  overlays: OverlayClip[];
  aspectRatio: AspectRatio;
  currentTime: number;
  registeredAssets: ProjectAsset[];
  selectedClipId?: string | null;
  selectedAudioId?: string | null;
  selectedCaptionId?: string | null;
  selectedOverlayId?: string | null;
  projectId?: string;
  projectName?: string;
  projectVersion?: number;
}

export type AIEditorMode = 'general' | 'recapgen';

export type AIStatusState =
  | 'reading_project'
  | 'reading_instruction'
  | 'analyzing_media'
  | 'planning_edit'
  | 'waiting_confirmation'
  | 'applying_edits'
  | 'updating_timeline'
  | 'saving_project'
  | 'rendering_preview'
  | 'ready'
  | 'error';

export interface CreativePlan {
  format: string; // e.g. "YouTube Shorts (9:16 vertical)"
  targetDuration: string; // e.g. "45s"
  editingStyle: string; // e.g. "Fast-paced punchy"
  selectedSections: string[];
  audioTreatment: string;
  captionTreatment: string;
  textAndEffects: string[];
  exportFormat: string;
  operations: TimelineOperation[];
}

export interface RecapScenePlanItem {
  sceneId: string;
  sourceAssetId: string;
  sourceAssetName?: string;
  sourceIn: number;
  sourceOut: number;
  timelineStart: number;
  timelineEnd: number;
  narrationStart: number;
  narrationEnd: number;
  narrationText: string;
  sceneDescription: string;
  confidence: number;
  status: 'planned' | 'matched' | 'partially-matched' | 'unresolved';
  warning?: string;
  thumbnailUrl?: string;
  transition?: TransitionType;
  motionEffect?: 'slow-zoom' | 'ken-burns' | 'pan-right' | 'punch-in' | 'static';
}

export interface RecapActionPlan {
  id: string;
  title: string;
  totalScenes: number;
  totalMovieSourceDurationUsed: number;
  finalRecapDuration: number;
  voiceoverDuration: number;
  captionCount: number;
  musicTracksCount: number;
  sfxCount: number;
  unresolvedScenesCount: number;
  warnings: string[];
  exportAspectRatio: AspectRatio;
  scenes: RecapScenePlanItem[];
  operations: TimelineOperation[];
}

