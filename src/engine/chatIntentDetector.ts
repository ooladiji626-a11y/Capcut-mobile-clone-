import { AspectRatio, ProjectAsset, VideoClip, AudioTrackClip, CaptionClip, OverlayClip, AIChatMessage } from '../types';

export type ChatIntentType =
  | 'CHAT'
  | 'EDIT_COMMAND'
  | 'NEEDS_CLARIFICATION'
  | 'NORMAL_CHAT'       // Backward compatibility alias for CHAT
  | 'EXPLICIT_COMMAND'  // Backward compatibility alias for EDIT_COMMAND
  | 'AMBIGUOUS';        // Backward compatibility alias for NEEDS_CLARIFICATION

export type ExplicitActionType =
  | 'CLEAR_ASSETS'
  | 'CLEAR_TIMELINE'
  | 'DELETE_EVERYTHING'
  | 'DELETE_CLIP'
  | 'DELETE_SELECTED_CLIP'
  | 'REMOVE_AUDIO'
  | 'ADD_IMAGE'
  | 'ADD_VIDEO_CLIP'
  | 'MOVE_CLIP'
  | 'SET_CLIP_DURATION'
  | 'TRIM_CLIP'
  | 'UNDO'
  | 'REDO'
  | 'CLEAR_CAPTIONS'
  | 'REMOVE_CAPTIONS'
  | 'CLEAR_TRANSITIONS'
  | 'CHANGE_ASPECT_RATIO'
  | 'REMOVE_SILENCE'
  | 'DUCK_MUSIC'
  | 'ADD_CAPTIONS'
  | 'ADD_BACKGROUND_MUSIC'
  | 'REORDER_CLIPS'
  | 'SPLIT_CLIP'
  | 'DUPLICATE_CLIP'
  | 'ADD_OVERLAY'
  | 'ADD_KEYFRAMES'
  | 'SLOW_ZOOM'
  | 'BUILD_RECAP'
  | 'AUTO_EDIT_PLAN'
  | 'MATCH_VISUALS_TO_AUDIO'
  | 'SHOW_VISUAL_MATCHES'
  | 'SWAP_VISUAL_BEAT'
  | 'APPROVE_VISUAL_MATCHES'
  | 'TRIGGER_ASSEMBLER'
  | 'RUN_ASSEMBLER'
  | 'ADD_SFX'
  | 'FADE_OUT_AUDIO'
  | 'UNSUPPORTED_ACTION';

export const AUTHORITATIVE_ACTIONS: ExplicitActionType[] = [
  'CLEAR_TIMELINE',
  'CLEAR_ASSETS',
  'DELETE_EVERYTHING',
  'DELETE_SELECTED_CLIP',
  'DELETE_CLIP',
  'DUPLICATE_CLIP',
  'ADD_OVERLAY',
  'ADD_KEYFRAMES',
  'SLOW_ZOOM',
  'ADD_CAPTIONS',
  'REMOVE_CAPTIONS',
  'CLEAR_CAPTIONS',
  'SPLIT_CLIP',
  'MOVE_CLIP',
  'TRIM_CLIP',
  'SET_CLIP_DURATION',
  'REMOVE_AUDIO',
  'ADD_IMAGE',
  'ADD_VIDEO_CLIP',
  'CHANGE_ASPECT_RATIO',
  'REMOVE_SILENCE',
  'DUCK_MUSIC',
  'ADD_BACKGROUND_MUSIC',
  'ADD_SFX',
  'FADE_OUT_AUDIO',
  'CLEAR_TRANSITIONS',
  'REORDER_CLIPS',
  'BUILD_RECAP',
  'AUTO_EDIT_PLAN',
  'MATCH_VISUALS_TO_AUDIO',
  'SHOW_VISUAL_MATCHES',
  'SWAP_VISUAL_BEAT',
  'APPROVE_VISUAL_MATCHES',
  'TRIGGER_ASSEMBLER',
  'RUN_ASSEMBLER',
  'UNDO',
  'REDO',
  'UNSUPPORTED_ACTION',
];

export function resolveExactActionIdentifier(text: string): ExplicitActionType | null {
  const normalized = text.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (
    normalized === 'CLEAR_ASSET_BIN' ||
    normalized === 'EMPTY_ASSET_BIN' ||
    normalized === 'CLEAR_MEDIA_BIN' ||
    normalized === 'EMPTY_MEDIA_BIN' ||
    normalized === 'DELETE_ASSET_BIN' ||
    normalized === 'REMOVE_ASSET_BIN' ||
    normalized === 'CLEAR_MEDIA' ||
    normalized === 'DELETE_ALL_ASSETS' ||
    normalized === 'REMOVE_ALL_ASSETS'
  ) {
    return 'CLEAR_ASSETS';
  }
  const found = AUTHORITATIVE_ACTIONS.find((act) => act === normalized);
  return found || null;
}

export interface CommandCondition {
  field: 'duration' | 'type' | 'volume' | 'startTime' | 'text' | string;
  operator: '<' | '<=' | '>' | '>=' | '==' | '!=' | 'contains' | string;
  value: number | string;
  rawDescription: string;
}

export interface DetectedCommandAction {
  actionType: ExplicitActionType;
  target?: 'SELECTED_CLIP' | 'TIMELINE' | 'ASSETS' | 'AUDIO_TRACK' | 'CAPTIONS' | 'TRANSITIONS' | 'SPECIFIC_CLIP' | 'PLAYHEAD' | 'OVERLAY' | 'KEYFRAMES' | string;
  targetId?: string;
  targetIndex?: number;
  condition?: CommandCondition;
  parameters?: {
    targetSeconds?: number;
    duration?: number;
    aspectRatio?: AspectRatio;
    clipIndex?: number;
    clipId?: string;
    volume?: number;
    threshold?: number;
    text?: string;
    effect?: string;
    isCorrection?: boolean;
    isMoveToOverlay?: boolean;
    beatLabel?: string;
    assetName?: string;
    time?: number;
    beatIndex?: number;
    sfxType?: string;
  };
}

export interface DetectedChatIntent {
  type: 'CHAT' | 'EDIT_COMMAND' | 'NEEDS_CLARIFICATION' | 'NORMAL_CHAT' | 'EXPLICIT_COMMAND' | 'AMBIGUOUS';
  actionType?: ExplicitActionType;
  target?: 'SELECTED_CLIP' | 'TIMELINE' | 'ASSETS' | 'AUDIO_TRACK' | 'CAPTIONS' | 'TRANSITIONS' | 'SPECIFIC_CLIP' | 'PLAYHEAD' | 'OVERLAY' | 'KEYFRAMES' | string;
  targetId?: string;
  targetIndex?: number;
  condition?: CommandCondition;
  actions?: DetectedCommandAction[];
  clarificationQuestion?: string;
  conversationalReply?: string;
  parameters?: {
    targetSeconds?: number;
    duration?: number;
    aspectRatio?: AspectRatio;
    clipIndex?: number;
    clipId?: string;
    volume?: number;
    threshold?: number;
    text?: string;
    effect?: string;
    isCorrection?: boolean;
    isMoveToOverlay?: boolean;
    beatLabel?: string;
    assetName?: string;
  };
  reasoning: string;
}

export interface EditorContextSnapshot {
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captions: CaptionClip[];
  overlays: OverlayClip[];
  registeredAssets?: ProjectAsset[];
  selectedClipId: string | null;
  aspectRatio: AspectRatio;
  currentTime: number;
  attachedScript?: string;
}

// =============================================================================
// HELPER: Extract numbers or time in seconds from text
// =============================================================================
function extractSeconds(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:seconds|second|secs|sec|s\b)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  const digitMatch = text.match(/\b(?:at|to|for|make it)\s*(\d+(?:\.\d+)?)\b/i);
  if (digitMatch) {
    return parseFloat(digitMatch[1]);
  }
  return null;
}

