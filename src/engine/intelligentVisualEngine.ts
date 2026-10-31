import {
  ProjectAsset,
  VideoClip,
  AudioTrackClip,
  CaptionClip,
  AspectRatio,
  TransitionType,
  AIEditCommand,
  AIEditPlan,
} from '../types';
import { AudioSegmentAnalysis } from '../utils/audioWaveform';
import {
  analyzeVisualAssets,
  matchBeatsToVisuals,
  AuthoritativeScriptBeat,
} from './visualAudioMatcher';

export interface VisualBeat {
  id: string;
  beatIndex: number; // 1-based index (e.g. 1, 2, 3...)
  sentenceIndex: number;
  text: string;
  fullSentence: string;
  startTime: number;
  endTime: number;
  duration: number;
  suggestedVisualDescription: string;
  coreKeywords: string[];
  actionVerbs: string[];
  keyObjects: string[];
  charactersOrSubjects: string[];
  matchedAssetId?: string;
  matchedAssetName?: string; // Original filename (NEVER renamed)
  matchedAssetThumbnail?: string;
  matchedAssetUrl?: string;
  matchScore: number; // 0.0 to 1.0
  matchConfidence: 'high' | 'medium' | 'low' | 'unmatched';
  matchReason: string;
  isUnmatched: boolean;
  isMultiActionInSentence: boolean;
  sfx?: string;
  transition?: TransitionType;
  keyframeZoom?: boolean;
}

export interface VisualMatchingPlan {
  id: string;
  title: string;
  beats: VisualBeat[];
  totalDuration: number;
  masterAudioDuration: number;
  hasAudioMaster: boolean;
  totalAssetsCount: number;
  matchedCount: number;
  unmatchedCount: number;
  unusedAssetsCount: number;
  aspectRatio: AspectRatio;
  audioTrackAsset?: ProjectAsset;
}

export interface ImageCandidateProfile {
  asset: ProjectAsset;
  originalFileName: string;
  cleanTokens: Set<string>;
  tokenArray: string[];
  actionKeywords: Set<string>;
  objectKeywords: Set<string>;
  subjectKeywords: Set<string>;
  locationKeywords: Set<string>;
  isActionShot: boolean;
  dominantColor?: string;
  brightness?: string;
}

// Common action verbs in storytelling & tutorials
const ACTION_VERBS = new Set([
  'wake', 'wakes', 'waking', 'woke',
  'walk', 'walks', 'walking', 'walked',
  'run', 'runs', 'running', 'ran', 'rush', 'rushes', 'rushing',
  'grab', 'grabs', 'grabbing', 'grabbed', 'take', 'takes', 'taking', 'took',
  'turn', 'turns', 'turning', 'turned',
  'open', 'opens', 'opening', 'opened', 'close', 'closes', 'closing', 'closed',
  'stare', 'stares', 'staring', 'stared', 'look', 'looks', 'looking', 'looked',
  'see', 'sees', 'seeing', 'saw',
  'drop', 'drops', 'dropping', 'dropped',
  'sit', 'sits', 'sitting', 'sat', 'stand', 'stands', 'standing', 'stood',
  'leave', 'leaves', 'leaving', 'left', 'enter', 'enters', 'entering', 'entered',
  'drive', 'drives', 'driving', 'drove',
  'jump', 'jumps', 'jumping', 'jumped',
  'call', 'calls', 'calling', 'called',
  'check', 'checks', 'checking', 'checked',
  'pour', 'pours', 'pouring', 'poured', 'drink', 'drinks', 'drinking', 'drank',
  'eat', 'eats', 'eating', 'ate',
  'write', 'writes', 'writing', 'wrote', 'type', 'types', 'typing',
  'click', 'clicks', 'clicking', 'clicked',
  'stop', 'stops', 'stopping', 'stopped',
  'escape', 'escapes', 'escaping', 'escaped',
  'hide', 'hides', 'hiding', 'hid',
  'fight', 'fights', 'fighting', 'fought',
  'cry', 'cries', 'crying', 'cried', 'smile', 'smiles', 'smiling', 'smiled',
  'think', 'thinks', 'thinking', 'thought',
  'notice', 'notices', 'noticing', 'noticed',
  'reach', 'reaches', 'reaching', 'reached',
  'hold', 'holds', 'holding', 'held',
]);

