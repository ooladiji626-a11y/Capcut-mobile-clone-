import type { AuthoritativeScriptBeat } from './visualAudioMatcher';
import { alignScriptBeatsToSrt } from './visualAudioMatcher';

function extractSimpleKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['the', 'and', 'for', 'that', 'with', 'this'].includes(w));
}

export interface SrtCue {
  index?: number;
  startTime: number; // in floating-point seconds (e.g. 14.35)
  endTime: number;   // in floating-point seconds (e.g. 17.80)
  start: number;     // in floating-point seconds (e.g. 14.35)
  end: number;       // in floating-point seconds (e.g. 17.80)
  duration: number;  // in floating-point seconds
  text: string;      // clean spoken subtitle text
}

export interface SrtParseResult {
  cues: SrtCue[];
  totalDuration: number;
  rawText: string;
}

/**
 * Parses SRT/VTT time code string to floating-point seconds.
 * Supports:
 *   "00:01:14,350" -> 74.35
 *   "00:01:14.350" -> 74.35
 *   "01:14,350"    -> 74.35
 */
export function parseSrtTimestamp(ts: string): number {
  if (!ts) return 0;
  const cleaned = ts.trim().replace(',', '.');
  const match = cleaned.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?/);
  if (!match) return 0;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const msStr = match[4] ? match[4].padEnd(3, '0').slice(0, 3) : '000';
  const ms = parseInt(msStr, 10);

  return Number((hours * 3600 + minutes * 60 + seconds + ms / 1000).toFixed(3));
}

/**
 * Checks whether text contains SRT or WebVTT subtitle timestamp formatting.
 */
export function isSrtFormat(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}/.test(text) ||
         /WEBVTT/i.test(text);
}

/**
 * Parses raw SRT/VTT text into structured subtitle cues.
 * Strips formatting tags (<b>, <i>, <font>, etc.) and cleans up whitespace.
 */
export function parseSrtText(srtText: string): SrtCue[] {
  if (!srtText || typeof srtText !== 'string') return [];

  // Normalize line breaks
  const normalized = srtText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SrtCue[] = [];
  let fallbackIndex = 1;

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) continue;

    let timeLine = '';
    let textStartIndex = 1;
    let cueIndex = fallbackIndex;

    if (lines[0].includes('-->')) {
      timeLine = lines[0];
      textStartIndex = 1;
    } else if (lines.length >= 2 && lines[1].includes('-->')) {
      const parsedNum = parseInt(lines[0], 10);
      if (!isNaN(parsedNum)) {
        cueIndex = parsedNum;
      }
      timeLine = lines[1];
      textStartIndex = 2;
    } else {
      // Find any line containing the arrow
      const foundIdx = lines.findIndex((l) => l.includes('-->'));
      if (foundIdx >= 0) {
        timeLine = lines[foundIdx];
        textStartIndex = foundIdx + 1;
      } else {
        continue;
      }
    }

    const [startRaw, endRaw] = timeLine.split('-->').map((s) => s.trim());
    if (!startRaw || !endRaw) continue;

    const startTime = parseSrtTimestamp(startRaw);
    const endTime = parseSrtTimestamp(endRaw);

    // Join text lines and strip HTML/formatting tags and watermarks (TurboScribe, etc.)
    const rawSubtitleText = lines
      .slice(textStartIndex)
      .join(' ')
      .replace(/\(Transcribed by TurboScribe[^\)]*\)/gi, '')
      .replace(/\(Transcribed by[^\)]*\)/gi, '')
      .replace(/\(Subtitles? [^\)]*\)/gi, '')
      .replace(/\[(?:Music|Applause|Laughter|Sound|Noise|Cheering)\]/gi, '')
      .replace(/<[^>]*>/g, '') // remove HTML tags (<b>, <i>, <font>)
      .replace(/\{[^}]*\}/g, '') // remove ASS/SSA style tags
      .trim();

    if (rawSubtitleText.length > 0) {
      const eTime = Math.max(startTime + 0.2, endTime);
      cues.push({
        index: cueIndex,
        startTime,
        endTime: eTime,
        start: startTime,
        end: eTime,
        duration: Number((eTime - startTime).toFixed(3)),
        text: rawSubtitleText,
      });
      fallbackIndex++;
    }
  }

  // Sort cues monotonically by start time
  cues.sort((a, b) => a.startTime - b.startTime);
  return cues;
}

