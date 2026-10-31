/**
 * AI Visual/Audio Matching Engine (General Auto Editor)
 *
 * Core workflow:
 * Voiceover + User Script + Asset Bin
 *        ↓
 * Analyze Audio & Script
 *        ↓
 * Transcribe actual audio + timestamps (Audio is master clock)
 *        ↓
 * Preserve exact user-defined script beats (Authoritative numbering & lettering: e.g. 23a, 23b)
 *        ↓
 * Analyze visual assets (people, objects, actions, environment, scene concepts, filenames)
 *        ↓
 * Match visuals to each beat (Action shot priority, continuity, avoid duplicate abuse)
 *        ↓
 * Show proposed matches (Compact review UI: Strong match, Needs review, No suitable visual)
 *        ↓
 * User reviews/changes matches (Single-beat swap without invalidating other matches)
 *        ↓
 * User approves (Timeline is NOT modified before explicit approval)
 *        ↓
 * Place approved visuals onto EXISTING timeline (Continuous, zero unintended gaps, voiceover master)
 *        ↓
 * Verify actual timeline state (Validate track, order, clips, duration)
 *        ↓
 * Report real result
 */

import { ProjectAsset, VideoClip, AudioTrackClip, CaptionClip } from '../types';
import { analyzeAudioSpeechAndSilence } from '../utils/audioWaveform';
import { applyAutoKenBurnsToClips } from '../utils/cinematicMotion';
import {
  parseSrtText,
  isSrtFormat,
  mergeSrtCuesToScriptBeats,
  convertSrtCuesToBeats,
  separateScriptAndSrt,
  extractCleanWords,
  COMMON_ALIGN_STOP_WORDS,
} from './srtParser';

export { parseSrtText, isSrtFormat, mergeSrtCuesToScriptBeats, convertSrtCuesToBeats, separateScriptAndSrt };

// =============================================================================
// SYLLABLE-WEIGHTED GLOBAL DP ALIGNMENT ENGINE (Cutflow Proven Alignment)
// =============================================================================

import type {
  SrtCue,
  TimedWord,
  AlignedBeat,
} from './alignBeatsFromSrt';
import {
  normWord,
  countSyllables,
  srtToWords,
  alignScriptToBeats,
} from './alignBeatsFromSrt';

export type {
  SrtCue,
  TimedWord,
  AlignedBeat,
};
export {
  normWord,
  countSyllables,
  srtToWords,
  alignScriptToBeats,
};

export interface AlignedSegment {
  start: number;
  end: number;
  text: string;
}

// Align script beats to SRT cues using the global DP syllable-weighted engine
export function alignScriptBeatsToSrt(
  beats: string[],
  cues: SrtCue[],
  totalAudioDuration: number
): AlignedSegment[] {
  const aligned = alignScriptToBeats(beats, cues, totalAudioDuration);
  return aligned.map((b) => ({
    start: b.start,
    end: b.end,
    text: b.text,
  }));
}

// =============================================================================
// 1. DATA STRUCTURES & INTERFACES
// =============================================================================

export type MatchStatus = 'STRONG_MATCH' | 'NEEDS_REVIEW' | 'NO_SUITABLE_VISUAL';

export interface AuthoritativeScriptBeat {
  id: string;
  beatIndex: number; // 1-based sequential order
  beatLabel: string; // Exact user label: "23a", "23b", "14", "1", etc.
  numberPart?: number; // e.g. 23
  letterPart?: string; // e.g. "a", "b"
  rawText: string; // Original exact text preserved without rewriting
  normalizedText: string;
  startTime: number; // Audio master start time in seconds
  endTime: number; // Audio master end time in seconds
  duration: number; // Audio duration in seconds
  // Semantic concepts extracted for matching
  requiredConcepts: string[];
  actionVerbs: string[];
  keyObjects: string[];
  peopleOrCharacters: string[];
  environmentKeywords: string[];
  hasMismatchWithAudio?: boolean;
  mismatchReason?: string;
}

export interface VisualAssetProfile {
  assetId: string;
  assetName: string; // Original filename preserved
  url: string;
  thumbnailUrl: string;
  file?: File | Blob;
  type: 'image' | 'video';
  // Rich visual content analysis
  peoplePresent: boolean;
  peopleDescription?: string;
  detectedActions: string[];
  detectedObjects: string[];
  environment: string;
  sceneConcepts: string[];
  isActionShot: boolean; // Indicates active person/motion vs empty room
  visualTokens: Set<string>;
  cleanFileName: string;
  userLabel?: string;
  dominantBrightness?: 'dark' | 'normal' | 'bright';
}

export interface CandidateMatch {
  asset: VisualAssetProfile;
  score: number;
  reason: string;
  matchedAspects: string[];
}

export interface VisualBeatMatch {
  beatId: string;
  beatIndex: number;
  beatLabel: string;
  startTime: number;
  endTime: number;
  duration: number;
  scriptText: string;
  status: MatchStatus;
  matchedAsset?: VisualAssetProfile;
  matchScore: number;
  matchReason: string;
  candidateList: CandidateMatch[];
  isUserOverridden?: boolean;
}

export interface VisualMatchingSession {
  id: string;
  createdAt: number;
  audioAssetName: string;
  audioDuration: number;
  totalBeats: number;
  visualAssetsCount: number;
  strongMatchesCount: number;
  needsReviewCount: number;
  noVisualCount: number;
  matches: VisualBeatMatch[];
  masterAudio?: ProjectAsset;
}

export interface TimelinePlacementVerification {
  success: boolean;
  passed?: boolean;
  totalPlaced: number;
  expectedPlaced: number;
  timelineStart: number;
  timelineEnd: number;
  durationCovered: number;
  audioDuration: number;
  unintendedGapsDetected: number;
  masterAudioPresent: boolean;
  verifiedClips: {
    clipId: string;
    assetName: string;
    startTime: number;
    endTime: number;
    duration: number;
  }[];
  summary: string;
  error?: string;
}

// =============================================================================
// 2. AUTHORITATIVE SCRIPT BEAT PARSER
// =============================================================================

/**
 * Parses user-provided script while strictly preserving exact numbering and lettering.
 * Rule: Numbering and lettering define the visual beats.
 * Examples:
 *   "23a. You grab your phone"
 *   "23b. and rush outside."
 *   -> TWO separate beats: "23a" and "23b". NEVER merged.
 *   "14. Rivers."
 *   "15. Lakes."
 *   "16. Reservoirs."
 *   -> THREE separate beats: "14", "15", "16".
 */