// =============================================================================
// HELPER: Parse conditional statements (Section 6: Conditional Commands)
// e.g. "Delete the selected clip if it's shorter than 2 seconds"
// =============================================================================
export function parseCommandCondition(text: string): CommandCondition | undefined {
  const lower = text.toLowerCase();
  if (!lower.includes('if ')) {
    return undefined;
  }

  // Duration condition: "if shorter than 2s" / "if it's less than 2 seconds" / "if duration < 2"
  const shorterMatch = lower.match(/if\s+(?:it(?:'s|\s+is)?\s+)?(?:shorter\s+than|less\s+than|<)\s*(\d+(?:\.\d+)?)\s*(?:seconds|second|secs|sec|s\b)?/i);
  if (shorterMatch) {
    const val = parseFloat(shorterMatch[1]);
    return {
      field: 'duration',
      operator: '<',
      value: val,
      rawDescription: `duration < ${val} seconds`,
    };
  }

  // Duration condition: "if longer than 5s" / "if greater than 5 seconds"
  const longerMatch = lower.match(/if\s+(?:it(?:'s|\s+is)?\s+)?(?:longer\s+than|greater\s+than|more\s+than|>)\s*(\d+(?:\.\d+)?)\s*(?:seconds|second|secs|sec|s\b)?/i);
  if (longerMatch) {
    const val = parseFloat(longerMatch[1]);
    return {
      field: 'duration',
      operator: '>',
      value: val,
      rawDescription: `duration > ${val} seconds`,
    };
  }

  // Silence condition: "if it has silence" / "if silent"
  if (lower.includes('if it has silence') || lower.includes('if there is silence') || lower.includes('if silent')) {
    return {
      field: 'silence',
      operator: '>',
      value: 0.8,
      rawDescription: 'silence > 0.8 seconds',
    };
  }

  // Generic fallback for any other "if <condition>"
  const genericIf = text.match(/\bif\s+([^,.;]+)/i);
  if (genericIf) {
    return {
      field: 'custom',
      operator: '==',
      value: genericIf[1].trim(),
      rawDescription: genericIf[1].trim(),
    };
  }

  return undefined;
}

// =============================================================================
// HELPER: Context Awareness & Reference Resolution (Section 4)
// Resolves references like "this clip", "selected image", "clip 2", "the audio track"
// =============================================================================
export interface ResolvedClipTarget {
  resolved: boolean;
  target?: 'SELECTED_CLIP' | 'SPECIFIC_CLIP' | 'SINGLE_CLIP' | 'LAST_ADDED';
  clipId?: string;
  clipIndex?: number;
  ambiguityReason?: 'NO_SELECTION_MULTIPLE_CLIPS' | 'NO_CLIPS_ON_TIMELINE' | 'INDEX_OUT_OF_BOUNDS';
}

export function resolveClipTarget(
  text: string,
  snapshot: EditorContextSnapshot
): ResolvedClipTarget {
  const lower = text.toLowerCase();

  // 1. Explicit numerical index (e.g. "clip 2", "clip 7", "2nd clip", "second clip", "clip #1")
  const indexMatch = lower.match(/(?:clip\s*(?:#)?\s*(\d+)|(\d+)(?:st|nd|rd|th)\s*clip)/i);
  if (indexMatch) {
    const rawIdx = parseInt(indexMatch[1] || indexMatch[2], 10);
    const clipIndex = rawIdx - 1; // 0-indexed
    if (clipIndex >= 0 && clipIndex < snapshot.videoClips.length) {
      return {
        resolved: true,
        target: 'SPECIFIC_CLIP',
        clipIndex,
        clipId: snapshot.videoClips[clipIndex].id,
      };
    } else {
      return {
        resolved: false,
        ambiguityReason: 'INDEX_OUT_OF_BOUNDS',
        clipIndex,
      };
    }
  }

  // 2. Word-based index (e.g. "first clip", "second clip", "last clip")
  if (lower.includes('first clip') || lower.includes('clip one') || lower.includes('initial clip')) {
    if (snapshot.videoClips.length > 0) {
      return {
        resolved: true,
        target: 'SPECIFIC_CLIP',
        clipIndex: 0,
        clipId: snapshot.videoClips[0].id,
      };
    }
  }

  if (
    lower.includes('one i just added') ||
    lower.includes('the one i added') ||
    lower.includes('last clip') ||
    lower.includes('latest clip') ||
    lower.includes('newest clip')
  ) {
    if (snapshot.videoClips.length > 0) {
      const idx = snapshot.videoClips.length - 1;
      return {
        resolved: true,
        target: 'LAST_ADDED',
        clipIndex: idx,
        clipId: snapshot.videoClips[idx].id,
      };
    }
  }

  // 3. User explicitly says "selected clip" or "selected image"
  if (lower.includes('selected clip') || lower.includes('selected image') || lower.includes('the selection')) {
    if (snapshot.selectedClipId) {
      const idx = snapshot.videoClips.findIndex((c) => c.id === snapshot.selectedClipId);
      return {
        resolved: true,
        target: 'SELECTED_CLIP',
        clipId: snapshot.selectedClipId,
        clipIndex: idx >= 0 ? idx : undefined,
      };
    }
  }

  // If the query is specifically targeting another timeline track or component (e.g. transitions, transactions, audio, captions, assets, silence),
  // do NOT resolve the target as a clip!
  const isNonClipEntity =
    /\b(?:transitions?|transactions?|transistions?|translations?|audio|music|soundtrack|song|voiceover|vo|captions?|subtitles?|asset\s*bin|media\s*bin|library|assets?|timeline|silence|pauses?|dead\s*space)\b/i.test(lower);

  if (isNonClipEntity) {
    return {
      resolved: false,
    };
  }

  // 4. "This clip", "that clip", "the clip", "this image", "the image", "it"
  const hasClipReference =
    lower.includes('clip') ||
    lower.includes('image') ||
    lower.includes('video') ||
    lower.includes('picture') ||
    lower.includes('photo') ||
    lower.includes('shot') ||
    lower.includes('selection') ||
    lower.includes('it') ||
    lower.includes('this') ||
    lower.includes('that') ||
    lower.includes('here') ||
    lower === 'delete' ||
    lower === 'delete.' ||
    lower === 'remove' ||
    lower === 'remove.' ||
    lower === 'duplicate' ||
    lower === 'duplicate.' ||
    lower === 'split' ||
    lower === 'trim';

  if (snapshot.selectedClipId && hasClipReference) {
    const selIdx = snapshot.videoClips.findIndex((c) => c.id === snapshot.selectedClipId);
    if (selIdx >= 0) {
      return {
        resolved: true,
        target: 'SELECTED_CLIP',
        clipId: snapshot.selectedClipId,
        clipIndex: selIdx,
      };
    }
  }

  // 5. If NO clip is selected, but there is ONLY ONE clip on the entire timeline
  if (snapshot.videoClips.length === 1) {
    return {
      resolved: true,
      target: 'SINGLE_CLIP',
      clipId: snapshot.videoClips[0].id,
      clipIndex: 0,
    };
  }

  // 6. If timeline has NO clips at all
  if (snapshot.videoClips.length === 0) {
    return {
      resolved: false,
      ambiguityReason: 'NO_CLIPS_ON_TIMELINE',
    };
  }

  // 7. Multiple clips exist on timeline, none selected, and no index specified
  return {
    resolved: false,
    ambiguityReason: 'NO_SELECTION_MULTIPLE_CLIPS',
  };
}

// =============================================================================
// HELPER: Discussion vs Instruction Detection (Section 5)
// Identifies when user is asking a question, discussing advice, or suggesting
// =============================================================================
export function isDiscussionOrQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // If text matches an authoritative action name, it is NEVER a discussion or question
  if (resolveExactActionIdentifier(text)) {
    return false;
  }

  // Explicit command keywords that should NEVER be misclassified as discussion
  const explicitCommandKeywords = [
    'clear the timeline',
    'clear the time line',
    'clear everything from the timeline',
    'clear everything from the time line',
    'empty the timeline',
    'empty the time line',
    'remove everything from the timeline',
    'remove everything from the time line',
    'delete everything from the timeline',
    'delete everything from the time line',
    'clear timeline',
    'clear time line',
    'clear all clips',
    'clear clips',
    'remove all clips',
    'remove all clips from the timeline',
    'remove all clips from the time line',
    'delete all clips',
    'delete all clips from the timeline',
    'delete all clips from the time line',
    'wipe the timeline',
    'wipe the time line',
    'wipe timeline',
    'wipe time line',
    'delete everything',
    'clear all assets',
    'clear all in the asset bin',
    'clear all in asset bin',
    'clear the asset bin',
    'clear asset bin',
    'clear assets bin',
    'empty the asset bin',
    'empty asset bin',
    'delete all in the asset bin',
    'delete all in asset bin',
    'delete the asset bin',
    'delete asset bin',
    'delete all assets in bin',
    'remove all from the asset bin',
    'remove all in the asset bin',
    'remove the asset bin',
    'remove asset bin',
    'wipe the asset bin',
    'wipe asset bin',
    'clear media bin',
    'empty media bin',
    'delete media bin',
    'remove media bin',
    'clear media',
    'clear all media',
    'remove all assets',
    'delete all assets',
    'clear assets',
    'empty assets',
    'change the aspect ratio',
    'change aspect ratio',
    'switch the aspect ratio',
    'switch aspect ratio',
    'toggle the aspect ratio',
    'toggle aspect ratio',
    'make it vertical',
    'make it widescreen',
    'make it landscape',
    'turn into 9:16',
    'turn into 16:9',
    'add captions',
    'add caption',
    'put captions on the video',
    'put caption on the video',
    'caption this video',
    'caption the video',
    'generate captions',
    'generate caption',
    'insert captions',
    'insert caption',
    'remove captions',
    'remove caption',
    'clear captions',
    'clear transitions',
    'clear transition',
    'remove transitions',
    'remove transition',
    'remove all transitions',
    'remove all the transitions',
    'remove all the transactions between clips',
    'remove all transactions between clips',
    'remove all the transactions',
    'remove all transactions',
    'remove transitions between clips',
    'delete transitions',
    'delete transition',
    'delete all transitions',
    'no transitions',
    'turn off transitions',
    'disable transitions',
    'duck music',
    'remove silence',
    'undo',
    'redo',
    'duplicate',
    'add overlay',
    'add one as overlay',
    'slow zoom',
    'add keyframes',
  ];
  if (explicitCommandKeywords.some((k) => lower === k || lower.startsWith(k))) {
    return false;
  }

  // Section 5 Examples:
  // "What happens if I delete the clip?" -> CHAT
  // "Should I delete this clip?" -> CHAT
  // "I think we should delete this clip." -> CHAT
  if (
    lower.includes('what happens if') ||
    lower.includes('what will happen if') ||
    lower.startsWith('should i ') ||
    lower.startsWith('should we ') ||
    lower.startsWith('do you think i should') ||
    lower.startsWith('i think we should') ||
    lower.startsWith('i think you should') ||
    lower.startsWith('maybe we should') ||
    lower.startsWith('what if we ') ||
    lower.startsWith('what if i ')
  ) {
    return true;
  }

  // Section 1 Examples:
  // "What does trimming do?"
  // "What's the difference between a cut and a split?"
  // "How can I make this video more engaging?"
  // "What transition would work here?"
  // "The timeline looks messy."
  if (
    lower.includes('what does trimming do') ||
    lower.includes('difference between a cut and a split') ||
    lower.includes('difference between cut and split') ||
    lower.includes('how can i make this video more engaging') ||
    lower.includes('what transition') ||
    lower.includes('which transition') ||
    lower === 'the timeline looks messy' ||
    lower === 'the timeline looks messy.' ||
    lower === 'the timeline is messy' ||
    lower === 'the timeline is messy.' ||
    lower.includes('timeline looks messy') ||
    lower.includes('timeline is messy') ||
    lower.includes('timeline looks cluttered')
  ) {
    return true;
  }

  // General questions: "what is...", "how does...", "why is...", "can you explain..."
  const questionStarters = [
    'what is',
    "what's",
    'what does',
    'how does',
    'how do i',
    'how can i',
    'how to',
    'why is',
    'why did',
    'can you explain',
    'could you explain',
    'tell me about',
    'is it possible to',
  ];
  for (const qs of questionStarters) {
    if (lower.startsWith(qs)) {
      return true;
    }
  }

  // Aesthetic discussion & feelings
  const aestheticStarters = [
    'i want this video to feel',
    'i want it to feel',
    'i want this to look',
    'i feel like',
    'in my opinion',
    'the audio is too loud',
    'the video is too long',
    'pacing feels slow',
    'colors look dull',
  ];
  for (const as of aestheticStarters) {
    if (lower.startsWith(as) || lower.includes(as)) {
      // If it doesn't contain a direct action verb
      if (
        !lower.includes('delete') &&
        !lower.includes('remove') &&
        !lower.includes('clear') &&
        !lower.includes('split') &&
        !lower.includes('trim')
      ) {
        return true;
      }
    }
  }

  // Question mark ending without imperative command structure
  if (text.trim().endsWith('?')) {
    const imperativeStarters = [
      'can you delete',
      'can you clear',
      'can you remove',
      'can you add',
      'can you move',
      'can you trim',
      'can you split',
      'could you delete',
      'could you clear',
      'could you remove',
      'please delete',
      'please clear',
      'please remove',
    ];
    if (!imperativeStarters.some((s) => lower.startsWith(s))) {
      return true;
    }
  }

  // Casual greetings & pleasantries
  const casualPhrases = [
    'hello',
    'hi',
    'hey',
    'hey there',
    'good morning',
    'good afternoon',
    'good evening',
    'thanks',
    'thank you',
    'great job',
    'looks good',
    'cool',
    'nice',
  ];
  if (casualPhrases.includes(lower)) {
    return true;
  }

  return false;
}

// =============================================================================
// HELPER: Multi-Action Request Recognition (Section 7)
// e.g. "Split the clip at 5 seconds and delete the second part"
// e.g. "Add background music and duck it to 20%"
// =============================================================================
export function parseMultiActionRequest(
  text: string,
  snapshot: EditorContextSnapshot
): DetectedCommandAction[] | null {
  const lower = text.toLowerCase().trim();

  // Guard against conversational questions
  if (isDiscussionOrQuestion(text)) {
    return null;
  }

  // Check for multi-beat SFX / whoosh command: e.g. "Put a whoosh on beat 45 and beat 110"
  if (lower.includes('whoosh') || lower.includes('sfx') || lower.includes('sound effect')) {
    const beatMatches = [...text.matchAll(/beat\s*#?\s*(\d+)/gi)];
    if (beatMatches.length >= 2) {
      return beatMatches.map((m) => ({
        actionType: 'ADD_SFX' as const,
        target: 'TIMELINE',
        parameters: {
          sfxType: 'whoosh',
          beatIndex: parseInt(m[1], 10),
        },
      }));
    }
  }

  // First check if text contains multiple action components
  // Can be separated by commas, conjunctions, or action keywords
  const hasConjunction =
    lower.includes(' and ') ||
    lower.includes(' then ') ||
    lower.includes(' followed by ') ||
    lower.includes(',') ||
    lower.includes(' + ');

  // Action phrase boundary pattern to split clauses like "add one as overlay add key frames slow zoom"
  const actionSplitRegex =
    /(?:,\s*|\s+(?:and\s+then|then|and|followed\s+by|\+)\s+|\s+(?=\b(?:add\s+(?:one\s+as\s+overlay|as\s+overlay|overlay|key\s*frames|captions|background\s+music|music|audio|image)|duplicate|apply\s+slow\s+zoom|slow\s+zoom|split\s+(?:the\s+)?clip|delete\s+(?:the\s+)?clip|delete\s+(?:the\s+)?second\s+part|trim\s+(?:the\s+)?clip|move\s+(?:the\s+)?clip|duck\s+(?:the\s+)?music|remove\s+(?:all\s+)?(?:the\s+|those\s+)?(?:transitions?|transactions?)|clear\s+transitions?)\b))/i;

  const rawParts = text.split(actionSplitRegex);
  const candidateParts = rawParts.map((p) => p.trim()).filter((p) => p.length > 0);

  if (candidateParts.length < 2 && !hasConjunction) {
    return null;
  }

  const actions: DetectedCommandAction[] = [];

  for (const part of candidateParts) {
    const single = detectSingleAction(part, snapshot);
    if (single && 'actionType' in single) {
      actions.push(single as DetectedCommandAction);
    }
  }

  if (actions.length >= 2) {
    return actions;
  }

  return null;
}

// =============================================================================
// HELPER: Detect a single command action
// =============================================================================
function detectSingleAction(
  text: string,
  snapshot: EditorContextSnapshot
): DetectedCommandAction | { needsClarification: true; question: string; reason: string } | null {
  const lower = text.toLowerCase().trim();
  // Normalize "time line" and "time-line" to "timeline" for robust recognition across all commands
  const normalizedTimeline = lower.replace(/\btime[\s-]+line\b/g, 'timeline');
  const condition = parseCommandCondition(text);

  // 0. AUTHORITATIVE ACTION IDENTIFIER CHECK (e.g. "CLEAR_TIMELINE", "ADD_CAPTIONS", "DUPLICATE_CLIP")
  const exactAction = resolveExactActionIdentifier(text);
  if (exactAction) {
    switch (exactAction) {
      case 'CLEAR_TIMELINE':
        return { actionType: 'CLEAR_TIMELINE', target: 'TIMELINE' };
      case 'ADD_CAPTIONS':
        return { actionType: 'ADD_CAPTIONS', target: 'CAPTIONS' };
      case 'REMOVE_CAPTIONS':
      case 'CLEAR_CAPTIONS':
        return { actionType: 'REMOVE_CAPTIONS', target: 'CAPTIONS' };
      case 'CLEAR_ASSETS':
        return { actionType: 'CLEAR_ASSETS', target: 'ASSETS' };
      case 'DELETE_EVERYTHING':
        return { actionType: 'DELETE_EVERYTHING', target: 'TIMELINE' };
      case 'DELETE_SELECTED_CLIP':
      case 'DELETE_CLIP': {
        const resolved = resolveClipTarget(text, snapshot);
        if (!resolved.resolved) {
          if (resolved.ambiguityReason === 'NO_SELECTION_MULTIPLE_CLIPS') {
            return {
              needsClarification: true,
              question: 'Which clip should I delete?',
              reason: 'Multiple clips exist on the timeline with none selected; clarification required without guessing.',
            };
          }
          if (resolved.ambiguityReason === 'NO_CLIPS_ON_TIMELINE') {
            return {
              needsClarification: true,
              question: 'There are currently no clips on the timeline to delete.',
              reason: 'Timeline is currently empty.',
            };
          }
          if (resolved.ambiguityReason === 'INDEX_OUT_OF_BOUNDS') {
            return {
              needsClarification: true,
              question: `Your timeline only has ${snapshot.videoClips.length} clip(s). Which clip would you like to delete?`,
              reason: 'Specified clip index is out of bounds.',
            };
          }
        }
        return {
          actionType: 'DELETE_SELECTED_CLIP',
          target: resolved.target || 'SELECTED_CLIP',
          targetId: resolved.clipId,
          targetIndex: resolved.clipIndex,
          parameters: { clipId: resolved.clipId, clipIndex: resolved.clipIndex },
        };
      }
      case 'DUPLICATE_CLIP': {
        const resolved = resolveClipTarget(text, snapshot);
        if (!resolved.resolved) {
          if (resolved.ambiguityReason === 'NO_SELECTION_MULTIPLE_CLIPS') {
            return {
              needsClarification: true,
              question: 'Which clip should I duplicate?',
              reason: 'Multiple clips exist on the timeline with none selected; clarification required without guessing.',
            };
          }
        }
        return {
          actionType: 'DUPLICATE_CLIP',
          target: resolved.target || 'SELECTED_CLIP',
          targetId: resolved.clipId,
          parameters: { clipId: resolved.clipId, clipIndex: resolved.clipIndex },
        };
      }
      case 'ADD_OVERLAY':
        return { actionType: 'ADD_OVERLAY', target: 'SELECTED_CLIP' };
      case 'ADD_KEYFRAMES':
        return { actionType: 'ADD_KEYFRAMES', target: 'SELECTED_CLIP' };
      case 'SLOW_ZOOM':
        return { actionType: 'SLOW_ZOOM', target: 'SELECTED_CLIP' };
      case 'REMOVE_AUDIO':
        return { actionType: 'REMOVE_AUDIO', target: 'AUDIO_TRACK' };
      case 'ADD_BACKGROUND_MUSIC':
        return { actionType: 'ADD_BACKGROUND_MUSIC', target: 'AUDIO_TRACK' };
      case 'REMOVE_SILENCE':
        return { actionType: 'REMOVE_SILENCE', target: 'TIMELINE', parameters: { threshold: 0.8 } };
      case 'DUCK_MUSIC':
        return { actionType: 'DUCK_MUSIC', target: 'AUDIO_TRACK', parameters: { volume: 15 } };
      case 'UNDO':
        return { actionType: 'UNDO', target: 'TIMELINE' };
      case 'REDO':
        return { actionType: 'REDO', target: 'TIMELINE' };
      case 'CLEAR_TRANSITIONS':
        return { actionType: 'CLEAR_TRANSITIONS', target: 'TRANSITIONS' };
      case 'CHANGE_ASPECT_RATIO': {
        const toggleRatio: AspectRatio = snapshot.aspectRatio === '9:16' ? '16:9' : '9:16';
        return { actionType: 'CHANGE_ASPECT_RATIO', target: 'TIMELINE', parameters: { aspectRatio: toggleRatio } };
      }
      case 'SPLIT_CLIP': {
        const resolved = resolveClipTarget(text, snapshot);
        return {
          actionType: 'SPLIT_CLIP',
          target: resolved.resolved ? resolved.target : 'PLAYHEAD',
          targetId: resolved.clipId,
          parameters: { targetSeconds: snapshot.currentTime, clipId: resolved.clipId },
        };
      }
      default:
        return { actionType: exactAction, target: 'TIMELINE' };
    }
  }

  // 1. CLEAR TIMELINE / CLEAR ALL CLIPS (Executed first to prevent false ambiguity in single-clip delete)
  // e.g. "clear all clips", "clear the timeline", "clear the time line", "remove all clips from the timeline", "delete all clips", "empty the timeline", "wipe the timeline"
  const isClearTimelineNL =
    /^(?:please\s+)?(?:clear|empty|wipe|clean|reset)\s+(?:all\s+)?(?:clips|tracks?|time[\s-]*line)(?:\s+(?:from|off)\s+(?:the\s+)?time[\s-]*line)?\.?$/i.test(lower) ||
    /^(?:please\s+)?(?:clear|empty|wipe|clean|reset)\s+(?:the\s+|my\s+)?time[\s-]*line\.?$/i.test(lower) ||
    /^(?:please\s+)?(?:remove|delete|clear|wipe|clean|reset)\s+(?:all\s+clips|all\s+the\s+clips|everything)\s+(?:from|off)\s+(?:the\s+|my\s+)?time[\s-]*line\.?$/i.test(lower) ||
    /^(?:please\s+)?(?:remove|delete)\s+all\s+(?:the\s+)?clips(?:\s+(?:from|off)\s+(?:the\s+|my\s+)?time[\s-]*line)?\.?$/i.test(lower) ||
    normalizedTimeline === 'clear timeline' ||
    normalizedTimeline === 'clear timeline.' ||
    normalizedTimeline === 'clear the timeline' ||
    normalizedTimeline === 'clear the timeline.' ||
    normalizedTimeline === 'clear all clips' ||
    normalizedTimeline === 'clear all clips.' ||
    normalizedTimeline === 'clear clips' ||
    normalizedTimeline === 'clear clips.' ||
    normalizedTimeline === 'remove all clips' ||
    normalizedTimeline === 'remove all clips.' ||
    normalizedTimeline === 'remove all clips from the timeline' ||
    normalizedTimeline === 'remove all clips from the timeline.' ||
    normalizedTimeline === 'delete all clips' ||
    normalizedTimeline === 'delete all clips.' ||
    normalizedTimeline === 'delete all clips from the timeline' ||
    normalizedTimeline === 'delete all clips from the timeline.' ||
    normalizedTimeline === 'empty the timeline' ||
    normalizedTimeline === 'empty the timeline.' ||
    normalizedTimeline === 'empty timeline' ||
    normalizedTimeline === 'empty timeline.' ||
    normalizedTimeline === 'wipe timeline' ||
    normalizedTimeline === 'wipe timeline.' ||
    normalizedTimeline === 'wipe the timeline' ||
    normalizedTimeline === 'wipe the timeline.' ||
    normalizedTimeline === 'clean the timeline' ||
    normalizedTimeline === 'clean timeline' ||
    normalizedTimeline === 'reset timeline' ||
    normalizedTimeline === 'reset the timeline' ||
    normalizedTimeline === 'clear everything from the timeline' ||
    normalizedTimeline === 'clear everything from the timeline.' ||
    normalizedTimeline === 'remove everything from the timeline' ||
    normalizedTimeline === 'remove everything from the timeline.' ||
    normalizedTimeline === 'delete everything from the timeline' ||
    normalizedTimeline === 'delete everything from the timeline.' ||
    normalizedTimeline.includes('clear everything from the timeline') ||
    normalizedTimeline.includes('remove everything from the timeline') ||
    normalizedTimeline.includes('delete everything from the timeline') ||
    normalizedTimeline.includes('clear all clips from the timeline') ||
    normalizedTimeline.includes('remove all clips from the timeline') ||
    normalizedTimeline.includes('delete all clips from the timeline');

  if (isClearTimelineNL) {
    return {
      actionType: 'CLEAR_TIMELINE',
      target: 'TIMELINE',
    };
  }

  // 1.5 CLEAR / REMOVE TRANSITIONS
  // Handles: "remove all transitions", "remove all the transactions between clips",
  // "remove all those transitions between clips", "remove transitions between clips", "delete transitions", "clear transitions"
  const isTransitionTarget =
    /\b(?:transitions?|transactions?|transistions?|translations?)\b/i.test(lower);

  const isClearTransitionsNL =
    (isTransitionTarget && (
      lower.includes('remove') ||
      lower.includes('delete') ||
      lower.includes('clear') ||
      lower.includes('wipe') ||
      lower.includes('erase') ||
      lower.includes('get rid of') ||
      lower.includes('take out') ||
      lower.includes('turn off') ||
      lower.includes('disable') ||
      lower.includes('no ') ||
      lower.includes('without ')
    )) ||
    /^(?:please\s+)?(?:remove|delete|clear|wipe|erase|take\s+out|turn\s+off|disable)\s+(?:all\s+)?(?:the\s+|those\s+|these\s+)?(?:transitions?|transactions?|transistions?)(?:\s+(?:between|from|off|on|in)\s+(?:the\s+)?clips?)?/i.test(lower) ||
    lower === 'clear transitions' ||
    lower === 'clear transitions.' ||
    lower === 'clear transition' ||
    lower === 'clear transition.' ||
    lower === 'remove transitions' ||
    lower === 'remove transitions.' ||
    lower === 'remove transition' ||
    lower === 'remove transition.' ||
    lower === 'delete transitions' ||
    lower === 'delete transitions.' ||
    lower === 'delete transition' ||
    lower === 'no transitions' ||
    lower.includes('transitions between clips') ||
    lower.includes('transactions between clips') ||
    lower.includes('remove all the transactions') ||
    lower.includes('remove all transactions') ||
    lower.includes('remove all the transitions') ||
    lower.includes('remove all transitions');

  if (isClearTransitionsNL) {
    return {
      actionType: 'CLEAR_TRANSITIONS',
      target: 'TRANSITIONS',
    };
  }

  // ADD CAPTIONS / SUBTITLES
  // e.g. "add caption", "add captions", "put captions on the video", "caption this video", "caption the video"
  const isAddCaptionsNL =
    /^(?:please\s+)?(?:add|insert|generate|create|put)\s+(?:a\s+)?captions?(?:\s+(?:on|to|for|in)\s+(?:the\s+|this\s+)?(?:video|timeline|project))?\.?$/i.test(lower) ||
    /^(?:please\s+)?(?:add|insert|generate|create|put)\s+(?:subtitles?)(?:\s+(?:on|to|for|in)\s+(?:the\s+|this\s+)?(?:video|timeline|project))?\.?$/i.test(lower) ||
    /^(?:please\s+)?caption\s+(?:this|the)?\s*video\.?$/i.test(lower) ||
    /^(?:please\s+)?subtitle\s+(?:this|the)?\s*video\.?$/i.test(lower) ||
    lower === 'add caption' ||
    lower === 'add caption.' ||
    lower === 'add captions' ||
    lower === 'add captions.' ||
    lower === 'put captions on the video' ||
    lower === 'put captions on the video.' ||
    lower === 'put caption on the video' ||
    lower === 'put caption on the video.' ||
    lower === 'put captions on video' ||
    lower === 'put caption on video' ||
    lower === 'caption this video' ||
    lower === 'caption this video.' ||
    lower === 'caption the video' ||
    lower === 'caption the video.' ||
    lower === 'caption this' ||
    lower === 'caption this.' ||
    lower === 'generate captions' ||
    lower === 'generate caption' ||
    lower === 'create captions' ||
    lower === 'create caption' ||
    lower === 'insert captions' ||
    lower === 'insert caption' ||
    lower === 'add subtitles' ||
    lower === 'add subtitle' ||
    lower.startsWith('add captions') ||
    lower.startsWith('add caption') ||
    lower.startsWith('generate captions') ||
    lower.startsWith('generate caption') ||
    lower.startsWith('insert captions') ||
    lower.startsWith('insert caption') ||
    lower.startsWith('add subtitles') ||
    lower.startsWith('add subtitle') ||
    lower.includes('caption this') ||
    lower.includes('create captions') ||
    lower.includes('put captions on');

  if (isAddCaptionsNL) {
    return {
      actionType: 'ADD_CAPTIONS',
      target: 'CAPTIONS',
    };
  }

  // DUPLICATE CLIP
  // e.g. "Duplicate this clip.", "Duplicate it", "Duplicate clip", "Duplicate", "Make a copy of this clip", "Clone this clip"
  if (
    lower === 'duplicate' ||
    lower === 'duplicate.' ||
    lower === 'duplicate it' ||
    lower === 'duplicate it.' ||
    lower === 'duplicate this' ||
    lower === 'duplicate this.' ||
    lower === 'duplicate this clip' ||
    lower === 'duplicate this clip.' ||
    lower === 'duplicate clip' ||
    lower === 'duplicate clip.' ||
    lower === 'duplicate the clip' ||
    lower === 'duplicate the clip.' ||
    lower === 'duplicate selected clip' ||
    lower === 'duplicate the selected clip' ||
    lower === 'duplicate clip 1' ||
    lower.startsWith('duplicate ') ||
    lower.startsWith('duplicate\t') ||
    lower.includes('duplicate this clip') ||
    lower.includes('duplicate the clip') ||
    lower.includes('duplicate it') ||
    lower.includes('duplicate clip') ||
    lower.includes('make a copy of this clip') ||
    lower.includes('copy this clip') ||
    lower.includes('clone this clip')
  ) {
    let clipIndex: number | undefined = undefined;
    const clipIdxMatch = /(?:clip\s+(\d+)|first\s+clip|second\s+clip|third\s+clip)/i.exec(text);
    if (clipIdxMatch) {
      if (clipIdxMatch[1]) clipIndex = parseInt(clipIdxMatch[1], 10) - 1;
      else if (clipIdxMatch[0].toLowerCase().includes('first')) clipIndex = 0;
      else if (clipIdxMatch[0].toLowerCase().includes('second')) clipIndex = 1;
      else if (clipIdxMatch[0].toLowerCase().includes('third')) clipIndex = 2;
    }

    const resolvedClip =
      (clipIndex !== undefined && snapshot.videoClips[clipIndex]) ||
      (snapshot.selectedClipId && snapshot.videoClips.find((c) => c.id === snapshot.selectedClipId)) ||
      snapshot.videoClips[0];

    return {
      actionType: 'DUPLICATE_CLIP',
      target: 'SELECTED_CLIP',
      targetId: resolvedClip?.id,
      parameters: { clipIndex, clipId: resolvedClip?.id },
    };
  }

  // ADD AS OVERLAY / MAKE OVERLAY
  if (
    lower === 'add as overlay' ||
    lower === 'add as overlay.' ||
    lower === 'add one as overlay' ||
    lower === 'add one as overlay.' ||
    lower === 'make overlay' ||
    lower === 'make it an overlay' ||
    lower === 'add overlay' ||
    lower === 'add overlay.' ||
    lower.includes('add one as overlay') ||
    lower.includes('add as overlay') ||
    lower.includes('add it as overlay') ||
    lower.includes('make it an overlay') ||
    lower.includes('convert to overlay') ||
    lower.includes('set as overlay')
  ) {
    return {
      actionType: 'ADD_OVERLAY',
      target: 'SELECTED_CLIP',
    };
  }

  // ADD KEYFRAMES
  if (
    lower === 'add keyframes' ||
    lower === 'add keyframes.' ||
    lower === 'add key frames' ||
    lower === 'add key frames.' ||
    lower.startsWith('add key frames') ||
    lower.startsWith('add keyframes') ||
    lower.includes('add key frames') ||
    lower.includes('add keyframes') ||
    lower.includes('insert keyframes') ||
    lower.includes('create keyframes')
  ) {
    const hasSlowZoom = lower.includes('slow zoom') || lower.includes('zoom');
    return {
      actionType: 'ADD_KEYFRAMES',
      target: 'SELECTED_CLIP',
      parameters: { effect: hasSlowZoom ? 'slow-zoom' : undefined },
    };
  }

  // SLOW ZOOM
  if (
    lower === 'slow zoom' ||
    lower === 'slow zoom.' ||
    lower === 'apply slow zoom' ||
    lower === 'apply slow zoom.' ||
    lower === 'add slow zoom' ||
    lower === 'add slow zoom.' ||
    lower.includes('apply slow zoom') ||
    lower.includes('slow zoom') ||
    lower.includes('slow zoom effect')
  ) {
    return {
      actionType: 'SLOW_ZOOM',
      target: 'SELECTED_CLIP',
    };
  }

  // 0. UNSUPPORTED CAPABILITIES (Section 16: DO NOT INVENT EDITOR CAPABILITIES)
  if (
    lower.includes('3d') ||
    lower.includes('vr ') ||
    lower.includes('hologram') ||
    lower.includes('deepfake') ||
    lower.includes('motion tracking')
  ) {
    let capability = '3D transformation';
    if (lower.includes('vr')) capability = 'VR rendering';
    else if (lower.includes('hologram')) capability = 'hologram effects';
    else if (lower.includes('deepfake')) capability = 'deepfake generation';
    else if (lower.includes('motion tracking')) capability = 'motion tracking';

    return {
      actionType: 'UNSUPPORTED_ACTION',
      target: 'TIMELINE',
      parameters: { text: capability },
    };
  }

  // 2. CLEAR ALL ASSETS (from Media Library / Asset Bin)
  const isClearAssets =
    /^(?:please\s+)?(?:clear|empty|delete|remove|wipe|purge|reset)\s+(?:all\s+)?(?:everything\s+)?(?:in\s+|from\s+|of\s+)?(?:the\s+)?(?:asset\s*bin|assets\s*bin|assets?|media\s*bin|media|library|bin)\b/i.test(lower) ||
    lower === 'clear the asset bin' ||
    lower === 'clear the asset bin.' ||
    lower === 'clear all in the asset bin' ||
    lower === 'clear all in the asset bin.' ||
    lower === 'clear all in asset bin' ||
    lower === 'clear all in asset bin.' ||
    lower === 'clear asset bin' ||
    lower === 'clear asset bin.' ||
    lower === 'clear assets bin' ||
    lower === 'empty the asset bin' ||
    lower === 'empty the asset bin.' ||
    lower === 'empty asset bin' ||
    lower === 'empty asset bin.' ||
    lower === 'delete the asset bin' ||
    lower === 'delete the asset bin.' ||
    lower === 'delete asset bin' ||
    lower === 'delete asset bin.' ||
    lower === 'delete all in the asset bin' ||
    lower === 'delete all in the asset bin.' ||
    lower === 'delete all in asset bin' ||
    lower === 'delete all assets in bin' ||
    lower === 'delete all assets in the bin' ||
    lower === 'remove all from the asset bin' ||
    lower === 'remove all from the asset bin.' ||
    lower === 'remove all in the asset bin' ||
    lower === 'remove all in asset bin' ||
    lower === 'remove all from asset bin' ||
    lower === 'remove the asset bin' ||
    lower === 'remove asset bin' ||
    lower === 'wipe the asset bin' ||
    lower === 'wipe asset bin' ||
    lower === 'clear assets' ||
    lower === 'clear the assets' ||
    lower === 'clear all assets' ||
    lower === 'empty assets' ||
    lower === 'empty the assets' ||
    lower === 'delete assets' ||
    lower === 'delete all assets' ||
    lower === 'remove assets' ||
    lower === 'remove all assets' ||
    lower === 'clear media' ||
    lower === 'clear all media' ||
    lower === 'clear media bin' ||
    lower === 'empty media bin' ||
    lower === 'delete media bin' ||
    lower === 'remove media bin' ||
    (lower.includes('asset bin') && (lower.includes('clear') || lower.includes('empty') || lower.includes('delete') || lower.includes('remove') || lower.includes('wipe'))) ||
    (lower.includes('assets bin') && (lower.includes('clear') || lower.includes('empty') || lower.includes('delete') || lower.includes('remove') || lower.includes('wipe'))) ||
    (lower.includes('media bin') && (lower.includes('clear') || lower.includes('empty') || lower.includes('delete') || lower.includes('remove') || lower.includes('wipe'))) ||
    lower.includes('clear all assets') ||
    lower.includes('remove all assets') ||
    lower.includes('delete all assets');

  if (isClearAssets) {
    return {
      actionType: 'CLEAR_ASSETS',
      target: 'ASSETS',
    };
  }

  // Check if user requested deleting a specific individual asset
  const singleAssetQuery = /^(?:please\s+)?(?:delete|remove)\s+(?:the\s+)?asset\s+(?:named\s+|called\s+)?["']?([^"']+)["']?(?:\s+from\s+(?:the\s+)?(?:asset\s*bin|media\s*bin|assets?|library))?/i.exec(lower);
  if (singleAssetQuery && !isClearAssets) {
    const assetQuery = singleAssetQuery[1].trim();
    if (assetQuery && assetQuery !== 'all' && assetQuery !== 'everything') {
      return {
        actionType: 'CLEAR_ASSETS',
        target: 'ASSETS',
        parameters: { assetName: assetQuery },
      };
    }
  }

  // 3. DELETE EVERYTHING (Timeline + Assets)
  if (
    lower === 'delete everything' ||
    lower === 'delete everything.' ||
    lower === 'remove everything' ||
    lower === 'clear everything' ||
    lower === 'reset project' ||
    lower === 'wipe everything'
  ) {
    return {
      actionType: 'DELETE_EVERYTHING',
      target: 'TIMELINE',
    };
  }

  // 4. DELETE CLIP / REMOVE THIS IMAGE (Section 3 & 4)
  // "Get rid of this clip", "Delete this clip", "Remove this clip", "Delete the selected clip", "Remove this image"
  if (
    lower.startsWith('delete') ||
    lower.startsWith('remove') ||
    lower.startsWith('get rid of') ||
    lower.startsWith('erase') ||
    lower.startsWith('cut out') ||
    lower.includes('delete this clip') ||
    lower.includes('delete the clip') ||
    lower.includes('remove this clip') ||
    lower.includes('remove the clip') ||
    lower.includes('get rid of this clip') ||
    lower.includes('remove this image') ||
    lower.includes('delete this image') ||
    lower.includes('delete the selected clip') ||
    lower.includes('remove the selected clip')
  ) {
    // Check if it's transitions/transactions instead
    if (isTransitionTarget) {
      return {
        actionType: 'CLEAR_TRANSITIONS',
        target: 'TRANSITIONS',
      };
    }

    // Check if it's audio instead
    if (lower.includes('audio') || lower.includes('music') || lower.includes('soundtrack')) {
      return {
        actionType: 'REMOVE_AUDIO',
        target: 'AUDIO_TRACK',
      };
    }

    // Check if it's captions instead
    if (lower.includes('caption') || lower.includes('subtitles')) {
      return {
        actionType: 'REMOVE_CAPTIONS',
        target: 'CAPTIONS',
      };
    }

    // Check if it's pauses or silence instead
    if (lower.includes('silence') || lower.includes('pause') || lower.includes('dead space')) {
      return {
        actionType: 'REMOVE_SILENCE',
        target: 'TIMELINE',
        parameters: { threshold: 0.8 },
      };
    }

    // Resolve clip target using editor context
    const resolved = resolveClipTarget(text, snapshot);

    if (resolved.resolved) {
      const isSelectedTarget = lower.includes('selected clip') || lower.includes('the selected') || resolved.target === 'SELECTED_CLIP';
      return {
        actionType: isSelectedTarget ? 'DELETE_SELECTED_CLIP' : 'DELETE_CLIP',
        target: resolved.target || 'SELECTED_CLIP',
        targetId: resolved.clipId,
        targetIndex: resolved.clipIndex,
        condition,
        parameters: {
          clipId: resolved.clipId,
          clipIndex: resolved.clipIndex,
        },
      };
    }

    // Target cannot be resolved reliably -> NEEDS_CLARIFICATION (Section 1 & 4)
    if (resolved.ambiguityReason === 'NO_SELECTION_MULTIPLE_CLIPS') {
      return {
        needsClarification: true,
        question: 'Which clip should I delete?',
        reason: 'Multiple clips exist on the timeline with none selected; clarification required without guessing.',
      };
    }

    if (resolved.ambiguityReason === 'NO_CLIPS_ON_TIMELINE') {
      return {
        needsClarification: true,
        question: 'There are currently no clips on the timeline to delete.',
        reason: 'Timeline is currently empty.',
      };
    }

    if (resolved.ambiguityReason === 'INDEX_OUT_OF_BOUNDS') {
      return {
        needsClarification: true,
        question: `Your timeline only has ${snapshot.videoClips.length} clip(s). Which clip would you like to delete?`,
        reason: 'Specified clip index is out of bounds.',
      };
    }
  }

  // 5. MOVE CLIP (Section 3 & 4)
  // "Put this at the start", "Move this clip to the beginning", "Move it to 0 seconds", "Move this image to 10 seconds"
  const isMoveClipCommand =
    lower.startsWith('move') ||
    lower.startsWith('place') ||
    lower.startsWith('shift') ||
    lower.includes('move this clip') ||
    lower.includes('move it') ||
    lower.includes('put this at') ||
    lower.includes('put clip') ||
    lower.includes('put the clip') ||
    (lower.startsWith('put') &&
      !lower.includes('caption') &&
      !lower.includes('subtitle') &&
      !lower.includes('music') &&
      !lower.includes('audio') &&
      !lower.includes('track') &&
      !lower.includes('overlay'));

  if (isMoveClipCommand) {
    let targetSec = 0;
    if (
      lower.includes('to the beginning') ||
      lower.includes('to the start') ||
      lower.includes('at the start') ||
      lower.includes('to 0') ||
      lower.includes('at 0')
    ) {
      targetSec = 0;
    } else {
      const extracted = extractSeconds(text);
      if (extracted !== null) {
        targetSec = extracted;
      }
    }

    const resolved = resolveClipTarget(text, snapshot);
    if (resolved.resolved) {
      return {
        actionType: 'MOVE_CLIP',
        target: resolved.target || 'SELECTED_CLIP',
        targetId: resolved.clipId,
        targetIndex: resolved.clipIndex,
        condition,
        parameters: {
          targetSeconds: targetSec,
          clipId: resolved.clipId,
          clipIndex: resolved.clipIndex,
        },
      };
    }

    // Cannot resolve clip reference -> NEEDS_CLARIFICATION
    return {
      needsClarification: true,
      question: 'Which clip do you want me to move?',
      reason: 'Unclear clip reference with multiple clips present; clarification required without guessing.',
    };
  }

  // 6. TRIM CLIP / SET DURATION
  // "Trim this clip", "Make this clip 5 seconds", "Set clip duration to 4 seconds"
  if (
    lower.startsWith('trim') ||
    lower.startsWith('shorten') ||
    lower.includes('make this clip') ||
    lower.includes('set duration') ||
    lower.includes('change duration')
  ) {
    const duration = extractSeconds(text) || 5;
    const resolved = resolveClipTarget(text, snapshot);

    if (resolved.resolved) {
      return {
        actionType: 'TRIM_CLIP',
        target: resolved.target || 'SELECTED_CLIP',
        targetId: resolved.clipId,
        targetIndex: resolved.clipIndex,
        condition,
        parameters: {
          duration,
          clipId: resolved.clipId,
          clipIndex: resolved.clipIndex,
        },
      };
    }

    return {
      needsClarification: true,
      question: 'Which clip do you want me to trim?',
      reason: 'Multiple clips exist on the timeline with none selected; clarification required without guessing.',
    };
  }

  // 7. SPLIT CLIP
  // "Split this clip", "Split the clip", "Split clip at playhead", "Cut clip at playhead"
  if (
    lower.startsWith('split') ||
    lower.includes('split this clip') ||
    lower.includes('split the clip') ||
    lower.includes('split clip at playhead') ||
    lower.includes('cut clip at playhead')
  ) {
    const resolved = resolveClipTarget(text, snapshot);
    const splitTime = extractSeconds(text) || snapshot.currentTime;

    return {
      actionType: 'SPLIT_CLIP',
      target: resolved.resolved ? resolved.target : 'PLAYHEAD',
      targetId: resolved.clipId,
      targetIndex: resolved.clipIndex,
      parameters: {
        targetSeconds: splitTime,
        clipId: resolved.clipId,
      },
    };
  }

  // 9. REMOVE SILENCE / CUT PAUSES
  if (
    lower.startsWith('remove silence') ||
    lower.startsWith('cut pauses') ||
    lower.startsWith('remove all pauses') ||
    lower.startsWith('cut out dead space') ||
    lower.startsWith('remove dead space')
  ) {
    return {
      actionType: 'REMOVE_SILENCE',
      target: 'TIMELINE',
      parameters: { threshold: 0.8 },
    };
  }

  // 10. DUCK MUSIC
  if (
    lower.startsWith('duck music') ||
    lower.startsWith('lower background music') ||
    lower.startsWith('duck the music') ||
    lower.startsWith('duck it') ||
    lower.startsWith('duck to') ||
    lower.includes('duck it to') ||
    lower.includes('lower volume') ||
    lower.includes('lower the volume') ||
    lower.includes('set music volume') ||
    lower.includes('duck audio') ||
    lower.includes('duck music under voice') ||
    lower.includes('bring the music down') ||
    lower.includes('bring down the music') ||
    lower.includes('keep it subtle under the voice') ||
    lower.includes('keep music subtle')
  ) {
    const volMatch = text.match(/(\d+)%/);
    const vol = volMatch ? parseInt(volMatch[1], 10) : 18;
    return {
      actionType: 'DUCK_MUSIC',
      target: 'AUDIO_TRACK',
      parameters: { volume: vol },
    };
  }

  // 10b. FADE OUT MUSIC / AUDIO
  if (
    lower.includes('fade out') &&
    (lower.includes('music') || lower.includes('audio') || lower.includes('bgm') || lower.includes('soundtrack'))
  ) {
    const secMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)/i);
    const fadeSec = secMatch ? parseFloat(secMatch[1]) : 5.0;
    return {
      actionType: 'FADE_OUT_AUDIO',
      target: 'AUDIO_TRACK',
      parameters: { duration: fadeSec },
    };
  }

  // 11. ADD BACKGROUND MUSIC
  if (
    lower.startsWith('add background music') ||
    lower.startsWith('add music') ||
    lower.startsWith('insert background music')
  ) {
    return {
      actionType: 'ADD_BACKGROUND_MUSIC',
      target: 'AUDIO_TRACK',
    };
  }

  // 12. CHANGE ASPECT RATIO
  const isAspectRatioCommand =
    /\b(?:aspect[-\s]*ratio|aspect|ratio)\b/i.test(lower) ||
    lower.includes('9:16') ||
    lower.includes('16:9') ||
    lower.includes('1:1') ||
    lower.includes('vertical short') ||
    lower.includes('vertical video') ||
    lower.includes('make it vertical') ||
    lower.includes('make it horizontal') ||
    lower.includes('make it landscape') ||
    lower.includes('make it square') ||
    lower.includes('make it widescreen') ||
    lower.includes('turn into vertical') ||
    lower.includes('turn into 9:16') ||
    lower.includes('turn into 16:9') ||
    lower.includes('format for tiktok') ||
    lower.includes('format for shorts') ||
    lower.includes('format for reels') ||
    lower.includes('format for youtube');

  if (isAspectRatioCommand) {
    let targetRatio: AspectRatio;
    if (
      lower.includes('9:16') ||
      lower.includes('9 by 16') ||
      lower.includes('9/16') ||
      lower.includes('vertical') ||
      lower.includes('portrait') ||
      lower.includes('tiktok') ||
      lower.includes('shorts') ||
      lower.includes('reels')
    ) {
      targetRatio = '9:16';
    } else if (
      lower.includes('16:9') ||
      lower.includes('16 by 9') ||
      lower.includes('16/9') ||
      lower.includes('horizontal') ||
      lower.includes('landscape') ||
      lower.includes('widescreen') ||
      lower.includes('wide') ||
      lower.includes('youtube')
    ) {
      targetRatio = '16:9';
    } else if (
      lower.includes('1:1') ||
      lower.includes('1 by 1') ||
      lower.includes('1/1') ||
      lower.includes('square') ||
      lower.includes('instagram')
    ) {
      targetRatio = '1:1';
    } else {
      // User requested "change the aspect ratio", "change aspect ratio", "toggle aspect ratio", etc.
      // Toggle between 16:9 and 9:16 based on current snapshot
      targetRatio = snapshot.aspectRatio === '9:16' ? '16:9' : '9:16';
    }
    return {
      actionType: 'CHANGE_ASPECT_RATIO',
      target: 'TIMELINE',
      parameters: { aspectRatio: targetRatio },
    };
  }

  // 13. UNDO / REDO
  if (lower === 'undo' || lower === 'undo edit' || lower === 'revert') {
    return {
      actionType: 'UNDO',
      target: 'TIMELINE',
    };
  }

  if (lower === 'redo' || lower === 'redo edit') {
    return {
      actionType: 'REDO',
      target: 'TIMELINE',
    };
  }

  // 14. AI VISUAL/AUDIO MATCHING COMMANDS (General Auto Editor)
  // Check for approval first
  if (
    lower === 'approve' ||
    lower === 'approve.' ||
    lower === 'approve matches' ||
    lower === 'approve & add to timeline' ||
    lower === 'approve and add to timeline' ||
    lower === 'add approved visuals to timeline' ||
    lower === 'apply matches to timeline' ||
    lower === 'apply sequence to timeline' ||
    lower === 'commit matches'
  ) {
    return {
      actionType: 'APPROVE_VISUAL_MATCHES',
      target: 'TIMELINE',
    };
  }

  // Check for show matches review
  if (
    lower === 'show matches' ||
    lower === 'show matches.' ||
    lower === 'show me the matches' ||
    lower === 'show me the matches.' ||
    lower === 'show me the matches first' ||
    lower === 'show me the matches first.' ||
    lower === 'review matches' ||
    lower === 'show visual matches' ||
    lower === 'open visual matching review'
  ) {
    return {
      actionType: 'SHOW_VISUAL_MATCHES',
      target: 'TIMELINE',
    };
  }

  // Check for swap beat visual: e.g. "swap beat 25 with water_cases_02.jpg", "use water_cases_02.jpg for beat 25"
  const swapWithMatch = lower.match(/(?:swap|replace|change)\s+(?:beat\s+)?([0-9]+[a-z]?)(?:\s+(?:with|to|for)\s+(.+))?/i);
  const useForBeatMatch = lower.match(/use\s+(.+?)\s+for\s+(?:beat\s+)?([0-9]+[a-z]?)/i);

  if (swapWithMatch && swapWithMatch[1]) {
    return {
      actionType: 'SWAP_VISUAL_BEAT',
      target: 'TIMELINE',
      parameters: {
        beatLabel: swapWithMatch[1].toLowerCase(),
        assetName: swapWithMatch[2]?.trim(),
      },
    };
  }

  if (useForBeatMatch && useForBeatMatch[2]) {
    return {
      actionType: 'SWAP_VISUAL_BEAT',
      target: 'TIMELINE',
      parameters: {
        beatLabel: useForBeatMatch[2].toLowerCase(),
        assetName: useForBeatMatch[1]?.trim(),
      },
    };
  }

  // AI Visual/Audio Matching Trigger
  const isMatchingOrAutoEdit =
    // 1. Explicit matching / syncing commands
    /^(?:start|begin|run)\s+(?:visual\s+)?matching\b/i.test(lower) ||
    lower === 'match visuals' ||
    lower === 'match images' ||
    lower === 'start matching' ||
    lower === 'begin matching' ||
    lower === 'run matching' ||
    lower === 'visual matching' ||
    lower === 'run visual matching' ||
    // 2. "Match [my/the/these/all] [images/visuals/assets] to [the/my] [voiceover/audio/narration/script]"
    /\b(?:match|sync|align|pair)\s+(?:(?:my|the|these|all)\s+)?(?:images?|visuals?|assets?|clips?)\s+(?:to|with)\s+(?:(?:the|my)\s+)?(?:voiceover|audio|narration|speech|script|beats?)\b/i.test(lower) ||
    // 3. "Match [the/my/attached] script [and/to/with] [visuals/images/assets]"
    /\b(?:match|sync|align|pair)\s+(?:(?:the|my|attached)\s+)?(?:script|beats?|narration)\s+(?:and|to|with)\s+(?:(?:the|my|attached|project)\s+)?(?:visuals?|images?|assets?)\b/i.test(lower) ||
    // 4. "Process attached [project] assets / script [with creative auto-edit]"
    /\bprocess\s+(?:the\s+)?attached\s+(?:project\s+)?(?:assets?|script|media|images?|files?)\b/i.test(lower) ||
    // 5. "Creative auto-edit" or "auto-edit" when attached script or assets are mentioned or present
    /\bcreative\s+auto[-\s]?edit\b/i.test(lower) ||
    (lower.includes('auto-edit') && (lower.includes('asset') || lower.includes('script') || lower.includes('attach') || lower.includes('project') || Boolean(snapshot.attachedScript))) ||
    // 6. Broad semantic overlap for matching visuals to audio/script
    (lower.includes('match') &&
      (lower.includes('image') || lower.includes('visual') || lower.includes('asset')) &&
      (lower.includes('audio') || lower.includes('voiceover') || lower.includes('script') || lower.includes('narration') || lower.includes('beat'))) ||
    // 7. Explicit SRT / Subtitle alignment requests: "I want to use srt file", "sync with srt", "use srt", "calculate my srt file to my beat"
    /\b(?:use|with|from|load|import|apply|sync|match|calculate|compute)\s+(?:an?\s+)?(?:attached\s+)?srt\b/i.test(lower) ||
    /\b(?:calculate|compute|sync|match|align)\s+(?:(?:my|the)\s+)?srt\s*(?:file)?\s+(?:to|with)\s+(?:(?:my|the)\s+)?(?:beats?|script)\b/i.test(lower) ||
    /\b(?:calculate|compute|sync|match|align)\s+(?:(?:my|the)\s+)?(?:beats?|script)\s+(?:to|with)\s+(?:(?:my|the)\s+)?srt\b/i.test(lower) ||
    /\bwant\s+to\s+use\s+(?:an?\s+)?srt\b/i.test(lower) ||
    /\bsrt\s+(?:file|subtitles?|captions?|timestamps?)\b/i.test(lower) ||
    /\bsync\s+(?:with|to)\s+srt\b/i.test(lower) ||
    lower.includes('calculate my srt') ||
    lower.includes('calculate srt') ||
    lower.includes('match my srt') ||
    lower.includes('match srt to') ||
    lower.includes('sync srt to') ||
    lower.includes('analyze my voiceover and match') ||
    lower.includes('match visual assets') ||
    lower.includes('sync images to') ||
    lower.includes('sync visuals to') ||
    lower.includes('sync these images to') ||
    // 8. Explicit Image Name / Filename Matching requests:
    // e.g. "use the image names as the match cuz the image name carry exactly the sentence of that beat"
    // e.g. "use image names to match", "match by filename", "match each image to its sentence", "which image go for which audio"
    /\b(?:use|match|sync|pair|align)\s+(?:the\s+)?(?:image|file|asset|clip)\s*names?\b/i.test(lower) ||
    /\b(?:image|file|asset)\s*names?\s+(?:as|for|to|with)\s+(?:the\s+)?(?:match|sync|audio|beat|script)\b/i.test(lower) ||
    /\b(?:image|file|asset)\s*names?\s+carry\b/i.test(lower) ||
    /\bmatch\s+(?:by|using|with)\s+(?:image|file|asset)\s*names?\b/i.test(lower) ||
    /\bwhich\s+image\s+(?:go|goes)\s+for\s+which\s+(?:audio|beat|sentence|clip)\b/i.test(lower) ||
    /\bmatch\s+(?:each\s+)?image\s+to\s+(?:its\s+)?(?:sentence|beat|audio|name)\b/i.test(lower) ||
    /\bmatch\s+by\s+filenames?\b/i.test(lower) ||
    /\buse\s+(?:the\s+)?filenames?\s+(?:to|for)\s+match\b/i.test(lower) ||
    lower.includes('image names as the match') ||
    lower.includes('use the image names') ||
    lower.includes('use image names') ||
    lower.includes('match with image names') ||
    lower.includes('match by image name') ||
    lower.includes('match by file name') ||
    lower.includes('match by filename') ||
    lower.includes('image name carry') ||
    lower.includes('image names carry') ||
    lower.includes('image filename') ||
    lower.includes('which image go for which audio') ||
    lower.includes('which image goes for which audio');

  // 14a. THE ASSEMBLER SKILL (Interactive Assembler Card Trigger)
  const isAssemblerTrigger =
    lower.includes('assembler') ||
    lower.includes('make a video using my assets') ||
    lower.includes('make a video from my assets') ||
    lower.includes('create a video using my assets') ||
    lower.includes('create a video from my assets') ||
    lower.includes('build a video using my assets') ||
    lower.includes('build a video from my assets') ||
    lower.includes('assemble my video') ||
    lower.includes('assemble the video') ||
    lower.includes('assemble this') ||
    lower.includes('put together my video') ||
    lower.includes('put together a video') ||
    lower.includes('skill 1') ||
    lower === 'assemble';

  if (isAssemblerTrigger) {
    return {
      actionType: 'TRIGGER_ASSEMBLER',
      target: 'TIMELINE',
    };
  }

  // 14b. RUN ASSEMBLER DIRECTLY
  if (
    lower === 'run assembler' ||
    lower.includes('run the assembler') ||
    lower.includes('execute assembler') ||
    lower.includes('start assembler')
  ) {
    return {
      actionType: 'RUN_ASSEMBLER',
      target: 'TIMELINE',
    };
  }

  // 14c. NATURAL SOUND DESIGN & SFX (Whoosh, Sound Effects)
  if (
    lower.includes('whoosh') ||
    lower.includes('sfx') ||
    lower.includes('sound effect') ||
    lower.includes('sound effects')
  ) {
    const beatMatch = lower.match(/beat\s*#?\s*(\d+)/i);
    const timeMatch = lower.match(/(?:at|on)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)?/i);
    return {
      actionType: 'ADD_SFX',
      target: 'TIMELINE',
      parameters: {
        sfxType: 'whoosh',
        beatIndex: beatMatch ? parseInt(beatMatch[1], 10) : undefined,
        time: timeMatch ? parseFloat(timeMatch[1]) : undefined,
      },
    };
  }

  if (isMatchingOrAutoEdit) {
    return {
      actionType: 'MATCH_VISUALS_TO_AUDIO',
      target: 'TIMELINE',
    };
  }

  // 15. BUILD SEQUENCE / APPLY EDITS (Fallback general sequence assembly)
  if (
    lower === 'apply' ||
    lower === 'apply it' ||
    lower === 'apply this' ||
    lower.includes('apply to timeline') ||
    lower.includes('assemble clips') ||
    lower.includes('build sequence')
  ) {
    return {
      actionType: 'BUILD_RECAP',
      target: 'TIMELINE',
    };
  }

  return null;
}

// =============================================================================
// HELPER: Resolve follow-up answers to clarification questions
// =============================================================================
function resolveClarificationFollowUp(
  text: string,
  snapshot: EditorContextSnapshot,
  chatHistory?: AIChatMessage[]
): DetectedChatIntent | null {
  if (!chatHistory || chatHistory.length === 0) return null;

  const lower = text.toLowerCase().trim();
  const lastAssistantMsg = [...chatHistory].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistantMsg) return null;

  const lastContent = lastAssistantMsg.content.toLowerCase();

  // User was asked "Which clip should I delete?"
  if (lastContent.includes('which clip should i delete')) {
    if (lower.includes('cancel') || lower.includes('nevermind') || lower.includes('don\'t')) {
      return {
        type: 'CHAT',
        conversationalReply: 'Understood, I cancelled the delete command.',
        reasoning: 'User cancelled following clarification question.',
      };
    }

    const resolved = resolveClipTarget(text, snapshot);
    if (resolved.resolved) {
      return {
        type: 'EDIT_COMMAND',
        actionType: 'DELETE_CLIP',
        target: resolved.target,
        targetId: resolved.clipId,
        targetIndex: resolved.clipIndex,
        parameters: { clipId: resolved.clipId, clipIndex: resolved.clipIndex },
        reasoning: `User clarified which clip to delete: ${resolved.clipId || resolved.clipIndex}.`,
      };
    }
  }

  // User was asked "Which clip do you want me to move?"
  if (lastContent.includes('which clip do you want me to move')) {
    if (lower.includes('cancel') || lower.includes('nevermind') || lower.includes('don\'t')) {
      return {
        type: 'CHAT',
        conversationalReply: 'Understood, I cancelled the move command.',
        reasoning: 'User cancelled following clarification question.',
      };
    }

    const resolved = resolveClipTarget(text, snapshot);
    if (resolved.resolved) {
      return {
        type: 'EDIT_COMMAND',
        actionType: 'MOVE_CLIP',
        target: resolved.target,
        targetId: resolved.clipId,
        targetIndex: resolved.clipIndex,
        parameters: { targetSeconds: 0, clipId: resolved.clipId, clipIndex: resolved.clipIndex },
        reasoning: `User clarified which clip to move: ${resolved.clipId || resolved.clipIndex}.`,
      };
    }
  }

  return null;
}

// =============================================================================
// MAIN FUNCTION: detectChatIntent
// Classifies every user message into exactly ONE of:
// - CHAT
// - EDIT_COMMAND
// - NEEDS_CLARIFICATION
// =============================================================================
export function detectChatIntent(
  userText: string,
  snapshot: EditorContextSnapshot,
  chatHistory?: AIChatMessage[]
): DetectedChatIntent {
  const trimmed = userText.trim();

  // 1. Check if this is a direct answer to a previous clarification question
  const followUp = resolveClarificationFollowUp(trimmed, snapshot, chatHistory);
  if (followUp) {
    return followUp;
  }

  // 1.5 Check for user correction or command repetition (e.g. "I said duplicate it", "I said delete clip 1")
  const correctionMatch = /^(?:i\s+(?:already\s+|just\s+)?said(?:\s+to)?|i\s+told\s+you\s+to|i\s+meant|please\s+just)\s+(.+)/i.exec(trimmed);
  if (correctionMatch) {
    const rawActionText = correctionMatch[1].trim();
    // Try multi-action first
    const innerMulti = parseMultiActionRequest(rawActionText, snapshot);
    if (innerMulti && innerMulti.length > 0) {
      return {
        type: 'EDIT_COMMAND',
        actionType: innerMulti[0].actionType,
        target: innerMulti[0].target,
        actions: innerMulti,
        reasoning: `User correction detected multi-action edit command: ${rawActionText}`,
      };
    }
    // Try single action
    const innerSingle = detectSingleAction(rawActionText, snapshot);
    if (innerSingle && 'actionType' in innerSingle) {
      return {
        type: 'EDIT_COMMAND',
        actionType: innerSingle.actionType,
        target: innerSingle.target,
        targetId: innerSingle.targetId,
        targetIndex: innerSingle.targetIndex,
        parameters: { ...innerSingle.parameters, isCorrection: true },
        reasoning: `User correction detected edit command: ${rawActionText}`,
      };
    }
    // If user said "I said do it" or similar without stating the action verb,
    // look back in chat history for the last attempted edit command
    if (chatHistory && chatHistory.length > 0) {
      for (let i = chatHistory.length - 1; i >= 0; i--) {
        const msg = chatHistory[i];
        if (msg.role === 'user') {
          const prevIntent = detectChatIntent(msg.content, snapshot);
          if (prevIntent.type === 'EDIT_COMMAND') {
            return {
              ...prevIntent,
              parameters: { ...prevIntent.parameters, isCorrection: true },
              reasoning: `User confirmed/retried previous command: "${msg.content}".`,
            };
          }
        }
      }
    }
  }

  // 1.6 Check for user readiness confirmation (e.g. "Yes am ready", "ready", "go ahead", "let's do it")
  const isReadinessConfirmation =
    /^(?:yes(?:,\s*|\s+)?(?:i\s*am\s*|i'm\s*|am\s*)?ready|i\s*am\s*ready|i'm\s*ready|ready|go\s*ahead|let's\s*do\s*it|do\s*it\s*now|proceed|start\s*matching|begin\s*matching|calculate\s*now)[\.\!]?$/i.test(trimmed);

  if (isReadinessConfirmation) {
    const hasVisualMatchingContext =
      Boolean(snapshot.attachedScript) ||
      (chatHistory &&
        chatHistory.some(
          (m) =>
            m.content.toLowerCase().includes('beat') ||
            m.content.toLowerCase().includes('srt') ||
            m.content.toLowerCase().includes('match') ||
            m.content.toLowerCase().includes('script')
        ));

    if (hasVisualMatchingContext) {
      return {
        type: 'EDIT_COMMAND',
        actionType: 'MATCH_VISUALS_TO_AUDIO',
        target: 'TIMELINE',
        reasoning: `User confirmed readiness to proceed with visual matching and SRT calculation: "${trimmed}".`,
      };
    }
  }

  // 2. Check for Multi-Action Requests first (Section 7)
  // e.g. "Split the clip at 5 seconds and delete the second part"
  // e.g. "Add background music and duck it to 20%"
  const multiActions = parseMultiActionRequest(trimmed, snapshot);
  if (multiActions && multiActions.length > 0) {
    return {
      type: 'EDIT_COMMAND',
      actionType: multiActions[0].actionType,
      target: multiActions[0].target,
      actions: multiActions,
      reasoning: `Multi-action editing request detected with ${multiActions.length} sub-actions.`,
    };
  }

  // 3. Discussion vs Instruction Check (Section 5)
  // Questions, advice, aesthetics, hypothetical questions ("What happens if I delete the clip?")
  if (isDiscussionOrQuestion(trimmed)) {
    return {
      type: 'CHAT',
      reasoning: 'User message classified as conversational discussion or question; editor will not be mutated.',
    };
  }

  // 4. Single Action Detection
  const singleAction = detectSingleAction(trimmed, snapshot);

  if (singleAction) {
    // Check if missing required information genuinely requires clarification
    if ('needsClarification' in singleAction) {
      return {
        type: 'NEEDS_CLARIFICATION',
        clarificationQuestion: singleAction.question,
        reasoning: singleAction.reason,
      };
    }

    const condition = parseCommandCondition(trimmed);

    return {
      type: 'EDIT_COMMAND',
      actionType: singleAction.actionType,
      target: singleAction.target,
      targetId: singleAction.targetId,
      targetIndex: singleAction.targetIndex,
      condition,
      parameters: singleAction.parameters,
      reasoning: `Explicit editing command detected: ${singleAction.actionType}${condition ? ` with condition: ${condition.rawDescription}` : ''}.`,
    };
  }

  // 5. Default Fallback: Treat as CHAT (Do not overclassify!)
  return {
    type: 'CHAT',
    reasoning: 'No explicit editing command recognized; treating as normal conversation to prevent accidental mutation.',
  };
}
