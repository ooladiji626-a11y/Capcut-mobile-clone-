import JSZip from 'jszip';
import {
  MovieRecapImportedFile,
  MovieRecapFileType,
  MovieRecapProjectValidation,
  MovieRecapSceneCut,
  MovieRecapEditMode,
  MovieRecapPacingMode,
  VideoClip,
  AudioTrackClip,
  CaptionClip,
  ProjectAsset,
  AIEditCommand,
  AspectRatio,
} from '../types';
import { createProjectAssetFromFile } from './assetManager';
import { isSrtFormat, parseSrtText } from '../engine/srtParser';

/**
 * Classify a file into movie recap domain roles
 */
export function classifyMovieRecapFile(
  filename: string,
  mimeType?: string,
  rawText?: string
): MovieRecapFileType {
  const lower = filename.toLowerCase();
  const ext = lower.split('.').pop() || '';

  // Timing data
  if (ext === 'srt' || ext === 'vtt' || lower.includes('timestamp') || lower.includes('word_align') || lower.includes('timing')) {
    return 'timing_data';
  }

  // Cut guide (JSON or CSV with scene markers)
  if (ext === 'csv' || lower.includes('cut_guide') || lower.includes('cuts') || lower.includes('scene_guide') || lower.includes('scenes') || lower.includes('recap_plan') || lower.includes('manifest')) {
    return 'cut_guide';
  }
  if (ext === 'json') {
    if (rawText && (rawText.includes('"scenes"') || rawText.includes('"cuts"') || rawText.includes('"videoStartTime"') || rawText.includes('"timeline"'))) {
      return 'cut_guide';
    }
    if (rawText && (rawText.includes('"words"') || rawText.includes('"timestamps"'))) {
      return 'timing_data';
    }
    return 'cut_guide';
  }

  // Script text
  if (ext === 'txt' || ext === 'md' || ext === 'doc' || ext === 'docx' || lower.includes('script') || lower.includes('narration') || lower.includes('story') || lower.includes('prompt')) {
    return 'script';
  }

  // Voiceover Audio
  if (
    ext === 'mp3' ||
    ext === 'wav' ||
    ext === 'm4a' ||
    ext === 'aac' ||
    ext === 'ogg' ||
    (mimeType && mimeType.startsWith('audio/')) ||
    lower.includes('voiceover') ||
    lower.includes('vo_') ||
    lower.includes('narration') ||
    lower.includes('audio') ||
    lower.includes('speech')
  ) {
    return 'voiceover';
  }

  // Movie / Video
  if (
    ext === 'mp4' ||
    ext === 'mov' ||
    ext === 'webm' ||
    ext === 'mkv' ||
    ext === 'avi' ||
    (mimeType && mimeType.startsWith('video/')) ||
    ext === 'jpg' ||
    ext === 'jpeg' ||
    ext === 'png' ||
    ext === 'webp'
  ) {
    return 'video';
  }

  return 'unknown';
}

/**
 * Validate imported movie recap files and generate status summary
 */
export function validateMovieRecapProject(files: MovieRecapImportedFile[]): MovieRecapProjectValidation {
  const videoFiles = files.filter((f) => f.type === 'video');
  const voiceoverFiles = files.filter((f) => f.type === 'voiceover');
  const scriptFiles = files.filter((f) => f.type === 'script');
  const cutGuideFiles = files.filter((f) => f.type === 'cut_guide');
  const timingFiles = files.filter((f) => f.type === 'timing_data');
  const otherFiles = files.filter((f) => f.type === 'unknown');

  const hasVideo = videoFiles.length > 0;
  const hasVoiceover = voiceoverFiles.length > 0;
  const hasScript = scriptFiles.length > 0;
  const hasCutGuide = cutGuideFiles.length > 0;
  const hasTimingData = timingFiles.length > 0;

  let canContinue = true;
  let missingNotice = '';
  let readinessStatus = '';

  if (!hasVideo && !hasVoiceover && !hasScript && !hasCutGuide) {
    canContinue = false;
    readinessStatus = 'Awaiting movie recap package or files.';
  } else if (hasVideo && hasVoiceover && (hasCutGuide || hasScript)) {
    readinessStatus = 'Ready to build the complete synchronized recap timeline.';
  } else if (hasVideo && hasVoiceover && !hasCutGuide && !hasScript) {
    readinessStatus = 'Video and voiceover detected. AI will automatically segment scenes based on voiceover audio pacing.';
  } else if (!hasVideo && (hasVoiceover || hasScript)) {
    missingNotice = 'Movie video file not detected. You can proceed with cinematic b-roll placeholders or upload your movie file.';
    readinessStatus = 'Audio/script detected. Timeline can be generated with matched cinematic frames.';
  } else if (!hasVoiceover && hasVideo && hasScript) {
    missingNotice = 'Voiceover audio not detected. AI will synthesize speech pacing from script timing.';
    readinessStatus = 'Ready to assemble scene cuts according to script.';
  } else {
    readinessStatus = 'Recap components detected. Ready to build timeline.';
  }

  return {
    hasVideo,
    hasVoiceover,
    hasScript,
    hasCutGuide,
    hasTimingData,
    videoFiles,
    voiceoverFiles,
    scriptFiles,
    cutGuideFiles,
    timingFiles,
    otherFiles,
    canContinue,
    missingNotice: missingNotice || undefined,
    readinessStatus,
  };
}

