import { ChartConfig, ChartType, ChartDataPoint, AIChatMessage } from '../types';
import { persistAppState, getAppState } from './persistentStorage';

export interface VaultTranscriptItem {
  id: string;
  title: string;
  type: 'chatgpt_transcript' | 'narration_script' | 'chart_transcript' | 'srt_clock' | 'ai_chat';
  text: string;
  timestamp: number;
  itemCount?: number;
  summary?: string;
  source?: string;
  projectId?: string;
}

const VAULT_STORAGE_KEY = 'capcut_transcript_vault_v2';
let inMemoryVault: VaultTranscriptItem[] | null = null;

/**
 * Lossless persistence for all user transcripts and ChatGPT pastes.
 * Synchronously writes to localStorage and asynchronously backups to IndexedDB.
 */
export function saveToTranscriptVault(
  item: Omit<VaultTranscriptItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): VaultTranscriptItem {
  const currentList = getTranscriptVaultItems();
  const trimmedText = item.text.trim();
  if (!trimmedText) {
    return (
      currentList[0] || {
        id: 'empty',
        title: 'Empty',
        type: item.type,
        text: '',
        timestamp: Date.now(),
      }
    );
  }

  // Deduplicate if identical text already saved recently
  const existingIdx = currentList.findIndex(
    (x) => x.text.trim() === trimmedText || (item.id && x.id === item.id)
  );

  const entry: VaultTranscriptItem = {
    id: item.id || (existingIdx >= 0 ? currentList[existingIdx].id : `transcript-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
    title: item.title || inferTranscriptTitle(trimmedText, item.type),
    type: item.type,
    text: trimmedText,
    timestamp: item.timestamp || Date.now(),
    itemCount: item.itemCount || countTranscriptItems(trimmedText, item.type),
    summary: item.summary || generateTranscriptSummary(trimmedText, item.type),
    source: item.source || 'User Paste',
    projectId: item.projectId,
  };

  let updated: VaultTranscriptItem[];
  if (existingIdx >= 0) {
    updated = [...currentList];
    updated[existingIdx] = entry;
  } else {
    // Keep most recent up to 100 items in vault
    updated = [entry, ...currentList].slice(0, 100);
  }

  inMemoryVault = updated;

  // 1. Sync to localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('[TranscriptVault] LocalStorage save fallback:', err);
    // If full, trim to top 20
    try {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(updated.slice(0, 20)));
    } catch {
      // Ignore
    }
  }

  // 2. Sync to IndexedDB for permanent storage
  if (typeof window !== 'undefined' && window.indexedDB) {
    persistAppState('transcript_vault_permanent', updated).catch(() => {});
  }

  return entry;
}

export function getTranscriptVaultItems(projectId?: string): VaultTranscriptItem[] {
  if (inMemoryVault) {
    const list = projectId
      ? inMemoryVault.filter((x) => !x.projectId || x.projectId === projectId)
      : inMemoryVault;
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }

  // Load from localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(VAULT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          inMemoryVault = parsed;
          const list = projectId
            ? parsed.filter((x) => !x.projectId || x.projectId === projectId)
            : parsed;
          return [...list].sort((a, b) => b.timestamp - a.timestamp);
        }
      }
    }
  } catch (e) {
    console.warn('[TranscriptVault] Error reading vault:', e);
  }

  return [];
}

export async function hydrateVaultFromIndexedDB(): Promise<VaultTranscriptItem[]> {
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      const dbItems = await getAppState<VaultTranscriptItem[]>('transcript_vault_permanent');
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        // Merge with existing in-memory vault
        const current = getTranscriptVaultItems();
        const map = new Map<string, VaultTranscriptItem>();
        dbItems.forEach((it) => map.set(it.id, it));
        current.forEach((it) => map.set(it.id, it));
        const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        inMemoryVault = merged;
        try {
          localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(merged.slice(0, 30)));
        } catch {
          // Ignore
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('[TranscriptVault] DB hydration notice:', err);
  }
  return getTranscriptVaultItems();
}

export function deleteVaultTranscript(id: string): void {
  const current = getTranscriptVaultItems();
  const filtered = current.filter((x) => x.id !== id);
  inMemoryVault = filtered;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(filtered));
    }
    if (window.indexedDB) {
      persistAppState('transcript_vault_permanent', filtered).catch(() => {});
    }
  } catch {
    // Ignore
  }
}

export function clearTranscriptVault(): void {
  inMemoryVault = [];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(VAULT_STORAGE_KEY);
    }
    if (window.indexedDB) {
      persistAppState('transcript_vault_permanent', []).catch(() => {});
    }
  } catch {
    // Ignore
  }
}

export function getLatestTranscript(type?: VaultTranscriptItem['type']): VaultTranscriptItem | null {
  const list = getTranscriptVaultItems();
  if (!type) return list[0] || null;
  return list.find((x) => x.type === type) || null;
}

function inferTranscriptTitle(text: string, type: VaultTranscriptItem['type']): string {
  const firstLine = text.split('\n')[0].replace(/^[#\*\-\d\.\s\|]+/, '').trim();
  if (firstLine && firstLine.length > 3 && firstLine.length <= 45) {
    return firstLine;
  }
  if (type === 'chart_transcript') {
    return `Chart Data (${text.length} chars)`;
  }
  if (type === 'srt_clock') {
    return `Subtitles SRT Clock (${text.split('\n').filter((l) => l.includes('-->')).length} cues)`;
  }
  if (type === 'narration_script') {
    const beats = text.split('\n').filter((l) => /\b\d+[\.\)]/.test(l)).length;
    return beats > 0 ? `Narration Script (${beats} beats)` : `Narration Script (${text.length} chars)`;
  }
  return `ChatGPT Transcript (${text.length} chars)`;
}

function countTranscriptItems(text: string, type: VaultTranscriptItem['type']): number {
  if (type === 'srt_clock') {
    return text.split('\n').filter((l) => l.includes('-->')).length;
  }
  if (type === 'chart_transcript') {
    const parsed = parseChatGPTChartTranscript(text);
    return parsed.detectedPoints.length;
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const beats = lines.filter((l) => /\b\d+[\.\)]/.test(l)).length;
  return beats > 0 ? beats : lines.length;
}

function generateTranscriptSummary(text: string, type: VaultTranscriptItem['type']): string {
  const preview = text.slice(0, 140).replace(/[\r\n]+/g, ' ').trim();
  return preview.length >= 140 ? `${preview}...` : preview;
}

// ============================================================================
// CHATGPT CHART TRANSCRIPT PARSER & EXTRACTOR
// ============================================================================

export interface ParsedChartTranscriptResult {
  config: Partial<ChartConfig>;
  detectedPoints: ChartDataPoint[];
  inferredType: ChartType;
  unit: string;
  prefix: string;
  trendText: string;
  title: string;
  subtitle: string;
}

/**
 * Intelligently parses ANY raw ChatGPT output, transcript, table, bulleted points,
 * CSV, or JSON text into high-fidelity animated Infographic Chart data.
 */
export function parseChatGPTChartTranscript(rawText: string): ParsedChartTranscriptResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      config: {},
      detectedPoints: [],
      inferredType: 'bar',
      unit: '',
      prefix: '',
      trendText: '',
      title: 'Infographic Chart',
      subtitle: 'From ChatGPT transcript',
    };
  }

  // 1. Try JSON array first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : parsed.data || parsed.points || parsed.items || [];
      if (Array.isArray(arr) && arr.length > 0) {
        const points: ChartDataPoint[] = arr.map((item: any, idx: number) => ({
          label: String(item.label || item.name || item.key || item.category || `Item ${idx + 1}`),
          value: Number(item.value ?? item.val ?? item.amount ?? item.percentage ?? item.count ?? 0),
        }));
        return {
          config: { data: points },
          detectedPoints: points,
          inferredType: points.length <= 5 && arr.some((x: any) => String(x.value).includes('%')) ? 'pie' : 'bar',
          unit: arr.some((x: any) => String(x.value).includes('%')) ? '%' : '',
          prefix: '',
          trendText: '',
          title: parsed.title || 'Extracted Chart Data',
          subtitle: parsed.subtitle || `${points.length} metrics from JSON`,
        };
      }
    } catch {
      // Continue to regex & line-based parsing
    }
  }

  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  let detectedPoints: ChartDataPoint[] = [];
  let unit = '';
  let prefix = '';
  let trendText = '';
  let title = 'Infographic Metrics';
  let subtitle = 'Extracted from transcript';

  // Check if first line looks like a title
  if (lines.length > 1 && !/\d/.test(lines[0]) && lines[0].length < 60) {
    title = lines[0].replace(/^[#\*\:\-\s]+/, '').trim();
  }

  // Detect trend badges (e.g. "+34%", "▲ 82% Avg", "Up 45%", "-12%")
  const trendMatch = trimmed.match(/([▲▼\+\-]\s*\d+(?:\.\d+)?%[^\n\r,\.]*)/);
  if (trendMatch) {
    trendText = trendMatch[1].trim();
  }

  // Detect currency prefix (e.g. $, €, £)
  if (trimmed.includes('$')) prefix = '$';
  else if (trimmed.includes('€')) prefix = '€';
  else if (trimmed.includes('£')) prefix = '£';

  // Detect unit suffixes (%, k, M, B, sec, s, min, pts)
  if (trimmed.includes('%')) unit = '%';
  else if (/\b(?:k|kilo|thousand)\b/i.test(trimmed)) unit = 'k';
  else if (/\b(?:M|million)\b/i.test(trimmed)) unit = 'M';
  else if (/\b(?:B|billion)\b/i.test(trimmed)) unit = 'B';

  // 2. Parse Markdown Table (| Col 1 | Col 2 |)
  const tableRows = lines.filter((l) => l.startsWith('|') && l.endsWith('|'));
  if (tableRows.length >= 2) {
    for (const row of tableRows) {
      const cells = row
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      // Skip markdown divider row like |---|---|
      if (cells.some((c) => /^[\:\-\s]+$/.test(c))) continue;
      if (cells.length >= 2) {
        const valMatch = cells[1].match(/[\+\-]?\d+(?:\.\d+)?/);
        if (valMatch) {
          detectedPoints.push({
            label: cells[0].replace(/[\*\#]/g, '').trim(),
            value: parseFloat(valMatch[0]),
          });
        }
      }
    }
  }

  // 3. Parse Line Patterns:
  // Examples:
  // "0:00 - 100%"
  // "1. January: $45k"
  // "- Retention at 30s: 82%"
  // "Q1: 140"
  // "Segment A = 45"
  if (detectedPoints.length === 0) {
    for (const line of lines) {
      // Match key-value separators (:, -, =, |, tab)
      const kvMatch = line.match(/^([^\:\-\=\|\t\d]+|\d+[\:\.]\d+|[A-Za-z0-9\s#]+)[\:\-\=\|\t]+(.*)$/);
      if (kvMatch) {
        const keyPart = kvMatch[1].replace(/^[#\*\d\.\s\-\(]+|[#\*\)\:]+$/g, '').trim();
        const valPart = kvMatch[2].trim();
        const numMatch = valPart.match(/[\+\-]?\d+(?:\.\d+)?/);
        if (numMatch && keyPart.length > 0 && keyPart.length < 40) {
          detectedPoints.push({
            label: keyPart,
            value: parseFloat(numMatch[0]),
          });
          continue;
        }
      }

      // Match "Label 45%" or "0:15 92%"
      const spaceMatch = line.match(/^([A-Za-z0-9\s#\:\.]+?)\s+([\+\-]?\d+(?:\.\d+)?)\s*(%|[kKmMbB])?$/);
      if (spaceMatch) {
        const label = spaceMatch[1].replace(/^[#\*\d\.\s\-\(]+|[#\*\)]+$/g, '').trim();
        const num = parseFloat(spaceMatch[2]);
        if (label && !isNaN(num)) {
          detectedPoints.push({
            label,
            value: num,
          });
        }
      }
    }
  }

  // 4. Fallback if only single metric or minimal numbers found
  if (detectedPoints.length === 0) {
    const allNumbers = Array.from(trimmed.matchAll(/([\w\s]{2,20})[\:\-]?\s*(\d+(?:\.\d+)?)/g));
    if (allNumbers.length > 0) {
      detectedPoints = allNumbers.slice(0, 10).map((m) => ({
        label: m[1].replace(/^[^\w]+/, '').trim(),
        value: parseFloat(m[2]),
      }));
    }
  }

  // Limit to reasonable video chart bounds
  detectedPoints = detectedPoints.slice(0, 8);

  // Inferred Chart Type
  let inferredType: ChartType = 'bar';
  const labelsText = detectedPoints.map((p) => p.label.toLowerCase()).join(' ');

  // Time / timestamps -> Line chart
  if (
    detectedPoints.some((p) => /\d+:\d+|sec|min|day|month|year|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(p.label)) ||
    labelsText.includes('retention') ||
    labelsText.includes('trend')
  ) {
    inferredType = 'line';
  } else if (detectedPoints.length === 1) {
    inferredType = detectedPoints[0].value <= 100 && unit === '%' ? 'progress' : 'metric';
  } else if (
    detectedPoints.length <= 5 &&
    (unit === '%' || detectedPoints.reduce((acc, p) => acc + p.value, 0) === 100)
  ) {
    inferredType = 'pie';
  }

  return {
    config: {
      type: inferredType,
      title,
      subtitle: `${detectedPoints.length} data points extracted from transcript`,
      data: detectedPoints,
      unit,
      prefix,
      trendText: trendText || (detectedPoints.length > 1 ? `▲ High: ${Math.max(...detectedPoints.map((p) => p.value))}${unit}` : undefined),
    },
    detectedPoints,
    inferredType,
    unit,
    prefix,
    trendText,
    title,
    subtitle,
  };
}
