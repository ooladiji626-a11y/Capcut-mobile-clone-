import JSZip from 'jszip';
import { ProjectAsset, CaptionClip } from '../types';
import { createProjectAssetFromFile } from './assetManager';

export interface ZipExtractionResult {
  zipName: string;
  assets: ProjectAsset[];
  scriptText?: string;
  subtitleCaptions?: CaptionClip[];
  summary: {
    totalFiles: number;
    videoCount: number;
    imageCount: number;
    audioCount: number;
    hasScript: boolean;
  };
}

/**
 * Checks if a file is a ZIP archive
 */
export function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    file.type === 'application/x-zip' ||
    file.type === 'multipart/x-zip'
  );
}

/**
 * Helper to determine MIME type from file extension
 */
function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    // Video
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';

    // Audio
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
    case 'aac':
      return 'audio/aac';
    case 'ogg':
      return 'audio/ogg';
    case 'flac':
      return 'audio/flac';

    // Image
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    case 'avif':
      return 'image/avif';

    // Text
    case 'txt':
    case 'md':
      return 'text/plain';
    case 'srt':
      return 'text/srt';
    case 'vtt':
      return 'text/vtt';
    case 'json':
      return 'application/json';

    default:
      return 'application/octet-stream';
  }
}

/**
 * Parses simple SRT subtitle format into CaptionClips
 */
function parseSrtToCaptions(srtText: string): CaptionClip[] {
  const captions: CaptionClip[] = [];
  const blocks = srtText.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 2) {
      // Line with timestamp: 00:00:01,000 --> 00:00:04,500
      const timeLine = lines.find((l) => l.includes('-->'));
      if (timeLine) {
        const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
        const parseTime = (t: string) => {
          const parts = t.replace(',', '.').split(':');
          if (parts.length === 3) {
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
          }
          return 0;
        };

        const startTime = parseTime(startStr);
        const endTime = parseTime(endStr);
        const duration = Math.max(0.5, endTime - startTime);

        const textLines = lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim();
        if (textLines) {
          captions.push({
            id: `cap-srt-${Date.now()}-${captions.length}`,
            text: textLines,
            startTime: Number(startTime.toFixed(2)),
            duration: Number(duration.toFixed(2)),
            stylePreset: 'hormozi',
          });
        }
      }
    }
  }

  return captions;
}

/**
 * Extracts all valid media assets and script files from a ZIP archive
 */