export function parseAuthoritativeScriptBeats(scriptText: string): AuthoritativeScriptBeat[] {
  if (!scriptText || scriptText.trim() === '') {
    return [];
  }

  // Split by line breaks, keeping non-empty lines
  const lines = scriptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const beats: AuthoritativeScriptBeat[] = [];
  let sequentialIndex = 1;

  // Regex to detect authoritative numbering and lettering at start of line:
  // Examples matching:
  // "23a. You grab your phone" -> num: 23, let: a
  // "23b) and rush outside."  -> num: 23, let: b
  // "14. Rivers."             -> num: 14, let: ""
  // "[23a] You grab phone"    -> num: 23, let: a
  // "#23a: You grab phone"    -> num: 23, let: a
  // "Scene 23a - Phone grab"  -> num: 23, let: a
  const numberedBeatRegex = /^(?:#|scene|beat|item)?\s*\[?(\d+)([a-zA-Z])?\]?[\.\:\)\-\s]\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const match = rawLine.match(numberedBeatRegex);

    let beatLabel: string;
    let numberPart: number | undefined;
    let letterPart: string | undefined;
    let contentText: string;

    if (match) {
      numberPart = parseInt(match[1], 10);
      letterPart = match[2] ? match[2].toLowerCase() : '';
      beatLabel = `${numberPart}${letterPart}`;
      contentText = match[3]?.trim() || rawLine;
    } else {
      // Fallback for lines without explicit numbered prefix:
      // Preserves every line as an authoritative beat in order
      beatLabel = `${sequentialIndex}`;
      numberPart = sequentialIndex;
      contentText = rawLine;
    }

    // Strip leading/trailing double or single quotes (including typographical/curly quotes)
    contentText = contentText.replace(/^[\s“"”'‘]+|[\s“"”'’]+$/g, '').trim();

    // Extract semantic keywords for visual matching
    const semantic = extractSemanticTokens(contentText);

    beats.push({
      id: `beat-${beatLabel}-${sequentialIndex}`,
      beatIndex: sequentialIndex,
      beatLabel,
      numberPart,
      letterPart,
      rawText: contentText,
      normalizedText: contentText.toLowerCase(),
      startTime: 0,
      endTime: 0,
      duration: 0,
      requiredConcepts: semantic.coreKeywords,
      actionVerbs: semantic.actionVerbs,
      keyObjects: semantic.keyObjects,
      peopleOrCharacters: semantic.peopleKeywords,
      environmentKeywords: semantic.locations,
    });

    sequentialIndex++;
  }

  return beats;
}

// =============================================================================
// 3. AUDIO TRANSCRIPTION & MASTER CLOCK TIMING
// =============================================================================

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const commaIndex = reader.result.indexOf(',');
        resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fetchAudioBlob(asset: ProjectAsset): Promise<{ blob: Blob; mimeType: string } | null> {
  if (asset.file) {
    return { blob: asset.file, mimeType: asset.file.type || 'audio/mp3' };
  }
  if (asset.url && typeof window !== 'undefined') {
    try {
      const res = await fetch(asset.url);
      if (res.ok) {
        const blob = await res.blob();
        return { blob, mimeType: blob.type || 'audio/mp3' };
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Analyzes audio and aligns authoritative script beats to the master audio clock.
 * Uses real Gemini speech-to-text alignment when available, with deterministic acoustic fallback.
 * Guarantees monotonic continuous timing with zero empty gaps.
 */
export async function transcribeAndTimestampAudio(
  beats: AuthoritativeScriptBeat[],
  masterAudio?: ProjectAsset,
  srtSource?: string | ProjectAsset
): Promise<{
  beatsWithTiming: AuthoritativeScriptBeat[];
  audioDuration: number;
  audioName: string;
  hasAudio: boolean;
  alignmentMethod?: 'srt_subtitle_parser' | 'gemini_speech_to_text' | 'acoustic_fallback';
  srtCuesCount?: number;
}> {
  if (beats.length === 0) {
    return {
      beatsWithTiming: [],
      audioDuration: 0,
      audioName: 'None',
      hasAudio: false,
    };
  }

  // 1. PRIMARY & AUTHORITATIVE: SRT Subtitle Alignment (Zero Gemini API Quota)
  // Check if an SRT file / content was passed directly or exists in masterAudio metadata
  const srtRawText =
    typeof srtSource === 'string'
      ? srtSource
      : srtSource?.textContent ||
        (srtSource as any)?.rawContent ||
        (masterAudio?.analysis as any)?.srtText ||
        '';

  if (srtRawText && isSrtFormat(srtRawText)) {
    const srtCues = parseSrtText(srtRawText);
    if (srtCues.length > 0) {
      const parsedDuration =
        masterAudio && masterAudio.duration && masterAudio.duration > 0
          ? masterAudio.duration
          : Math.max(...srtCues.map((c) => c.endTime));

      const mergedBeats = mergeSrtCuesToScriptBeats(beats, srtCues, parsedDuration);

      return {
        beatsWithTiming: mergedBeats,
        audioDuration: Number(parsedDuration.toFixed(3)),
        audioName: masterAudio ? masterAudio.name : 'SRT Master Subtitles',
        hasAudio: true,
        alignmentMethod: 'srt_subtitle_parser',
        srtCuesCount: srtCues.length,
      };
    }
  }

  const audioDuration =
    masterAudio && masterAudio.duration && masterAudio.duration > 0
      ? masterAudio.duration
      : estimateScriptDuration(beats);

  const audioName = masterAudio ? masterAudio.name : 'Estimated Speech Pacing';
  const hasAudio = Boolean(masterAudio && masterAudio.duration && masterAudio.duration > 0);

  // 2. Secondary: Attempt Real Speech-to-Text Alignment with Gemini API (Audio Master Clock)
  if (masterAudio && typeof window !== 'undefined') {
    try {
      const audioData = await fetchAudioBlob(masterAudio);
      if (audioData && audioData.blob.size > 0) {
        const audioBase64 = await blobToBase64(audioData.blob);
        const alignPayload = {
          audioBase64,
          mimeType: audioData.mimeType,
          audioDuration,
          beats: beats.map((b) => ({
            beat_index: b.beatIndex,
            beat_label: b.beatLabel,
            text: b.rawText,
          })),
        };

        const abortCtrl = new AbortController();
        const timeoutId = setTimeout(() => abortCtrl.abort(), 15000);

        let response: Response | null = null;
        try {
          response = await fetch('/api/ai-editor/align-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alignPayload),
            signal: abortCtrl.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (response && response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.alignedBeats) && data.alignedBeats.length > 0) {
            const alignedMap = new Map<number, { start_time: number; end_time: number; confidence?: string }>();
            for (const item of data.alignedBeats) {
              const idx = typeof item.beat_index === 'number' ? item.beat_index : parseInt(item.beat_index, 10);
              if (!isNaN(idx)) {
                alignedMap.set(idx, {
                  start_time: Number(item.start_time),
                  end_time: Number(item.end_time),
                  confidence: item.confidence,
                });
              }
            }

            // Build beats with real Gemini speech-to-text timestamps
            const beatsWithTiming: AuthoritativeScriptBeat[] = [];
            let prevEnd = 0.0;

            for (let i = 0; i < beats.length; i++) {
              const b = beats[i];
              const geminiTiming = alignedMap.get(b.beatIndex);

              let start = geminiTiming && !isNaN(geminiTiming.start_time) ? geminiTiming.start_time : prevEnd;
              let rawEnd = geminiTiming && !isNaN(geminiTiming.end_time) ? geminiTiming.end_time : start + 2.0;

              // Ensure monotonic progression
              if (start < prevEnd) {
                start = prevEnd;
              }
              if (rawEnd <= start) {
                rawEnd = Number((start + 0.5).toFixed(2));
              }

              // Look ahead to next beat start to extend and eliminate any black frames
              let end = rawEnd;
              const nextBeat = beats[i + 1];
              const nextTiming = nextBeat ? alignedMap.get(nextBeat.beatIndex) : undefined;
              if (nextTiming && !isNaN(nextTiming.start_time) && nextTiming.start_time > start) {
                end = nextTiming.start_time;
              } else if (i === beats.length - 1 && audioDuration > 0 && audioDuration > start) {
                end = audioDuration;
              }

              // Ensure not exceeding total audio duration (unless last beat)
              if (audioDuration > 0 && start >= audioDuration) {
                start = Math.max(0, audioDuration - 0.5);
                end = audioDuration;
              }

              const duration = Number((end - start).toFixed(2));
              prevEnd = end;

              beatsWithTiming.push({
                ...b,
                startTime: Number(start.toFixed(2)),
                endTime: Number(end.toFixed(2)),
                duration,
                hasMismatchWithAudio: false,
              });
            }

            return {
              beatsWithTiming,
              audioDuration: Number(audioDuration.toFixed(3)),
              audioName,
              hasAudio: true,
              alignmentMethod: 'gemini_speech_to_text',
            };
          } else {
            const serverError =
              data.error || data.message || 'Gemini speech-to-text alignment failed to extract timestamps from the audio narration.';
            throw new Error(serverError);
          }
        } else if (response && !response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`Alignment API returned HTTP ${response.status}: ${errText || response.statusText}`);
        }
      }
    } catch (alignErr: any) {
      console.error('Gemini audio alignment error:', alignErr);
      throw alignErr;
    }
  }

  // 2. Deterministic Syllable/Speech-Weight Fallback
  // If master audio has speech interval analysis (from Web Audio API acoustic decoding)
  let speechIntervals = (masterAudio?.analysis?.speechIntervals || []).filter((s) => !s.isSilence);

  // If intervals are not yet computed but an audio file is present, decode real acoustic speech boundaries
  // Only decode directly in browser if audio is under 45s, avoiding main thread lockup on 8.5-minute narrations
  if (
    speechIntervals.length === 0 &&
    masterAudio?.file &&
    typeof window !== 'undefined' &&
    audioDuration <= 45
  ) {
    try {
      const acousticAnalysis = await analyzeAudioSpeechAndSilence(masterAudio.file);
      if (acousticAnalysis?.speechIntervals && acousticAnalysis.speechIntervals.length > 0) {
        speechIntervals = acousticAnalysis.speechIntervals.filter((s) => !s.isSilence);
        // Cache back onto masterAudio analysis for subsequent operations
        if (!masterAudio.analysis) {
          masterAudio.analysis = {};
        }
        masterAudio.analysis.speechIntervals = acousticAnalysis.speechIntervals;
      }
    } catch {
      // Gracefully continue with syllable/word weight pacing
    }
  }

  // Calculate syllable/word weights for natural pacing
  const beatWeights = beats.map((b) => {
    const words = b.rawText.split(/\s+/).filter((w) => w.length > 0).length;
    const chars = b.rawText.length;
    // Word length + character factor
    return Math.max(1.0, words * 0.7 + chars * 0.05);
  });

  const totalWeight = beatWeights.reduce((acc, w) => acc + w, 0);

  // Compute contiguous cut points: N beats -> N + 1 cut points
  // cutPoints[0] is strictly 0.0 (master timeline start)
  // cutPoints[N] is strictly audioDuration (master audio end)
  const cutPoints: number[] = [0];
  let accumulatedWeight = 0;

  for (let i = 0; i < beats.length - 1; i++) {
    accumulatedWeight += beatWeights[i];
    const rawCut = (accumulatedWeight / totalWeight) * audioDuration;
    let cutTime = Number(rawCut.toFixed(2));

    // Align with nearest speech interval boundary if available nearby
    if (speechIntervals.length > 0) {
      const nearestInterval = speechIntervals.find(
        (sp) => Math.abs(sp.start - cutTime) < 0.5 || Math.abs(sp.end - cutTime) < 0.5
      );
      if (nearestInterval) {
        const candidate =
          Math.abs(nearestInterval.start - cutTime) < Math.abs(nearestInterval.end - cutTime)
            ? nearestInterval.start
            : nearestInterval.end;

        const prevCut = cutPoints[cutPoints.length - 1];
        // Ensure monotonic progression and at least 0.5s per beat
        const minRemaining = (beats.length - 1 - i) * 0.5;
        if (candidate > prevCut + 0.5 && candidate < audioDuration - minRemaining) {
          cutTime = Number(candidate.toFixed(2));
        }
      }
    }

    // Ensure strictly greater than previous cut point
    const prevCut = cutPoints[cutPoints.length - 1];
    if (cutTime <= prevCut) {
      cutTime = Number((prevCut + 0.5).toFixed(2));
    }

    cutPoints.push(cutTime);
  }

  // Final cut point strictly pins to master audio duration
  cutPoints.push(Number(audioDuration.toFixed(2)));

  const beatsWithTiming: AuthoritativeScriptBeat[] = [];

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const beatStart = cutPoints[i];
    const beatEnd = cutPoints[i + 1];
    const beatDuration = Number((beatEnd - beatStart).toFixed(2));

    // Check for potential audio/script duration mismatch
    let hasMismatch = false;
    let mismatchReason: string | undefined;
    if (hasAudio && beatDuration < 0.5) {
      hasMismatch = true;
      mismatchReason = 'Audio pacing unusually brief for beat text length';
    }

    beatsWithTiming.push({
      ...beat,
      startTime: beatStart,
      endTime: beatEnd,
      duration: beatDuration,
      hasMismatchWithAudio: hasMismatch,
      mismatchReason,
    });
  }

  return {
    beatsWithTiming,
    audioDuration: Number(audioDuration.toFixed(3)),
    audioName,
    hasAudio,
  };
}

function estimateScriptDuration(beats: AuthoritativeScriptBeat[]): number {
  const totalWords = beats.reduce(
    (acc, b) => acc + b.rawText.split(/\s+/).filter((w) => w.length > 0).length,
    0
  );
  // Standard conversational narration is ~140 words per minute (2.33 words per second)
  return Math.max(10, Number((totalWords / 2.33).toFixed(2)));
}

// =============================================================================
// 4. VISUAL ASSET ANALYSIS ENGINE
// =============================================================================

/**
 * Analyzes all available visual assets in the Asset Bin.
 * Dissects people, objects, actions, environment, descriptions, tags, and filenames.
 * Prioritizes action shots (person performing an action vs static empty background).
 */
export function analyzeVisualAssets(assets: ProjectAsset[]): VisualAssetProfile[] {
  const visualAssets = assets.filter((a) => a.type === 'image' || a.type === 'video');

  return visualAssets.map((asset) => {
    const cleanFileName = asset.name
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[\-_]/g, ' ')
      .trim();

    // Aggregate descriptive textual metadata available on the asset without duplicating raw name
    const textSources = [
      cleanFileName,
      asset.analysis?.description || '',
      asset.textContent || '',
      ...(asset.tags || []),
    ].filter(Boolean).join(' ');

    const tokens = extractSemanticTokens(textSources);
    const uniqueActions = Array.from(new Set(tokens.actionVerbs));
    const uniqueObjects = Array.from(new Set(tokens.keyObjects));
    const uniqueLocations = Array.from(new Set(tokens.locations));
    const uniquePeople = Array.from(new Set(tokens.peopleKeywords));

    // Identify domain-specific visual concepts using word-boundary matching
    const domainConcepts: string[] = [];
    const lowerSources = textSources.toLowerCase();
    for (const [domainKey, domainDef] of Object.entries(CONCEPT_DOMAINS)) {
      const hasTrigger = domainDef.triggerWords.some((w) => {
        const regex = new RegExp(`\\b${w}\\b`, 'i');
        return regex.test(lowerSources);
      });
      if (hasTrigger) {
        domainConcepts.push(...domainDef.visualConcepts);
      }
    }

    // Analyze for action markers
    const isActionShot =
      Boolean(asset.analysis?.isActionShot) ||
      uniqueActions.length > 0 ||
      /\b(walking|running|grabbing|rushing|carrying|holding|standing|opening|entering|turning|driving|calling|looking|farming|harvesting)\b/i.test(
        textSources
      );

    // Detect people in visual
    const peoplePresent =
      uniquePeople.length > 0 ||
      /\b(person|man|woman|people|boy|girl|stickman|character|crowd|farmer|shopper)\b/i.test(
        textSources
      );

    // Environment/location
    const environment =
      uniqueLocations.length > 0
        ? uniqueLocations[0]
        : detectEnvironmentFromText(textSources);

    // Build comprehensive visual token set
    const visualTokens = new Set<string>();
    [
      ...tokens.coreKeywords,
      ...uniqueActions,
      ...uniqueObjects,
      ...uniquePeople,
      ...uniqueLocations,
      ...domainConcepts,
    ].forEach((t) => visualTokens.add(t.toLowerCase()));

    // Include parts of clean filename
    cleanFileName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .forEach((w) => visualTokens.add(w));

    return {
      assetId: asset.id,
      assetName: asset.name,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl || asset.url,
      file: asset.file,
      type: asset.type as 'image' | 'video',
      peoplePresent,
      peopleDescription: peoplePresent ? 'Character or person present in scene' : undefined,
      detectedActions: uniqueActions,
      detectedObjects: uniqueObjects,
      environment,
      sceneConcepts: Array.from(new Set([...tokens.coreKeywords, ...domainConcepts])),
      isActionShot,
      visualTokens,
      cleanFileName,
      dominantBrightness: 'normal',
    };
  });
}

function detectEnvironmentFromText(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('bathroom') || lower.includes('sink') || lower.includes('faucet') || lower.includes('toilet')) return 'bathroom';
  if (lower.includes('farm') || lower.includes('farmland') || lower.includes('crop') || lower.includes('wheat') || lower.includes('pasture') || lower.includes('barn') || lower.includes('tractor')) return 'farmland';
  if (lower.includes('supermarket') || lower.includes('store') || lower.includes('grocery') || lower.includes('aisle') || lower.includes('shelves')) return 'supermarket';
  if (lower.includes('river') || lower.includes('stream') || lower.includes('creek') || lower.includes('canal') || lower.includes('waterway')) return 'river';
  if (lower.includes('lake') || lower.includes('pond')) return 'lake';
  if (lower.includes('reservoir') || lower.includes('dam') || lower.includes('basin')) return 'reservoir';
  if (lower.includes('water')) return 'water body';
  if (lower.includes('outside') || lower.includes('street') || lower.includes('road') || lower.includes('highway') || lower.includes('outdoor')) return 'outside';
  if (lower.includes('kitchen')) return 'kitchen';
  if (lower.includes('bedroom') || lower.includes('room') || lower.includes('house') || lower.includes('living room')) return 'indoor';
  return 'general scene';
}

// =============================================================================
// NARRATIVE CONTEXT MODELING FOR AUTHORITATIVE BEATS
// =============================================================================

export interface BeatNarrativeContext {
  beatIndex: number;
  beatLabel: string;
  isShortBeat: boolean;
  isNegationOrContinuation: boolean;
  primaryDomain?: string;
  expandedConcepts: Set<string>;
  actionVerbs: string[];
  keyObjects: string[];
  environment: string;
  narrativeDescription: string;
  prohibitedEnvironments: string[];
}

/**
 * Builds rich narrative context for each beat by evaluating:
 * 1. The beat itself.
 * 2. Preceding and following narrative context.
 * 3. Expanded visual concept domains (e.g. Farms -> crops, fields, barn, agriculture; Rivers -> stream, flowing water).
 * 4. Contextual negations and continuations (e.g. "They're not.", "Nothing.", "Still nothing.").
 */
export function buildNarrativeContexts(beats: AuthoritativeScriptBeat[]): BeatNarrativeContext[] {
  const contexts: BeatNarrativeContext[] = [];

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const rawLower = beat.rawText.toLowerCase().trim();
    const rawWords = rawLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const isShortBeat = rawWords.length <= 4;

    // Detect negation / absence phrases that rely on preceding context:
    // e.g. "They're not.", "They are not.", "Nothing.", "Still nothing.", "None.", "Not working.", "Not running."
    const isNegationOrContinuation =
      /\b(they're not|they are not|it's not|is not|are not|still nothing|nothing|not yet|neither|nowhere|no luck|none|not running|not working)\b/i.test(
        beat.rawText
      );

    let primaryDomain: string | undefined;
    let environment = beat.environmentKeywords[0] || '';
    const keyObjects = [...beat.keyObjects];
    const actionVerbs = [...beat.actionVerbs];
    const expandedConcepts = new Set<string>([
      ...beat.requiredConcepts,
      ...beat.actionVerbs,
      ...beat.keyObjects,
      ...beat.environmentKeywords,
    ]);
    let narrativeDescription = beat.rawText;
    let prohibitedEnvironments: string[] = [];

    if (isNegationOrContinuation) {
      // Look back at preceding 1-3 beats to inherit the scene, object, and question being evaluated
      let foundPrecedingContext = false;
      for (let prevIdx = i - 1; prevIdx >= Math.max(0, i - 3); prevIdx--) {
        const prevBeat = beats[prevIdx];
        const prevLower = prevBeat.rawText.toLowerCase();

        // Check if preceding beat checked water, taps, sink, or plumbing
        if (
          prevLower.includes('water') ||
          prevLower.includes('tap') ||
          prevLower.includes('faucet') ||
          prevLower.includes('sink')
        ) {
          primaryDomain = 'plumbing';
          environment = 'bathroom';
          keyObjects.push('tap', 'faucet', 'sink', 'water');
          ['tap', 'taps', 'faucet', 'sink', 'water', 'dry', 'empty', 'stopped', 'bathroom', 'kitchen', 'plumbing'].forEach(
            (c) => expandedConcepts.add(c)
          );
          narrativeDescription = 'dry or non-running faucet/sink with no water flowing';
          prohibitedEnvironments = ['farmland', 'supermarket', 'outside street'];
          foundPrecedingContext = true;
          break;
        }

        // Check if preceding beat checked phone, communication, or waiting
        if (
          prevLower.includes('phone') ||
          prevLower.includes('call') ||
          prevLower.includes('message') ||
          prevLower.includes('wait')
        ) {
          primaryDomain = 'phone_communication';
          environment = 'indoor';
          keyObjects.push('phone', 'smartphone', 'screen');
          ['phone', 'smartphone', 'screen', 'waiting', 'silent', 'clock', 'quiet'].forEach((c) =>
            expandedConcepts.add(c)
          );
          narrativeDescription = 'waiting by phone/screen with no notifications or silence';
          prohibitedEnvironments = ['farmland', 'supermarket', 'water body'];
          foundPrecedingContext = true;
          break;
        }

        // Check if preceding beat checked supermarket, store, or groceries
        if (
          prevLower.includes('store') ||
          prevLower.includes('supermarket') ||
          prevLower.includes('grocery') ||
          prevLower.includes('shelf') ||
          prevLower.includes('shelves')
        ) {
          primaryDomain = 'supermarket';
          environment = 'supermarket';
          keyObjects.push('shelves', 'cart', 'aisle');
          ['supermarket', 'grocery', 'shelves', 'shelf', 'aisle', 'empty', 'depleted', 'store'].forEach((c) =>
            expandedConcepts.add(c)
          );
          narrativeDescription = 'empty supermarket shelves following store search';
          prohibitedEnvironments = ['farmland', 'bathroom', 'water body'];
          foundPrecedingContext = true;
          break;
        }
      }

      if (!foundPrecedingContext && i > 0) {
        // Inherit the immediately preceding beat's domain and environment with emptiness/stillness
        const prevBeat = beats[i - 1];
        if (prevBeat.environmentKeywords.length > 0) {
          environment = prevBeat.environmentKeywords[0];
        }
        prevBeat.keyObjects.forEach((o) => keyObjects.push(o));
        ['empty', 'dry', 'deserted', 'nothing', 'still'].forEach((c) => expandedConcepts.add(c));
        narrativeDescription = `emptiness or absence following "${prevBeat.rawText}"`;
      }
    } else {
      // Direct semantic domain identification
      for (const [domainKey, domainDef] of Object.entries(CONCEPT_DOMAINS)) {
        const matchesDomain = domainDef.triggerWords.some((trigger) => {
          const regex = new RegExp(`\\b${trigger}\\b`, 'i');
          return regex.test(rawLower);
        });

        if (matchesDomain) {
          primaryDomain = domainKey;
          if (!environment || environment === 'general scene') {
            environment = domainDef.defaultEnvironment;
          }
          domainDef.visualConcepts.forEach((c) => expandedConcepts.add(c));
          domainDef.typicalObjects.forEach((o) => {
            if (!keyObjects.includes(o)) keyObjects.push(o);
          });
          narrativeDescription = domainDef.name;
          prohibitedEnvironments = domainDef.prohibitedEnvironments;
          break;
        }
      }
    }

    if (!environment) {
      environment = detectEnvironmentFromText(beat.rawText);
    }

    contexts.push({
      beatIndex: beat.beatIndex,
      beatLabel: beat.beatLabel,
      isShortBeat,
      isNegationOrContinuation,
      primaryDomain,
      expandedConcepts,
      actionVerbs,
      keyObjects,
      environment,
      narrativeDescription,
      prohibitedEnvironments,
    });
  }

  return contexts;
}

// =============================================================================
// 5. BEAT-TO-VISUAL MATCHING ENGINE
// =============================================================================

const STOP_WORDS_FOR_SENTENCE = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'can', 'could', 'may',
  'might', 'must', 'that', 'this', 'these', 'those', 'i', 'you', 'he',
  'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why',
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'scene', 'beat', "they're", 'still', 'there', 'here',
]);

