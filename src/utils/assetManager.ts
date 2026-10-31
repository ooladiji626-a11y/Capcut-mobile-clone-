import { ProjectAsset } from '../types';
import { extractWaveformDataFromFile, analyzeAudioSpeechAndSilence, generateRealisticAudioWaveform } from './audioWaveform';
import { createSafeThumbnail, createManagedObjectUrl } from './imageMemoryManager';

/**
 * Creates a registered ProjectAsset from an uploaded browser File
 */
export async function createProjectAssetFromFile(file: File): Promise<ProjectAsset> {
  const url = createManagedObjectUrl(file);
  const nameLower = file.name.toLowerCase();
  const type: 'video' | 'image' | 'audio' | 'text' = file.type.startsWith('video/')
    ? 'video'
    : file.type.startsWith('audio/')
    ? 'audio'
    : file.type.startsWith('text/') || nameLower.endsWith('.txt') || nameLower.endsWith('.md') || nameLower.endsWith('.srt') || nameLower.endsWith('.vtt') || nameLower.endsWith('.json')
    ? 'text'
    : 'image';

  let duration = 5.0; // default for images
  let width: number | undefined;
  let height: number | undefined;
  let thumbnailUrl = url;
  let waveformData: number[] | undefined;
  let analysisData: ProjectAsset['analysis'] | undefined;
  let textContent: string | undefined;

  // Extract ranking index from filename if present (e.g., "5_ocean.mp4", "rank_3.jpg", "clip number 2.mov")
  let rankingIndex: number | undefined;
  const rankMatch = nameLower.match(/(?:rank|number|#|top|entry|clip|\b)([1-5])\b/);
  if (rankMatch) {
    rankingIndex = parseInt(rankMatch[1], 10);
  }

  if (type === 'text') {
    try {
      textContent = await file.text();
    } catch {
      textContent = '';
    }
    const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
    duration = Math.max(3.0, Math.min(60.0, Number((wordCount / 2.5).toFixed(1))));
    analysisData = {
      transcript: textContent,
      description: `Document/Script: ${file.name} (${textContent.length} chars, ~${wordCount} words)`,
    };
  } else if (type === 'audio') {
    try {
      const audioAnalysis = await analyzeAudioSpeechAndSilence(file);
      duration = Number(audioAnalysis.duration.toFixed(2));
      waveformData = audioAnalysis.waveformData;
      analysisData = {
        speechIntervals: audioAnalysis.speechIntervals,
      };
      thumbnailUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80';
    } catch {
      try {
        const audioInfo = await extractWaveformDataFromFile(file);
        duration = Number(audioInfo.duration.toFixed(2));
        waveformData = audioInfo.waveformData;
        thumbnailUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80';
      } catch {
        // Fallback: Use HTML5 Audio element to read the exact duration from the media container
        try {
          const audioElemDuration = await new Promise<number>((resolve, reject) => {
            const el = document.createElement('audio');
            el.preload = 'metadata';
            el.src = url;
            const timer = setTimeout(() => {
              cleanup();
              reject(new Error('Audio metadata timeout'));
            }, 3000);
            const onLoaded = () => {
              cleanup();
              resolve(el.duration && Number.isFinite(el.duration) ? el.duration : 6.0);
            };
            const onError = () => {
              cleanup();
              reject(new Error('Audio load error'));
            };
            function cleanup() {
              clearTimeout(timer);
              el.removeEventListener('loadedmetadata', onLoaded);
              el.removeEventListener('error', onError);
            }
            el.addEventListener('loadedmetadata', onLoaded);
            el.addEventListener('error', onError);
          });
          duration = Number(audioElemDuration.toFixed(2));
        } catch {
          duration = 6.0;
        }
        waveformData = generateRealisticAudioWaveform(duration, 'speech');
        thumbnailUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80';
      }
    }
  } else if (type === 'video') {
    await new Promise<void>((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.src = url;

      const captureFrame = () => {
        try {
          width = v.videoWidth || 1920;
          height = v.videoHeight || 1080;
          duration = Number((v.duration || 5.0).toFixed(2));

          const canvas = document.createElement('canvas');
          canvas.width = Math.min(width, 480);
          canvas.height = Math.round((canvas.width * (height || 1080)) / (width || 1920));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch {
          // Fallback if cross-origin canvas security blocks capture
          thumbnailUrl = url;
        }
        resolve();
      };

      v.onloadeddata = () => {
        v.currentTime = Math.min(0.5, (v.duration || 2) * 0.1);
      };

      v.onseeked = () => {
        captureFrame();
      };

      v.onerror = () => {
        duration = 5.0;
        resolve();
      };

      // Fallback timeout in case video loading stalls
      setTimeout(() => {
        if (duration === 5.0 && v.duration) {
          duration = Number(v.duration.toFixed(2));
        }
        resolve();
      }, 1500);
    });
  } else if (type === 'image') {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        width = img.naturalWidth;
        height = img.naturalHeight;
        resolve();
      };
      img.onerror = () => resolve();
    });

    try {
      thumbnailUrl = await createSafeThumbnail(file, file.name, 260);
    } catch {
      thumbnailUrl = url;
    }
  }

  // Derive rich semantic tags and description from filename
  const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const rawWords = cleanBase.split(/[-_ \s\d#]+/).filter((w) => w.length > 1);
  const tagSet = new Set<string>(rawWords.filter((w) => w.length > 2));

  // Auto-expand semantic associations for finance, real estate, and actions
  if (rawWords.includes('house') || rawWords.includes('home') || rawWords.includes('property') || rawWords.includes('keys') || rawWords.includes('key')) {
    tagSet.add('real-estate');
    if (rawWords.includes('keys') || rawWords.includes('key')) {
      tagSet.add('house keys');
      tagSet.add('holding keys');
      tagSet.add('homeowner');
    }
  }
  if (rawWords.includes('stock') || rawWords.includes('chart') || rawWords.includes('invest') || rawWords.includes('candlestick') || rawWords.includes('crypto')) {
    tagSet.add('finance');
    tagSet.add('investing');
    tagSet.add('stock market');
  }
  if (rawWords.includes('cash') || rawWords.includes('money') || rawWords.includes('dollar') || rawWords.includes('wealth')) {
    tagSet.add('finance');
    tagSet.add('wealth');
    tagSet.add('cash flow');
  }
  if (rawWords.includes('debt') || rawWords.includes('credit') || rawWords.includes('bill') || rawWords.includes('card')) {
    tagSet.add('finance');
    tagSet.add('credit card debt');
  }
  if (rawWords.includes('piggy') || rawWords.includes('save') || rawWords.includes('savings') || rawWords.includes('fund')) {
    tagSet.add('finance');
    tagSet.add('savings');
    tagSet.add('emergency fund');
  }

  const tags = Array.from(tagSet);
  if (!analysisData) {
    analysisData = {
      description: `Visual depicting ${tags.slice(0, 4).join(', ')}`,
      dominantColor: '#4A5568',
      brightness: 'balanced',
    };
  }

  return {
    id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: file.name,
    type,
    url,
    thumbnailUrl,
    duration: Number(duration.toFixed(2)),
    width,
    height,
    uploadedAt: Date.now(),
    createdAt: Date.now(),
    file,
    size: file.size,
    textContent,
    tags,
    rankingIndex,
    waveformData,
    analysis: analysisData,
  };
}

/**
 * Safely registers incoming assets without overwriting existing assets.
 * If duplicate filenames exist, assigns distinguishing names (e.g., 'image (1).png').
 */
export function deduplicateAndMergeAssets(
  existingAssets: ProjectAsset[],
  incomingAssets: ProjectAsset[]
): ProjectAsset[] {
  const existingNames = new Set(existingAssets.map((a) => a.name.toLowerCase()));
  const existingIds = new Set(existingAssets.map((a) => a.id));

  const processedIncoming: ProjectAsset[] = [];

  for (const asset of incomingAssets) {
    if (existingIds.has(asset.id)) {
      continue;
    }

    let finalName = asset.name;
    const nameLower = asset.name.toLowerCase();

    if (existingNames.has(nameLower)) {
      // Find suitable copy index
      const extMatch = asset.name.match(/\.([^.]+)$/);
      const ext = extMatch ? `.${extMatch[1]}` : '';
      const baseName = extMatch ? asset.name.slice(0, -ext.length) : asset.name;

      let counter = 1;
      let candidate = `${baseName} (${counter})${ext}`;
      while (
        existingNames.has(candidate.toLowerCase()) ||
        processedIncoming.some((a) => a.name.toLowerCase() === candidate.toLowerCase())
      ) {
        counter++;
        candidate = `${baseName} (${counter})${ext}`;
      }
      finalName = candidate;
    }

    const uniqueAsset: ProjectAsset = {
      ...asset,
      name: finalName,
      uploadedAt: asset.uploadedAt || Date.now(),
      createdAt: asset.createdAt || asset.uploadedAt || Date.now(),
    };

    processedIncoming.push(uniqueAsset);
    existingNames.add(finalName.toLowerCase());
    existingIds.add(uniqueAsset.id);
  }

  return [...existingAssets, ...processedIncoming];
}
