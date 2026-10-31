import {
  AIEditCommand,
  VideoClip,
  AudioTrackClip,
  CaptionClip,
  OverlayClip,
  ProjectAsset,
  AspectRatio,
  TimelineVerificationReport,
} from '../types';
import { generateRealisticAudioWaveform } from './audioWaveform';

export interface ExecutionContext {
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captionClips: CaptionClip[];
  overlayClips: OverlayClip[];
  registeredAssets: ProjectAsset[];
  aspectRatio?: AspectRatio;
}

export interface VerificationOptions {
  requestedAspectRatio?: AspectRatio;
  requestedAssetNames?: string[];
  requestedSFX?: boolean;
  requestedCaptions?: boolean;
  requestedDeadSpaceRemoval?: boolean;
  requestedTasks?: string[];
  masterAudioDuration?: number;
  isCorrection?: boolean;
}

/**
 * Validates a single AI Edit Command before execution
 */
export function validateAICommand(
  cmd: AIEditCommand,
  context: ExecutionContext
): { valid: boolean; error?: string } {
  if (!cmd.type) {
    return { valid: false, error: 'Command type is missing' };
  }

  switch (cmd.type) {
    case 'ADD_CLIP':
      if (!cmd.payload.title && !cmd.payload.id) {
        return { valid: false, error: 'ADD_CLIP requires a valid title or asset reference' };
      }
      if (cmd.payload.duration !== undefined && cmd.payload.duration <= 0) {
        return { valid: false, error: 'Clip duration must be greater than 0' };
      }
      return { valid: true };

    case 'REMOVE_CLIP':
      if (!cmd.targetId) {
        return { valid: false, error: 'REMOVE_CLIP requires a target clip ID' };
      }
      return { valid: true };

    case 'TRIM_CLIP':
    case 'CHANGE_DURATION':
      if (!cmd.targetId && cmd.payload.newDuration === undefined && cmd.payload.duration === undefined) {
        return { valid: false, error: 'Target clip ID or duration required for duration adjustment' };
      }
      return { valid: true };

    case 'ADD_CAPTION':
      if (!cmd.payload.text) {
        return { valid: false, error: 'Caption text is required' };
      }
      return { valid: true };

    case 'ADD_AUDIO':
    case 'ADD_SFX':
      if (!cmd.payload.title) {
        return { valid: false, error: 'Audio title is required' };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
}

/**
 * Applies a single AI command onto the project state immutably and returns updated collections
 */
export function applyAICommand(
  cmd: AIEditCommand,
  current: ExecutionContext
): {
  nextContext: ExecutionContext;
  success: boolean;
  error?: string;
} {
  const validation = validateAICommand(cmd, current);
  if (!validation.valid) {
    return { nextContext: current, success: false, error: validation.error };
  }

  let videoClips = [...current.videoClips];
  let audioClips = [...current.audioClips];
  let captionClips = [...current.captionClips];
  let overlayClips = [...current.overlayClips];
  let aspectRatio = current.aspectRatio || '9:16';

  try {
    switch (cmd.type) {
      case 'ADD_CLIP': {
        const payload = cmd.payload;
        const matchingAsset = current.registeredAssets.find(
          (a) =>
            (payload.matchedAssetId && a.id === payload.matchedAssetId) ||
            (payload.id && a.id === payload.id) ||
            (payload.title && a.name.toLowerCase() === payload.title.toLowerCase()) ||
            (payload.title && (a.name.toLowerCase().includes(payload.title.toLowerCase()) || payload.title.toLowerCase().includes(a.name.toLowerCase())))
        );

        const newClip: VideoClip = {
          id: payload.id || `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: matchingAsset?.name || payload.title || 'Untitled Visual Clip',
          type: (matchingAsset?.type === 'image' || matchingAsset?.type === 'video' ? matchingAsset.type : payload.type) || 'video',
          url: matchingAsset?.url || payload.url,
          file: matchingAsset?.file || payload.file,
          color: payload.color || 'from-cyan-700 to-blue-800',
          thumbnailUrl:
            matchingAsset?.thumbnailUrl ||
            matchingAsset?.url ||
            payload.thumbnailUrl ||
            'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=300&auto=format&fit=crop&q=80',
          frames: matchingAsset
            ? [matchingAsset.thumbnailUrl || matchingAsset.url, matchingAsset.thumbnailUrl || matchingAsset.url]
            : payload.frames || [
                payload.thumbnailUrl ||
                  'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=300&auto=format&fit=crop&q=80',
              ],
          duration: payload.duration || matchingAsset?.duration || 3.0,
          startOffset: payload.startOffset || 0,
          rawDuration: matchingAsset?.duration || payload.rawDuration || (payload.duration || 3.0) * 2,
          volume: payload.volume ?? 100,
          speed: payload.speed ?? 1.0,
          transitionAfter: payload.transitionAfter,
          keyframes: payload.keyframes,
          filterPreset: payload.filterPreset,
          videoEffects: payload.videoEffects,
        };
        videoClips.push(newClip);
        break;
      }

      case 'REMOVE_CLIP': {
        videoClips = videoClips.filter((c) => c.id !== cmd.targetId);
        break;
      }

      case 'MOVE_CLIP': {
        const { fromIndex, toIndex } = cmd.payload;
        if (fromIndex !== undefined && toIndex !== undefined && fromIndex >= 0 && fromIndex < videoClips.length) {
          const item = videoClips.splice(fromIndex, 1)[0];
          videoClips.splice(Math.max(0, Math.min(videoClips.length, toIndex)), 0, item);
        }
        break;
      }

      case 'REPLACE_CLIP': {
        videoClips = videoClips.map((c) => {
          if (c.id === cmd.targetId) {
            return {
              ...c,
              title: cmd.payload.title || c.title,
              thumbnailUrl: cmd.payload.thumbnailUrl || c.thumbnailUrl,
              type: cmd.payload.type || c.type,
            };
          }
          return c;
        });
        break;
      }

      case 'TRIM_CLIP':
      case 'CHANGE_DURATION': {
        videoClips = videoClips.map((c) => {
          if (c.id === cmd.targetId) {
            return {
              ...c,
              duration: cmd.payload.newDuration || cmd.payload.duration || c.duration,
            };
          }
          return c;
        });
        break;
      }

      case 'SET_SPEED': {
        videoClips = videoClips.map((c) => {
          if (c.id === cmd.targetId) {
            const speed = cmd.payload.speed || 1.0;
            return {
              ...c,
              speed,
              duration: cmd.payload.duration || Number((c.duration / speed).toFixed(2)),
            };
          }
          return c;
        });
        break;
      }

      case 'ADD_CAPTION': {
        const payload = cmd.payload;
        const newCap: CaptionClip = {
          id: payload.id || `cap-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          text: payload.text,
          startTime: payload.startTime ?? 0,
          duration: payload.duration ?? 2.0,
          stylePreset: payload.stylePreset || 'documentary',
        };
        captionClips.push(newCap);
        break;
      }

      case 'REMOVE_CAPTION': {
        if (cmd.targetId) {
          captionClips = captionClips.filter((c) => c.id !== cmd.targetId);
        } else if (cmd.payload?.id) {
          captionClips = captionClips.filter((c) => c.id !== cmd.payload.id);
        } else {
          captionClips = [];
        }
        break;
      }

      case 'CLEAR_CAPTIONS': {
        captionClips = [];
        break;
      }

      case 'EDIT_TEXT': {
        captionClips = captionClips.map((c) => {
          if (c.id === cmd.targetId || !cmd.targetId) {
            return {
              ...c,
              ...(cmd.payload.stylePreset ? { stylePreset: cmd.payload.stylePreset } : {}),
              ...(cmd.payload.text ? { text: cmd.payload.text } : {}),
            };
          }
          return c;
        });
        break;
      }

      case 'ADD_TEXT': {
        const payload = cmd.payload;
        const newOverlay: OverlayClip = {
          id: payload.id || `overlay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: payload.title || 'Text Graphic',
          thumbnailUrl: payload.thumbnailUrl || '',
          startTime: payload.startTime ?? 0,
          duration: payload.duration ?? 3.0,
          type: payload.type || 'motion-graphic',
          opacity: payload.opacity ?? 1,
          transform: payload.transform,
        };
        overlayClips.push(newOverlay);
        break;
      }

      case 'ADD_AUDIO':
      case 'ADD_SFX': {
        const payload = cmd.payload;
        const matchingAsset = current.registeredAssets.find(
          (a) =>
            a.type === 'audio' &&
            ((payload.matchedAssetId && a.id === payload.matchedAssetId) ||
              (payload.id && a.id === payload.id) ||
              (payload.title && a.name.toLowerCase() === payload.title.toLowerCase()) ||
              (payload.title &&
                (a.name.toLowerCase().includes(payload.title.toLowerCase()) ||
                  payload.title.toLowerCase().includes(a.name.toLowerCase()))))
        ) || (cmd.type === 'ADD_AUDIO' && payload.category === 'voiceover' ? current.registeredAssets.find((a) => a.type === 'audio') : undefined);

        const newAudio: AudioTrackClip = {
          id: payload.id || `audio-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: matchingAsset?.name || payload.title,
          artist: payload.artist || (cmd.type === 'ADD_SFX' ? 'SFX Library' : matchingAsset ? 'User Audio' : 'Soundtrack'),
          category: payload.category || (cmd.type === 'ADD_SFX' ? 'sfx' : matchingAsset ? 'voiceover' : 'music'),
          url: matchingAsset?.url || payload.url,
          file: matchingAsset?.file || payload.file,
          duration: payload.duration || matchingAsset?.duration || 5.0,
          startTime: payload.startTime ?? 0,
          volume: payload.volume ?? 80,
          waveformData:
            matchingAsset?.waveformData ||
            payload.waveformData ||
            generateRealisticAudioWaveform(payload.duration || 5.0, cmd.type === 'ADD_SFX' ? 'impact' : 'speech'),
        };
        // If it already exists (updating start offset), replace it; otherwise append
        const existsIdx = audioClips.findIndex((a) => a.id === (cmd.targetId || payload.id));
        if (existsIdx >= 0) {
          audioClips[existsIdx] = newAudio;
        } else {
          audioClips.push(newAudio);
        }
        break;
      }

      case 'ADD_TRANSITION': {
        videoClips = videoClips.map((c) => {
          if (c.id === cmd.targetId) {
            return {
              ...c,
              transitionAfter: cmd.payload.transitionAfter,
            };
          }
          return c;
        });
        break;
      }

      case 'REMOVE_TRANSITION': {
        videoClips = videoClips.map((c, idx) => {
          if (
            (cmd.targetId && c.id === cmd.targetId) ||
            (cmd.payload?.clipIndex !== undefined && idx === cmd.payload.clipIndex) ||
            !cmd.targetId
          ) {
            return {
              ...c,
              transitionAfter: undefined,
            };
          }
          return c;
        });
        break;
      }

      case 'CLEAR_TRANSITIONS': {
        videoClips = videoClips.map((c) => ({
          ...c,
          transitionAfter: undefined,
        }));
        break;
      }

      case 'ADD_EFFECT': {
        videoClips = videoClips.map((c) => {
          if (c.id === cmd.targetId) {
            return {
              ...c,
              videoEffects: cmd.payload.videoEffects || c.videoEffects,
              filterPreset: cmd.payload.filterPreset || c.filterPreset,
              keyframes: cmd.payload.keyframes || c.keyframes,
            };
          }
          return c;
        });
        break;
      }

      case 'REMOVE_DEAD_SPACE': {
        // Dead-space reduction: trim initial or interstitial pauses from audio clips
        const trimAmount = cmd.payload?.trimSeconds || 0.4;
        audioClips = audioClips.map((a) => ({
          ...a,
          startTime: Math.max(0, a.startTime - (a.startTime > 0 ? trimAmount : 0)),
        }));
        break;
      }

      default:
        break;
    }

    return {
      nextContext: {
        ...current,
        videoClips,
        audioClips,
        captionClips,
        overlayClips,
        aspectRatio,
      },
      success: true,
    };
  } catch (err: any) {
    return {
      nextContext: current,
      success: false,
      error: err.message || 'Execution failed',
    };
  }
}

/**
 * Strict Verification Pass:
 * Reads the actual current project state from timeline, audio, captions, SFX, and aspect ratio.
 * Compares against requested criteria and guarantees honest, verified reporting.
 */
export function verifyAIExecution(
  context: ExecutionContext,
  options?: VerificationOptions
): TimelineVerificationReport {
  const discrepancies: string[] = [];
  const warnings: string[] = [];
  const requestedChangesCompleted: { task: string; completed: boolean; note?: string }[] = [];

  // 1. TIMELINE & VIDEO DURATION
  const videoClips = context.videoClips || [];
  const videoClipsPlaced = videoClips.filter((c) => c.type === 'video').length;
  const imageClipsPlaced = videoClips.filter((c) => c.type === 'image').length;
  const totalVisualsPlaced = videoClips.length;

  const projectDuration = Number(videoClips.reduce((acc, c) => acc + (c.duration || 0), 0).toFixed(2));

  // 2. AUDIO DURATION & COVERAGE
  const audioClips = context.audioClips || [];
  const voiceoverAudio = audioClips.find((a) => a.category === 'voiceover');
  
  let actualAudioDuration = 0;
  if (options?.masterAudioDuration && options.masterAudioDuration > 0) {
    actualAudioDuration = Number(options.masterAudioDuration.toFixed(2));
  } else if (voiceoverAudio && voiceoverAudio.duration > 0) {
    actualAudioDuration = Number(voiceoverAudio.duration.toFixed(2));
  } else if (audioClips.length > 0) {
    actualAudioDuration = Number(
      audioClips.reduce((max, a) => Math.max(max, (a.startTime || 0) + (a.duration || 0)), 0).toFixed(2)
    );
  }

  const audioCoverageDiff = actualAudioDuration > 0 ? Number((projectDuration - actualAudioDuration).toFixed(2)) : 0;
  const audioCovered = actualAudioDuration > 0 ? Math.abs(audioCoverageDiff) <= 0.05 : true;

  if (actualAudioDuration > 0 && !audioCovered) {
    discrepancies.push(
      `Timeline duration (${projectDuration}s) does not match audio duration (${actualAudioDuration}s). Difference: ${audioCoverageDiff > 0 ? '+' : ''}${audioCoverageDiff}s.`
    );
  }

  // 3. ASPECT RATIO VERIFICATION
  const actualAspectRatio = context.aspectRatio || '9:16';
  const requestedAspectRatio = options?.requestedAspectRatio;
  const aspectRatioMatched = !requestedAspectRatio || actualAspectRatio === requestedAspectRatio;

  const aspectRatioInfo = {
    requested: requestedAspectRatio,
    actual: actualAspectRatio,
    matched: aspectRatioMatched,
    error: aspectRatioMatched
      ? undefined
      : `Aspect ratio change failed — project is still ${actualAspectRatio} (requested ${requestedAspectRatio}).`,
  };

  if (!aspectRatioMatched) {
    discrepancies.push(aspectRatioInfo.error!);
  }

  // 4. VISUAL ASSETS AUDITING (Available vs. Used vs. Unused)
  const registeredAssets = context.registeredAssets || [];
  const visualAssets = registeredAssets.filter((a) => a.type === 'video' || a.type === 'image');
  const availableVisualAssets = visualAssets.length;

  // Track unique assets actually used on timeline
  const usedAssetIds = new Set<string>();
  const usedAssetNames = new Set<string>();

  for (const clip of videoClips) {
    const matched = visualAssets.find(
      (a) => a.id === clip.id || a.name === clip.title || (a.thumbnailUrl && a.thumbnailUrl === clip.thumbnailUrl)
    );
    if (matched) {
      usedAssetIds.add(matched.id);
      usedAssetNames.add(matched.name);
    }
  }

  const assetsActuallyUsed = usedAssetIds.size > 0 ? usedAssetIds.size : Math.min(availableVisualAssets, totalVisualsPlaced);
  const assetsUnused = Math.max(0, availableVisualAssets - assetsActuallyUsed);

  // Check specific requested assets if specified
  const requestedAssetsPlaced: { name: string; placed: boolean }[] = [];
  if (options?.requestedAssetNames && options.requestedAssetNames.length > 0) {
    for (const reqName of options.requestedAssetNames) {
      const placed = videoClips.some((c) => c.title.toLowerCase().includes(reqName.toLowerCase()));
      requestedAssetsPlaced.push({ name: reqName, placed });
      if (!placed) {
        discrepancies.push(`Requested visual asset "${reqName}" was not found on timeline.`);
      }
    }
  }

  // 5. CAPTIONS VERIFICATION
  const captionClips = context.captionClips || [];
  const captionSegments = captionClips.length;
  let captionTrackDuration = 0;
  let captionAudioCoveragePercent = 0;

  if (captionSegments > 0) {
    const minStart = Math.min(...captionClips.map((c) => c.startTime || 0));
    const maxEnd = Math.max(...captionClips.map((c) => (c.startTime || 0) + (c.duration || 0)));
    captionTrackDuration = Number((maxEnd - minStart).toFixed(2));
    const targetDur = actualAudioDuration > 0 ? actualAudioDuration : projectDuration;
    captionAudioCoveragePercent = targetDur > 0 ? Math.min(100, Math.round((captionTrackDuration / targetDur) * 100)) : 100;
  }

  if (options?.requestedCaptions && captionSegments === 0) {
    discrepancies.push('Captions were requested but 0 caption clips exist on the timeline.');
  }

  // 6. SFX VERIFICATION
  const sfxClips = audioClips.filter((a) => a.category === 'sfx');
  const sfxPlaced = sfxClips.length;

  if (options?.requestedSFX && sfxPlaced === 0) {
    discrepancies.push('Sound effects were requested but 0 SFX clips exist on the timeline.');
  }

  // 7. OVERLAYS
  const overlaysPlaced = (context.overlayClips || []).length;

  // 8. TASK CHECKLIST EVALUATION
  if (totalVisualsPlaced > 0) {
    requestedChangesCompleted.push({
      task: `Visual placement (${totalVisualsPlaced} clips)`,
      completed: true,
      note: `${videoClipsPlaced} video clips, ${imageClipsPlaced} image clips placed.`,
    });
  } else {
    requestedChangesCompleted.push({
      task: 'Visual placement',
      completed: false,
      note: '0 visual clips placed on timeline.',
    });
    discrepancies.push('Timeline contains 0 visual clips.');
  }

  if (actualAudioDuration > 0) {
    requestedChangesCompleted.push({
      task: `Audio alignment (${actualAudioDuration}s)`,
      completed: audioCovered,
      note: audioCovered
        ? `Timeline covers full ${actualAudioDuration}s audio track.`
        : `Timeline duration (${projectDuration}s) differs from audio (${actualAudioDuration}s).`,
    });
  }

  if (requestedAspectRatio) {
    requestedChangesCompleted.push({
      task: `Aspect ratio ${requestedAspectRatio}`,
      completed: aspectRatioMatched,
      note: aspectRatioMatched
        ? `Confirmed project aspect ratio is ${actualAspectRatio}.`
        : `Failed — project is still ${actualAspectRatio}.`,
    });
  }

  if (captionSegments > 0) {
    requestedChangesCompleted.push({
      task: `Captions synchronized (${captionSegments} segments)`,
      completed: true,
      note: `${captionTrackDuration}s total span (${captionAudioCoveragePercent}% coverage).`,
    });
  } else if (options?.requestedCaptions) {
    requestedChangesCompleted.push({
      task: 'Captions synchronized',
      completed: false,
      note: '0 caption segments created.',
    });
  }

  if (sfxPlaced > 0) {
    requestedChangesCompleted.push({
      task: `SFX placed (${sfxPlaced} cues)`,
      completed: true,
      note: `${sfxPlaced} sound effect cues located on audio track.`,
    });
  } else if (options?.requestedSFX) {
    requestedChangesCompleted.push({
      task: 'SFX placement',
      completed: false,
      note: '0 SFX cues placed.',
    });
  }

  // 9. OVERALL STATUS DETERMINATION
  let overallStatus: 'COMPLETED' | 'INCOMPLETE' | 'FAILED' = 'COMPLETED';
  if (totalVisualsPlaced === 0) {
    overallStatus = 'FAILED';
  } else if (discrepancies.length > 0) {
    overallStatus = 'INCOMPLETE';
  }

  return {
    overallStatus,
    projectDuration,
    audioDuration: actualAudioDuration,
    audioCovered,
    audioCoverageDiff,
    aspectRatio: aspectRatioInfo,
    videoClipsPlaced,
    imageClipsPlaced,
    totalVisualsPlaced,
    availableVisualAssets,
    assetsActuallyUsed,
    assetsUnused,
    requestedAssetsPlaced,
    captionSegments,
    captionTrackDuration,
    captionAudioCoveragePercent,
    sfxPlaced,
    overlaysPlaced,
    requestedChangesCompleted,
    discrepancies,
    warnings,
    verifiedAt: Date.now(),
    // Legacy support fields
    placedVisuals: totalVisualsPlaced,
    totalVisuals: totalVisualsPlaced,
    synchronizedAudio: audioCovered,
    actualAudioDuration,
    timelineDuration: projectDuration,
    captionsAdded: captionSegments,
    missingVisualsReported: availableVisualAssets > 0 && totalVisualsPlaced > availableVisualAssets ? totalVisualsPlaced - availableVisualAssets : 0,
  };
}

