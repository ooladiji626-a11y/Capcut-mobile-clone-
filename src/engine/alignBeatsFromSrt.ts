/**
 * Syllable-Weighted Global Dynamic Programming Alignment Engine
 * 
 * Solves the 3 core causes of inaccurate cuts:
 * 1. The Repeated-Word Jump Bug: Solved via global (N+1)*(M+1) DP edit-distance matrix and backtracking.
 * 2. Even Word Division: Solved via vowel-clustering syllable weight distribution (countSyllables).
 * 3. Non-Monotonic Cut Boundaries: Solved via midpoint pause cutting and bidirectional monotonic clamping.
 */

export interface SrtCue {
  start: number; // in seconds, e.g. 1.250
  end: number;   // in seconds, e.g. 4.100
  text: string;
  index?: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export interface TimedWord {
  word: string;
  norm: string;
  start: number;
  end: number;
}

export interface AlignedBeat {
  index: number;
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
  duration: number;
}

export const COMMON_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'into', 'over', 'after', 'is', 'are',
  'was', 'were', 'it', 'this', 'that', 'then', 'so', 'he', 'she', 'they',
  'said', 'be', 'been', 'have', 'had', 'has', 'do', 'did',
]);

// 1. Clean words for accurate matching
export function normWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// 2. Count syllables to accurately distribute milliseconds within an SRT cue
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 1;
  if (w.length <= 3) return 1;
  const cleaned = w.replace(/(?:[^laeiouy]|ed|es|e)$/, "").replace(/^y/, "");
  const matches = cleaned.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

/**
 * Calculates human speech rhythm weight using character length, syllable count,
 * and conversational punctuation pause weighting.
 */
export function calculateWordRhythmWeight(word: string): number {
  const norm = normWord(word);
  if (!norm) return 1;
  const syllables = countSyllables(norm);
  const charLength = norm.length;

  // Base weight: character length + 1.5 * syllable count
  let weight = charLength + syllables * 1.5;

  // Conversational punctuation pause bonus
  const trimmed = word.trim();
  if (/[,;]$/.test(trimmed)) {
    weight += 2.0; // comma / semicolon breath pause
  } else if (/[.!?:\u2014-]$/.test(trimmed)) {
    weight += 3.5; // full stop / clause terminal pause
  }

  return Math.max(1, weight);
}

// 3. Convert SRT cues into character-length + syllable-weighted timed words
export function srtToWords(cues: SrtCue[]): TimedWord[] {
  const words: TimedWord[] = [];
  for (const c of cues) {
    const rawWords = c.text.split(/[\s/-]+/).filter((w) => normWord(w));
    if (!rawWords.length) continue;
    
    const weights = rawWords.map(calculateWordRhythmWeight);
    const totalWeight = weights.reduce((sum, wt) => sum + wt, 0) || 1;
    const cStart = typeof c.start === 'number' ? c.start : ((c as any).startTime ?? 0);
    const cEnd = typeof c.end === 'number' ? c.end : ((c as any).endTime ?? cStart + 2.0);
    const cueDuration = Math.max(0.1, cEnd - cStart);

    let t = cStart;
    rawWords.forEach((word, i) => {
      const d = (cueDuration * weights[i]) / totalWeight;
      words.push({
        word,
        norm: normWord(word),
        start: t,
        end: t + d,
      });
      t += d;
    });
  }
  return words;
}