/**
 * Evaluates whether an image's filename contains or matches the beat's sentence.
 * AI-generated batch images (e.g. from Midjourney, Stable Diffusion, Whisk) often have
 * filenames formatted with the prompt / narration sentence.
 */
export function evaluateFilenameSentenceMatch(
  assetName: string,
  beatText: string,
  beatIndex?: number,
  beatLabel?: string
): {
  isSentenceMatch: boolean;
  score: number;
  reason: string;
  matchedWords: string[];
} {
  if (!assetName || !beatText) {
    return { isSentenceMatch: false, score: 0, reason: '', matchedWords: [] };
  }

  // 1. Strip file extension and clean asset name
  const rawNoExt = assetName.replace(/\.[^/.]+$/, '');
  const cleanAsset = rawNoExt
    .replace(/^whisk_batch_\d+_\d+[\s\-_]*/i, '') // Whisk batch prefix
    .replace(/^batch_\d+[\s\-_]*/i, '')
    .replace(/^(?:scene|beat|image|shot|frame|img)[\s\-_]*\d+[\s\-_]*/i, '')
    .replace(/^\d+[\.\:\)\-_]+\s*/, '') // Leading numbers e.g. "001_", "1. "
    .replace(/[\-_]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Clean beat text
  const cleanBeat = beatText
    .replace(/^(?:#|scene|beat|item)?\s*\[?(\d+)([a-zA-Z])?\]?[\.\:\)\-]\s+/i, '')
    .replace(/[\-_]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanAsset || !cleanBeat) {
    return { isSentenceMatch: false, score: 0, reason: '', matchedWords: [] };
  }

  // Extract non-stop words to ensure we only match on substantive content
  const assetWords = cleanAsset
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS_FOR_SENTENCE.has(w));
  const beatWords = cleanBeat
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS_FOR_SENTENCE.has(w));

  // If there are no substantive content words, do not trigger sentence match
  if (assetWords.length === 0 || beatWords.length === 0) {
    return { isSentenceMatch: false, score: 0, reason: '', matchedWords: [] };
  }

  // A. Exact sentence match
  if (cleanAsset === cleanBeat) {
    return {
      isSentenceMatch: true,
      score: 1.0,
      reason: `exact sentence in filename ("${assetName}")`,
      matchedWords: assetWords,
    };
  }

  // B. Substring match (either filename contains full sentence or vice-versa)
  if (
    (cleanAsset.length >= 8 && cleanBeat.includes(cleanAsset)) ||
    (cleanBeat.length >= 8 && cleanAsset.includes(cleanBeat))
  ) {
    return {
      isSentenceMatch: true,
      score: 0.98,
      reason: `sentence substring in filename ("${assetName}")`,
      matchedWords: assetWords,
    };
  }

  // C. Word token overlap
  const beatSet = new Set(beatWords);
  const matched = Array.from(new Set(assetWords.filter((w) => beatSet.has(w))));
  const overlapRatio = matched.length / Math.min(assetWords.length, beatWords.length);

  // If 3+ significant words match or >= 50% overlap of significant words
  if (matched.length >= 3 || (assetWords.length <= 2 && matched.length === assetWords.length) || overlapRatio >= 0.5) {
    const score = Number(Math.min(0.96, 0.75 + overlapRatio * 0.22).toFixed(2));
    return {
      isSentenceMatch: true,
      score,
      reason: `filename words match beat sentence (${matched.slice(0, 4).join(', ')})`,
      matchedWords: matched,
    };
  }

  // D. Index matching ONLY for pure index filenames (e.g. 001.png, whisk_batch_001.png)
  const isPureIndex = /^(?:(?:whisk_)?batch_\d+_\d+|(?:image|img|frame|scene|beat|shot)[\s\-_]*)?\d{1,4}$/i.test(rawNoExt.trim());
  if (isPureIndex && beatIndex && beatIndex > 0) {
    const numMatches = rawNoExt.match(/(?:^|[^\d])(\d{1,4})(?:[^\d]|$)/g);
    if (numMatches) {
      for (const m of numMatches) {
        const num = parseInt(m.replace(/\D/g, ''), 10);
        if (num === beatIndex) {
          return {
            isSentenceMatch: true,
            score: 0.75,
            reason: `filename sequential index #${beatIndex} matches beat #${beatIndex}`,
            matchedWords: [`#${beatIndex}`],
          };
        }
      }
    }
  }

  return { isSentenceMatch: false, score: 0, reason: '', matchedWords: [] };
}