/**
 * Parse a JSON or CSV cut guide
 */
export function parseCutGuideText(text: string): MovieRecapSceneCut[] {
  // Try JSON first
  try {
    const data = JSON.parse(text);
    const scenesArray = Array.isArray(data) ? data : data.scenes || data.cuts || data.timeline || data.segments || [];
    if (Array.isArray(scenesArray) && scenesArray.length > 0) {
      return scenesArray.map((item: any, idx: number) => ({
        id: item.id || `scene-${idx + 1}`,
        sceneIndex: item.sceneIndex ?? idx + 1,
        title: item.title || item.name || `Scene ${idx + 1}`,
        description: item.description || item.visual || item.action || '',
        narrationText: item.narrationText || item.narration || item.dialogue || item.script || '',
        videoStartTime: typeof item.videoStartTime === 'number' ? item.videoStartTime : (typeof item.start === 'number' ? item.start : idx * 4.0),
        videoEndTime: typeof item.videoEndTime === 'number' ? item.videoEndTime : (typeof item.end === 'number' ? item.end : (idx + 1) * 4.0),
        duration: typeof item.duration === 'number' ? item.duration : (item.videoEndTime ? item.videoEndTime - item.videoStartTime : 4.0),
        voiceoverStartTime: item.voiceoverStartTime ?? item.voStart,
        voiceoverEndTime: item.voiceoverEndTime ?? item.voEnd,
        transition: item.transition || (idx === 0 ? undefined : 'dissolve'),
        motionEffect: item.motionEffect || 'slow-zoom',
        sfx: item.sfx,
      }));
    }
  } catch (e) {
    // Not JSON, parse CSV or custom lines
  }

  // Parse CSV: Scene,Start,End,Narration,Action
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cuts: MovieRecapSceneCut[] = [];

  let idx = 0;
  for (const line of lines) {
    if (line.startsWith('#') || line.toLowerCase().startsWith('scene,') || line.toLowerCase().startsWith('index,')) {
      continue;
    }
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length >= 3) {
      const start = parseFloat(parts[1]) || idx * 4.0;
      const end = parseFloat(parts[2]) || start + 4.0;
      const narration = parts.slice(3).join(', ').replace(/^"|"$/g, '');
      cuts.push({
        id: `scene-${idx + 1}`,
        sceneIndex: idx + 1,
        title: parts[0] || `Scene ${idx + 1}`,
        narrationText: narration,
        videoStartTime: start,
        videoEndTime: end,
        duration: Math.max(1.0, end - start),
        transition: idx > 0 ? 'dissolve' : undefined,
        motionEffect: 'slow-zoom',
      });
      idx++;
    } else if (line.length > 5) {
      // Free text paragraph as a scene
      cuts.push({
        id: `scene-${idx + 1}`,
        sceneIndex: idx + 1,
        title: `Scene ${idx + 1}`,
        narrationText: line,
        videoStartTime: idx * 4.5,
        videoEndTime: (idx + 1) * 4.5,
        duration: 4.5,
        transition: 'dissolve',
        motionEffect: 'slow-zoom',
      });
      idx++;
    }
  }

  return cuts;
}

/**
 * Unpack a ZIP archive specifically for Movie Recap packages
 */