const LOCATION_WORDS = new Set([
  'bathroom', 'bedroom', 'kitchen', 'living', 'room', 'house', 'home',
  'office', 'desk', 'street', 'road', 'highway', 'forest', 'woods', 'trees',
  'city', 'building', 'hospital', 'store', 'shop', 'car', 'bus', 'train',
  'outside', 'inside', 'hallway', 'doorway', 'porch', 'yard', 'garden',
  'rooftop', 'basement', 'garage', 'cabin', 'camp',
]);

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'about', 'into', 'over', 'after', 'beneath', 'under', 'above', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might',
  'must', 'it', 'its', 'they', 'them', 'their', 'he', 'him', 'his', 'she',
  'her', 'hers', 'you', 'your', 'yours', 'we', 'us', 'our', 'ours', 'i', 'me',
  'my', 'mine', 'this', 'that', 'these', 'those', 'there', 'here', 'when',
  'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'just', 'don', 'now',
]);

/**
 * Normalizes text to tokens, stripping punctuation and filtering stop words
 */
export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Extracts action verbs, objects, subjects, and locations from raw phrase text
 */
export function extractSemanticTokens(text: string): {
  tokens: string[];
  actionVerbs: string[];
  keyObjects: string[];
  charactersOrSubjects: string[];
  locations: string[];
} {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const tokens = words.filter((w) => !STOP_WORDS.has(w));
  const actionVerbs: string[] = [];
  const keyObjects: string[] = [];
  const charactersOrSubjects: string[] = [];
  const locations: string[] = [];

  for (const w of words) {
    if (ACTION_VERBS.has(w)) {
      actionVerbs.push(w);
    } else if (LOCATION_WORDS.has(w)) {
      locations.push(w);
    } else if (['stickman', 'man', 'woman', 'boy', 'girl', 'person', 'guy', 'people', 'doctor', 'cop', 'hero', 'traveler', 'friend', 'friend', 'villain', 'monster', 'clown', 'alien'].includes(w)) {
      charactersOrSubjects.push(w);
    } else if (!STOP_WORDS.has(w) && w.length >= 3) {
      keyObjects.push(w);
    }
  }

  return {
    tokens,
    actionVerbs,
    keyObjects,
    charactersOrSubjects,
    locations,
  };
}

/**
 * Builds candidate profile from a ProjectAsset without modifying its original name
 */
