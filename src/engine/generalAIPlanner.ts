import {
  TimelineOperation,
  TimelineState,
  CreativePlan,
  AspectRatio,
} from '../types';
import {
  detectChatIntent,
  EditorContextSnapshot,
} from './chatIntentDetector';
import { generateConversationalReply } from './chatConversationalResponder';

export interface GeneralAIPlanResult {
  reply: string;
  creativePlan?: CreativePlan;
  operations: TimelineOperation[];
  requiresConfirmation: boolean;
  statusText: string;
  detectedRules?: string[];
  unappliedRules?: string[];
  intentType?: 'CHAT' | 'EDIT_COMMAND' | 'NEEDS_CLARIFICATION' | 'NORMAL_CHAT' | 'AMBIGUOUS' | 'EXPLICIT_COMMAND';
  actionType?: string;
  clarificationQuestion?: string;
}

/**
 * Natural language intent parser for General Editor.
 * Strictly respects intent:
 * - CHAT: Answers questions & discusses ideas without any timeline operations.
 * - NEEDS_CLARIFICATION: Asks short clarification without guessing or touching the timeline.
 * - EDIT_COMMAND: Generates explicit timeline operations only when instructed.
 */
export function planGeneralEdit(
  userInstruction: string,
  state: TimelineState,
  customRules?: string[]
): GeneralAIPlanResult {
  const text = userInstruction.trim();
  const lower = text.toLowerCase();
  const ops: TimelineOperation[] = [];
  const detectedRules: string[] = [];
  const unappliedRules: string[] = [];

  const snapshot: EditorContextSnapshot = {
    videoClips: state.videoClips || [],
    audioClips: state.audioClips || [],
    captions: state.captions || [],
    overlays: state.overlays || [],
    registeredAssets: state.registeredAssets || [],
    selectedClipId: state.selectedClipId || null,
    aspectRatio: state.aspectRatio || '9:16',
    currentTime: state.currentTime || 0,
  };

  const detected = detectChatIntent(text, snapshot);

  // =========================================================================
  // TYPE 1: CHAT / DISCUSSION
  // DO NOT modify the editor. DO NOT call an editing action.
  // =========================================================================
  if (detected.type === 'CHAT' || (detected.type as string) === 'NORMAL_CHAT') {
    const conversationalAnswer =
      detected.conversationalReply || generateConversationalReply(text, snapshot);

    return {
      reply: conversationalAnswer,
      operations: [],
      requiresConfirmation: false,
      statusText: 'Conversational response',
      intentType: 'CHAT',
    };
  }

  // =========================================================================
  // TYPE 2: NEEDS_CLARIFICATION
  // DO NOT guess. Ask a short clarification.
  // =========================================================================
  if (detected.type === 'NEEDS_CLARIFICATION' || (detected.type as string) === 'AMBIGUOUS') {
    const clarification =
      detected.clarificationQuestion ||
      'Which clip would you like me to edit?';

    return {
      reply: clarification,
      operations: [],
      requiresConfirmation: false,
      statusText: 'Awaiting clarification',
      intentType: 'NEEDS_CLARIFICATION',
      clarificationQuestion: clarification,
    };
  }

  // =========================================================================
  // TYPE 2: EXPLICIT EDITING COMMAND
  // Generate corresponding operations for the explicit action
  // =========================================================================
  const action = detected.actionType;

  // 1. Clear Assets
  if (action === 'CLEAR_ASSETS') {
    ops.push({
      id: `op-clear-assets-${Date.now()}`,
      type: 'clear_assets' as any,
      description: 'Remove all assets from the media library',
      parameters: {},
    });
    return {
      reply: 'Done — the assets have been cleared.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Assets cleared',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'CLEAR_ASSETS',
    };
  }

  // 2. Clear Timeline
  if (action === 'CLEAR_TIMELINE') {
    ops.push({
      id: `op-clear-timeline-${Date.now()}`,
      type: 'clear_timeline' as any,
      description: 'Clear all tracks on the timeline',
      parameters: {},
    });
    return {
      reply: 'Done — the timeline has been cleared.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Timeline cleared',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'CLEAR_TIMELINE',
    };
  }

  // 3. Delete Everything
  if (action === 'DELETE_EVERYTHING') {
    ops.push({
      id: `op-delete-everything-${Date.now()}`,
      type: 'delete_everything' as any,
      description: 'Delete all timeline tracks and registered assets',
      parameters: {},
    });
    return {
      reply: 'Done — everything has been deleted. The timeline and asset library are now completely empty.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Everything deleted',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'DELETE_EVERYTHING',
    };
  }

  // 4. Delete Clip
  if (action === 'DELETE_CLIP') {
    const clipIndex = detected.parameters?.clipIndex;
    let targetClip = snapshot.videoClips[0];
    if (clipIndex !== undefined && snapshot.videoClips[clipIndex]) {
      targetClip = snapshot.videoClips[clipIndex];
    } else if (snapshot.selectedClipId) {
      const found = snapshot.videoClips.find((c) => c.id === snapshot.selectedClipId);
      if (found) targetClip = found;
    }

    if (!targetClip) {
      return {
        reply: 'There are no clips on the timeline to delete.',
        operations: [],
        requiresConfirmation: false,
        statusText: 'No clips to delete',
        intentType: 'EXPLICIT_COMMAND',
        actionType: 'DELETE_CLIP',
      };
    }

    ops.push({
      id: `op-delete-clip-${Date.now()}`,
      type: 'delete_clip' as any,
      description: `Delete clip "${targetClip.title || 'Clip'}" from timeline`,
      parameters: { clipId: targetClip.id },
    });

    return {
      reply: `Done — deleted clip "${targetClip.title || 'Clip'}" from the timeline.`,
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Clip deleted',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'DELETE_CLIP',
    };
  }

  // 5. Remove Audio
  if (action === 'REMOVE_AUDIO') {
    ops.push({
      id: `op-remove-audio-${Date.now()}`,
      type: 'remove_audio' as any,
      description: 'Remove all audio tracks from timeline',
      parameters: {},
    });
    return {
      reply: 'Done — the audio has been removed from the timeline.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Audio removed',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'REMOVE_AUDIO',
    };
  }

  // 6. Add Image
  if (action === 'ADD_IMAGE') {
    const imageAsset = snapshot.registeredAssets.find((a) => a.type === 'image') || snapshot.registeredAssets[0];
    ops.push({
      id: `op-add-image-${Date.now()}`,
      type: 'create_image_clip',
      description: `Add image visual beat: ${imageAsset?.name || 'Image'}`,
      parameters: {
        assetId: imageAsset?.id,
        duration: 4.0,
      },
    });
    return {
      reply: `Done — added image "${imageAsset?.name || 'Image'}" to the timeline.`,
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Image added',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'ADD_IMAGE',
    };
  }

  // 7. Move Clip
  if (action === 'MOVE_CLIP') {
    const sec = detected.parameters?.targetSeconds ?? 10;
    ops.push({
      id: `op-move-clip-${Date.now()}`,
      type: 'move_clip' as any,
      description: `Move clip to ${sec}s`,
      parameters: { targetSeconds: sec },
    });
    return {
      reply: `Done — moved clip to ${sec} seconds on the timeline.`,
      operations: ops,
      requiresConfirmation: false,
      statusText: `Moved to ${sec}s`,
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'MOVE_CLIP',
    };
  }

  // 8. Set Clip Duration
  if (action === 'SET_CLIP_DURATION') {
    const dur = detected.parameters?.duration ?? 5.0;
    ops.push({
      id: `op-set-duration-${Date.now()}`,
      type: 'set_clip_duration' as any,
      description: `Set clip duration to ${dur}s`,
      parameters: { duration: dur },
    });
    return {
      reply: `Done — set clip duration to ${dur} seconds.`,
      operations: ops,
      requiresConfirmation: false,
      statusText: `Duration set to ${dur}s`,
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'SET_CLIP_DURATION',
    };
  }

  // 9. Undo / Redo
  if (action === 'UNDO') {
    return {
      reply: 'Done — undid the last editor change.',
      operations: [{ id: `op-undo-${Date.now()}`, type: 'undo' as any, description: 'Undo last change', parameters: {} }],
      requiresConfirmation: false,
      statusText: 'Undid last change',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'UNDO',
    };
  }

  if (action === 'REDO') {
    return {
      reply: 'Done — redid the previous editor change.',
      operations: [{ id: `op-redo-${Date.now()}`, type: 'redo' as any, description: 'Redo change', parameters: {} }],
      requiresConfirmation: false,
      statusText: 'Redid previous change',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'REDO',
    };
  }

  // 10. Clear Captions
  if (action === 'CLEAR_CAPTIONS') {
    ops.push({
      id: `op-clear-captions-${Date.now()}`,
      type: 'clear_captions',
      description: 'Remove all captions from the timeline',
      parameters: {},
    });
    return {
      reply: 'Done — all captions have been removed.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Captions cleared',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'CLEAR_CAPTIONS',
    };
  }

  // 11. Add Captions
  if (action === 'ADD_CAPTIONS') {
    ops.push({
      id: `op-add-captions-${Date.now()}`,
      type: 'add_caption',
      description: 'Add synchronized captions with word highlights',
      parameters: {
        text: 'This video covers every single detail you need to know.',
        start: 0,
        end: 4.0,
        style: 'hormozi',
      },
    });
    return {
      reply: 'Done — added synchronized captions to the timeline.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Captions added',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'ADD_CAPTIONS',
    };
  }

  // 12. Clear Transitions
  if (action === 'CLEAR_TRANSITIONS') {
    ops.push({
      id: `op-clear-transitions-${Date.now()}`,
      type: 'clear_transitions',
      description: 'Remove all transitions from the timeline',
      parameters: {},
    });
    return {
      reply: 'Done — all transitions have been removed.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Transitions cleared',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'CLEAR_TRANSITIONS',
    };
  }

  // 13. Change Aspect Ratio
  if (action === 'CHANGE_ASPECT_RATIO') {
    const ratio = detected.parameters?.aspectRatio || '16:9';
    ops.push({
      id: `op-ratio-${Date.now()}`,
      type: 'change_aspect_ratio',
      description: `Change project aspect ratio to ${ratio}`,
      parameters: { ratio },
    });
    return {
      reply: `Done — changed project aspect ratio to ${ratio}.`,
      operations: ops,
      requiresConfirmation: false,
      statusText: `Aspect ratio ${ratio}`,
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'CHANGE_ASPECT_RATIO',
    };
  }

  // 14. Remove Silence
  if (action === 'REMOVE_SILENCE') {
    ops.push({
      id: `op-silence-${Date.now()}`,
      type: 'remove_silence',
      description: 'Remove audio pauses greater than 0.8 seconds',
      parameters: { threshold: 0.8 },
    });
    return {
      reply: 'Done — removed silence pauses and closed timeline gaps.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Silence removed',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'REMOVE_SILENCE',
    };
  }

  // 15. Duck Music
  if (action === 'DUCK_MUSIC') {
    const vol = detected.parameters?.volume ?? 15;
    ops.push({
      id: `op-duck-${Date.now()}`,
      type: 'duck_music_under_voice',
      description: `Lower background music to ${vol}% under voiceover`,
      parameters: { musicVolume: vol },
    });
    return {
      reply: `Done — ducked background music volume to ${vol}% under voiceover.`,
      operations: ops,
      requiresConfirmation: false,
      statusText: `Music ducked to ${vol}%`,
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'DUCK_MUSIC',
    };
  }

  // 16. Add Background Music
  if (action === 'ADD_BACKGROUND_MUSIC') {
    ops.push({
      id: `op-music-${Date.now()}`,
      type: 'add_background_music',
      description: 'Add background soundtrack on Track 2',
      parameters: {
        title: 'Cinematic Ambient Score',
        volume: 25,
      },
    });
    return {
      reply: 'Done — added background music track to the timeline.',
      operations: ops,
      requiresConfirmation: false,
      statusText: 'Music track added',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'ADD_BACKGROUND_MUSIC',
    };
  }

  // 17. Split Clip
  if (action === 'SPLIT_CLIP') {
    return {
      reply: 'Done — split clip at the playhead position.',
      operations: [{ id: `op-split-${Date.now()}`, type: 'split_clip' as any, description: 'Split clip at playhead', parameters: {} }],
      requiresConfirmation: false,
      statusText: 'Clip split',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'SPLIT_CLIP',
    };
  }

  // 18. Creative Auto-Edit Plan
  if (action === 'AUTO_EDIT_PLAN') {
    const isShorts = lower.includes('9:16') || lower.includes('short') || lower.includes('tiktok');
    const targetAspect: AspectRatio = isShorts ? '9:16' : '16:9';
    const targetDur = isShorts ? '45s' : '120s';
    const styleName = isShorts ? 'Fast-Paced Viral Shorts' : 'Cinematic Documentary';

    ops.push({
      id: `op-ratio-${Date.now()}`,
      type: 'change_aspect_ratio',
      description: `Format project for ${targetAspect === '9:16' ? 'Vertical 9:16' : 'Landscape 16:9'}`,
      parameters: { ratio: targetAspect },
    });

    ops.push({
      id: `op-silence-${Date.now()}`,
      type: 'remove_silence',
      description: 'Analyze audio track and remove pauses over 0.8s',
      parameters: { threshold: 0.8 },
    });

    if (snapshot.registeredAssets.length > 0) {
      snapshot.registeredAssets.slice(0, 8).forEach((asset, idx) => {
        if (asset.type === 'video') {
          ops.push({
            id: `op-clip-${idx + 1}`,
            type: 'create_video_clip',
            description: `Place Scene ${idx + 1} from ${asset.name}`,
            parameters: {
              assetId: asset.id,
              duration: 3.5,
              sourceIn: 0,
              sourceOut: 3.5,
              zoom: idx % 2 === 1,
            },
          });
        } else if (asset.type === 'image') {
          ops.push({
            id: `op-img-${idx + 1}`,
            type: 'create_image_clip',
            description: `Add image visual beat: ${asset.name}`,
            parameters: {
              assetId: asset.id,
              duration: 3.0,
            },
          });
        }
      });
    }

    const creativePlan: CreativePlan = {
      format: targetAspect === '9:16' ? 'YouTube Shorts / TikTok (9:16 Vertical)' : 'Long-form YouTube (16:9 Landscape)',
      targetDuration: targetDur,
      editingStyle: styleName,
      selectedSections: [
        'Dynamic Hook Opening (0-3s)',
        'Key Story Progression & Beat Alignment (3-35s)',
        'Climactic Moment with Punch-in Zoom (35-40s)',
        'Call to Action / Ending Outro (40-45s)',
      ],
      audioTreatment: 'Voiceover prioritized with automatic -18dB background music ducking & noise floor leveling',
      captionTreatment: 'Large bold typography with golden active-word highlighter (Hormozi style)',
      textAndEffects: [
        'Dynamic Ken Burns zoom on key visual moments',
        'Whoosh & flash transitions between scenes',
        'Opening title overlay and end subscribe card',
      ],
      exportFormat: targetAspect === '9:16' ? '1080x1920 (9:16) MP4 60FPS' : '1920x1080 (16:9) MP4 60FPS',
      operations: ops,
    };

    return {
      reply: `I have prepared a full Creative Auto-Edit Plan tailored for **${creativePlan.format}** with **${creativePlan.editingStyle}** pacing.`,
      creativePlan,
      operations: ops,
      requiresConfirmation: true,
      statusText: 'Creative plan ready for review',
      intentType: 'EXPLICIT_COMMAND',
      actionType: 'AUTO_EDIT_PLAN',
    };
  }

  // Custom rules execution
  if (customRules && customRules.length > 0) {
    customRules.forEach((rule, idx) => {
      const rLower = rule.toLowerCase();
      if (rLower.includes('pause') || rLower.includes('silence')) {
        detectedRules.push(`Rule ${idx + 1}: Cut pauses longer than 1.0s`);
        ops.push({
          id: `op-custom-silence-${idx}`,
          type: 'remove_silence',
          description: `Apply Custom Rule: Remove silence > 1s`,
          parameters: { threshold: 1.0 },
        });
      }
    });
  }

  if (ops.length === 0) {
    return {
      reply: generateConversationalReply(text, snapshot),
      operations: [],
      requiresConfirmation: false,
      statusText: 'Ready',
      intentType: 'NORMAL_CHAT',
    };
  }

  return {
    reply: `I have planned **${ops.length} editing operation${ops.length > 1 ? 's' : ''}** for your timeline based on your request.`,
    operations: ops,
    requiresConfirmation: ops.length >= 3,
    statusText: 'Plan ready to apply',
    detectedRules,
    unappliedRules,
    intentType: 'EXPLICIT_COMMAND',
  };
}