/**
 * Normalizes a single word for phonetics and matching.
 */
function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Internal interface for sub-cue timed words.
 */
interface TimedWord {
  word: string;
  normalized: string;
  startTime: number;
  endTime: number;
  cueIndex: number;
}

/**
 * Extracts continuous word-level timestamps from subtitle cues with proportional timing.
 */
export function extractTimedWordsFromCues(cues: SrtCue[]): TimedWord[] {
  const timedWords: TimedWord[] = [];
  for (const cue of cues) {
    const rawTokens = cue.text.split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) continue;

    const cueDur = Math.max(0.08, cue.endTime - cue.startTime);
    const wordDur = cueDur / rawTokens.length;

    for (let i = 0; i < rawTokens.length; i++) {
      const raw = rawTokens[i];
      const norm = normalizeWord(raw);
      if (!norm) continue;

      const wStart = Number((cue.startTime + i * wordDur).toFixed(3));
      const wEnd = Number((cue.startTime + (i + 1) * wordDur).toFixed(3));

      timedWords.push({
        word: raw,
        normalized: norm,
        startTime: wStart,
        endTime: wEnd,
        cueIndex: cue.index,
      });
    }
  }
  return timedWords;
}

/**
 * Intelligently separates a mixed block of text containing both numbered script beats
 * (e.g. "1. At 8:17...", "2. the lights go out...") and SRT subtitle timestamp cues
 * (e.g. "00:00:00,190 --> 00:00:02,150").
 */
export function separateScriptAndSrt(input: string): { scriptText: string; srtText: string } {
  if (!input || typeof input !== 'string') {
    return { scriptText: '', srtText: '' };
  }

  // If text does not contain any SRT arrows, return as pure script
  if (!/\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}/.test(input)) {
    return { scriptText: input.trim(), srtText: '' };
  }

  // If text contains SRT arrow and has no numbered lines at all, return as pure SRT
  const hasNumberedScriptLines = /\b\d+[\.\)]\s+[A-Za-z"“'‘]/.test(input);
  if (!hasNumberedScriptLines) {
    return { scriptText: '', srtText: input.trim() };
  }

  const lines = input.split(/\r?\n/);
  const srtLines: string[] = [];
  const scriptLines: string[] = [];

  let inSrtBlock = false;
  const pendingBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const isArrowTimeLine = /\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}/.test(trimmed);

    if (isArrowTimeLine) {
      // If previous line in buffer was just a numeric cue index (e.g. "1", "284"), move it to SRT
      if (pendingBuffer.length > 0 && /^\d+$/.test(pendingBuffer[pendingBuffer.length - 1].trim())) {
        const indexLine = pendingBuffer.pop()!;
        srtLines.push(indexLine);
      }
      srtLines.push(line);
      inSrtBlock = true;
    } else if (inSrtBlock) {
      if (trimmed === '') {
        srtLines.push(line);
        inSrtBlock = false;
      } else {
        const isNumberedBeat = /^(?:#|scene|beat|item)?\s*\[?(\d+)([a-zA-Z])?\]?[\.\:\)\-]\s+[A-Za-z"“'‘]/i.test(trimmed);
        if (isNumberedBeat) {
          inSrtBlock = false;
          scriptLines.push(line);
        } else {
          srtLines.push(line);
        }
      }
    } else {
      if (trimmed === '') {
        if (pendingBuffer.length > 0) {
          scriptLines.push(...pendingBuffer);
          pendingBuffer.length = 0;
        }
        scriptLines.push(line);
      } else {
        pendingBuffer.push(line);
      }
    }
  }

  if (pendingBuffer.length > 0) {
    scriptLines.push(...pendingBuffer);
  }

  return {
    scriptText: scriptLines.join('\n').trim(),
    srtText: srtLines.join('\n').trim(),
  };
}

/**
 * Computes semantic word overlap ratio between a beat's words and a subtitle cue's words.
 */