export async function extractZipArchive(
  zipFile: File,
  onProgress?: (percent: number, currentItem: string) => void
): Promise<ZipExtractionResult> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipFile);

  const assets: ProjectAsset[] = [];
  let scriptText: string | undefined;
  let subtitleCaptions: CaptionClip[] | undefined;

  const validEntries: Array<{ name: string; entry: JSZip.JSZipObject }> = [];

  // Filter out directories, Mac metadata, and hidden files
  loadedZip.forEach((relativePath, entry) => {
    if (
      entry.dir ||
      relativePath.startsWith('__MACOSX/') ||
      relativePath.includes('/.DS_Store') ||
      relativePath.endsWith('.DS_Store') ||
      relativePath.startsWith('.')
    ) {
      return;
    }
    validEntries.push({ name: relativePath, entry });
  });

  const totalEntries = validEntries.length;
  let processed = 0;

  for (const item of validEntries) {
    const rawFileName = item.name.split('/').pop() || item.name;
    const mimeType = getMimeTypeFromExtension(rawFileName);

    if (onProgress) {
      const pct = Math.round((processed / Math.max(1, totalEntries)) * 100);
      onProgress(pct, rawFileName);
    }

    try {
      // 1. Check for subtitle/caption files
      if (rawFileName.endsWith('.srt') || rawFileName.endsWith('.vtt')) {
        const textContent = await item.entry.async('text');
        if (textContent.trim()) {
          const parsed = parseSrtToCaptions(textContent);
          if (parsed.length > 0) {
            subtitleCaptions = parsed;
          }
          if (!scriptText) {
            scriptText = textContent.trim();
          }
          const blob = new Blob([textContent], { type: 'text/plain' });
          const extractedFile = new File([blob], rawFileName, { type: 'text/plain' });
          const asset = await createProjectAssetFromFile(extractedFile);
          assets.push(asset);
        }
      }
      // 2. Check for script/text narration files
      else if (
        rawFileName.endsWith('.txt') ||
        rawFileName.endsWith('.md') ||
        rawFileName.toLowerCase().includes('script') ||
        rawFileName.toLowerCase().includes('voiceover')
      ) {
        const textContent = await item.entry.async('text');
        if (textContent.trim()) {
          if (textContent.length > 20) {
            scriptText = textContent.trim();
          }
          const blob = new Blob([textContent], { type: 'text/plain' });
          const extractedFile = new File([blob], rawFileName, { type: 'text/plain' });
          const asset = await createProjectAssetFromFile(extractedFile);
          assets.push(asset);
        }
      }
      // 3. Media files (Audio, Video, Image)
      else if (
        mimeType.startsWith('video/') ||
        mimeType.startsWith('audio/') ||
        mimeType.startsWith('image/')
      ) {
        const blob = await item.entry.async('blob');
        const extractedFile = new File([blob], rawFileName, { type: mimeType });
        if (mimeType.startsWith('image/')) {
          // Use lightweight in-memory Blob URL; NEVER convert to base64 string
          const objectUrl = URL.createObjectURL(extractedFile);
          let rankingIndex: number | undefined;
          const rankMatch = rawFileName.match(/(?:^|[^\d])(\d{1,4})(?:[^\d]|$)/);
          if (rankMatch) {
            rankingIndex = parseInt(rankMatch[1], 10);
          }
          const cleanBase = rawFileName.replace(/\.[^/.]+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
          const rawWords = cleanBase.split(/[-_ \s\d#]+/).filter((w) => w.length > 1);
          const tagSet = new Set<string>(rawWords.filter((w) => w.length > 2));
          const asset: ProjectAsset = {
            id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: rawFileName,
            type: 'image',
            url: objectUrl,
            thumbnailUrl: objectUrl, // in-memory Blob URL, NOT base64
            duration: 5.0,
            uploadedAt: Date.now(),
            createdAt: Date.now(),
            file: extractedFile,
            size: extractedFile.size,
            tags: Array.from(tagSet),
            rankingIndex,
            analysis: {
              description: `Visual depicting ${rawFileName}`,
              dominantColor: '#4A5568',
              brightness: 'balanced',
            },
          };
          assets.push(asset);
        } else {
          const asset = await createProjectAssetFromFile(extractedFile);
          assets.push(asset);
        }
      }
    } catch (err) {
      console.warn(`Failed to extract entry ${rawFileName} from zip:`, err);
    }

    processed++;
    // Yield to the browser main thread to avoid memory spikes and keep UI responsive
    if (processed % 3 === 0) {
      await new Promise((r) => setTimeout(r, 16));
    }
  }

  if (onProgress) {
    onProgress(100, 'Complete');
  }

  // Count summary
  const videoCount = assets.filter((a) => a.type === 'video').length;
  const imageCount = assets.filter((a) => a.type === 'image').length;
  const audioCount = assets.filter((a) => a.type === 'audio').length;

  return {
    zipName: zipFile.name,
    assets,
    scriptText,
    subtitleCaptions,
    summary: {
      totalFiles: assets.length,
      videoCount,
      imageCount,
      audioCount,
      hasScript: Boolean(scriptText),
    },
  };
}

/**
 * Handles batch processing of files which may include single media files and/or ZIP archives
 */
export async function processUploadFilesOrZips(
  files: FileList | File[],
  onProgress?: (progressText: string) => void
): Promise<{
  assets: ProjectAsset[];
  scriptText?: string;
  subtitleCaptions?: CaptionClip[];
  zipSummaries: Array<{ zipName: string; count: number; breakdown: string }>;
}> {
  const fileArray = Array.from(files);
  const allAssets: ProjectAsset[] = [];
  let combinedScript: string | undefined;
  let combinedCaptions: CaptionClip[] | undefined;
  const zipSummaries: Array<{ zipName: string; count: number; breakdown: string }> = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];

    if (isZipFile(file)) {
      if (onProgress) {
        onProgress(`Unpacking ZIP: ${file.name}...`);
      }
      const zipRes = await extractZipArchive(file, (pct, itemName) => {
        if (onProgress) {
          onProgress(`Extracting ${file.name} (${pct}%): ${itemName}`);
        }
      });

      allAssets.push(...zipRes.assets);
      if (zipRes.scriptText && !combinedScript) {
        combinedScript = zipRes.scriptText;
      }
      if (zipRes.subtitleCaptions && !combinedCaptions) {
        combinedCaptions = zipRes.subtitleCaptions;
      }

      const breakdown = `${zipRes.summary.videoCount}v · ${zipRes.summary.imageCount}img · ${zipRes.summary.audioCount}aud${
        zipRes.summary.hasScript ? ' · 1 script' : ''
      }`;
      zipSummaries.push({
        zipName: file.name,
        count: zipRes.assets.length,
        breakdown,
      });
    } else {
      if (onProgress) {
        onProgress(`Processing ${file.name}...`);
      }
      try {
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
          const text = await file.text();
          if (text.trim() && !combinedScript) {
            combinedScript = text.trim();
          }
        } else if (lowerName.endsWith('.srt') || lowerName.endsWith('.vtt')) {
          const text = await file.text();
          const parsed = parseSrtToCaptions(text);
          if (parsed.length > 0 && !combinedCaptions) {
            combinedCaptions = parsed;
          }
          if (!combinedScript && text.trim()) {
            // Preserve raw SRT formatting with timestamps for exact subtitle timing
            combinedScript = text.trim();
          }
        } else if (file.type.startsWith('image/')) {
          const objectUrl = URL.createObjectURL(file);
          let rankingIndex: number | undefined;
          const rankMatch = file.name.match(/(?:^|[^\d])(\d{1,4})(?:[^\d]|$)/);
          if (rankMatch) {
            rankingIndex = parseInt(rankMatch[1], 10);
          }
          const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
          const rawWords = cleanBase.split(/[-_ \s\d#]+/).filter((w) => w.length > 1);
          const tagSet = new Set<string>(rawWords.filter((w) => w.length > 2));
          allAssets.push({
            id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: file.name,
            type: 'image',
            url: objectUrl,
            thumbnailUrl: objectUrl, // in-memory Blob URL, NOT base64
            duration: 5.0,
            uploadedAt: Date.now(),
            createdAt: Date.now(),
            file,
            size: file.size,
            tags: Array.from(tagSet),
            rankingIndex,
            analysis: {
              description: `Visual depicting ${file.name}`,
              dominantColor: '#4A5568',
              brightness: 'balanced',
            },
          });
        } else {
          const asset = await createProjectAssetFromFile(file);
          allAssets.push(asset);
        }
      } catch (err) {
        console.warn(`Failed to process ${file.name}:`, err);
      }
    }
  }

  return {
    assets: allAssets,
    scriptText: combinedScript,
    subtitleCaptions: combinedCaptions,
    zipSummaries,
  };
}