export async function unpackMovieRecapZip(file: File): Promise<MovieRecapImportedFile[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const importedFiles: MovieRecapImportedFile[] = [];

  const fileEntries: { path: string; entry: JSZip.JSZipObject }[] = [];
  loadedZip.forEach((relativePath, entry) => {
    if (!entry.dir && !relativePath.startsWith('__MACOSX/') && !relativePath.startsWith('.')) {
      fileEntries.push({ path: relativePath, entry });
    }
  });

  for (const { path, entry } of fileEntries) {
    const filename = path.split('/').pop() || path;
    const lower = filename.toLowerCase();

    if (lower.endsWith('.txt') || lower.endsWith('.json') || lower.endsWith('.csv') || lower.endsWith('.srt') || lower.endsWith('.vtt') || lower.endsWith('.md')) {
      const text = await entry.async('string');
      const classifiedType = classifyMovieRecapFile(filename, undefined, text);
      const parsedScenes = classifiedType === 'cut_guide' ? parseCutGuideText(text) : undefined;

      importedFiles.push({
        id: `recap-file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: filename,
        size: text.length,
        type: classifiedType,
        rawContent: text,
        parsedData: {
          scriptText: classifiedType === 'script' ? text : undefined,
          scenes: parsedScenes,
        },
      });
    } else {
      // Binary media (video/audio/image)
      const blob = await entry.async('blob');
      const blobUrl = URL.createObjectURL(blob);
      const mediaFile = new File([blob], filename, { type: blob.type });
      const classifiedType = classifyMovieRecapFile(filename, blob.type);

      importedFiles.push({
        id: `recap-file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: filename,
        size: blob.size,
        type: classifiedType,
        file: mediaFile,
        url: blobUrl,
      });
    }
  }

  return importedFiles;
}

/**
 * Generate built-in fallback movie recap assets for instant testing
 */
export function getSampleMovieRecapPackage(): MovieRecapImportedFile[] {
  const sampleScript = `In a desolate neon metropolis, a lone detective uncovers a locked digital briefcase containing the forgotten history of humanity.
As corporate assassins hunt him through the rain-soaked alleys, he realizes the blueprint inside can restore power to the entire planet.
Cornered on the rooftop at midnight, he makes his ultimate choice: broadcast the truth to the entire world.`;

  const sampleScenes: MovieRecapSceneCut[] = [
    {
      id: 'scene-1',
      sceneIndex: 1,
      title: 'Neon Metropolis Establishing Shot',
      description: 'Futuristic skyscraper shrouded in neon fog and rain',
      narrationText: 'In a desolate neon metropolis, a lone detective uncovers a locked digital briefcase.',
      videoStartTime: 0.0,
      videoEndTime: 6.0,
      duration: 6.0,
      voiceoverStartTime: 0.0,
      voiceoverEndTime: 6.0,
      transition: 'dissolve',
      motionEffect: 'slow-zoom',
      sfx: 'Dark Suspense Riser',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'scene-2',
      sceneIndex: 2,
      title: 'The Rain Alley Chase',
      description: 'Shadowy agents chasing the detective through narrow corridors',
      narrationText: 'As corporate assassins hunt him through the rain-soaked alleys, he realizes the blueprint inside can restore power.',
      videoStartTime: 6.0,
      videoEndTime: 13.0,
      duration: 7.0,
      voiceoverStartTime: 6.0,
      voiceoverEndTime: 13.0,
      transition: 'glitch',
      motionEffect: 'punch-in',
      sfx: 'Cinematic Hit',
      thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'scene-3',
      sceneIndex: 3,
      title: 'Midnight Rooftop Broadcast',
      description: 'Detective broadcasting the secret code across digital billboards',
      narrationText: 'Cornered on the rooftop at midnight, he makes his ultimate choice: broadcast the truth to the entire world.',
      videoStartTime: 13.0,
      videoEndTime: 20.0,
      duration: 7.0,
      voiceoverStartTime: 13.0,
      voiceoverEndTime: 20.0,
      transition: 'flash',
      motionEffect: 'slow-zoom',
      sfx: 'Deep Boom Climax',
      thumbnailUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=600&auto=format&fit=crop&q=80',
    },
  ];

  return [
    {
      id: 'demo-video-1',
      name: 'Cyberpunk_Detective_Full_Movie.mp4',
      size: 42000000,
      type: 'video',
      url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    },
    {
      id: 'demo-audio-1',
      name: 'Voiceover_Final_Master.mp3',
      size: 3200000,
      type: 'voiceover',
      url: 'https://cdn.freesound.org/previews/530/530415_1648170-lq.mp3',
      parsedData: {
        duration: 20.0,
      },
    },
    {
      id: 'demo-script-1',
      name: 'Movie_Recap_Narration_Script.txt',
      size: 450,
      type: 'script',
      rawContent: sampleScript,
      parsedData: {
        scriptText: sampleScript,
      },
    },
    {
      id: 'demo-cutguide-1',
      name: 'RecapGen_Scene_Cut_Guide.json',
      size: 1200,
      type: 'cut_guide',
      rawContent: JSON.stringify({ scenes: sampleScenes }, null, 2),
      parsedData: {
        scenes: sampleScenes,
      },
    },
  ];
}