// 4. Global ordered alignment (prevents repeated-phrase jumps across subtitle speech)
export function alignScriptToBeats(
  beatTexts: string[],
  cues: SrtCue[],
  totalDuration: number
): AlignedBeat[] {
  const n = beatTexts.length;
  if (n === 0) return [];

  const words = srtToWords(cues);
  if (!words.length) {
    // Fallback: divide evenly if no valid SRT words found
    const step = totalDuration / n;
    return beatTexts.map((text, i) => ({
      index: i + 1,
      text,
      start: i * step,
      end: (i + 1) * step,
      duration: step,
    }));
  }

  // Flatten script beats into normalized words tagged with their beat index
  const scriptWords: { norm: string; beat: number }[] = [];
  beatTexts.forEach((text, bIdx) => {
    text.split(/[\s/-]+/).forEach((w) => {
      const norm = normWord(w);
      if (norm) scriptWords.push({ norm, beat: bIdx });
    });
  });

  const N = scriptWords.length;
  const M = words.length;

  const eq = (a: string, b: string) =>
    a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));

  // Dynamic programming edit-distance matrix
  const dir = new Uint8Array((N + 1) * (M + 1));
  let prev = new Int32Array(M + 1);
  let cur = new Int32Array(M + 1);

  for (let j = 1; j <= M; j++) {
    prev[j] = j * 2;
    dir[j] = 3;
  }

  for (let i = 1; i <= N; i++) {
    cur[0] = i * 2;
    dir[i * (M + 1)] = 2;
    const isStopWord = COMMON_STOP_WORDS.has(scriptWords[i - 1].norm);
    const expectedJ = (i / N) * M;

    for (let j = 1; j <= M; j++) {
      const same = eq(scriptWords[i - 1].norm, words[j - 1].norm);
      const distFromExpected = Math.abs(j - expectedJ);
      const distPenalty = Math.min(4, Math.floor((distFromExpected / Math.max(10, M)) * 6));

      // Repeated-word jump protection:
      // Stop words ("he", "said", "the") cannot jump far across cues without penalty
      let matchCost = 0;
      if (same) {
        matchCost = isStopWord ? distPenalty : 0;
      } else {
        matchCost = 3 + distPenalty;
      }

      const diagonal = prev[j - 1] + matchCost;
      const deleteScript = prev[j] + 2;
      const insertTranscript = cur[j - 1] + 2;

      if (diagonal <= deleteScript && diagonal <= insertTranscript) {
        cur[j] = diagonal;
        dir[i * (M + 1) + j] = 1; // match/substitute
      } else if (deleteScript <= insertTranscript) {
        cur[j] = deleteScript;
        dir[i * (M + 1) + j] = 2; // delete
      } else {
        cur[j] = insertTranscript;
        dir[i * (M + 1) + j] = 3; // insert
      }
    }
    [prev, cur] = [cur, prev];
  }

  // Backtrack to find first and last spoken timestamps per beat
  const first = new Array<number>(n).fill(NaN);
  const last = new Array<number>(n).fill(NaN);

  let i = N;
  let j = M;
  while (i > 0 && j > 0) {
    const d = dir[i * (M + 1) + j];
    if (d === 1) {
      const beat = scriptWords[i - 1].beat;
      const word = words[j - 1];
      if (eq(scriptWords[i - 1].norm, word.norm)) {
        first[beat] = Number.isNaN(first[beat])
          ? word.start
          : Math.min(first[beat], word.start);
        last[beat] = Number.isNaN(last[beat])
          ? word.end
          : Math.max(last[beat], word.end);
      }
      i--;
      j--;
    } else if (d === 2) {
      i--;
    } else {
      j--;
    }
  }

  // Interpolate any beats that had zero matched words
  const known = first.map((v, k) => (isNaN(v) ? -1 : k)).filter((k) => k >= 0);
  for (let k = 0; k < n; k++) {
    if (!isNaN(first[k])) continue;
    const lo = [...known].reverse().find((x) => x < k);
    const hi = known.find((x) => x > k);
    const a = lo === undefined ? 0 : first[lo];
    const aK = lo ?? -1;
    const b = hi === undefined ? totalDuration : first[hi];
    const bK = hi ?? n;
    first[k] = a + ((b - a) * (k - aK)) / (bK - aK);
    last[k] = first[k];
  }

  // Calculate clean cuts between consecutive beats (midpoint of pauses)
  const boundaries = new Array<number>(n + 1).fill(0);
  const minStep = Math.min(0.001, totalDuration / Math.max(1, n));
  boundaries[0] = 0;
  boundaries[n] = totalDuration;

  for (let k = 1; k < n; k++) {
    const prevEnd = Number.isNaN(last[k - 1]) ? first[k - 1] : last[k - 1];
    const nextStart = first[k];
    const cut = (prevEnd + nextStart) / 2;
    boundaries[k] = Math.max(boundaries[k - 1] + minStep, Math.min(totalDuration, cut));
  }

  // Backward pass to enforce strict non-overlapping order
  for (let k = n - 1; k > 0; k--) {
    boundaries[k] = Math.max(0, Math.min(boundaries[k], boundaries[k + 1] - minStep));
  }

  return beatTexts.map((text, idx) => ({
    index: idx + 1,
    text,
    start: Number(boundaries[idx].toFixed(3)),
    end: Number(boundaries[idx + 1].toFixed(3)),
    duration: Number((boundaries[idx + 1] - boundaries[idx]).toFixed(3)),
  }));
}