function computeWordSimilarity(beatWords: string[], cueWords: string[]): number {
  if (beatWords.length === 0 || cueWords.length === 0) return 0;
  const cueSet = new Set(cueWords);
  let matched = 0;
  for (const w of beatWords) {
    if (cueSet.has(w)) matched++;
  }
  return matched / Math.max(beatWords.length, cueWords.length);
}

/**
 * Extracts normalized clean lowercase tokens from text.
 */
export function extractCleanWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export const COMMON_ALIGN_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'into', 'over', 'after', 'is', 'are',
  'was', 'were', 'it', 'this', 'that', 'then', 'so',
]);

/**
 * Identifies the cue index where a beat's initial spoken sentence begins in the audio.
 */
function findCueForBeatSentenceStart(
  beatWords: string[],
  cues: SrtCue[],
  cueWordsList: string[][],
  minCueIdx: number,
  expectedCueIdx: number
): { cueIdx: number; confidence: number } {
  if (beatWords.length === 0 || minCueIdx >= cues.length) {
    return { cueIdx: minCueIdx, confidence: 0 };
  }

  // Initial words of the beat
  const headWords = beatWords.slice(0, 5);
  // Find first significant non-stop words
  const nonStopWords = headWords.filter((w) => !COMMON_ALIGN_STOP_WORDS.has(w));
  const firstSignificant = nonStopWords[0] || headWords[0];
  const secondSignificant = nonStopWords[1];

  const windowRadius = Math.max(8, Math.ceil((cues.length / Math.max(1, beatWords.length)) * 2));
  const searchStart = Math.max(minCueIdx, expectedCueIdx - windowRadius);
  const searchEnd = Math.min(cues.length - 1, expectedCueIdx + windowRadius);

  let bestCue = minCueIdx;
  let bestScore = -1;

  for (let c = searchStart; c <= searchEnd; c++) {
    const cueWords = cueWordsList[c];
    if (!cueWords || cueWords.length === 0) continue;

    let score = 0;

    // Check if cue starts with the exact first word of the beat
    if (cueWords[0] === headWords[0]) {
      score += 0.50;
      if (headWords.length > 1 && cueWords.includes(headWords[1])) {
        score += 0.35;
      }
    }

    // Check if cue contains the first significant word
    if (firstSignificant && cueWords.includes(firstSignificant)) {
      score += 0.40;
      const idx = cueWords.indexOf(firstSignificant);
      if (idx <= 2) score += 0.20; // Near start of cue
    }

    // Check if cue contains the second significant word
    if (secondSignificant && cueWords.includes(secondSignificant)) {
      score += 0.20;
    }

    // Distance penalty from expectedCueIdx
    const dist = Math.abs(c - expectedCueIdx);
    const distPenalty = Math.min(0.20, (dist / Math.max(1, cues.length)) * 0.4);
    score -= distPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestCue = c;
    }
  }

  return { cueIdx: bestCue, confidence: Math.max(0, bestScore) };
}

/**
 * Merges split subtitle cues that belong to the same sentence/beat so all 270 beats
 * receive exact, continuous start and end timestamps.
 *
 * Guarantees:
 * 1. Monotonic progression: startTime[i] >= startTime[i-1].
 * 2. Continuous cuts with zero gaps: endTime[i] === startTime[i+1].
 * 3. 100% deterministic with zero API calls.
 * 4. Resolves cue-count mismatches (e.g. 284 subtitle cues spanning 270 script beats)
 *    using localized sequence alignment with syllable weight fallback.
 */
