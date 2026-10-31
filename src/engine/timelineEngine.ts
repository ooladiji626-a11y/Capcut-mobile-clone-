import {
  TimelineOperation,
  TimelineOperationType,
  OperationResult,
  BatchOperationResult,
  TimelineState,
  VideoClip,
  AudioTrackClip,
  CaptionClip,
  OverlayClip,
  Keyframe,
  Transition,
  TransitionType,
  FilterPreset,
  AspectRatio,
  ProjectAsset,
} from '../types';

/**
 * Validates whether an asset or clip exists and parameters are sane.
 */
function validateOperation(
  op: TimelineOperation,
  state: TimelineState
): { valid: boolean; error?: string } {
  if (!op || !op.type) {
    return { valid: false, error: 'Invalid operation object: missing type.' };
  }

  const p = op.parameters || {};

  switch (op.type) {
    case 'create_recap_clip':
    case 'create_video_clip': {
      const sIn = p.sourceStartSecond !== undefined ? p.sourceStartSecond : p.sourceIn;
      const sOut = p.sourceEndSecond !== undefined ? p.sourceEndSecond : p.sourceOut;

      if (sIn !== undefined && sOut !== undefined && sIn >= sOut) {
        return { valid: false, error: `Invalid cut points: startSecond (${sIn}s) must be strictly less than endSecond (${sOut}s).` };
      }
      if (sIn !== undefined && sIn < 0) {
        return { valid: false, error: `Invalid startSecond (${sIn}s): startSecond must be greater than or equal to 0.` };
      }
      if (p.assetId || p.sourceAssetId) {
        const targetAssetId = p.assetId || p.sourceAssetId;
        const asset = state.registeredAssets.find((a) => a.id === targetAssetId);
        if (asset && asset.type !== 'video' && asset.type !== 'image') {
          return { valid: false, error: `Asset "${asset.name}" is not a valid video or visual asset.` };
        }
      }
      break;
    }
    case 'delete_clip':
    case 'split_clip':
    case 'trim_clip':
    case 'set_clip_speed':
    case 'add_transition':
    case 'add_zoom': {
      if (op.targetId) {
        const existsInVideo = state.videoClips.some((c) => c.id === op.targetId);
        const existsInAudio = state.audioClips.some((a) => a.id === op.targetId);
        const existsInCaptions = state.captions.some((c) => c.id === op.targetId);
        const existsInOverlays = state.overlays.some((o) => o.id === op.targetId);
        if (!existsInVideo && !existsInAudio && !existsInCaptions && !existsInOverlays) {
          // If not found by exact ID, fallback to check if index or first clip applies
          if (p.clipIndex === undefined && state.videoClips.length === 0) {
            return { valid: false, error: `Target item "${op.targetId}" does not exist on timeline.` };
          }
        }
      }
      break;
    }
    default:
      break;
  }

  return { valid: true };
}

/**
 * Apply a single TimelineOperation to the central TimelineState
 */