export function buildImageCandidateProfile(asset: ProjectAsset): ImageCandidateProfile {
  const originalFileName = asset.name;
  
  // Parse filename tokens (handle camelCase, snake_case, dashes, numbering)
  const cleanBase = originalFileName
    .replace(/\.[^/.]+$/, '') // remove extension (.png, .jpg, etc.)
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
    .replace(/[-_.\d#]+/g, ' ') // replace numbers, dashes, underscores
    .toLowerCase();

  const fileWords = cleanBase.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  const tagWords = (asset.tags || []).map((t) => t.toLowerCase());

  const tokenSet = new Set<string>([...fileWords, ...tagWords]);
  const tokenArray = Array.from(tokenSet);

  const actionKeywords = new Set<string>();
  const objectKeywords = new Set<string>();
  const subjectKeywords = new Set<string>();
  const locationKeywords = new Set<string>();

  for (const token of tokenArray) {
    if (ACTION_VERBS.has(token)) actionKeywords.add(token);
    else if (LOCATION_WORDS.has(token)) locationKeywords.add(token);
    else if (['stickman', 'man', 'woman', 'person', 'people', 'hero', 'creature', 'monster'].includes(token)) subjectKeywords.add(token);
    else objectKeywords.add(token);
  }

  return {
    asset,
    originalFileName,
    cleanTokens: tokenSet,
    tokenArray,
    actionKeywords,
    objectKeywords,
    subjectKeywords,
    locationKeywords,
    isActionShot: asset.analysis?.isActionShot || actionKeywords.size > 0,
    dominantColor: asset.analysis?.dominantColor,
    brightness: asset.analysis?.brightness,
  };
}

/**
 * 1. SCRIPT UNDERSTANDING:
 * Parses a narration script into intelligent visual beats.
 * - Respects very short phrases ("Nothing.", "Still nothing.", "Today...", "The problem?").
 * - Splits multi-action sentences ("You grab your phone and rush outside.") into distinct visual sub-beats.
 * - Stores surrounding sentence context for each beat.
 */
export function parseIntelligentVisualBeats(scriptText: string): VisualBeat[] {
  if (!scriptText || scriptText.trim().length === 0) {
    return [];
  }

  // 1. Normalize line endings and extract clean lines
  const lines = scriptText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rawSentences: string[] = [];

  for (const line of lines) {
    // Skip meta-instruction headers often included in prompts
    if (/^(important:|note:|instructions:|for example:)/i.test(line)) {
      continue;
    }

    // Strip numbering prefixes like "1. ", "1) ", "Beat 1: ", "[1] ", "#1: ", "1 - "
    const cleanLine = line
      .replace(/^(\d+[\.\)\-:]|\b(beat|scene|shot|action|step)\s*\d+[:\.\-]?|\[\d+\]|#\d+[:\.\-]?)\s*/i, '')
      .trim();

    if (!cleanLine || cleanLine.length < 2) continue;

    // Split sentences inside the line if separated by sentence-ending punctuation followed by whitespace and a capital letter or quote
    const parts = cleanLine
      .split(/(?<=[.?!])\s+(?=[A-Z"'\d])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (parts.length > 0) {
      rawSentences.push(...parts);
    } else {
      rawSentences.push(cleanLine);
    }
  }

  const beats: VisualBeat[] = [];
  let beatCounter = 1;

  for (let sIdx = 0; sIdx < rawSentences.length; sIdx++) {
    const sentence = rawSentences[sIdx];
    if (!sentence) continue;

    // Check if sentence contains multiple sequential actions:
    // Pattern: [Action clause A] (and | then | but | while) [Action clause B]
    // Only split if both parts have meaningful verbs or independent visual moments
    const multiActionClauses = splitSentenceIntoActionClauses(sentence);

    if (multiActionClauses.length > 1) {
      for (let cIdx = 0; cIdx < multiActionClauses.length; cIdx++) {
        const clause = multiActionClauses[cIdx];
        const { tokens, actionVerbs, keyObjects, charactersOrSubjects } = extractSemanticTokens(clause);

        beats.push({
          id: `beat-${beatCounter}`,
          beatIndex: beatCounter,
          sentenceIndex: sIdx + 1,
          text: clause,
          fullSentence: sentence,
          startTime: 0,
          endTime: 0,
          duration: 0,
          suggestedVisualDescription: clause,
          coreKeywords: tokens,
          actionVerbs,
          keyObjects,
          charactersOrSubjects,
          matchScore: 0,
          matchConfidence: 'unmatched',
          matchReason: '',
          isUnmatched: true,
          isMultiActionInSentence: true,
        });
        beatCounter++;
      }
    } else {
      // Single action or short phrase (e.g. "Nothing.", "You walk into the bathroom.")
      const { tokens, actionVerbs, keyObjects, charactersOrSubjects } = extractSemanticTokens(sentence);

      beats.push({
        id: `beat-${beatCounter}`,
        beatIndex: beatCounter,
        sentenceIndex: sIdx + 1,
        text: sentence,
        fullSentence: sentence,
        startTime: 0,
        endTime: 0,
        duration: 0,
        suggestedVisualDescription: sentence,
        coreKeywords: tokens,
        actionVerbs,
        keyObjects,
        charactersOrSubjects,
        matchScore: 0,
        matchConfidence: 'unmatched',
        matchReason: '',
        isUnmatched: true,
        isMultiActionInSentence: false,
      });
      beatCounter++;
    }
  }

  return beats;
}

/**
 * Splits a compound sentence into sequential action clauses when appropriate
 */
function splitSentenceIntoActionClauses(sentence: string): string[] {
  // If sentence is very short, keep it together
  const words = sentence.split(/\s+/);
  if (words.length <= 6) {
    return [sentence];
  }

  // Regex splitting on conjunctions connecting action verbs: " and ", " then ", " but "
  const parts = sentence.split(/(?:,\s*and\s+|,\s*then\s+|\s+and\s+then\s+|\s+and\s+|\s+then\s+)/i);
  if (parts.length <= 1) {
    return [sentence];
  }

  // Check if each part contains at least one action or subject
  const validParts: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.length < 3) continue;

    const partWords = part.toLowerCase().split(/\s+/);
    const hasVerb = partWords.some((w) => ACTION_VERBS.has(w));
    if (hasVerb || partWords.length >= 3) {
      validParts.push(part);
    } else if (validParts.length > 0) {
      // Merge with previous part if too short
      validParts[validParts.length - 1] += ' and ' + part;
    } else {
      validParts.push(part);
    }
  }

  return validParts.length > 1 ? validParts : [sentence];
}

/**
 * 2. AUDIO TRANSCRIPTION & TIMING MASTER:
 * Aligns parsed visual beats to spoken audio duration and speech intervals.
 * Enforces ZERO blank gaps: visual continuity remains active through narrator pauses.
 */
export function alignBeatsWithAudioMaster(
  beats: VisualBeat[],
  masterAudio?: ProjectAsset,
  audioAnalysis?: AudioSegmentAnalysis
): {
  alignedBeats: VisualBeat[];
  totalDuration: number;
  hasAudioMaster: boolean;
  masterAudioDuration: number;
} {
  if (beats.length === 0) {
    return {
      alignedBeats: [],
      totalDuration: 0,
      hasAudioMaster: false,
      masterAudioDuration: 0,
    };
  }

  const hasAudioMaster = Boolean(masterAudio && masterAudio.duration > 0);
  const masterAudioDuration = masterAudio?.duration || audioAnalysis?.duration || 0;

  const numBeats = beats.length;
  // Calculate relative weight for each beat based on word count
  const weights = beats.map((b) => {
    const wc = b.text.split(/\s+/).filter(Boolean).length;
    // Even very short phrases ("Nothing.") get a minimum weight to receive audible pacing
    return Math.max(1.2, wc);
  });
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  // If we have master audio, use its exact duration; otherwise calculate natural speaking duration (~140 WPM)
  const targetDuration = masterAudioDuration > 0
    ? Number(masterAudioDuration.toFixed(2))
    : Number((totalWeight * 0.45).toFixed(2));

  // Compute exact monotonic boundary timestamps (B_0 = 0, B_N = targetDuration)
  const boundaries: number[] = new Array(numBeats + 1);
  boundaries[0] = 0.00;
  boundaries[numBeats] = targetDuration;

  const activeSpeechIntervals = masterAudio?.analysis?.speechIntervals || audioAnalysis?.speechIntervals;

  if (activeSpeechIntervals && activeSpeechIntervals.length >= 2 && masterAudioDuration > 0) {
    // Map beats along speech energy intervals
    const voiceIntervals = activeSpeechIntervals.filter((iv) => !iv.isSilence && iv.duration >= 0.15);

    let cumulativeWeight = 0;
    for (let i = 1; i < numBeats; i++) {
      cumulativeWeight += weights[i - 1];
      const targetFraction = cumulativeWeight / totalWeight;
      const targetTime = targetFraction * masterAudioDuration;

      // Find nearest speech boundary near targetTime
      let closestBoundary = targetTime;
      let minDistance = Infinity;

      for (const iv of voiceIntervals) {
        const dStart = Math.abs(iv.start - targetTime);
        const dEnd = Math.abs(iv.end - targetTime);
        if (dStart < minDistance) {
          minDistance = dStart;
          closestBoundary = iv.start;
        }
        if (dEnd < minDistance) {
          minDistance = dEnd;
          closestBoundary = iv.end;
        }
      }

      const minVal = boundaries[i - 1] + 0.3;
      const maxVal = targetDuration - (numBeats - i) * 0.3;
      boundaries[i] = Number(Math.max(minVal, Math.min(maxVal, closestBoundary)).toFixed(2));
    }
  } else {
    // Proportional distribution matching speech envelope
    let cumulativeWeight = 0;
    for (let i = 1; i < numBeats; i++) {
      cumulativeWeight += weights[i - 1];
      const targetFraction = cumulativeWeight / totalWeight;
      const rawTime = targetFraction * targetDuration;
      const minVal = boundaries[i - 1] + 0.3;
      const maxVal = targetDuration - (numBeats - i) * 0.3;
      boundaries[i] = Number(Math.max(minVal, Math.min(maxVal, rawTime)).toFixed(2));
    }
  }

  // Strict monotonicity check
  for (let i = 1; i <= numBeats; i++) {
    if (boundaries[i] <= boundaries[i - 1]) {
      boundaries[i] = Number((boundaries[i - 1] + 0.2).toFixed(2));
    }
  }
  boundaries[numBeats] = targetDuration;

  // Apply timestamps to beats (Zero Gaps: each beat endTime is next beat startTime)
  const alignedBeats = beats.map((beat, idx) => {
    const startTime = boundaries[idx];
    const endTime = boundaries[idx + 1];
    const duration = Number((endTime - startTime).toFixed(2));

    return {
      ...beat,
      startTime,
      endTime,
      duration,
    };
  });

  return {
    alignedBeats,
    totalDuration: targetDuration,
    hasAudioMaster,
    masterAudioDuration: targetDuration,
  };
}

/**
 * 4. GLOBAL IMAGE MATCHING (Delegates entirely to visualAudioMatcher):
 * Evaluates the visual assets against the beats using strict sequential numeric pairing.
 */
export function performGlobalIntelligentImageMatching(
  beats: VisualBeat[],
  imageAssets: ProjectAsset[]
): {
  matchedBeats: VisualBeat[];
  matchedCount: number;
  unmatchedCount: number;
  unusedAssets: ProjectAsset[];
} {
  if (beats.length === 0) {
    return {
      matchedBeats: [],
      matchedCount: 0,
      unmatchedCount: 0,
      unusedAssets: [...imageAssets],
    };
  }

  const visualAssets = imageAssets.filter((a) => a.type === 'image' || a.type === 'video');
  if (visualAssets.length === 0) {
    return {
      matchedBeats: beats.map((b) => ({
        ...b,
        matchScore: 0,
        matchConfidence: 'unmatched',
        matchReason: 'No visual images uploaded in project library.',
        isUnmatched: true,
      })),
      matchedCount: 0,
      unmatchedCount: beats.length,
      unusedAssets: [],
    };
  }

  // Convert VisualBeat to AuthoritativeScriptBeat and delegate directly to visualAudioMatcher
  const authBeats: AuthoritativeScriptBeat[] = beats.map((b) => ({
    id: b.id,
    beatIndex: b.beatIndex,
    beatLabel: String(b.beatIndex),
    numberPart: b.beatIndex,
    letterPart: '',
    rawText: b.text,
    normalizedText: b.text.toLowerCase(),
    startTime: b.startTime,
    endTime: b.endTime,
    duration: b.duration,
    requiredConcepts: b.coreKeywords || [],
    actionVerbs: b.actionVerbs || [],
    keyObjects: b.keyObjects || [],
    peopleOrCharacters: b.charactersOrSubjects || [],
    environmentKeywords: [],
  }));

  const profiles = analyzeVisualAssets(visualAssets);
  const matches = matchBeatsToVisuals(authBeats, profiles);

  const matchedBeats: VisualBeat[] = beats.map((b, idx) => {
    const m = matches[idx];
    const asset = m?.matchedAsset;
    return {
      ...b,
      matchedAssetId: asset?.assetId,
      matchedAssetName: asset?.assetName,
      matchedAssetThumbnail: asset?.thumbnailUrl || asset?.url,
      matchedAssetUrl: asset?.url,
      matchScore: m?.matchScore ?? 0,
      matchConfidence:
        m?.status === 'STRONG_MATCH' ? 'high' : m?.status === 'NEEDS_REVIEW' ? 'medium' : 'unmatched',
      matchReason: m?.matchReason ?? '',
      isUnmatched: !asset || m?.status === 'NO_SUITABLE_VISUAL',
    };
  });

  const matchedAssetIds = new Set(matchedBeats.map((b) => b.matchedAssetId).filter(Boolean));
  const unusedAssets = visualAssets.filter((a) => !matchedAssetIds.has(a.id));

  return {
    matchedBeats,
    matchedCount: matchedBeats.filter((b) => !b.isUnmatched).length,
    unmatchedCount: matchedBeats.filter((b) => b.isUnmatched).length,
    unusedAssets,
  };
}

/**
 * 5. TIMELINE INTEGRATION:
 * Converts approved visual beats and master audio into concrete CapCut timeline clips.
 * Guarantees zero empty gaps and perfectly continuous playback.
 */
export function buildTimelineClipsFromApprovedBeats(
  beats: VisualBeat[],
  masterAudio?: ProjectAsset,
  aspectRatio: AspectRatio = '16:9'
): {
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captionClips: CaptionClip[];
} {
  const videoClips: VideoClip[] = [];
  const audioClips: AudioTrackClip[] = [];
  const captionClips: CaptionClip[] = [];

  // 1. Process Video/Image Clips
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const clipId = `clip-vis-${beat.id || i + 1}-${Date.now()}`;
    const duration = beat.duration > 0 ? beat.duration : 2.5;

    // Use matched asset URL or elegant neutral placeholder
    const assetUrl = beat.matchedAssetUrl ||
      beat.matchedAssetThumbnail ||
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1280&auto=format&fit=crop&q=80';

    videoClips.push({
      id: clipId,
      title: beat.matchedAssetName || `Scene ${beat.beatIndex}`, // Preserves original name
      type: 'image',
      color: 'from-cyan-700 to-blue-800',
      url: assetUrl,
      thumbnailUrl: beat.matchedAssetThumbnail || assetUrl,
      frames: [beat.matchedAssetThumbnail || assetUrl],
      duration: duration,
      startOffset: 0,
      rawDuration: duration,
      timelineStart: beat.startTime,
      timelineEnd: beat.endTime,
      assetId: beat.matchedAssetId,
      volume: 0,
      speed: 1.0,
      aspectFit: 'cover',
      transitionAfter: beat.transition
        ? {
            id: `trans-${clipId}`,
            name: beat.transition.replace('-', ' ').toUpperCase(),
            type: beat.transition,
            duration: 0.35,
          }
        : undefined,
      keyframes: [
        { id: `kf-start-${clipId}`, time: 0, scale: 1.00, x: 0, y: 0, opacity: 1.0 },
        { id: `kf-end-${clipId}`, time: duration, scale: 1.06, x: 0, y: 0, opacity: 1.0 },
      ],
    });

    // 2. Process Synchronized Captions
    captionClips.push({
      id: `cap-${beat.id || i + 1}`,
      text: beat.text,
      startTime: beat.startTime,
      duration: duration,
      stylePreset: 'hormozi',
    });
  }

  // 3. Process Master Audio
  if (masterAudio && masterAudio.url) {
    audioClips.push({
      id: `audio-master-vo-${Date.now()}`,
      title: masterAudio.name,
      category: 'voiceover',
      url: masterAudio.url,
      file: masterAudio.file,
      duration: masterAudio.duration,
      startTime: 0,
      volume: 100,
      waveformData: masterAudio.waveformData || [],
      speechIntervals: masterAudio.analysis?.speechIntervals,
    });
  }

  return {
    videoClips,
    audioClips,
    captionClips,
  };
}