export function mergeSrtCuesToScriptBeats(
  beats: AuthoritativeScriptBeat[],
  cues: SrtCue[],
  masterAudioDuration?: number
): AuthoritativeScriptBeat[] {
  if (!beats || beats.length === 0) return [];
  if (!cues || cues.length === 0) return beats;

  // Convert cues to word-level alignment format
  const formattedCues = cues.map((c) => ({
    start: typeof c.start === 'number' ? c.start : (c.startTime ?? 0),
    end: typeof c.end === 'number' ? c.end : (c.endTime ?? (c.start ?? 0) + 2.0),
    text: c.text,
  }));

  const beatTexts = beats.map((b) => b.rawText);
  const totalAudioDuration =
    masterAudioDuration && masterAudioDuration > 0
      ? masterAudioDuration
      : Math.max(...formattedCues.map((c) => c.end), 534.0);

  const segments = alignScriptBeatsToSrt(beatTexts, formattedCues, totalAudioDuration);

  return beats.map((beat, i) => {
    const seg = segments[i] || {
      start: (i / beats.length) * totalAudioDuration,
      end: ((i + 1) / beats.length) * totalAudioDuration,
      text: beat.rawText,
    };
    const start = Number(seg.start.toFixed(3));
    const end = Number(seg.end.toFixed(3));
    const duration = Number((end - start).toFixed(3));
    return {
      ...beat,
      startTime: start,
      endTime: end,
      duration,
    };
  });
}

/**
 * Converts SRT cues directly into AuthoritativeScriptBeats when the user provides an SRT file
 * without a separate numbered script text.
 */
export function convertSrtCuesToBeats(
  cues: SrtCue[],
  mergeBySentence = false,
  masterAudioDuration?: number
): AuthoritativeScriptBeat[] {
  if (!cues || cues.length === 0) return [];

  if (!mergeBySentence) {
    const beats: AuthoritativeScriptBeat[] = [];
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const nextStart = i < cues.length - 1 ? cues[i + 1].startTime : cue.endTime;
      let endTime = Math.max(Number((cue.startTime + 0.4).toFixed(2)), Number(nextStart.toFixed(2)));

      if (i === cues.length - 1 && masterAudioDuration && masterAudioDuration > cue.startTime) {
        endTime = Number(masterAudioDuration.toFixed(2));
      }

      const keywords = extractSimpleKeywords(cue.text);

      beats.push({
        id: `beat-srt-${cue.index}-${i + 1}`,
        beatIndex: i + 1,
        beatLabel: String(cue.index || i + 1),
        numberPart: cue.index || i + 1,
        letterPart: '',
        rawText: cue.text,
        normalizedText: cue.text.toLowerCase(),
        startTime: i === 0 ? 0 : Number(cue.startTime.toFixed(2)),
        endTime,
        duration: Number((endTime - (i === 0 ? 0 : cue.startTime)).toFixed(2)),
        requiredConcepts: keywords,
        actionVerbs: [],
        keyObjects: [],
        peopleOrCharacters: [],
        environmentKeywords: [],
      });
    }
    return beats;
  }

  // Sentence-level grouping for fragmented sub-phrase cues
  const beats: AuthoritativeScriptBeat[] = [];
  let currentGroup: SrtCue[] = [];
  let groupStart = cues[0].startTime;
  let beatIndex = 1;

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (currentGroup.length === 0) {
      groupStart = cue.startTime;
    }
    currentGroup.push(cue);

    const isTerminal = /[.!?]["'\s]*$/.test(cue.text.trim()) || i === cues.length - 1;
    if (isTerminal) {
      const combinedText = currentGroup.map((c) => c.text).join(' ').trim();
      let nextCueStart = i < cues.length - 1 ? cues[i + 1].startTime : cue.endTime;
      if (i === cues.length - 1 && masterAudioDuration && masterAudioDuration > groupStart) {
        nextCueStart = masterAudioDuration;
      }
      const endTime = Math.max(Number((groupStart + 0.4).toFixed(2)), Number(nextCueStart.toFixed(2)));

      const keywords = extractSimpleKeywords(combinedText);

      beats.push({
        id: `beat-srt-merged-${beatIndex}`,
        beatIndex,
        beatLabel: String(beatIndex),
        numberPart: beatIndex,
        letterPart: '',
        rawText: combinedText,
        normalizedText: combinedText.toLowerCase(),
        startTime: Number(groupStart.toFixed(2)),
        endTime,
        duration: Number((endTime - groupStart).toFixed(2)),
        requiredConcepts: keywords,
        actionVerbs: [],
        keyObjects: [],
        peopleOrCharacters: [],
        environmentKeywords: [],
      });

      beatIndex++;
      currentGroup = [];
    }
  }

  return beats;
}