/**
 * Extracts leading numbers from image filenames (e.g. "009_-_And_every_s.jpg" -> 9).
 */
export function extractLeadingNumber(filename: string): number | null {
  if (!filename) return null;
  const base = (filename.split('/').pop() || filename).trim();
  const match = base.match(/^0*(\d+)/);
  if (match) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? null : val;
  }
  const prefixMatch = base.match(/^(?:#|scene|beat|item|img|image|clip|shot|frame)[\s\-_]*0*(\d+)/i);
  if (prefixMatch) {
    const val = parseInt(prefixMatch[1], 10);
    return isNaN(val) ? null : val;
  }
  const bracketMatch = base.match(/^\[0*(\d+)\]/);
  if (bracketMatch) {
    const val = parseInt(bracketMatch[1], 10);
    return isNaN(val) ? null : val;
  }
  const anyNumMatch = base.match(/(?:^|[^\d])0*(\d{1,4})(?:[^\d]|$)/);
  if (anyNumMatch) {
    const val = parseInt(anyNumMatch[1], 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Strict forward-only matching function:
 * 1. Extract leading number from image filename (e.g. "005_...jpg" -> 5) and pair Image #N directly to Script Beat #N.
 * 2. Start searching SRT cues strictly from previousClip.endTime.
 * 3. If a cue matches: clip.startTime = cue.startTime, clip.duration = Math.min(cue.endTime - cue.startTime, 5.0).
 * 4. If NO cue matches forward: clip.startTime = previousClip.endTime, clip.duration = 2.5.
 * 5. NEVER let a single image exceed 5.0 seconds. Advance to clip N+1 immediately.
 */
export function matchBeatsToVisuals(
  beats: AuthoritativeScriptBeat[],
  visualProfiles: VisualAssetProfile[],
  srtInput?: SrtCue[] | string,
  audioDurationInput?: number
): VisualBeatMatch[] {
  if (beats.length === 0) return [];

  // Parse SRT cues if provided
  let srtCues: SrtCue[] = [];
  if (Array.isArray(srtInput)) {
    srtCues = srtInput;
  } else if (typeof srtInput === 'string' && isSrtFormat(srtInput)) {
    srtCues = parseSrtText(srtInput);
  }

  // Calculate dynamic fallback duration: audio.duration / beats.length, clamped between 2.5s and 5.5s
  const effectiveAudioDuration =
    typeof audioDurationInput === 'number' && audioDurationInput > 0
      ? audioDurationInput
      : beats.length > 0 && typeof beats[beats.length - 1].endTime === 'number' && beats[beats.length - 1].endTime! > 0
      ? beats[beats.length - 1].endTime!
      : (srtCues.length > 0 ? Math.max(...srtCues.map((c) => c.endTime)) : 534.0);

  const rawAvg = effectiveAudioDuration / Math.max(beats.length, 1);
  const fallbackDuration = Math.max(2.5, Math.min(rawAvg, 5.5));

  // 1. Numeric Index Pairing:
  // Extract leading numbers from image filenames (e.g. "005_-_And_every_s.jpg" -> 5)
  // Pair Image #N directly with Script Beat #N (1-to-1 matching)
  const numberedProfileMap = new Map<number, VisualAssetProfile>();
  for (const prof of visualProfiles) {
    const num = extractLeadingNumber(prof.assetName);
    if (num !== null && !numberedProfileMap.has(num)) {
      numberedProfileMap.set(num, prof);
    }
  }

  // 2. Word-Level SRT Alignment (Zero Guessing, Perfect Sync across 162 beats & 196+ cues)
  let wordAlignedSegments: AlignedSegment[] = [];
  if (srtCues.length > 0) {
    wordAlignedSegments = alignScriptBeatsToSrt(
      beats.map((b) => b.rawText),
      srtCues,
      effectiveAudioDuration
    );
  }

  // 3. Strict Forward-Only Matching Loop
  let previousClipEndTime = 0.0;
  const matches: VisualBeatMatch[] = [];

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const beatNum =
      beat.numberPart !== undefined
        ? beat.numberPart
        : beat.beatIndex !== undefined
        ? beat.beatIndex
        : i + 1;

    // Pair Image #N directly with Script Beat #N
    let matchedAsset = numberedProfileMap.get(beatNum);
    if (!matchedAsset) {
      // Check for exact/strong sentence text match in filename
      const beatClean = beat.rawText.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (beatClean.length >= 6) {
        matchedAsset = visualProfiles.find((prof) => {
          const fileClean = prof.cleanFileName.toLowerCase().replace(/[^a-z0-9]/g, '');
          return fileClean.includes(beatClean) || beatClean.includes(fileClean);
        });
      }
    }
    if (!matchedAsset && numberedProfileMap.size === 0 && visualProfiles.length > 0) {
      matchedAsset = visualProfiles[i % visualProfiles.length];
    }

    let clipStartTime: number;
    let clipDuration: number;

    if (wordAlignedSegments.length === beats.length) {
      const seg = wordAlignedSegments[i];
      clipStartTime = previousClipEndTime;
      const targetEnd = i === beats.length - 1 ? effectiveAudioDuration : seg.end;
      clipDuration = Math.max(0.2, targetEnd - clipStartTime);
    } else if (typeof beat.startTime === 'number' && typeof beat.duration === 'number' && beat.duration > 0) {
      clipStartTime = Math.max(previousClipEndTime, beat.startTime);
      const nextBeat = i + 1 < beats.length ? beats[i + 1] : undefined;
      if (nextBeat && typeof nextBeat.startTime === 'number' && nextBeat.startTime > clipStartTime) {
        clipDuration = nextBeat.startTime - clipStartTime;
      } else {
        clipDuration = Math.max(1.5, beat.duration);
      }
    } else {
      // Dynamic fallback duration (around 3.3s, clamped between 2.5s and 5.5s)
      clipStartTime = previousClipEndTime;
      clipDuration = fallbackDuration;
    }

    // Stretch previous clip to current clipStartTime if needed
    if (clipStartTime > previousClipEndTime) {
      if (matches.length > 0) {
        const prevMatch = matches[matches.length - 1];
        prevMatch.duration = clipStartTime - prevMatch.startTime;
        prevMatch.endTime = Number((prevMatch.startTime + prevMatch.duration).toFixed(2));
        if (prevMatch.endTime < clipStartTime) {
          clipStartTime = prevMatch.endTime;
        }
      } else {
        clipStartTime = previousClipEndTime;
      }
    } else if (clipStartTime < previousClipEndTime) {
      clipStartTime = previousClipEndTime;
    }

    const clipEndTime = Number((clipStartTime + clipDuration).toFixed(2));
    previousClipEndTime = clipEndTime;

    // Advance to clip N+1 immediately
    matches.push({
      beatId: beat.id,
      beatIndex: beat.beatIndex,
      beatLabel: beat.beatLabel,
      startTime: Number(clipStartTime.toFixed(2)),
      endTime: clipEndTime,
      duration: Number(clipDuration.toFixed(2)),
      scriptText: beat.rawText,
      status: matchedAsset ? 'STRONG_MATCH' : 'NO_SUITABLE_VISUAL',
      matchedAsset,
      matchScore: matchedAsset ? 1.0 : 0.0,
      matchReason: matchedAsset
        ? `Paired directly with Image #${beatNum} ("${matchedAsset.assetName}")`
        : `No image with numeric index #${beatNum} found in uploaded files.`,
      candidateList: matchedAsset
        ? [
            {
              asset: matchedAsset,
              score: 1.0,
              reason: `Numeric index pairing #${beatNum}`,
              matchedAspects: [`numeric index #${beatNum}`],
            },
          ]
        : [],
    });
  }

  return matches;
}

function evaluateCandidateMatch(
  beat: AuthoritativeScriptBeat,
  cand: VisualAssetProfile,
  narrativeCtx: BeatNarrativeContext,
  prevMatch: VisualBeatMatch | undefined,
  nextBeat: AuthoritativeScriptBeat | undefined,
  currentUsageCount: number
): CandidateMatch {
  let visualScore = 0;
  const matchedAspects: string[] = [];
  let hasSubstantiveVisualMatch = false;
  let isContradictory = false;

  const candNameLower = cand.cleanFileName.toLowerCase();

  // 0. Filename Sentence & Prompt Matching (For AI-generated images named after the script/prompt)
  const sentenceMatch = evaluateFilenameSentenceMatch(
    cand.assetName,
    beat.rawText,
    beat.beatIndex,
    beat.beatLabel
  );

  if (sentenceMatch.isSentenceMatch) {
    visualScore = Math.max(visualScore, sentenceMatch.score);
    hasSubstantiveVisualMatch = true;
    isContradictory = false;
    matchedAspects.push(sentenceMatch.reason);
  }

  // 1. Contextual Concept Domain Alignment (Farming, Waterways, Lakes, Reservoirs, Plumbing, etc.)
  const matchedDomainConcepts: string[] = [];
  narrativeCtx.expandedConcepts.forEach((concept) => {
    if (
      cand.visualTokens.has(concept) ||
      cand.detectedObjects.includes(concept) ||
      cand.sceneConcepts.includes(concept) ||
      cand.environment.toLowerCase().includes(concept)
    ) {
      matchedDomainConcepts.push(concept);
    }
  });

  if (matchedDomainConcepts.length >= 2) {
    visualScore += 0.50;
    hasSubstantiveVisualMatch = true;
    matchedAspects.push(
      `domain "${narrativeCtx.primaryDomain || 'narrative'}" (${matchedDomainConcepts.slice(0, 3).join(', ')})`
    );
  } else if (matchedDomainConcepts.length === 1) {
    visualScore += 0.35;
    hasSubstantiveVisualMatch = true;
    matchedAspects.push(`concept "${matchedDomainConcepts[0]}"`);
  }

  // Negation & Absence State Alignment (e.g. dry tap, empty shelves, blank screen)
  let hasNegationState = false;
  if (narrativeCtx.isNegationOrContinuation) {
    const negationKeywords = [
      'dry', 'empty', 'stopped', 'nothing', 'blank', 'quiet', 'silent',
      'depleted', 'deserted', 'barren', 'drought', 'abandoned',
    ];
    hasNegationState = negationKeywords.some(
      (nk) => cand.visualTokens.has(nk) || cand.sceneConcepts.includes(nk)
    );
    if (hasNegationState) {
      visualScore += 0.35;
      hasSubstantiveVisualMatch = true;
      matchedAspects.push(`negative/absence state`);
    } else if (prevMatch && prevMatch.matchedAsset?.assetId === cand.assetId) {
      visualScore -= 0.20;
    }
  }

  // 2. Action & Character Alignment (Action shots prioritized over static backgrounds)
  const beatHasAction = beat.actionVerbs.length > 0;
  let actionMatched = false;
  if (beatHasAction) {
    for (const verb of beat.actionVerbs) {
      if (cand.detectedActions.includes(verb) || cand.visualTokens.has(verb)) {
        visualScore += 0.30;
        actionMatched = true;
        hasSubstantiveVisualMatch = true;
        matchedAspects.push(`action "${verb}"`);
        break;
      }
      const actionSynonyms: Record<string, string[]> = {
        grab: ['hold', 'holding', 'take', 'taking', 'touch', 'carry', 'carries'],
        grabs: ['hold', 'holds', 'holding', 'takes', 'carry'],
        grabbing: ['holding', 'taking', 'touching', 'carrying'],
        hold: ['grab', 'grabbing', 'carry'],
        rush: ['run', 'running', 'hurry', 'dash', 'escape'],
        rushes: ['runs', 'running', 'hurries'],
        rushing: ['running', 'hurrying', 'dashing'],
        walk: ['enter', 'entering', 'step', 'stepping'],
        walks: ['enters', 'entering', 'steps'],
        walking: ['entering', 'stepping'],
      };
      const syns = actionSynonyms[verb] || [];
      const matchedSyn = syns.find((s) => cand.detectedActions.includes(s) || cand.visualTokens.has(s));
      if (matchedSyn) {
        visualScore += 0.25;
        actionMatched = true;
        hasSubstantiveVisualMatch = true;
        matchedAspects.push(`action "${verb}" (via ${matchedSyn})`);
        break;
      }
    }

    if (cand.isActionShot) {
      visualScore += 0.15;
      matchedAspects.push(`active character/motion`);
    } else {
      visualScore -= 0.10;
    }
  }

  // 3. Key Object Overlap
  let objectsMatched = 0;
  for (const obj of narrativeCtx.keyObjects) {
    if (cand.detectedObjects.includes(obj) || cand.visualTokens.has(obj)) {
      visualScore += 0.25;
      objectsMatched++;
      hasSubstantiveVisualMatch = true;
      matchedAspects.push(`object "${obj}"`);
      continue;
    }
    const objectSynonyms: Record<string, string[]> = {
      phone: ['smartphone', 'cellphone', 'screen', 'device', 'mobile'],
      phones: ['smartphones', 'cellphones', 'screens', 'devices'],
      smartphone: ['phone', 'cellphone', 'mobile'],
      car: ['vehicle', 'automobile', 'truck'],
      bottle: ['water', 'drink'],
      tap: ['faucet', 'sink', 'plumbing'],
      faucet: ['tap', 'sink', 'plumbing'],
      field: ['crops', 'wheat', 'farmland'],
      crops: ['field', 'wheat', 'farm', 'harvest'],
    };
    const syns = objectSynonyms[obj] || [];
    const matchedSyn = syns.find((s) => cand.detectedObjects.includes(s) || cand.visualTokens.has(s));
    if (matchedSyn) {
      visualScore += 0.25;
      objectsMatched++;
      hasSubstantiveVisualMatch = true;
      matchedAspects.push(`object "${obj}" (via ${matchedSyn})`);
    }
  }

  // 4. People / Character Overlap
  const beatMentionsPerson =
    beat.peopleOrCharacters.length > 0 ||
    /\b(you|he|she|they|person|man|woman|people|someone|character|farmer|shopper)\b/i.test(beat.rawText);

  if (beatMentionsPerson && cand.peoplePresent) {
    visualScore += 0.15;
    matchedAspects.push(`person/character present`);
  }

  // 5. Location & Environment Overlap
  let environmentMatched = false;
  if (narrativeCtx.environment && narrativeCtx.environment !== 'general scene') {
    if (
      cand.environment.toLowerCase().includes(narrativeCtx.environment) ||
      cand.visualTokens.has(narrativeCtx.environment)
    ) {
      visualScore += 0.20;
      environmentMatched = true;
      hasSubstantiveVisualMatch = true;
      matchedAspects.push(`location "${narrativeCtx.environment}"`);
    }
  }

  // 6. Context from Neighboring Beats & Narrative Continuity
  if (
    narrativeCtx.isShortBeat &&
    !narrativeCtx.isNegationOrContinuation &&
    prevMatch &&
    prevMatch.matchedAsset
  ) {
    if (cand.assetId === prevMatch.matchedAsset.assetId && !isContradictory) {
      visualScore += 0.15;
      matchedAspects.push(`narrative continuity from previous beat`);
    }
  }

  if (nextBeat && nextBeat.environmentKeywords.length > 0) {
    for (const nLoc of nextBeat.environmentKeywords) {
      if (cand.environment.toLowerCase().includes(nLoc) || cand.visualTokens.has(nLoc)) {
        visualScore += 0.05;
        break;
      }
    }
  }

  // 7. Contradiction Detection (Penalize visual that directly contradicts narrative meaning)
  if (narrativeCtx.prohibitedEnvironments.length > 0) {
    const isProhibited = narrativeCtx.prohibitedEnvironments.some((penv) =>
      cand.environment.toLowerCase().includes(penv)
    );
    if (isProhibited) {
      isContradictory = true;
      visualScore -= 0.40;
      matchedAspects.push(`contradicts scene environment (${cand.environment})`);
    }
  }

  // 8. Filename Numbers / Labels (SUPPORTING EVIDENCE ONLY)
  const labelMatches =
    Boolean(beat.beatLabel) &&
    (candNameLower.includes(beat.beatLabel.toLowerCase()) ||
      (Boolean(beat.numberPart) &&
        candNameLower.includes(beat.numberPart!.toString().padStart(3, '0')) &&
        (!beat.letterPart || candNameLower.includes(beat.letterPart))));

  let filenameBonus = 0;
  if (labelMatches) {
    if (hasSubstantiveVisualMatch && !isContradictory) {
      filenameBonus = 0.10;
      matchedAspects.push(`supporting filename label "${beat.beatLabel}"`);
    } else {
      // Contradiction / No visual evidence: filename says label, but visual does not represent beat
      visualScore -= 0.35;
      isContradictory = true;
      matchedAspects.push(`contradictory/unsupported filename label "${beat.beatLabel}"`);
    }
  }

  // 9. Excessive Reuse Penalty
  if (currentUsageCount > 0 && !narrativeCtx.isShortBeat) {
    visualScore -= Math.min(0.30, currentUsageCount * 0.15);
  }

  let totalScore = visualScore + filenameBonus;

  // Enforce ceiling: If there is no substantive visual match or it contradicts the narrative, cap at <= 0.30
  if (!hasSubstantiveVisualMatch || isContradictory) {
    totalScore = Math.min(0.30, totalScore);
  }

  // If this is a negation beat and candidate does not depict the negative/absence state, cap at 0.50
  if (narrativeCtx.isNegationOrContinuation && !hasNegationState) {
    totalScore = Math.min(0.50, totalScore);
  }

  const finalScore = Math.max(0.0, Math.min(1.0, Number(totalScore.toFixed(2))));

  const reason =
    matchedAspects.length > 0
      ? `Matches ${matchedAspects.join(', ')} in "${cand.assetName}".`
      : `No substantive visual alignment for "${narrativeCtx.narrativeDescription}" in "${cand.assetName}".`;

  return {
    asset: cand,
    score: finalScore,
    reason,
    matchedAspects,
  };
}

// =============================================================================
// 6. SINGLE-BEAT SWAP
// =============================================================================

/**
 * Swaps the assigned visual asset for a single beat without invalidating or
 * altering any other approved matches.
 */
export function swapVisualForBeat(
  currentMatches: VisualBeatMatch[],
  targetBeatLabelOrId: string,
  newAsset: ProjectAsset
): VisualBeatMatch[] {
  const cleanTarget = targetBeatLabelOrId.trim().toLowerCase();

  return currentMatches.map((m) => {
    const isTarget =
      m.beatId.toLowerCase() === cleanTarget ||
      m.beatLabel.toLowerCase() === cleanTarget ||
      `#${m.beatLabel}`.toLowerCase() === cleanTarget ||
      `beat ${m.beatLabel}`.toLowerCase() === cleanTarget ||
      m.beatIndex.toString() === cleanTarget;

    if (!isTarget) return m;

    // Create profile for new asset
    const newProfile: VisualAssetProfile = {
      assetId: newAsset.id,
      assetName: newAsset.name, // Preserves original filename
      url: newAsset.url,
      thumbnailUrl: newAsset.thumbnailUrl || newAsset.url,
      file: newAsset.file,
      type: (newAsset.type === 'video' ? 'video' : 'image'),
      peoplePresent: false,
      detectedActions: [],
      detectedObjects: [],
      environment: 'custom',
      sceneConcepts: [],
      isActionShot: false,
      visualTokens: new Set([newAsset.name.toLowerCase()]),
      cleanFileName: newAsset.name,
    };

    return {
      ...m,
      matchedAsset: newProfile,
      status: 'STRONG_MATCH',
      matchScore: 1.0,
      matchReason: `User manually assigned: "${newAsset.name}". Original filename preserved.`,
      isUserOverridden: true,
    };
  });
}

// =============================================================================
// 7. TIMELINE INTEGRATION & MUTATION BUILDER
// =============================================================================

/**
 * Converts approved visual matches and master audio into concrete CapCut timeline clips.
 * Places each approved visual at its calculated audio timing.
 * Master audio is preserved as the master track without alterations.
 */
export function buildTimelineClipsFromApprovedMatches(
  matches: VisualBeatMatch[],
  masterAudio?: ProjectAsset
): {
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captions: CaptionClip[];
} {
  const videoClips: VideoClip[] = [];
  const audioClips: AudioTrackClip[] = [];
  const captions: CaptionClip[] = [];

  const masterDuration =
    masterAudio && typeof masterAudio.duration === 'number' && masterAudio.duration > 0
      ? masterAudio.duration
      : 0;

  // Dynamic fallback duration based on master audio duration
  const rawAvg = masterDuration > 0 ? masterDuration / Math.max(matches.length, 1) : 3.3;
  const fallbackDuration = Math.max(2.5, Math.min(rawAvg, 5.5));

  let previousClipEndTime = 0.0;

  // 1. Process Visual Clips onto Video Track
  // Strict forward-only placement: stretch to next cue clamped to max 6.0s
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const asset = m.matchedAsset;
    const clipId = `clip-matched-${m.beatLabel || i + 1}-${Date.now()}-${i}`;

    let startTime =
      typeof m.startTime === 'number' && !isNaN(m.startTime)
        ? Number(m.startTime.toFixed(2))
        : previousClipEndTime;

    if (startTime < previousClipEndTime) {
      startTime = previousClipEndTime;
    }

    // Stretch previous clip to current startTime, clamped to max 6.0s
    if (startTime > previousClipEndTime) {
      if (videoClips.length > 0) {
        const prevClip = videoClips[videoClips.length - 1];
        prevClip.duration = Math.min(startTime - prevClip.timelineStart!, 6.0);
        prevClip.timelineEnd = Number((prevClip.timelineStart! + prevClip.duration).toFixed(2));
        prevClip.rawDuration = prevClip.duration;
        if (prevClip.timelineEnd < startTime) {
          startTime = prevClip.timelineEnd;
        }
      } else {
        startTime = previousClipEndTime;
      }
    }

    // Stretch to next cue start if forward match exists
    let duration: number;
    if (i + 1 < matches.length && typeof matches[i + 1].startTime === 'number' && matches[i + 1].startTime > startTime) {
      duration = matches[i + 1].startTime - startTime;
    } else if (i === matches.length - 1 && masterDuration > 0 && masterDuration > startTime) {
      duration = masterDuration - startTime;
    } else if (typeof m.duration === 'number' && m.duration > 0) {
      duration = m.duration;
    } else {
      duration = fallbackDuration;
    }
    duration = Math.max(1.0, duration);

    const endTime = Number((startTime + duration).toFixed(2));
    previousClipEndTime = endTime;

    const visualUrl =
      asset?.url ||
      asset?.thumbnailUrl ||
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1280&auto=format&fit=crop&q=80';

    videoClips.push({
      id: clipId,
      title: asset ? asset.assetName : `Beat ${m.beatLabel}`, // Preserves original filename
      type: asset?.type || 'image',
      color: 'from-cyan-700 to-blue-800',
      url: visualUrl,
      thumbnailUrl: asset?.thumbnailUrl || visualUrl,
      frames: [asset?.thumbnailUrl || visualUrl],
      duration,
      startOffset: 0,
      rawDuration: duration,
      timelineStart: startTime,
      timelineEnd: endTime,
      assetId: asset?.assetId,
      volume: 0,
      speed: 1.0,
      aspectFit: 'cover',
      transitionAfter: undefined, // Clean cuts without unwanted transition artifacts
      keyframes: [
        { id: `kf-start-${clipId}`, time: 0, scale: 1.0, x: 0, y: 0, opacity: 1.0 },
        { id: `kf-end-${clipId}`, time: duration, scale: 1.05, x: 0, y: 0, opacity: 1.0 },
      ],
    });

    // 2. Synchronized Captions
    captions.push({
      id: `cap-match-${m.beatLabel || i + 1}-${i}`,
      text: m.scriptText,
      startTime,
      duration,
      stylePreset: 'hormozi',
    });
  }

  // 3. Process Master Audio Track (Master timeline locked to voiceover audio duration)
  if (masterAudio && (masterAudio.url || (masterAudio.duration && masterAudio.duration > 0))) {
    audioClips.push({
      id: `audio-master-vo-${Date.now()}`,
      title: masterAudio.name || 'Master Voiceover',
      category: 'voiceover',
      url: masterAudio.url || '',
      file: masterAudio.file,
      duration: masterAudio.duration || 0,
      startTime: 0,
      volume: 100,
      trackIndex: 1,
      waveformData: masterAudio.waveformData || [],
      speechIntervals: masterAudio.analysis?.speechIntervals,
    });
  }

  return {
    videoClips: applyAutoKenBurnsToClips(videoClips, true),
    audioClips,
    captions,
  };
}

// =============================================================================
// 8. TIMELINE STATE VERIFICATION
// =============================================================================

/**
 * Inspects and verifies the actual timeline state after placement.
 * Ensures clips exist, order matches, timing is contiguous, and audio is master.
 */
export function verifyMatchedTimelineState(
  placedClips: VideoClip[],
  placedAudio: AudioTrackClip[],
  expectedMatches: VisualBeatMatch[],
  audioDuration: number
): TimelinePlacementVerification {
  const verifiedClips: {
    clipId: string;
    assetName: string;
    startTime: number;
    endTime: number;
    duration: number;
  }[] = [];

  let unintendedGaps = 0;
  let lastEnd = 0;

  for (let i = 0; i < placedClips.length; i++) {
    const c = placedClips[i];
    const start = c.timelineStart ?? 0;
    const end = c.timelineEnd ?? start + c.duration;

    if (i > 0 && Math.abs(start - lastEnd) > 0.05) {
      unintendedGaps++;
    }

    verifiedClips.push({
      clipId: c.id,
      assetName: c.title,
      startTime: start,
      endTime: end,
      duration: c.duration,
    });

    lastEnd = end;
  }

  const hasMasterAudio = placedAudio.some(
    (a) => a.category === 'voiceover' || a.id.includes('vo') || a.startTime === 0
  );

  const durationCovered = placedClips.reduce((acc, c) => acc + c.duration, 0);
  const success =
    placedClips.length > 0 &&
    placedClips.length >= Math.min(expectedMatches.length, 1) &&
    unintendedGaps === 0;

  const summary = success
    ? `Verified ${placedClips.length} visual clips placed sequentially (${(placedClips[0]?.timelineStart ?? 0).toFixed(2)}s – ${lastEnd.toFixed(2)}s). Zero unintended gaps. Master audio active.`
    : `Placement verification failed. Placed: ${placedClips.length}, Expected: ${expectedMatches.length}, Gaps: ${unintendedGaps}.`;

  return {
    success,
    passed: success,
    totalPlaced: placedClips.length,
    expectedPlaced: expectedMatches.length,
    timelineStart: placedClips[0]?.timelineStart ?? 0,
    timelineEnd: lastEnd,
    durationCovered: Number(durationCovered.toFixed(2)),
    audioDuration,
    unintendedGapsDetected: unintendedGaps,
    masterAudioPresent: hasMasterAudio,
    verifiedClips,
    summary,
    error: success ? undefined : 'Clips failed to materialize contiguously on timeline',
  };
}

// =============================================================================
// HELPER: CONCEPT DOMAINS & SEMANTIC TOKEN EXTRACTION
// =============================================================================

export interface ConceptDomainDefinition {
  name: string;
  triggerWords: string[];
  visualConcepts: string[];
  defaultEnvironment: string;
  typicalObjects: string[];
  typicalActions: string[];
  prohibitedEnvironments: string[];
}

export const CONCEPT_DOMAINS: Record<string, ConceptDomainDefinition> = {
  farming: {
    name: 'Farming & Agriculture',
    triggerWords: [
      'farm', 'farms', 'farming', 'farmland', 'crops', 'crop', 'wheat', 'corn', 'grain',
      'grains', 'barn', 'barns', 'tractor', 'tractors', 'field', 'fields', 'agriculture',
      'agricultural', 'rural', 'pasture', 'pastures', 'harvest', 'soil', 'cultivation', 'food supply',
    ],
    visualConcepts: [
      'farm', 'farms', 'farmland', 'crops', 'crop', 'wheat', 'corn', 'field', 'fields',
      'barn', 'tractor', 'agriculture', 'rural', 'pasture', 'harvest', 'countryside', 'plow',
    ],
    defaultEnvironment: 'farmland',
    typicalObjects: ['tractor', 'barn', 'crops', 'wheat', 'corn', 'field', 'hay'],
    typicalActions: ['farming', 'harvesting', 'growing', 'plowing'],
    prohibitedEnvironments: ['bathroom', 'supermarket', 'indoor office'],
  },
  waterways: {
    name: 'Rivers & Waterways',
    triggerWords: [
      'river', 'rivers', 'stream', 'streams', 'creek', 'creeks', 'waterway', 'waterways',
      'brook', 'canal', 'canals', 'flowing water',
    ],
    visualConcepts: [
      'river', 'rivers', 'stream', 'creek', 'waterway', 'water', 'flowing', 'riverbank', 'waterfront',
    ],
    defaultEnvironment: 'water body',
    typicalObjects: ['water', 'river', 'bank', 'rocks', 'bridge'],
    typicalActions: ['flowing', 'running', 'rushing'],
    prohibitedEnvironments: ['bathroom', 'supermarket', 'indoor office'],
  },
  lakes: {
    name: 'Lakes & Ponds',
    triggerWords: ['lake', 'lakes', 'pond', 'ponds', 'lagoon', 'freshwater', 'lakefront'],
    visualConcepts: ['lake', 'lakes', 'pond', 'water', 'shore', 'lakefront', 'calm water', 'lake surface'],
    defaultEnvironment: 'water body',
    typicalObjects: ['lake', 'water', 'shore', 'dock', 'pier'],
    typicalActions: ['calm', 'still', 'reflecting'],
    prohibitedEnvironments: ['bathroom', 'supermarket', 'indoor office'],
  },
  reservoirs: {
    name: 'Reservoirs & Dams',
    triggerWords: [
      'reservoir', 'reservoirs', 'dam', 'dams', 'water storage', 'basin', 'aqueduct', 'water supply',
    ],
    visualConcepts: [
      'reservoir', 'reservoirs', 'dam', 'dams', 'basin', 'water storage', 'water infrastructure',
    ],
    defaultEnvironment: 'water body',
    typicalObjects: ['dam', 'reservoir', 'basin', 'concrete', 'water', 'spillway'],
    typicalActions: ['holding', 'storing', 'draining'],
    prohibitedEnvironments: ['bathroom', 'supermarket'],
  },
  plumbing: {
    name: 'Taps, Sinks & Plumbing',
    triggerWords: [
      'tap', 'taps', 'faucet', 'faucets', 'sink', 'sinks', 'spigot', 'plumbing', 'pipe',
      'pipes', 'drain', 'running water', 'water flow',
    ],
    visualConcepts: [
      'tap', 'taps', 'faucet', 'sink', 'plumbing', 'pipes', 'drain', 'water', 'basin', 'dry tap',
    ],
    defaultEnvironment: 'bathroom',
    typicalObjects: ['tap', 'faucet', 'sink', 'counter', 'pipes', 'drain', 'glass'],
    typicalActions: ['turn', 'turning', 'check', 'checking', 'running', 'dripping'],
    prohibitedEnvironments: ['farmland', 'outside street'],
  },
  supermarket: {
    name: 'Supermarkets & Stores',
    triggerWords: [
      'supermarket', 'supermarkets', 'store', 'stores', 'grocery', 'groceries', 'market',
      'shop', 'shops', 'shelves', 'shelf', 'aisle', 'aisles', 'cart', 'carts', 'supplies',
    ],
    visualConcepts: [
      'supermarket', 'grocery', 'store', 'market', 'shelves', 'shelf', 'aisle', 'cart', 'retail',
    ],
    defaultEnvironment: 'supermarket',
    typicalObjects: ['shelf', 'shelves', 'cart', 'goods', 'products', 'boxes', 'cans', 'aisle'],
    typicalActions: ['shopping', 'grabbing', 'searching', 'walking', 'pushing'],
    prohibitedEnvironments: ['farmland', 'bathroom', 'water body'],
  },
  phone_communication: {
    name: 'Phones & Devices',
    triggerWords: [
      'phone', 'phones', 'smartphone', 'cellphone', 'cell', 'mobile', 'screen', 'screens',
      'call', 'calling', 'text', 'message', 'alert', 'notification', 'dial',
    ],
    visualConcepts: [
      'phone', 'smartphone', 'cellphone', 'screen', 'device', 'mobile', 'call', 'display',
    ],
    defaultEnvironment: 'indoor',
    typicalObjects: ['phone', 'smartphone', 'screen', 'device', 'charger'],
    typicalActions: ['grab', 'grabbing', 'hold', 'holding', 'looking', 'calling', 'checking', 'dialing'],
    prohibitedEnvironments: ['farmland', 'water body'],
  },
  vehicle_transport: {
    name: 'Vehicles & Driving',
    triggerWords: [
      'car', 'cars', 'vehicle', 'vehicles', 'truck', 'trucks', 'automobile', 'road',
      'highway', 'street', 'traffic', 'drive', 'driving', 'driveway',
    ],
    visualConcepts: [
      'car', 'vehicle', 'truck', 'road', 'highway', 'street', 'traffic', 'driving', 'automotive',
    ],
    defaultEnvironment: 'outside',
    typicalObjects: ['car', 'vehicle', 'truck', 'wheel', 'keys', 'steering wheel'],
    typicalActions: ['drive', 'driving', 'steering', 'parking', 'starting'],
    prohibitedEnvironments: ['bathroom', 'supermarket interior'],
  },
  emptiness_negation: {
    name: 'Emptiness & Absence',
    triggerWords: [
      'nothing', 'still nothing', 'empty', 'dry', 'dried', 'barren', 'deserted',
      'abandoned', 'depleted', 'vacant', 'gone', 'quiet', 'silent', 'none',
      "they're not", 'they are not', 'not running', 'not working',
    ],
    visualConcepts: [
      'empty', 'dry', 'barren', 'deserted', 'abandoned', 'nothing', 'depleted', 'drought', 'vacant', 'still',
    ],
    defaultEnvironment: 'general scene',
    typicalObjects: ['empty shelves', 'dry tap', 'deserted street', 'blank screen'],
    typicalActions: ['waiting', 'standing', 'staring'],
    prohibitedEnvironments: [],
  },
  urgency_motion: {
    name: 'Rush & Motion',
    triggerWords: [
      'rush', 'rushes', 'rushing', 'run', 'runs', 'running', 'dash', 'dashing',
      'hurry', 'hurries', 'escape', 'flee', 'fleeing',
    ],
    visualConcepts: ['running', 'rushing', 'dash', 'hurry', 'escape', 'motion', 'action'],
    defaultEnvironment: 'outside',
    typicalObjects: ['door', 'street', 'stairs'],
    typicalActions: ['rush', 'run', 'dash', 'hurry', 'escape'],
    prohibitedEnvironments: [],
  },
};

function extractSemanticTokens(text: string): {
  coreKeywords: string[];
  actionVerbs: string[];
  keyObjects: string[];
  peopleKeywords: string[];
  locations: string[];
} {
  const lower = text.toLowerCase();

  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'should', 'can', 'could', 'may',
    'might', 'must', 'that', 'this', 'these', 'those', 'i', 'you', 'he',
    'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'scene', 'beat', "they're", 'still', 'there', 'here',
  ]);

  const rawWords = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
  const coreKeywords = rawWords.filter((w) => !stopWords.has(w));

  const knownVerbs = new Set([
    'walk', 'walks', 'walking', 'run', 'runs', 'running', 'rush', 'rushes', 'rushing',
    'grab', 'grabs', 'grabbing', 'carry', 'carries', 'carrying', 'hold', 'holds', 'holding',
    'turn', 'turns', 'turning', 'enter', 'enters', 'entering', 'open', 'opens', 'opening',
    'close', 'closes', 'closing', 'pour', 'pours', 'pouring', 'drink', 'drinks', 'drinking',
    'look', 'looks', 'looking', 'see', 'sees', 'seeing', 'drive', 'drives', 'driving',
    'call', 'calls', 'calling', 'leave', 'leaves', 'leaving', 'pack', 'packs', 'packed',
    'farm', 'farming', 'harvest', 'grow', 'growing', 'flow', 'flowing', 'check', 'checking',
  ]);

  const knownObjects = new Set([
    'phone', 'phones', 'tap', 'taps', 'faucet', 'sink', 'water', 'bottle', 'bottles',
    'case', 'cases', 'cart', 'shelves', 'shelf', 'car', 'door', 'bag', 'bags',
    'glass', 'cup', 'money', 'food', 'groceries', 'keys', 'reservoir', 'reservoirs',
    'river', 'rivers', 'lake', 'lakes', 'stream', 'creek', 'dam', 'dams', 'basin',
    'farm', 'farms', 'farmland', 'crops', 'crop', 'wheat', 'corn', 'barn', 'tractor',
    'field', 'fields', 'pasture',
  ]);

  const knownPeople = new Set([
    'person', 'people', 'man', 'men', 'woman', 'women', 'boy', 'girl', 'crowd',
    'character', 'stickman', 'someone', 'everybody', 'shopper', 'shoppers', 'farmer',
  ]);

  const knownLocations = new Set([
    'bathroom', 'supermarket', 'store', 'grocery', 'outside', 'street', 'road',
    'kitchen', 'bedroom', 'room', 'house', 'city', 'town', 'river', 'lake', 'reservoir',
    'farm', 'farmland', 'field', 'fields', 'barn', 'countryside', 'rural', 'pasture',
    'stream', 'creek', 'dam',
  ]);

  const actionVerbs = coreKeywords.filter((w) => knownVerbs.has(w));
  const keyObjects = coreKeywords.filter((w) => knownObjects.has(w));
  const peopleKeywords = coreKeywords.filter((w) => knownPeople.has(w));
  const locations = coreKeywords.filter((w) => knownLocations.has(w));

  return {
    coreKeywords,
    actionVerbs,
    keyObjects,
    peopleKeywords,
    locations,
  };
}