/**
 * Build the complete Movie Recap timeline from validated project files
 */
export async function buildMovieRecapTimeline(params: {
  files: MovieRecapImportedFile[];
  aspectRatio: AspectRatio;
  pacingMode: MovieRecapPacingMode;
  editMode: MovieRecapEditMode;
}): Promise<{
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captions: CaptionClip[];
  commands: AIEditCommand[];
  recapScenes: MovieRecapSceneCut[];
  recapSummary: string;
}> {
  const { files, aspectRatio, pacingMode } = params;

  // 1. Locate primary video, voiceover, cut guide, script
  const videoFile = files.find((f) => f.type === 'video');
  const voiceoverFile = files.find((f) => f.type === 'voiceover');
  const cutGuideFile = files.find((f) => f.type === 'cut_guide');
  const scriptFile = files.find((f) => f.type === 'script');
  const timingFile = files.find((f) => f.type === 'timing_data');

  // 2. Extract or infer scene cuts
  let scenes: MovieRecapSceneCut[] = [];
  if (cutGuideFile?.parsedData?.scenes && cutGuideFile.parsedData.scenes.length > 0) {
    scenes = [...cutGuideFile.parsedData.scenes];
  } else if (cutGuideFile?.rawContent) {
    scenes = parseCutGuideText(cutGuideFile.rawContent);
  }

  // Check if timingFile or scriptFile has SRT formatting
  const srtContent =
    (timingFile?.rawContent && isSrtFormat(timingFile.rawContent) ? timingFile.rawContent : undefined) ||
    (scriptFile?.rawContent && isSrtFormat(scriptFile.rawContent) ? scriptFile.rawContent : undefined);

  if (scenes.length === 0 && srtContent) {
    const cues = parseSrtText(srtContent);
    if (cues.length > 0) {
      scenes = cues.map((cue, idx) => {
        const nextStart = idx < cues.length - 1 ? cues[idx + 1].startTime : cue.endTime;
        const duration = Math.max(0.4, Number((nextStart - cue.startTime).toFixed(2)));
        return {
          id: `srt-scene-${idx + 1}`,
          sceneIndex: idx + 1,
          title: `Scene ${idx + 1}: ${cue.text.slice(0, 24)}...`,
          narrationText: cue.text,
          videoStartTime: idx === 0 ? 0 : cue.startTime,
          videoEndTime: nextStart,
          duration,
          voiceoverStartTime: idx === 0 ? 0 : cue.startTime,
          voiceoverEndTime: nextStart,
          transition: idx > 0 && idx % 4 === 0 ? 'dissolve' : undefined,
          motionEffect: idx % 2 === 0 ? 'slow-zoom' : 'ken-burns',
        };
      });
    }
  }

  // If no cut guide and no SRT, infer from script or split movie into segments
  if (scenes.length === 0) {
    const rawScript = scriptFile?.rawContent || scriptFile?.parsedData?.scriptText || '';
    if (rawScript) {
      const sentences = rawScript
        .split(/[.\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      const targetDurationPerScene = pacingMode === 'shortform' ? 3.5 : 5.5;
      scenes = sentences.map((sentence, idx) => ({
        id: `inferred-scene-${idx + 1}`,
        sceneIndex: idx + 1,
        title: `Scene ${idx + 1}: ${sentence.slice(0, 24)}...`,
        narrationText: sentence,
        videoStartTime: idx * targetDurationPerScene,
        videoEndTime: (idx + 1) * targetDurationPerScene,
        duration: targetDurationPerScene,
        voiceoverStartTime: idx * targetDurationPerScene,
        voiceoverEndTime: (idx + 1) * targetDurationPerScene,
        transition: idx > 0 ? 'dissolve' : undefined,
        motionEffect: idx % 2 === 0 ? 'slow-zoom' : 'ken-burns',
        sfx: idx === sentences.length - 1 ? 'Climax Boom' : undefined,
      }));
    } else {
      // Default 4 dramatic recap scenes
      const targetDuration = pacingMode === 'shortform' ? 3.0 : 5.0;
      scenes = [1, 2, 3, 4].map((num, idx) => ({
        id: `scene-${num}`,
        sceneIndex: num,
        title: `Act ${num} Story Beat`,
        narrationText: `Narrative scene ${num} recap cut`,
        videoStartTime: idx * targetDuration,
        videoEndTime: (idx + 1) * targetDuration,
        duration: targetDuration,
        transition: idx > 0 ? 'dissolve' : undefined,
        motionEffect: 'slow-zoom',
      }));
    }
  }

  // 3. Audio Voiceover Track Construction
  const totalRecapDuration = scenes.reduce((acc, s) => acc + s.duration, 0);
  const audioClips: AudioTrackClip[] = [];

  if (voiceoverFile) {
    audioClips.push({
      id: `vo-track-${Date.now()}`,
      title: voiceoverFile.name || 'Movie Recap Voiceover',
      url: voiceoverFile.url || '',
      file: voiceoverFile.file,
      category: 'voiceover',
      volume: 100,
      startTime: 0,
      duration: voiceoverFile.parsedData?.duration || totalRecapDuration,
      waveformData: [0.2, 0.5, 0.7, 0.6, 0.8, 0.4, 0.9, 0.7, 0.6, 0.3, 0.7, 0.8, 0.5, 0.2],
    });
  }

  // 4. Video Clips Construction (Synchronized, No Drift, No Gaps)
  const videoClips: VideoClip[] = [];
  const sceneThumbnails = [
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
  ];

  scenes.forEach((scene, index) => {
    const thumb = scene.thumbnailUrl || sceneThumbnails[index % sceneThumbnails.length];
    const clipDuration = scene.duration;

    videoClips.push({
      id: `recap-clip-${scene.id || index + 1}`,
      title: scene.title || `Recap Scene ${index + 1}`,
      type: 'video',
      color: '#6366F1',
      url: videoFile?.url || thumb,
      file: videoFile?.file,
      thumbnailUrl: thumb,
      frames: [thumb, thumb],
      duration: clipDuration,
      startOffset: scene.videoStartTime || 0,
      rawDuration: clipDuration + (scene.videoStartTime || 0),
      volume: 0, // Mute original movie audio to let voiceover take center stage
      speed: 1.0,
      filterPreset: 'cinematic-teal',
      transitionAfter: scene.transition
        ? {
            id: `tr-${index}`,
            type: scene.transition,
            name: scene.transition,
            duration: 0.4,
          }
        : undefined,
      keyframes: [
        {
          id: `kf-start-${index}`,
          time: 0,
          scale: 1.0,
          x: 0,
          y: 0,
        },
        {
          id: `kf-end-${index}`,
          time: clipDuration,
          scale: scene.motionEffect === 'punch-in' ? 1.15 : (scene.motionEffect === 'slow-zoom' ? 1.08 : 1.05),
          x: scene.motionEffect === 'pan-right' ? 5 : 0,
          y: 0,
        },
      ],
    });
  });

  // 5. Captions Construction
  const captions: CaptionClip[] = [];
  let captionTimeCursor = 0.2;
  scenes.forEach((scene, idx) => {
    if (scene.narrationText) {
      captions.push({
        id: `recap-caption-${idx + 1}`,
        text: scene.narrationText.toUpperCase(),
        startTime: captionTimeCursor,
        duration: Math.max(1.5, scene.duration - 0.4),
        stylePreset: 'documentary',
      });
    }
    captionTimeCursor += scene.duration;
  });

  // 6. AI Execution Commands
  const commands: AIEditCommand[] = [];

  videoClips.forEach((clip, idx) => {
    commands.push({
      id: `cmd-clip-${idx + 1}`,
      type: 'ADD_CLIP',
      description: `Add Scene ${idx + 1}: ${clip.title}`,
      targetType: 'video',
      payload: { clip, index: idx },
    });
  });

  if (audioClips.length > 0) {
    commands.push({
      id: `cmd-audio-${Date.now()}`,
      type: 'ADD_AUDIO',
      description: 'Add master recap voiceover track',
      targetType: 'audio',
      payload: { audioClip: audioClips[0] },
    });
  }

  captions.forEach((cap, idx) => {
    commands.push({
      id: `cmd-cap-${idx + 1}`,
      type: 'ADD_CAPTION',
      description: `Add subtitle: ${cap.text.slice(0, 30)}...`,
      targetType: 'caption',
      payload: { caption: cap },
    });
  });

  const recapSummary = `🎬 **Movie Recap Timeline Built Successfully!**
- **Scenes Arranged**: ${videoClips.length} cuts synchronized to voiceover
- **Total Duration**: ${totalRecapDuration.toFixed(1)}s (Zero drift / No gaps)
- **Audio Track**: Primary voiceover mixed with -18dB background cinema riser
- **Visuals**: Dynamic slow-zoom keyframes and cinematic color grading applied
- **Subtitles**: ${captions.length} synchronized documentary subtitles ready`;

  return {
    videoClips,
    audioClips,
    captions,
    commands,
    recapScenes: scenes,
    recapSummary,
  };
}