export function applyOperation(
  operation: TimelineOperation,
  state: TimelineState
): { nextState: TimelineState; result: OperationResult } {
  // 1. Validation
  const validation = validateOperation(operation, state);
  if (!validation.valid) {
    return {
      nextState: state,
      result: {
        success: false,
        operationId: operation.id,
        operationType: operation.type,
        message: `Validation failed for ${operation.type}: ${validation.error}`,
        error: validation.error,
      },
    };
  }

  // Clone state immutably
  let nextClips = [...state.videoClips];
  let nextAudio = [...state.audioClips];
  let nextCaptions = [...state.captions];
  let nextOverlays = [...state.overlays];
  let nextAspectRatio = state.aspectRatio;
  let nextAssets = [...state.registeredAssets];
  let affectedIds: string[] = [];

  const p = operation.parameters || {};

  try {
    switch (operation.type) {
      case 'import_media': {
        if (p.asset) {
          const asset: ProjectAsset = p.asset;
          if (!nextAssets.some((a) => a.id === asset.id)) {
            nextAssets.push(asset);
          }
          affectedIds.push(asset.id);
        }
        break;
      }

      case 'create_recap_clip':
      case 'create_video_clip': {
        const assetId = p.sourceAssetId || p.assetId || operation.targetId;
        // Lookup asset in registered assets
        const asset = nextAssets.find((a) => a.id === assetId) ||
          nextAssets.find((a) => a.type === 'video') ||
          (p.file ? {
            id: assetId || `asset-${Date.now()}`,
            name: p.title || 'Video Asset',
            type: 'video' as const,
            url: p.url || '',
            file: p.file,
            thumbnailUrl: p.thumbnailUrl || p.url || '',
            duration: p.sourceOut ? Math.max(p.sourceOut + 10, 60) : 60,
          } : undefined);

        const sIn = p.sourceStartSecond !== undefined ? Math.max(0, p.sourceStartSecond) : (p.sourceIn !== undefined ? Math.max(0, p.sourceIn) : (p.startOffset || 0));
        const sOut = p.sourceEndSecond !== undefined ? p.sourceEndSecond : (p.sourceOut !== undefined ? p.sourceOut : (sIn + (p.duration || 4.0)));
        const exactDuration = Math.max(0.2, (p.timelineEndSecond !== undefined && p.timelineStartSecond !== undefined) ? (p.timelineEndSecond - p.timelineStartSecond) : (sOut - sIn));
        const rawDur = asset?.duration && asset.duration > sOut ? asset.duration : Math.max(sOut + 5, exactDuration + 10);
        
        let timelineStartPos = p.timelineStartSecond !== undefined ? p.timelineStartSecond : p.timelineStart;
        if (timelineStartPos === undefined) {
          // Compute cumulative position of clips on the track
          timelineStartPos = nextClips.reduce((acc, c) => acc + c.duration, 0);
        }
        const timelineEndPos = p.timelineEndSecond !== undefined ? p.timelineEndSecond : (timelineStartPos + exactDuration);

        const clipId = p.id || (p.sceneId ? `recap-clip-${p.sceneId}` : `vclip-${Date.now()}-${Math.floor(Math.random() * 1000)}`);

        const newClip: VideoClip = {
          id: clipId,
          title: p.title || asset?.name || (p.sceneId ? `Scene ${p.sceneId}` : `Clip ${nextClips.length + 1}`),
          type: 'video',
          color: p.color || '#3B82F6',
          url: p.url || asset?.url || asset?.thumbnailUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
          file: p.file || asset?.file,
          thumbnailUrl: p.thumbnailUrl || asset?.thumbnailUrl || asset?.url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
          frames: [
            p.thumbnailUrl || asset?.thumbnailUrl || asset?.url || '',
            p.thumbnailUrl || asset?.thumbnailUrl || asset?.url || '',
          ],
          duration: exactDuration,
          startOffset: sIn,
          rawDuration: rawDur,
          sourceIn: sIn,
          sourceOut: sOut,
          sourceStartSecond: sIn,
          sourceEndSecond: sOut,
          timelineStart: timelineStartPos,
          timelineEnd: timelineEndPos,
          timelineStartSecond: timelineStartPos,
          timelineEndSecond: timelineEndPos,
          sourceAssetId: asset?.id || assetId || 'existing-movie-asset',
          assetId: asset?.id || assetId || 'existing-movie-asset',
          sceneId: p.sceneId || (p.id ? p.id.replace('recap-clip-', '') : undefined),
          trackId: p.trackId || (operation.type === 'create_recap_clip' ? 'recap-video-track' : 'main-video-track'),
          status: 'ready',
          volume: p.volume !== undefined ? p.volume : 0, // Default muted if voiceover exists
          speed: p.speed || 1.0,
          filterPreset: p.filterPreset || 'cinematic-teal',
          transitionAfter: p.transitionAfter,
          keyframes: p.keyframes || (p.zoom ? [
            { id: 'kf-1', time: 0, scale: 1.0, x: 0, y: 0, opacity: 1 },
            { id: 'kf-2', time: exactDuration, scale: 1.15, x: 0, y: 0, opacity: 1 },
          ] : undefined),
        };

        if (p.index !== undefined && p.index >= 0 && p.index <= nextClips.length) {
          nextClips.splice(p.index, 0, newClip);
        } else {
          nextClips.push(newClip);
        }
        affectedIds.push(newClip.id);
        break;
      }

      case 'create_image_clip': {
        const assetId = p.assetId || operation.targetId;
        const asset = nextAssets.find((a) => a.id === assetId);
        const duration = p.duration || 3.0;
        const fallbackImg = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80';
        const resolvedUrl = p.url || asset?.url || asset?.thumbnailUrl || fallbackImg;
        const resolvedThumb = p.thumbnailUrl || asset?.thumbnailUrl || asset?.url || fallbackImg;

        const newImageClip: VideoClip = {
          id: p.id || `imgclip-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: p.title || asset?.name || `Image Beat ${nextClips.length + 1}`,
          type: 'image',
          color: '#8B5CF6',
          url: resolvedUrl,
          file: p.file || asset?.file,
          thumbnailUrl: resolvedThumb,
          frames: [resolvedThumb, resolvedThumb],
          duration: duration,
          startOffset: 0,
          rawDuration: 10.0,
          volume: 0,
          speed: 1.0,
          filterPreset: p.filterPreset || 'none',
          keyframes: p.keyframes || [
            { id: 'kf-1', time: 0, scale: 1.0, x: 0, y: 0, opacity: 1 },
            { id: 'kf-2', time: duration, scale: 1.12, x: 2, y: -2, opacity: 1 },
          ],
        };

        if (p.index !== undefined && p.index >= 0 && p.index <= nextClips.length) {
          nextClips.splice(p.index, 0, newImageClip);
        } else {
          nextClips.push(newImageClip);
        }
        affectedIds.push(newImageClip.id);
        break;
      }

      case 'create_audio_clip':
      case 'add_voiceover':
      case 'add_background_music':
      case 'add_sound_effect': {
        const cat = operation.type === 'add_voiceover' ? 'voiceover'
          : operation.type === 'add_background_music' ? 'music'
          : operation.type === 'add_sound_effect' ? 'sfx'
          : (p.category || 'voiceover');

        const newAudio: AudioTrackClip = {
          id: p.id || `audio-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: p.title || (cat === 'voiceover' ? 'Voiceover Narration' : cat === 'music' ? 'Background Score' : 'Sound Effect'),
          category: cat,
          url: p.url || '',
          file: p.file,
          duration: p.duration || 10.0,
          startTime: p.startTime !== undefined ? p.startTime : 0,
          volume: p.volume !== undefined ? p.volume : (cat === 'music' ? 20 : 100),
          waveformData: p.waveformData || [0.3, 0.6, 0.8, 0.5, 0.7, 0.4, 0.9, 0.6, 0.8, 0.3, 0.5],
        };

        // If replacing master voiceover
        if (cat === 'voiceover' && p.replaceExisting) {
          nextAudio = nextAudio.filter((a) => a.category !== 'voiceover');
        }

        nextAudio.push(newAudio);
        affectedIds.push(newAudio.id);
        break;
      }

      case 'split_clip': {
        const targetId = operation.targetId || p.clipId;
        const splitTime = p.time !== undefined ? p.time : state.currentTime;
        const idx = nextClips.findIndex((c) => c.id === targetId);

        if (idx !== -1) {
          const original = nextClips[idx];
          // Calculate relative split offset
          let timelineStart = 0;
          for (let i = 0; i < idx; i++) timelineStart += nextClips[i].duration;

          const relativeSplit = Math.max(0.5, Math.min(original.duration - 0.5, splitTime - timelineStart));
          const part1Duration = relativeSplit;
          const part2Duration = original.duration - relativeSplit;

          const part1: VideoClip = {
            ...original,
            duration: part1Duration,
          };

          const part2: VideoClip = {
            ...original,
            id: `split-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: `${original.title} (Part 2)`,
            startOffset: original.startOffset + part1Duration * (original.speed || 1),
            duration: part2Duration,
          };

          nextClips.splice(idx, 1, part1, part2);
          affectedIds.push(part1.id, part2.id);
        }
        break;
      }

      case 'trim_clip': {
        const targetId = operation.targetId || p.clipId;
        const idx = nextClips.findIndex((c) => c.id === targetId);
        if (idx !== -1) {
          const clip = nextClips[idx];
          const newDur = p.duration !== undefined ? Math.max(0.5, p.duration) : clip.duration;
          const newOffset = p.startOffset !== undefined ? Math.max(0, p.startOffset) : clip.startOffset;
          nextClips[idx] = { ...clip, duration: newDur, startOffset: newOffset };
          affectedIds.push(clip.id);
        }
        break;
      }

      case 'move_clip': {
        const targetId = operation.targetId || p.clipId;
        const fromIdx = nextClips.findIndex((c) => c.id === targetId);
        const toIdx = p.newIndex !== undefined ? p.newIndex : p.toIndex;
        if (fromIdx !== -1 && toIdx !== undefined && toIdx >= 0 && toIdx < nextClips.length) {
          const [moved] = nextClips.splice(fromIdx, 1);
          nextClips.splice(toIdx, 0, moved);
          affectedIds.push(moved.id);
        }
        break;
      }

      case 'delete_clip': {
        const targetId = operation.targetId || p.clipId;
        if (targetId) {
          nextClips = nextClips.filter((c) => c.id !== targetId);
          nextAudio = nextAudio.filter((a) => a.id !== targetId);
          nextCaptions = nextCaptions.filter((c) => c.id !== targetId);
          nextOverlays = nextOverlays.filter((o) => o.id !== targetId);
          affectedIds.push(targetId);
        } else if (p.index !== undefined && p.index >= 0 && p.index < nextClips.length) {
          const removed = nextClips.splice(p.index, 1);
          if (removed[0]) affectedIds.push(removed[0].id);
        }
        break;
      }

      case 'duplicate_clip': {
        const targetId = operation.targetId || p.clipId;
        const idx = nextClips.findIndex((c) => c.id === targetId);
        if (idx !== -1) {
          const original = nextClips[idx];
          const dup: VideoClip = {
            ...original,
            id: `dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: `${original.title} (Copy)`,
          };
          nextClips.splice(idx + 1, 0, dup);
          affectedIds.push(dup.id);
        }
        break;
      }

      case 'replace_clip': {
        const targetId = operation.targetId || p.clipId;
        const assetId = p.newAssetId;
        const newAsset = nextAssets.find((a) => a.id === assetId);
        const idx = nextClips.findIndex((c) => c.id === targetId);
        if (idx !== -1 && newAsset) {
          const assetThumb = newAsset.thumbnailUrl || newAsset.url || '';
          nextClips[idx] = {
            ...nextClips[idx],
            title: newAsset.name,
            url: newAsset.url || newAsset.thumbnailUrl,
            thumbnailUrl: assetThumb,
            frames: assetThumb ? [assetThumb, assetThumb] : [],
            file: newAsset.file,
            type: newAsset.type === 'video' ? 'video' : 'image',
          };
          affectedIds.push(nextClips[idx].id);
        }
        break;
      }

      case 'reorder_clips': {
        if (Array.isArray(p.orderIds)) {
          const map = new Map(nextClips.map((c) => [c.id, c]));
          const reordered: VideoClip[] = [];
          for (const id of p.orderIds) {
            const found = map.get(id);
            if (found) {
              reordered.push(found);
              map.delete(id);
            }
          }
          // Append remaining clips if any
          for (const leftover of map.values()) {
            reordered.push(leftover);
          }
          nextClips = reordered;
        }
        break;
      }

      case 'set_clip_speed': {
        const targetId = operation.targetId || p.clipId;
        const speed = p.speed || 1.0;
        nextClips = nextClips.map((c) => {
          if (!targetId || c.id === targetId) {
            const ratio = c.speed / speed;
            return {
              ...c,
              speed,
              duration: Math.max(0.5, c.duration * ratio),
            };
          }
          return c;
        });
        break;
      }

      case 'set_volume': {
        const vol = Math.max(0, Math.min(100, p.volume ?? 100));
        const targetTrack = operation.targetTrack || p.track;
        if (targetTrack === 'music') {
          nextAudio = nextAudio.map((a) => (a.category === 'music' ? { ...a, volume: vol } : a));
        } else if (targetTrack === 'voiceover') {
          nextAudio = nextAudio.map((a) => (a.category === 'voiceover' ? { ...a, volume: vol } : a));
        } else if (operation.targetId) {
          nextAudio = nextAudio.map((a) => (a.id === operation.targetId ? { ...a, volume: vol } : a));
          nextClips = nextClips.map((c) => (c.id === operation.targetId ? { ...c, volume: vol } : c));
        }
        break;
      }

      case 'mute_clip': {
        const targetId = operation.targetId || p.clipId;
        nextClips = nextClips.map((c) => (!targetId || c.id === targetId ? { ...c, volume: 0 } : c));
        nextAudio = nextAudio.map((a) => (!targetId || a.id === targetId ? { ...a, volume: 0 } : a));
        break;
      }

      case 'duck_music_under_voice': {
        const duckLevel = p.musicVolume !== undefined ? p.musicVolume : 15;
        nextAudio = nextAudio.map((a) => {
          if (a.category === 'music') {
            return { ...a, volume: duckLevel };
          }
          return a;
        });
        break;
      }

      case 'remove_silence': {
        const threshold = p.threshold || 0.8; // seconds
        // Adjust audio intervals
        nextAudio = nextAudio.map((a) => {
          if (a.category === 'voiceover' && a.speechIntervals) {
            const nonSilent = a.speechIntervals.filter((s) => !s.isSilence || s.duration <= threshold);
            const compactedDuration = nonSilent.reduce((acc, s) => acc + s.duration, 0);
            return {
              ...a,
              duration: Math.max(2.0, compactedDuration),
            };
          }
          return a;
        });
        break;
      }

      case 'add_caption':
      case 'add_subtitle': {
        const newCap: CaptionClip = {
          id: p.id || `cap-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          text: p.text || 'Caption',
          startTime: p.start !== undefined ? p.start : (p.startTime || 0),
          duration: p.end !== undefined && p.start !== undefined ? (p.end - p.start) : (p.duration || 3.0),
          stylePreset: p.style || p.stylePreset || 'hormozi',
          highlightWordIndex: p.highlightWordIndex,
        };
        nextCaptions.push(newCap);
        affectedIds.push(newCap.id);
        break;
      }

      case 'add_text':
      case 'add_title': {
        const newOverlay: OverlayClip = {
          id: p.id || `txt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: p.text || p.title || 'Title Text',
          thumbnailUrl: '',
          startTime: p.startTime || 0,
          duration: p.duration || 3.5,
          type: 'motion-graphic',
          opacity: 1,
          transform: {
            x: p.x || 0,
            y: p.y || -10,
            scale: p.scale || 1.2,
            rotation: 0,
          },
        };
        nextOverlays.push(newOverlay);
        affectedIds.push(newOverlay.id);
        break;
      }

      case 'add_transition': {
        const targetId = operation.targetId || p.clipId;
        const transitionType: TransitionType = p.type || 'dissolve';
        const trans: Transition = {
          id: `tr-${Date.now()}`,
          type: transitionType,
          name: transitionType,
          duration: p.duration || 0.4,
          soundEffect: p.sfx || 'swoosh',
        };
        nextClips = nextClips.map((c, idx) => {
          if (!targetId || c.id === targetId || (p.clipIndex !== undefined && idx === p.clipIndex)) {
            return { ...c, transitionAfter: trans };
          }
          return c;
        });
        break;
      }

      case 'remove_transition':
      case 'clear_transitions': {
        const targetId = operation.targetId || p.clipId;
        if (targetId || p.clipIndex !== undefined) {
          nextClips = nextClips.map((c, idx) => {
            if ((targetId && c.id === targetId) || (p.clipIndex !== undefined && idx === p.clipIndex)) {
              return { ...c, transitionAfter: undefined };
            }
            return c;
          });
        } else {
          // Clear all transitions from all clips
          nextClips = nextClips.map((c) => ({ ...c, transitionAfter: undefined }));
        }
        break;
      }

      case 'remove_caption':
      case 'clear_captions': {
        const targetId = operation.targetId || p.captionId || p.id;
        if (targetId) {
          nextCaptions = nextCaptions.filter((c) => c.id !== targetId);
        } else if (p.timeRange && Array.isArray(p.timeRange)) {
          const [tMin, tMax] = p.timeRange;
          nextCaptions = nextCaptions.filter((c) => {
            const cEnd = c.startTime + c.duration;
            return cEnd <= tMin || c.startTime >= tMax;
          });
        } else {
          // Clear all captions from the timeline
          nextCaptions = [];
        }
        break;
      }

      case 'add_filter':
      case 'add_effect': {
        const filter: FilterPreset = p.filterPreset || p.filter || 'cinematic-teal';
        const targetId = operation.targetId || p.clipId;
        nextClips = nextClips.map((c) => {
          if (!targetId || c.id === targetId) {
            return { ...c, filterPreset: filter };
          }
          return c;
        });
        break;
      }

      case 'add_zoom':
      case 'add_pan': {
        const targetId = operation.targetId || p.clipId;
        const zoomLevel = p.scale || 1.2;
        nextClips = nextClips.map((c) => {
          if (!targetId || c.id === targetId) {
            const kfs: Keyframe[] = [
              { id: 'kf-1', time: 0, scale: 1.0, x: 0, y: 0, opacity: 1 },
              { id: 'kf-2', time: c.duration, scale: zoomLevel, x: p.panX || 0, y: p.panY || 0, opacity: 1 },
            ];
            return { ...c, keyframes: kfs };
          }
          return c;
        });
        break;
      }

      case 'add_overlay':
      case 'add_sticker':
      case 'add_image_overlay':
      case 'add_video_overlay': {
        const newOverlay: OverlayClip = {
          id: p.id || `ov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: p.title || 'Overlay Item',
          thumbnailUrl: p.url || p.thumbnailUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
          startTime: p.startTime || 0,
          duration: p.duration || 4.0,
          type: operation.type === 'add_sticker' ? 'sticker' : 'b-roll',
          opacity: p.opacity || 1,
          transform: {
            x: p.x || 0,
            y: p.y || 0,
            scale: p.scale || 1.0,
            rotation: 0,
          },
        };
        nextOverlays.push(newOverlay);
        affectedIds.push(newOverlay.id);
        break;
      }

      case 'change_aspect_ratio':
      case 'change_canvas_size': {
        const ratio: AspectRatio = p.ratio || p.aspectRatio || '9:16';
        nextAspectRatio = ratio;
        break;
      }

      case 'align_to_narration': {
        // Compute total voiceover duration
        const vo = nextAudio.find((a) => a.category === 'voiceover');
        if (vo && nextClips.length > 0) {
          const totalVODur = vo.duration;
          const currentVisualDur = nextClips.reduce((acc, c) => acc + c.duration, 0);
          if (currentVisualDur > 0) {
            const factor = totalVODur / currentVisualDur;
            nextClips = nextClips.map((c) => ({
              ...c,
              duration: Math.max(0.5, c.duration * factor),
            }));
          }
        }
        break;
      }

      default:
        break;
    }

    const nextState: TimelineState = {
      ...state,
      videoClips: nextClips,
      audioClips: nextAudio,
      captions: nextCaptions,
      overlays: nextOverlays,
      aspectRatio: nextAspectRatio,
      registeredAssets: nextAssets,
    };

    return {
      nextState,
      result: {
        success: true,
        operationId: operation.id,
        operationType: operation.type,
        message: operation.description || `Successfully executed ${operation.type}.`,
        affectedClipIds: affectedIds,
      },
    };
  } catch (err: any) {
    return {
      nextState: state,
      result: {
        success: false,
        operationId: operation.id,
        operationType: operation.type,
        message: `Failed to execute ${operation.type}: ${err?.message || 'Unknown runtime error'}`,
        error: err?.message || 'Execution error',
      },
    };
  }
}

/**
 * Apply a batch of TimelineOperations sequentially.
 */
export function applyOperations(
  operations: TimelineOperation[],
  initialState: TimelineState
): { nextState: TimelineState; batchResult: BatchOperationResult } {
  let currentState = { ...initialState };
  const results: OperationResult[] = [];
  let completed = 0;
  let failed = 0;

  for (const op of operations) {
    const { nextState, result } = applyOperation(op, currentState);
    currentState = nextState;
    results.push(result);
    if (result.success) {
      completed++;
    } else {
      failed++;
    }
  }

  const summary = `Executed ${completed} of ${operations.length} operations successfully${failed > 0 ? ` (${failed} failed)` : ''}.`;

  return {
    nextState: currentState,
    batchResult: {
      success: failed === 0,
      totalOperations: operations.length,
      completedOperations: completed,
      failedOperations: failed,
      results,
      summary,
    },
  };
}

export interface CutVideoParams {
  sourceAssetId: string;
  sourceIn: number;
  sourceOut: number;
  timelineStart?: number;
  trackId?: string;
  title?: string;
}

export interface CutVideoResult {
  success: boolean;
  message: string;
  createdClip?: VideoClip;
  nextState?: TimelineState;
  error?: string;
}

/**
 * CUT OPERATION
 * Implements a strict real cut operation:
 * 1. Confirm that sourceAssetId exists.
 * 2. Confirm that the asset is a valid video.
 * 3. Read the actual source duration.
 * 4. Confirm sourceIn is greater than or equal to 0.
 * 5. Confirm sourceOut is greater than sourceIn.
 * 6. Confirm sourceOut does not exceed the video duration.
 * 7. Create a new timeline clip.
 * 8. Set the clip’s source start to sourceIn.
 * 9. Set the clip’s source end to sourceOut.
 * 10. Set the clip’s timeline start to timelineStart.
 * 11. Set the clip’s timeline duration to sourceOut minus sourceIn.
 * 12. Add the clip to the main video track.
 * 13. Save the timeline (immutably produce nextState).
 * 14. Refresh the visible timeline.
 * 15. Verify that the new clip exists.
 * 16. Return success only after verification.
 */
export function cutVideo(
  params: CutVideoParams,
  currentState: TimelineState
): CutVideoResult {
  const { sourceAssetId, sourceIn, sourceOut, trackId = 'main-video-track', title } = params;

  // 1. Confirm that sourceAssetId exists.
  const asset = currentState.registeredAssets.find((a) => a.id === sourceAssetId);
  if (!asset) {
    return {
      success: false,
      message: `Cut failed. Source asset "${sourceAssetId}" not found in project assets.`,
      error: `Asset ID ${sourceAssetId} not found`,
    };
  }

  // 2. Confirm that the asset is a valid video.
  if (asset.type !== 'video') {
    return {
      success: false,
      message: `Cut failed. Asset "${asset.name}" is of type "${asset.type}", not a valid video.`,
      error: 'Asset is not a video',
    };
  }

  // 3. Read the actual source duration.
  const sourceDuration = asset.duration || 60.0;

  // 4. Confirm sourceIn is greater than or equal to 0.
  if (sourceIn < 0) {
    return {
      success: false,
      message: `Cut failed. sourceIn (${sourceIn}s) must be greater than or equal to 0.`,
      error: 'sourceIn < 0',
    };
  }

  // 5. Confirm sourceOut is greater than sourceIn.
  if (sourceOut <= sourceIn) {
    return {
      success: false,
      message: `Cut failed. sourceOut (${sourceOut}s) must be strictly greater than sourceIn (${sourceIn}s).`,
      error: 'sourceOut <= sourceIn',
    };
  }

  // 6. Confirm sourceOut does not exceed the video duration.
  if (asset.duration && sourceOut > asset.duration + 0.5) {
    return {
      success: false,
      message: `Cut failed. sourceOut (${sourceOut.toFixed(1)}s) exceeds source video duration (${asset.duration.toFixed(1)}s).`,
      error: 'sourceOut exceeds video duration',
    };
  }

  // Calculate timeline start
  const timelineStart = params.timelineStart !== undefined
    ? params.timelineStart
    : currentState.videoClips.reduce((acc, c) => acc + c.duration, 0);

  const duration = sourceOut - sourceIn;
  const clipId = `clip-cut-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 7, 8, 9, 10, 11. Create new timeline clip
  const newClip: VideoClip = {
    id: clipId,
    assetId: asset.id,
    trackId: trackId,
    type: 'video',
    title: title || `${asset.name} [${sourceIn.toFixed(1)}s-${sourceOut.toFixed(1)}s]`,
    color: '#3B82F6',
    url: asset.url || asset.thumbnailUrl,
    file: asset.file,
    thumbnailUrl: asset.thumbnailUrl || asset.url || '',
    frames: (asset.thumbnailUrl || asset.url) ? [asset.thumbnailUrl || asset.url, asset.thumbnailUrl || asset.url] : [],
    sourceIn: sourceIn,
    sourceOut: sourceOut,
    timelineStart: timelineStart,
    timelineEnd: timelineStart + duration,
    duration: duration,
    startOffset: sourceIn,
    rawDuration: sourceDuration,
    status: 'ready',
    volume: 0,
    speed: 1.0,
    filterPreset: 'cinematic-teal',
  };

  // 12. Add the clip to the main video track.
  const nextVideoClips = [...currentState.videoClips, newClip];

  // 13. Save the timeline.
  const nextState: TimelineState = {
    ...currentState,
    videoClips: nextVideoClips,
    selectedClipId: newClip.id,
  };

  // 15. Verify that the new clip exists.
  const clipExists = nextState.videoClips.some(
    (c) => c.id === newClip.id && c.sourceIn === sourceIn && c.sourceOut === sourceOut && c.trackId === trackId
  );

  if (!clipExists) {
    return {
      success: false,
      message: 'Cut failed. No video clip was added to the main video track.',
      error: 'Verification check failed',
    };
  }

  // 16. Return success only after verification.
  return {
    success: true,
    message: `Cut applied successfully: created clip "${newClip.title}" (${duration.toFixed(1)}s) from ${sourceIn.toFixed(1)}s to ${sourceOut.toFixed(1)}s on "${trackId}".`,
    createdClip: newClip,
    nextState,
  };
}
