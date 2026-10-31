import {
  TimelineOperation,
  TimelineState,
  RecapScenePlanItem,
  RecapActionPlan,
  AspectRatio,
  ProjectAsset,
  TransitionType,
} from '../types';
import {
  parseIntelligentVisualBeats,
  alignBeatsWithAudioMaster,
  performGlobalIntelligentImageMatching,
} from './intelligentVisualEngine';
import { isSrtFormat, parseSrtText } from './srtParser';

export interface RecapGenParseResult {
  scenes: RecapScenePlanItem[];
  unresolvedScenes: RecapScenePlanItem[];
  warnings: string[];
  totalSourceDurationUsed: number;
  totalRecapDuration: number;
  projectTitle?: string;
}

/**
 * Parses timecodes in formats:
 * - HH:MM:SS:FF (e.g., 00:00:17:06 @ 30fps -> 17.2s)
 * - HH:MM:SS;FF (drop frame)
 * - HH:MM:SS.mmm
 * - HH:MM:SS
 * - MM:SS or M:SS
 * - SS.s or SSs or S
 */
export function parseTimecode(tc: string, fps: number = 30): number | null {
  if (!tc) return null;
  const clean = tc.trim().replace(/^[\[\(<"']+|[\]\)>"']+$/g, '').trim();
  if (!clean) return null;

  // HH:MM:SS:FF or HH:MM:SS;FF or HH:MM:SS.FF
  const fourPartMatch = clean.match(/^(\d{1,2}):(\d{2}):(\d{2})[:;.](\d{2,3})$/);
  if (fourPartMatch) {
    const hours = parseInt(fourPartMatch[1], 10);
    const minutes = parseInt(fourPartMatch[2], 10);
    const seconds = parseInt(fourPartMatch[3], 10);
    const framesOrMs = parseInt(fourPartMatch[4], 10);
    const frameRate = fourPartMatch[4].length === 3 ? 1000 : fps;
    return hours * 3600 + minutes * 60 + seconds + framesOrMs / frameRate;
  }

  // HH:MM:SS
  const threePartMatch = clean.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (threePartMatch) {
    const hours = parseInt(threePartMatch[1], 10);
    const minutes = parseInt(threePartMatch[2], 10);
    const seconds = parseInt(threePartMatch[3], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // MM:SS or MM:SS:FF or M:SS
  const twoPartMatch = clean.match(/^(\d{1,3}):(\d{2})(?:[:;.](\d{2}))?$/);
  if (twoPartMatch) {
    const minutes = parseInt(twoPartMatch[1], 10);
    const seconds = parseInt(twoPartMatch[2], 10);
    const frames = twoPartMatch[3] ? parseInt(twoPartMatch[3], 10) : 0;
    return minutes * 60 + seconds + frames / fps;
  }

  // Raw seconds or float e.g. "12.5s" or "12.5" or "12"
  const rawSecMatch = clean.match(/^(\d+(?:\.\d+)?)\s*s?$/i);
  if (rawSecMatch) {
    const val = parseFloat(rawSecMatch[1]);
    return isNaN(val) ? null : Math.max(0, val);
  }

  const rawSec = parseFloat(clean.replace(/[^\d.-]/g, ''));
  return isNaN(rawSec) ? null : Math.max(0, rawSec);
}

/**
 * Curated high quality cinematic visual placeholders for movie recap scenes
 */
const RECAP_SCENE_THUMBNAILS = [
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80', // mysterious forest/trap
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80', // dark woods
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80', // creepy cabin / reveal
  'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80', // dark suspense / attack
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80', // movie cinema / closing
  'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&auto=format&fit=crop&q=80', // dark road
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop&q=80', // cinema auditorium
];

/**
 * Checks if raw text is a cut guide, CMX 3600 EDL, or JSON Cut Guide
 */
export function isCutGuideOrEDLText(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.includes('TITLE:') || t.includes('FCM:') || t.includes('FROM CLIP NAME:') || t.includes('NARRATION:')) {
    return true;
  }
  if (t.startsWith('{') || t.startsWith('[')) {
    if (
      t.includes('sceneCutGuide') ||
      t.includes('cuts') ||
      t.includes('scenes') ||
      t.includes('sourceMovie') ||
      t.includes('recapTimeline') ||
      t.includes('narrationScript') ||
      t.includes('cutGuide') ||
      t.includes('timecodeRange') ||
      t.includes('startSecond')
    ) {
      return true;
    }
  }
  // Check for CMX EDL event pattern e.g. "001  AX  V  C  00:00:00:00"
  if (/\b\d{1,4}\s+[\w\d]+\s+[VA\d]+\s+[CDW\d]+\s+\d{1,2}:\d{2}:\d{2}/i.test(t)) {
    return true;
  }
  // Check for timecode ranges e.g. "00:00 - 00:06", "00:12 to 00:28", "12s - 28s"
  if (/\d{1,2}:\d{2}(?::\d{2})?\s*(?:[-–—]|to|->|,)\s*\d{1,2}:\d{2}/i.test(t)) {
    return true;
  }
  if (/\d+(?:\.\d+)?s?\s*(?:[-–—]|to|->)\s*\d+(?:\.\d+)?s?/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Parses cut guides in CMX 3600 EDL, JSON, CSV, or Text format
 */
export function parseCutGuideText(
  rawContent: string,
  movieAsset?: ProjectAsset,
  voiceoverAsset?: ProjectAsset
): RecapGenParseResult {
  const scenes: RecapScenePlanItem[] = [];
  const unresolved: RecapScenePlanItem[] = [];
  const warnings: string[] = [];
  let extractedProjectTitle: string | undefined;

  const trimmed = rawContent.trim();

  // ----------------------------------------------------
  // 1. CMX 3600 EDL PARSER
  // ----------------------------------------------------
  if (
    trimmed.includes('TITLE:') ||
    trimmed.includes('FCM:') ||
    trimmed.includes('FROM CLIP NAME:') ||
    /\b\d{1,4}\s+[\w\d]+\s+[VA\d]+\s+[CDW\d]+\s+\d{1,2}:\d{2}:\d{2}/i.test(trimmed)
  ) {
    const lines = trimmed.split('\n').map((l) => l.trim());
    let currentEvent: {
      eventNum?: string;
      srcIn?: number;
      srcOut?: number;
      dstIn?: number;
      dstOut?: number;
      clipName?: string;
      transition?: string;
      cue?: string;
      pacing?: string;
      narration?: string;
    } | null = null;

    let timelineOffset = 0;

    const commitEvent = () => {
      if (!currentEvent || currentEvent.srcIn === undefined || currentEvent.srcOut === undefined) return;
      
      let sIn = currentEvent.srcIn;
      let sOut = currentEvent.srcOut;

      // Auto-recover if invalid range
      if (sIn >= sOut) {
        sOut = sIn + 4.0;
        warnings.push(`Auto-adjusted Scene duration for Event #${currentEvent.eventNum || scenes.length + 1} (${sIn}s - ${sOut}s)`);
      }

      const duration = Math.max(0.5, sOut - sIn);
      const sceneIndex = scenes.length + 1;
      const title = currentEvent.clipName || `Scene ${sceneIndex}`;
      const narration = currentEvent.narration || currentEvent.clipName || `Scene ${sceneIndex}`;
      
      // Determine motion & styling from CUE / PACING
      let motionEffect: 'slow-zoom' | 'ken-burns' | 'static' = 'ken-burns';
      let transitionType: TransitionType | undefined = undefined;

      if (currentEvent.cue?.toLowerCase().includes('slow zoom') || currentEvent.pacing?.toLowerCase().includes('slow zoom')) {
        motionEffect = 'slow-zoom';
      } else if (currentEvent.cue?.toLowerCase().includes('fast cut') || currentEvent.pacing?.toLowerCase().includes('fast cut')) {
        motionEffect = 'static';
      }

      if (currentEvent.transition?.toLowerCase().includes('dissolve')) {
        transitionType = 'dissolve';
      } else if (currentEvent.transition?.toLowerCase().includes('fade') || currentEvent.pacing?.toLowerCase().includes('fade to black')) {
        transitionType = 'fade-black';
      } else if (currentEvent.transition?.toLowerCase().includes('wipe') || currentEvent.transition?.toLowerCase().includes('slide')) {
        transitionType = 'slide-left';
      }

      const sceneItem: RecapScenePlanItem = {
        sceneId: `recap-scene-${sceneIndex}`,
        sourceAssetId: movieAsset?.id || 'movie-source',
        sourceAssetName: movieAsset?.name || 'Main Movie Source',
        sourceIn: sIn,
        sourceOut: sOut,
        timelineStart: timelineOffset,
        timelineEnd: timelineOffset + duration,
        narrationStart: timelineOffset,
        narrationEnd: timelineOffset + duration,
        narrationText: narration,
        sceneDescription: title,
        confidence: 0.98,
        status: 'matched',
        transition: transitionType,
        motionEffect: motionEffect,
        thumbnailUrl: movieAsset?.thumbnailUrl || RECAP_SCENE_THUMBNAILS[(sceneIndex - 1) % RECAP_SCENE_THUMBNAILS.length],
      };

      scenes.push(sceneItem);
      timelineOffset += duration;
      currentEvent = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Extract Title
      if (line.toUpperCase().startsWith('TITLE:')) {
        extractedProjectTitle = line.substring(6).trim();
        continue;
      }

      // Skip FCM line
      if (line.toUpperCase().startsWith('FCM:')) {
        continue;
      }

      // Check for CMX 3600 Event line
      // e.g. "001  AX       V     C        00:00:00:00 00:00:06:00 00:00:00:00 00:00:06:00"
      const eventRegex = /^(\d{1,4})\s+([\w\d]+)\s+([VA\d]+)\s+([CDW\d]+)\s+(\d{1,2}:\d{2}:\d{2}[:;.]\d{2,3})\s+(\d{1,2}:\d{2}:\d{2}[:;.]\d{2,3})\s+(\d{1,2}:\d{2}:\d{2}[:;.]\d{2,3})\s+(\d{1,2}:\d{2}:\d{2}[:;.]\d{2,3})/i;
      const match = line.match(eventRegex);

      if (match) {
        // Commit prior event if pending
        commitEvent();

        const srcIn = parseTimecode(match[5]);
        const srcOut = parseTimecode(match[6]);
        const dstIn = parseTimecode(match[7]);
        const dstOut = parseTimecode(match[8]);

        currentEvent = {
          eventNum: match[1],
          srcIn: srcIn ?? 0,
          srcOut: srcOut ?? 6,
          dstIn: dstIn ?? 0,
          dstOut: dstOut ?? 6,
        };
        continue;
      }

      // Check for Comments following an event
      if (line.startsWith('*') || line.startsWith('#') || line.startsWith('//')) {
        const comment = line.replace(/^[\*#\/]+\s*/, '').trim();
        
        if (currentEvent) {
          if (comment.toUpperCase().startsWith('FROM CLIP NAME:')) {
            currentEvent.clipName = comment.substring('FROM CLIP NAME:'.length).trim();
          } else if (comment.toUpperCase().startsWith('CLIP NAME:')) {
            currentEvent.clipName = comment.substring('CLIP NAME:'.length).trim();
          } else if (comment.toUpperCase().startsWith('TRANSITION:')) {
            currentEvent.transition = comment.substring('TRANSITION:'.length).trim();
          } else if (comment.toUpperCase().startsWith('NARRATION:')) {
            currentEvent.narration = comment.substring('NARRATION:'.length).trim();
          } else if (comment.toUpperCase().startsWith('CUE:')) {
            const parts = comment.split('|');
            currentEvent.cue = parts[0].replace(/CUE:/i, '').trim();
            if (parts[1]) {
              currentEvent.pacing = parts[1].replace(/PACING:/i, '').trim();
            }
          }
        }
      }
    }

    // Commit last event
    commitEvent();

    if (scenes.length > 0) {
      const totalSourceUsed = scenes.reduce((acc, s) => acc + (s.sourceOut - s.sourceIn), 0);
      const totalDur = scenes.reduce((acc, s) => acc + (s.timelineEnd - s.timelineStart), 0);

      return {
        scenes,
        unresolvedScenes: unresolved,
        warnings,
        totalSourceDurationUsed: totalSourceUsed,
        totalRecapDuration: totalDur,
        projectTitle: extractedProjectTitle,
      };
    }
  }

  // ----------------------------------------------------
  // 2. JSON PARSER (sceneCutGuide, cuts, scenes)
  // ----------------------------------------------------
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const rawGuide = parsed.sceneCutGuide || parsed.cutGuide || parsed;
      if (rawGuide.projectTitle || parsed.projectTitle || parsed.title || parsed.movie?.title) {
        const baseTitle = rawGuide.projectTitle || parsed.projectTitle || parsed.title || parsed.movie?.title;
        extractedProjectTitle = baseTitle.toUpperCase().includes('RECAP') ? baseTitle : `${baseTitle} Recap`;
      }

      let rawScenes: any[] = [];
      if (Array.isArray(rawGuide)) {
        rawScenes = rawGuide;
      } else if (Array.isArray(rawGuide.cuts)) {
        rawScenes = rawGuide.cuts;
      } else if (Array.isArray(rawGuide.scenes)) {
        rawScenes = rawGuide.scenes;
      } else if (Array.isArray(parsed.cuts)) {
        rawScenes = parsed.cuts;
      } else if (Array.isArray(parsed.scenes)) {
        rawScenes = parsed.scenes;
      }

      // Sort by sceneOrder if provided
      rawScenes.sort((a, b) => {
        const orderA = typeof a.sceneOrder === 'number' ? a.sceneOrder : (typeof a.order === 'number' ? a.order : 9999);
        const orderB = typeof b.sceneOrder === 'number' ? b.sceneOrder : (typeof b.order === 'number' ? b.order : 9999);
        return orderA - orderB;
      });

      let cumulativeRecapTimeline = 0;

      rawScenes.forEach((s: any, idx: number) => {
        const sceneNum = s.sceneOrder ?? (idx + 1);
        const sceneId = s.sceneId ? String(s.sceneId) : `c${sceneNum}`;
        const sceneTitle = s.sceneTitle || s.title || s.name || s.sceneDescription || `Scene ${sceneNum}`;
        const narration = s.narrationAlignment || s.narrationText || s.narration || s.scriptText || s.text || s.actionPrompt || `Scene ${sceneNum}`;

        // Source Movie Timing Extraction
        const srcObj = s.sourceMovie || s.source || s.sourceTiming || {};
        let rawSourceStart = srcObj.startSecond ?? srcObj.sourceIn ?? srcObj.start ?? s.sourceStartSecond ?? s.sourceIn ?? s.videoStartTime;
        let rawSourceEnd = srcObj.endSecond ?? srcObj.sourceOut ?? srcObj.end ?? s.sourceEndSecond ?? s.sourceOut ?? s.videoEndTime;

        // Recap Timeline Timing Extraction
        const recObj = s.recapTimeline || s.timeline || s.timelineTiming || {};
        let rawRecapStart = recObj.startSecond ?? recObj.timelineStart ?? recObj.start ?? s.timelineStartSecond ?? s.timelineStart;
        let rawRecapEnd = recObj.endSecond ?? recObj.timelineEnd ?? recObj.end ?? s.timelineEndSecond ?? s.timelineEnd;

        // If source timing wasn't in sourceMovie, check direct cut properties
        if (rawSourceStart === undefined) {
          rawSourceStart = s.startSecond ?? (typeof s.start === 'number' ? s.start : undefined);
        }
        if (rawSourceEnd === undefined) {
          rawSourceEnd = s.endSecond ?? (typeof s.end === 'number' ? s.end : undefined);
        }

        // If still undefined, check timecodeRange string like "00:00 - 00:06"
        if ((rawSourceStart === undefined || rawSourceEnd === undefined) && typeof s.timecodeRange === 'string') {
          const tcParts = s.timecodeRange.split(/\s*(?:[-–—]|to)\s*/);
          if (tcParts.length === 2) {
            if (rawSourceStart === undefined) rawSourceStart = parseTimecode(tcParts[0]);
            if (rawSourceEnd === undefined) rawSourceEnd = parseTimecode(tcParts[1]);
          }
        }

        let sIn = typeof rawSourceStart === 'number' ? rawSourceStart : (rawSourceStart !== undefined ? parseTimecode(String(rawSourceStart)) : null);
        let sOut = typeof rawSourceEnd === 'number' ? rawSourceEnd : (rawSourceEnd !== undefined ? parseTimecode(String(rawSourceEnd)) : null);

        let rIn = typeof rawRecapStart === 'number' ? rawRecapStart : (rawRecapStart !== undefined ? parseTimecode(String(rawRecapStart)) : null);
        let rOut = typeof rawRecapEnd === 'number' ? rawRecapEnd : (rawRecapEnd !== undefined ? parseTimecode(String(rawRecapEnd)) : null);

        // Auto-recover fallback timings if missing or invalid
        if (sIn === null || isNaN(sIn) || sIn < 0) {
          sIn = rIn !== null ? rIn : cumulativeRecapTimeline;
        }

        if (sOut === null || isNaN(sOut) || sOut <= sIn) {
          const fallbackDur = typeof s.durationSeconds === 'number' && s.durationSeconds > 0 ? s.durationSeconds : 6.0;
          sOut = sIn + fallbackDur;
        }

        const sourceDuration = Math.max(0.2, sOut - sIn);

        if (rIn === null || isNaN(rIn) || rIn < 0) {
          rIn = cumulativeRecapTimeline;
        }
        if (rOut === null || isNaN(rOut) || rOut <= rIn) {
          rOut = rIn + sourceDuration;
        }

        const recapDuration = Math.max(0.2, rOut - rIn);

        if (movieAsset?.duration && movieAsset.duration > 0 && sIn >= movieAsset.duration) {
          warnings.push(`Scene ${sceneNum} source start (${sIn}s) exceeds preview asset duration (${movieAsset.duration}s); loaded for playback.`);
        }

        // Determine transitions & motion effects
        let transitionType: TransitionType | undefined = undefined;
        const rawTrans = (s.transition || s.visualCueTag || '').toLowerCase();
        if (rawTrans.includes('dissolve') || rawTrans.includes('cross')) {
          transitionType = 'dissolve';
        } else if (rawTrans.includes('fade') || rawTrans.includes('black')) {
          transitionType = 'fade-black';
        } else if (rawTrans.includes('wipe') || rawTrans.includes('slide')) {
          transitionType = 'slide-left';
        } else if (rawTrans.includes('zoom') || rawTrans.includes('glitch')) {
          transitionType = 'glitch';
        }

        let motionEffect: 'slow-zoom' | 'ken-burns' | 'static' = 'ken-burns';
        const pacing = (s.pacingNotes || s.actionPrompt || '').toLowerCase();
        if (pacing.includes('fast') || pacing.includes('shake') || pacing.includes('hard cut')) {
          motionEffect = 'slow-zoom';
        } else if (pacing.includes('static') || pacing.includes('still')) {
          motionEffect = 'static';
        }

        const sceneItem: RecapScenePlanItem = {
          sceneId: sceneId,
          sourceAssetId: movieAsset?.id || 'existing-movie-asset',
          sourceAssetName: movieAsset?.name || 'Main Movie Source',
          sourceIn: sIn as number,
          sourceOut: sOut as number,
          timelineStart: rIn,
          timelineEnd: rOut,
          narrationStart: rIn,
          narrationEnd: rOut,
          narrationText: narration,
          sceneDescription: sceneTitle,
          confidence: s.confidence || (srcObj.status === 'matched' ? 1.0 : 0.96),
          status: 'matched',
          transition: transitionType,
          motionEffect: motionEffect,
          thumbnailUrl: s.thumbnailUrl || movieAsset?.thumbnailUrl || RECAP_SCENE_THUMBNAILS[idx % RECAP_SCENE_THUMBNAILS.length],
        };

        scenes.push(sceneItem);
        cumulativeRecapTimeline = Math.max(cumulativeRecapTimeline + recapDuration, rOut);
      });

      if (scenes.length > 0 || unresolved.length > 0) {
        const totalSourceUsed = scenes.reduce((acc, s) => acc + (s.sourceOut - s.sourceIn), 0);
        const totalDur = scenes.length > 0 ? Math.max(...scenes.map((s) => s.timelineEnd)) : 0;

        return {
          scenes,
          unresolvedScenes: unresolved,
          warnings,
          totalSourceDurationUsed: totalSourceUsed,
          totalRecapDuration: totalDur,
          projectTitle: extractedProjectTitle || movieAsset?.name?.replace(/\.[^/.]+$/, '') || 'Custom Visual Sequence',
        };
      }
    } catch (e) {
      // Fall through to text/csv parsing
    }
  }

  // ----------------------------------------------------
  // 3. TEXT / CSV / TIMECODE RANGE ROBUST PARSER
  // ----------------------------------------------------
  const rawLines = trimmed.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  let timelinePos = 0;

  // Regex to extract timecode pair e.g. "00:00:12:00 - 00:00:28:00" or "00:12 to 00:28" or "12.5s - 28s" or "00:12, 00:28"
  const rangeRegex = /(\d{1,2}:\d{2}(?::\d{2})?(?:[:;.]\d{2,3})?|\d+(?:\.\d+)?s?)\s*(?:[-–—]|to|->|,)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[:;.]\d{2,3})?|\d+(?:\.\d+)?s?)/i;

  rawLines.forEach((line, idx) => {
    // Skip general header labels
    if (idx === 0 && (line.toLowerCase().startsWith('title:') || line.toLowerCase().startsWith('fcm:') || line.toLowerCase().startsWith('scene,') || line.toLowerCase().startsWith('in,out'))) {
      if (line.toLowerCase().startsWith('title:')) {
        extractedProjectTitle = line.substring(6).trim();
      }
      return;
    }

    let sIn: number | null = null;
    let sOut: number | null = null;
    let desc = `Scene ${scenes.length + 1}`;
    let narration = `Scene ${scenes.length + 1}`;

    const rangeMatch = line.match(rangeRegex);
    if (rangeMatch) {
      sIn = parseTimecode(rangeMatch[1]);
      sOut = parseTimecode(rangeMatch[2]);

      // Extract description from the remaining parts of the line
      const matchedText = rangeMatch[0];
      const matchIndex = line.indexOf(matchedText);
      const afterMatch = line.substring(matchIndex + matchedText.length).replace(/^[|:,\-\s]+/, '').trim();
      const beforeMatch = line.substring(0, matchIndex).replace(/[|:,\-\s]+$/, '').trim();

      if (afterMatch) {
        const metadataParts = afterMatch.split(/[|:]/).map((p) => p.trim()).filter((p) => p.length > 0);
        if (metadataParts.length > 0) desc = metadataParts[0];
        if (metadataParts.length > 1) narration = metadataParts.slice(1).join(' - ');
        else narration = desc;
      } else if (beforeMatch && !beforeMatch.toLowerCase().startsWith('scene')) {
        desc = beforeMatch;
        narration = beforeMatch;
      }
    } else if (line.includes(',')) {
      // CSV fallback: 0, 6, The Trap, The hook narration
      const parts = line.split(',').map((p) => p.trim());
      sIn = parseTimecode(parts[0]);
      sOut = parseTimecode(parts[1]);
      if (parts[2]) desc = parts[2];
      if (parts[3]) narration = parts.slice(3).join(', ');
      else narration = desc;
    }

    // Check validity
    if (sIn === null || sOut === null || isNaN(sIn) || isNaN(sOut) || sOut <= sIn) {
      warnings.push(`Scene ${scenes.length + 1} cannot be built because the cut guide does not contain a verified location inside the movie.`);
      unresolved.push({
        sceneId: `c${scenes.length + 1}`,
        sourceAssetId: movieAsset?.id || 'existing-movie-asset',
        sourceAssetName: movieAsset?.name || 'Main Movie Source',
        sourceIn: 0,
        sourceOut: 0,
        timelineStart: timelinePos,
        timelineEnd: timelinePos + 4.0,
        narrationStart: timelinePos,
        narrationEnd: timelinePos + 4.0,
        narrationText: narration,
        sceneDescription: `${desc} [UNRESOLVED SOURCE]`,
        confidence: 0,
        status: 'unresolved',
        thumbnailUrl: movieAsset?.thumbnailUrl || RECAP_SCENE_THUMBNAILS[scenes.length % RECAP_SCENE_THUMBNAILS.length],
      });
      return;
    }

    const dur = Math.max(0.5, sOut - sIn);
    const sceneIndex = scenes.length + 1;
    const sceneItem: RecapScenePlanItem = {
      sceneId: `c${sceneIndex}`,
      sourceAssetId: movieAsset?.id || 'existing-movie-asset',
      sourceAssetName: movieAsset?.name || 'Main Movie Source',
      sourceIn: sIn,
      sourceOut: sOut,
      timelineStart: timelinePos,
      timelineEnd: timelinePos + dur,
      narrationStart: timelinePos,
      narrationEnd: timelinePos + dur,
      narrationText: narration,
      sceneDescription: desc,
      confidence: 0.95,
      status: 'matched',
      transition: undefined,
      motionEffect: sceneIndex % 2 === 0 ? 'slow-zoom' : 'ken-burns',
      thumbnailUrl: movieAsset?.thumbnailUrl || RECAP_SCENE_THUMBNAILS[(sceneIndex - 1) % RECAP_SCENE_THUMBNAILS.length],
    };

    scenes.push(sceneItem);
    timelinePos += dur;
  });

  const totalSourceUsed = scenes.reduce((acc, s) => acc + (s.sourceOut - s.sourceIn), 0);
  const totalDur = scenes.reduce((acc, s) => acc + (s.timelineEnd - s.timelineStart), 0);

  return {
    scenes,
    unresolvedScenes: unresolved,
    warnings,
    totalSourceDurationUsed: totalSourceUsed,
    totalRecapDuration: totalDur,
    projectTitle:
      extractedProjectTitle ||
      movieAsset?.name?.replace(/\.[^/.]+$/, '') ||
      'Custom Visual Sequence',
  };
}

/**
 * Builds the complete RecapActionPlan and TimelineOperations for RecapGen mode
 */
export function buildRecapActionPlan(
  movieAsset?: ProjectAsset,
  voiceoverAsset?: ProjectAsset,
  cutGuideContent?: string,
  scriptText?: string,
  musicAsset?: ProjectAsset,
  aspectRatio: AspectRatio = '16:9',
  allAssets?: ProjectAsset[]
): RecapActionPlan {
  let parsed: RecapGenParseResult;

  if (cutGuideContent && cutGuideContent.trim().length > 0 && isCutGuideOrEDLText(cutGuideContent)) {
    parsed = parseCutGuideText(cutGuideContent, movieAsset, voiceoverAsset);
  } else {
    // Check visual assets (images and videos)
    const visualAssets = (allAssets || []).filter((a) => a.type === 'video' || a.type === 'image');
    const voDuration = voiceoverAsset?.duration || 30.0;
    const movieDur = movieAsset?.duration || 120.0;

    // Determine script text from scriptText, cutGuideContent, or narrative assets
    let effectiveScript = (scriptText && scriptText.trim().length > 0) ? scriptText.trim() : '';
    if (!effectiveScript && cutGuideContent && cutGuideContent.trim().length > 0 && !isCutGuideOrEDLText(cutGuideContent)) {
      effectiveScript = cutGuideContent.trim();
    }

    // Check if an SRT file is provided directly or exists in allAssets
    const srtSource =
      (effectiveScript && isSrtFormat(effectiveScript) ? effectiveScript : undefined) ||
      allAssets?.find(
        (a) =>
          a.name.toLowerCase().endsWith('.srt') ||
          a.name.toLowerCase().endsWith('.vtt') ||
          (a.textContent && isSrtFormat(a.textContent))
      )?.textContent;

    let beats: any[] = [];

    if (srtSource && isSrtFormat(srtSource)) {
      const cues = parseSrtText(srtSource);
      if (cues.length > 0) {
        beats = cues.map((cue, idx) => {
          const nextStart = idx < cues.length - 1 ? cues[idx + 1].startTime : (voDuration > cue.startTime ? voDuration : cue.endTime);
          const duration = Math.max(0.3, Number((nextStart - cue.startTime).toFixed(2)));
          return {
            id: `beat-srt-${cue.index || idx + 1}`,
            beatIndex: idx + 1,
            sentenceIndex: idx + 1,
            text: cue.text,
            fullSentence: cue.text,
            startTime: idx === 0 ? 0 : Number(cue.startTime.toFixed(2)),
            endTime: Number(nextStart.toFixed(2)),
            duration,
            suggestedVisualDescription: cue.text,
            coreKeywords: cue.text.toLowerCase().split(/\s+/).filter((w) => w.length >= 3),
            actionVerbs: [],
            keyObjects: [],
            charactersOrSubjects: [],
            matchScore: 1.0,
            matchConfidence: 'high' as const,
            matchReason: 'SRT Subtitle Cue',
            isUnmatched: false,
            isMultiActionInSentence: false,
          };
        });
      }
    }

    // 1. If not from SRT, parse intelligent beats from script (supports numbered lists and multi-action sentences)
    if (beats.length === 0) {
      beats = parseIntelligentVisualBeats(effectiveScript);
    }

    // If no beats from script but visual assets exist, create semantic beats from the images themselves
    if (beats.length === 0 && visualAssets.length > 0) {
      beats = visualAssets.map((asset, idx) => {
        const cleanName = asset.name ? asset.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ') : `Scene ${idx + 1}`;
        return {
          id: `beat-${idx + 1}`,
          beatIndex: idx + 1,
          sentenceIndex: idx + 1,
          text: cleanName,
          fullSentence: cleanName,
          startTime: 0,
          endTime: 0,
          duration: 0,
          suggestedVisualDescription: cleanName,
          coreKeywords: cleanName.toLowerCase().split(/\s+/),
          actionVerbs: [],
          keyObjects: [],
          charactersOrSubjects: [],
          matchScore: 1.0,
          matchConfidence: 'high' as const,
          matchReason: 'Direct asset beat',
          isUnmatched: false,
          isMultiActionInSentence: false,
          matchedAssetId: asset.id,
          matchedAssetName: asset.name,
          matchedAssetThumbnail: asset.thumbnailUrl || asset.url,
        };
      });
    } else if (beats.length === 0) {
      const defaultPhrases = ['Opening scene', 'Action develops', 'Tension rises', 'Climax and resolution'];
      beats = defaultPhrases.map((phrase, idx) => ({
        id: `beat-${idx + 1}`,
        beatIndex: idx + 1,
        sentenceIndex: idx + 1,
        text: phrase,
        fullSentence: phrase,
        startTime: 0,
        endTime: 0,
        duration: 0,
        suggestedVisualDescription: phrase,
        coreKeywords: phrase.toLowerCase().split(/\s+/),
        actionVerbs: [],
        keyObjects: [],
        charactersOrSubjects: [],
        matchScore: 0.9,
        matchConfidence: 'high' as const,
        matchReason: 'Default sequence progression',
        isUnmatched: false,
        isMultiActionInSentence: false,
      }));
    }

    // 2. Audio Master Clock Alignment (non-uniform timestamps matching speech intervals & words)
    const { alignedBeats, totalDuration: computedDuration } = alignBeatsWithAudioMaster(
      beats,
      voiceoverAsset,
      voiceoverAsset?.analysis as any
    );

    // 3. Match beats to visual assets preserving original filenames
    const { matchedBeats } = performGlobalIntelligentImageMatching(
      alignedBeats,
      visualAssets.length > 0 ? visualAssets : (movieAsset ? [movieAsset] : [])
    );

    // 4. Construct scenes with dynamic, non-uniform durations
    const scenes: RecapScenePlanItem[] = matchedBeats.map((beat, idx) => {
      const assignedAsset = visualAssets.find((a) => a.id === beat.matchedAssetId) ||
        (visualAssets.length > 0 ? visualAssets[idx % visualAssets.length] : movieAsset);
      const beatDur = Math.max(0.2, Number((beat.endTime - beat.startTime).toFixed(2)));
      const sIn = assignedAsset?.type === 'video' ? ((idx * (movieDur / Math.max(1, matchedBeats.length))) % Math.max(1, movieDur - beatDur)) : 0;
      const sOut = sIn + beatDur;

      return {
        sceneId: beat.id || `c${idx + 1}`,
        sourceAssetId: beat.matchedAssetId || assignedAsset?.id || 'visual-asset',
        sourceAssetName: beat.matchedAssetName || assignedAsset?.name || `Visual Asset ${idx + 1}`,
        sourceIn: Math.max(0, Number(sIn.toFixed(2))),
        sourceOut: Number(sOut.toFixed(2)),
        timelineStart: Number(beat.startTime.toFixed(2)),
        timelineEnd: Number(beat.endTime.toFixed(2)),
        narrationStart: Number(beat.startTime.toFixed(2)),
        narrationEnd: Number(beat.endTime.toFixed(2)),
        narrationText: beat.text,
        sceneDescription: beat.matchedAssetName ? beat.matchedAssetName.replace(/\.[^/.]+$/, '') : beat.text,
        confidence: beat.matchScore > 0 ? beat.matchScore : 0.92,
        status: beat.isUnmatched ? 'unresolved' : 'matched',
        transition: beat.transition || (idx > 0 && idx % 3 === 0 ? 'dissolve' : undefined),
        motionEffect: beat.keyframeZoom ? 'slow-zoom' : (idx % 2 === 1 ? 'slow-zoom' : 'ken-burns'),
        thumbnailUrl: beat.matchedAssetThumbnail || assignedAsset?.thumbnailUrl || assignedAsset?.url || movieAsset?.thumbnailUrl || RECAP_SCENE_THUMBNAILS[idx % RECAP_SCENE_THUMBNAILS.length],
      };
    });

    const defaultTitle =
      movieAsset?.name?.replace(/\.[^/.]+$/, '') ||
      (visualAssets.length > 0 && visualAssets[0].name ? visualAssets[0].name.replace(/\.[^/.]+$/, '') : 'Synchronized Visual Sequence');

    const finalPlanDuration = voDuration > 0 ? voDuration : (computedDuration > 0 ? computedDuration : 30.0);

    parsed = {
      scenes,
      unresolvedScenes: [],
      warnings: [],
      totalSourceDurationUsed: finalPlanDuration,
      totalRecapDuration: finalPlanDuration,
      projectTitle: defaultTitle,
    };
  }

  const ops: TimelineOperation[] = [];

  // 1. Aspect ratio
  ops.push({
    id: `recap-op-ratio-${Date.now()}`,
    type: 'change_aspect_ratio',
    description: `Set 16:9 widescreen cinematic ratio for movie recap`,
    parameters: { ratio: aspectRatio },
  });

  // 2. Video Clips (using create_recap_clip for explicit sourceMovie and recapTimeline placements)
  parsed.scenes.forEach((scene, idx) => {
    const matchedAsset = (allAssets || []).find((a) => a.id === scene.sourceAssetId);
    const sceneDuration = Math.max(0.2, (scene.timelineEnd ?? 0) - (scene.timelineStart ?? 0));
    const sIn = scene.sourceIn ?? 0;
    const sOut = scene.sourceOut ?? (sIn + sceneDuration);
    const rStart = scene.timelineStart ?? (idx * sceneDuration);
    const rEnd = scene.timelineEnd ?? (rStart + sceneDuration);

    ops.push({
      id: `recap-op-clip-${scene.sceneId || idx + 1}`,
      type: 'create_recap_clip',
      description: `Create Recap Clip #${idx + 1} (${scene.sceneDescription}): Source [${sIn.toFixed(1)}s - ${sOut.toFixed(1)}s] -> Recap Timeline [${rStart.toFixed(1)}s - ${rEnd.toFixed(1)}s]`,
      parameters: {
        id: `recap-clip-${scene.sceneId}`,
        sceneId: scene.sceneId,
        sourceAssetId: matchedAsset?.id || movieAsset?.id || scene.sourceAssetId || 'existing-movie-asset',
        sourceStartSecond: sIn,
        sourceEndSecond: sOut,
        timelineStartSecond: rStart,
        timelineEndSecond: rEnd,
        trackId: 'recap-video-track',
        title: scene.sceneDescription,
        sourceIn: sIn,
        sourceOut: sOut,
        timelineStart: rStart,
        timelineEnd: rEnd,
        duration: sceneDuration,
        thumbnailUrl: scene.thumbnailUrl || matchedAsset?.thumbnailUrl,
        url: matchedAsset?.url || movieAsset?.url || scene.thumbnailUrl,
        file: matchedAsset?.file || movieAsset?.file,
        volume: 0, // Mute original movie audio so voiceover is crisp & primary
        filterPreset: scene.sceneDescription.toLowerCase().includes('reveal') || scene.sceneDescription.toLowerCase().includes('attack') ? 'oppenheimer' : 'cinematic-teal',
        transitionAfter: scene.transition ? {
          id: `tr-${idx}`,
          type: scene.transition,
          name: scene.transition,
          duration: 0.35,
          soundEffect: 'swoosh',
        } : undefined,
        zoom: scene.motionEffect === 'slow-zoom' || scene.motionEffect === 'ken-burns',
        keyframes: scene.motionEffect === 'slow-zoom' ? [
          { id: `kf-${idx}-1`, time: 0, scale: 1.0, x: 0, y: 0, opacity: 1 },
          { id: `kf-${idx}-2`, time: sceneDuration, scale: 1.2, x: 0, y: 0, opacity: 1 },
        ] : (scene.motionEffect === 'ken-burns' ? [
          { id: `kf-${idx}-1`, time: 0, scale: 1.15, x: -10, y: 0, opacity: 1 },
          { id: `kf-${idx}-2`, time: sceneDuration, scale: 1.0, x: 10, y: 0, opacity: 1 },
        ] : undefined),
      },
    });
  });

  // 3. Voiceover track on recap audio track
  if (voiceoverAsset) {
    ops.push({
      id: `recap-op-vo-${Date.now()}`,
      type: 'add_voiceover',
      description: `Place master voiceover narration (${voiceoverAsset.name}) on audio track`,
      parameters: {
        id: `recap-audio-vo`,
        title: voiceoverAsset.name || 'Master Voiceover Narration',
        url: voiceoverAsset.url,
        file: voiceoverAsset.file,
        duration: voiceoverAsset.duration || parsed.totalRecapDuration,
        startTime: 0,
        volume: 100,
        waveformData: voiceoverAsset.waveformData,
        replaceExisting: true,
      },
    });
  }

  // 4. Captions from Narration alignment
  parsed.scenes.forEach((scene, idx) => {
    if (scene.narrationText) {
      ops.push({
        id: `recap-op-cap-${scene.sceneId || idx + 1}`,
        type: 'add_caption',
        description: `Add subtitle for Scene #${idx + 1}: "${scene.narrationText}"`,
        parameters: {
          text: scene.narrationText,
          start: scene.timelineStart,
          end: scene.timelineEnd,
          style: 'documentary',
        },
      });
    }
  });

  // 5. Optional Background Music
  if (musicAsset) {
    ops.push({
      id: `recap-op-music-${Date.now()}`,
      type: 'add_background_music',
      description: 'Add dramatic soundtrack ducked to 15% under voiceover',
      parameters: {
        title: musicAsset.name || 'Dramatic Orchestral Theme',
        url: musicAsset.url,
        file: musicAsset.file,
        volume: 15,
      },
    });
  }

  const finalTitle =
    parsed.projectTitle ||
    movieAsset?.name?.replace(/\.[^/.]+$/, '') ||
    (allAssets && allAssets.length > 0 && allAssets[0].name ? allAssets[0].name.replace(/\.[^/.]+$/, '') : 'Custom Visual Sequence');

  return {
    id: `recap-plan-${Date.now()}`,
    title: finalTitle,
    totalScenes: parsed.scenes.length,
    totalMovieSourceDurationUsed: parsed.totalSourceDurationUsed,
    finalRecapDuration: parsed.totalRecapDuration,
    voiceoverDuration: voiceoverAsset?.duration || parsed.totalRecapDuration,
    captionCount: parsed.scenes.length,
    musicTracksCount: musicAsset ? 1 : 0,
    sfxCount: parsed.scenes.length,
    unresolvedScenesCount: parsed.unresolvedScenes.length,
    warnings: parsed.warnings,
    exportAspectRatio: aspectRatio,
    scenes: [...parsed.scenes, ...parsed.unresolvedScenes],
    operations: ops,
  };
}

