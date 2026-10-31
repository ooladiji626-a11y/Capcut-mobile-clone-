import {
  VideoClip,
  CaptionClip,
  OverlayClip,
  AudioTrackClip,
  AspectRatio,
  Transition,
} from '../types';
import { interpolateKeyframes } from './keyframe';
import { getClipPathForMask } from '../components/PreviewPlayer';
import { generateCinematicSoundtrack, generateSubDropAndWhoosh } from './cinematicAudioSynthesizer';
import { generateDuckingGainEnvelope } from './audioDuckingEngine';
import { getKenBurnsTransform } from './cinematicMotion';

export interface ExportSettings {
  resolution: '720p' | '1080p' | '2k' | '4k';
  frameRate: 24 | 30 | 60;
  bitratePreset: 'standard' | 'high' | 'ultra';
  format: 'mp4' | 'webm' | 'gif' | 'json';
  includeAudio: boolean;
  watermark: boolean;
}

export interface RenderProgressCallback {
  (progress: {
    percent: number;
    currentFrame: number;
    totalFrames: number;
    stage: string;
    elapsedSeconds: number;
    estimatedRemainingSeconds: number;
    renderedCanvas?: HTMLCanvasElement;
  }): void;
}

// Calculate pixel dimensions from resolution and aspect ratio
export function getDimensions(
  resolution: ExportSettings['resolution'],
  aspectRatio: AspectRatio
): { width: number; height: number } {
  let baseLong = 1920;
  let baseShort = 1080;

  if (resolution === '720p') {
    baseLong = 1280;
    baseShort = 720;
  } else if (resolution === '1080p') {
    baseLong = 1920;
    baseShort = 1080;
  } else if (resolution === '2k') {
    baseLong = 2560;
    baseShort = 1440;
  } else if (resolution === '4k') {
    baseLong = 3840;
    baseShort = 2160;
  }

  switch (aspectRatio) {
    case '9:16':
      return { width: baseShort, height: baseLong };
    case '16:9':
      return { width: baseLong, height: baseShort };
    case '1:1':
      return { width: baseShort, height: baseShort };
    case '4:5':
      return { width: baseShort, height: Math.round((baseShort * 5) / 4) };
    default:
      return { width: baseShort, height: baseLong };
  }
}

// Pre-load an image URL safely into an HTMLImageElement
export async function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback placeholder canvas
      const placeholder = document.createElement('canvas');
      placeholder.width = 600;
      placeholder.height = 800;
      const ctx = placeholder.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e1e2d';
        ctx.fillRect(0, 0, 600, 800);
        ctx.fillStyle = '#6366f1';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Media Asset', 300, 400);
      }
      const fallbackImg = new Image();
      fallbackImg.src = placeholder.toDataURL();
      fallbackImg.onload = () => resolve(fallbackImg);
    };
    img.src = url;
  });
}

// Master multi-track offline audio mixdown engine
async function prepareProjectMasterAudio(
  videoClips: VideoClip[],
  audioClips: AudioTrackClip[],
  totalDuration: number,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  const safeTotal = Math.max(0.5, totalDuration);
  const totalSamples = Math.ceil(sampleRate * safeTotal);
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  // 1. Decode & mix real audio from video clips (original audio, dialogue, recorded sound)
  let videoTimeOffset = 0;
  for (const clip of videoClips) {
    const clipStart = videoTimeOffset;
    videoTimeOffset += clip.duration;
    if (clipStart >= safeTotal) break;

    const clipVolume = typeof clip.volume === 'number' ? clip.volume : 100;
    if (clipVolume <= 0) continue;

    try {
      let arrayBuf: ArrayBuffer | null = null;
      if (clip.file) {
        arrayBuf = await clip.file.arrayBuffer();
      } else if (clip.url && (clip.url.startsWith('blob:') || clip.url.startsWith('data:') || clip.url.startsWith('http'))) {
        const resp = await fetch(clip.url);
        if (resp.ok) {
          arrayBuf = await resp.arrayBuffer();
        }
      }

      if (arrayBuf) {
        const audioBuf = await offlineCtx.decodeAudioData(arrayBuf.slice(0));
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuf;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.setValueAtTime(clipVolume / 100, 0);

        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        const sourceStart = clip.sourceIn ?? clip.startOffset ?? 0;
        const playDuration = Math.min(clip.duration, Math.max(0, audioBuf.duration - sourceStart));

        if (playDuration > 0) {
          source.start(
            clipStart,
            sourceStart,
            Math.min(playDuration, safeTotal - clipStart)
          );
        }
      }
    } catch (err) {
      // Expected if clip is an image or silent video
    }
  }

  // 2. Compute smart auto-ducking gain envelope across voiceover and BGM tracks
  const duckingEnvelope = generateDuckingGainEnvelope(audioClips, safeTotal);

  // 3. Decode & mix timeline audio tracks (music, sound effects, voiceovers)
  for (const aClip of audioClips) {
    const aStartTime = aClip.startTime || 0;
    if (aStartTime >= safeTotal) continue;
    const aVolume = typeof aClip.volume === 'number' ? aClip.volume : 80;
    if (aVolume <= 0) continue;

    try {
      let audioBuf: AudioBuffer | null = null;

      if (aClip.file) {
        try {
          const arrayBuf = await aClip.file.arrayBuffer();
          audioBuf = await offlineCtx.decodeAudioData(arrayBuf.slice(0));
        } catch (e) {
          console.warn('Could not decode file for audio clip:', aClip.title, e);
        }
      } else if (aClip.url && (aClip.url.startsWith('blob:') || aClip.url.startsWith('data:') || aClip.url.startsWith('http'))) {
        try {
          const resp = await fetch(aClip.url);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            audioBuf = await offlineCtx.decodeAudioData(arrayBuf.slice(0));
          }
        } catch (e) {
          console.warn('Could not fetch/decode URL for audio clip:', aClip.title, e);
        }
      }

      // If audio clip has no buffer yet, synthesize realistic score or SFX matching the clip
      if (!audioBuf) {
        const lowerTitle = (aClip.title || '').toLowerCase();
        if (lowerTitle.includes('whoosh') || lowerTitle.includes('sub-drop') || aClip.category === 'sfx') {
          const sfx = await generateSubDropAndWhoosh(aClip.duration || 3.5, sampleRate);
          audioBuf = sfx.buffer;
        } else {
          // Default cinematic narrative score
          const score = await generateCinematicSoundtrack(aClip.duration || 21.5, sampleRate);
          audioBuf = score.buffer;
        }
      }

      if (audioBuf) {
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuf;

        const gainNode = offlineCtx.createGain();
        const baseGain = aVolume / 100;

        const isBgm =
          aClip.category === 'music' ||
          aClip.trackIndex === 2 ||
          (!aClip.category && (aClip.title || '').toLowerCase().includes('music')) ||
          (!aClip.category && (aClip.title || '').toLowerCase().includes('soundtrack')) ||
          (!aClip.category && (aClip.title || '').toLowerCase().includes('ambient'));

        if (isBgm && duckingEnvelope.length > 0) {
          // Schedule smart auto-ducking curve directly into offline context
          gainNode.gain.setValueAtTime(baseGain * duckingEnvelope[0].gain, 0);
          for (const pt of duckingEnvelope) {
            const t = Math.max(0, pt.time);
            if (t <= safeTotal) {
              gainNode.gain.setValueAtTime(
                Math.max(0, Math.min(1, baseGain * pt.gain)),
                t
              );
            }
          }
        } else {
          gainNode.gain.setValueAtTime(baseGain, 0);
        }

        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        const aOffset = (aClip as any).startOffset || (aClip as any).sourceIn || (aClip as any).sourceStartSecond || 0;
        const playDuration = Math.min(aClip.duration, Math.max(0, audioBuf.duration - aOffset));

        if (playDuration > 0) {
          source.start(
            aStartTime,
            aOffset,
            Math.min(playDuration, safeTotal - aStartTime)
          );
        }
      }
    } catch (err) {
      console.warn('Failed to mix audio clip:', aClip.title, err);
    }
  }

  // Render the entire multi-track composition into a master stereo AudioBuffer
  const masterAudioBuffer = await offlineCtx.startRendering();
  return masterAudioBuffer;
}

// Master rendering pipeline
export async function renderAndExportVideo(params: {
  videoClips: VideoClip[];
  captions: CaptionClip[];
  overlays: OverlayClip[];
  audioClips: AudioTrackClip[];
  aspectRatio: AspectRatio;
  totalDuration: number;
  projectTitle: string;
  settings: ExportSettings;
  onProgress: RenderProgressCallback;
  abortSignal?: { aborted: boolean };
}): Promise<{ blob: Blob; url: string; filename: string; mimeType: string; sizeBytes: number }> {
  const {
    videoClips,
    captions,
    overlays,
    audioClips,
    aspectRatio,
    totalDuration,
    projectTitle,
    settings,
    onProgress,
    abortSignal,
  } = params;

  const { width, height } = getDimensions(settings.resolution, aspectRatio);
  const fps = settings.frameRate || 30;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));
  const startTime = performance.now();

  // 1. Stage: Preload all clip images, overlay assets & REAL HTMLVideoElements
  onProgress({
    percent: 2,
    currentFrame: 0,
    totalFrames,
    stage: 'Pre-loading timeline video streams and media...',
    elapsedSeconds: 0,
    estimatedRemainingSeconds: Math.ceil(totalFrames / fps),
  });

  const imageMap = new Map<string, HTMLImageElement>();
  const videoMap = new Map<string, HTMLVideoElement>();

  for (const clip of videoClips) {
    if (clip.thumbnailUrl && !imageMap.has(clip.thumbnailUrl)) {
      imageMap.set(clip.thumbnailUrl, await preloadImage(clip.thumbnailUrl));
    }
    if (clip.frames) {
      for (const frameUrl of clip.frames) {
        if (frameUrl && !imageMap.has(frameUrl)) {
          imageMap.set(frameUrl, await preloadImage(frameUrl));
        }
      }
    }

    // Initialize real HTMLVideoElement for video playback
    const isVideo =
      clip.type === 'video' ||
      Boolean(
        clip.url &&
          (clip.url.startsWith('blob:') ||
            clip.url.includes('.mp4') ||
            clip.url.includes('.webm') ||
            clip.url.includes('.mov') ||
            clip.file?.type?.startsWith('video/'))
      );

    const mediaUrl = clip.url || (clip.file ? URL.createObjectURL(clip.file) : null);
    if (isVideo && mediaUrl) {
      try {
        const v = document.createElement('video');
        v.crossOrigin = 'anonymous';
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.src = mediaUrl;
        await new Promise<void>((resolve) => {
          if (v.readyState >= 2) return resolve();
          v.onloadeddata = () => resolve();
          v.onerror = () => resolve();
          setTimeout(resolve, 2000);
        });
        videoMap.set(clip.id, v);
      } catch (err) {
        console.warn('Could not initialize video player for clip:', clip.id, err);
      }
    }
  }

  for (const ov of overlays) {
    if (ov.thumbnailUrl && !imageMap.has(ov.thumbnailUrl)) {
      imageMap.set(ov.thumbnailUrl, await preloadImage(ov.thumbnailUrl));
    }
  }

  const cleanupMediaElements = () => {
    for (const v of videoMap.values()) {
      try {
        v.pause();
        v.removeAttribute('src');
        v.load();
      } catch (e) {}
    }
    videoMap.clear();
  };

  // 2. Setup Offscreen Rendering Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context creation failed');

  // 3. Audio Setup (Master Multi-Track Mixed Buffer)
  let audioContext: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  let audioSourceNode: AudioBufferSourceNode | null = null;

  if (typeof window.AudioContext !== 'undefined') {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtxClass({ sampleRate: 48000 });
      if (audioContext.state === 'suspended') {
        await audioContext.resume().catch(() => {});
      }
      audioDest = audioContext.createMediaStreamDestination();

      if (settings.includeAudio) {
        onProgress({
          percent: 3,
          currentFrame: 0,
          totalFrames,
          stage: 'Pre-decoding and mastering sample-accurate audio buffer...',
          elapsedSeconds: 0,
          estimatedRemainingSeconds: Math.ceil(totalFrames / fps),
        });

        const masterAudioBuffer = await prepareProjectMasterAudio(
          videoClips,
          audioClips,
          totalDuration,
          audioContext.sampleRate
        );

        audioSourceNode = audioContext.createBufferSource();
        audioSourceNode.buffer = masterAudioBuffer;
        audioSourceNode.connect(audioDest);
      }
    } catch (e) {
      console.warn('AudioContext master mix initialization ignored:', e);
    }
  }

  // 4. MediaStream & MediaRecorder Setup
  if (typeof window.MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported by your browser. Please try Chrome, Edge, or Firefox.');
  }

  const captureFn =
    canvas.captureStream ||
    (canvas as any).mozCaptureStream ||
    (canvas as any).webkitCaptureStream;
  if (!captureFn) {
    throw new Error('Canvas stream capture is not supported in this browser. Please use Chrome, Edge, or Firefox.');
  }
  const canvasStream: MediaStream = captureFn.call(canvas, fps);
  const combinedStream = new MediaStream();

  canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
  if (audioDest) {
    audioDest.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
  }

  // Pick best available MIME type prioritizing the requested format
  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];
  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264',
    'video/webm',
  ];

  const preferredMimeTypes =
    settings.format === 'mp4'
      ? [...mp4Types, ...webmTypes]
      : [...webmTypes, ...mp4Types];

  let selectedMimeType = '';
  for (const mime of preferredMimeTypes) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime)) {
      selectedMimeType = mime;
      break;
    }
  }
  if (!selectedMimeType) selectedMimeType = 'video/webm';

  let videoBitsPerSecond = 12000000; // 12 Mbps default
  if (settings.bitratePreset === 'high') videoBitsPerSecond = 18000000;
  if (settings.bitratePreset === 'ultra') videoBitsPerSecond = 32000000;

  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(combinedStream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond,
    });
  } catch (err1) {
    try {
      recorder = new MediaRecorder(combinedStream, { mimeType: selectedMimeType });
    } catch (err2) {
      try {
        recorder = new MediaRecorder(combinedStream);
      } catch (err3: any) {
        throw new Error('Could not initialize video recorder on this device: ' + (err3?.message || 'Unsupported format'));
      }
    }
  }

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Start synchronized audio output and video recording simultaneously
  const recordStartTime = performance.now();
  let audioStartTime = 0;
  if (audioContext) {
    audioStartTime = audioContext.currentTime;
    if (audioSourceNode) {
      audioSourceNode.start(audioStartTime);
    }
  }
  recorder.start(100);

  // 5. Hardware Audio-Clock Master Loop (Eliminates Cumulative Drift)
  let lastReportedSec = -1;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (abortSignal?.aborted) {
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
        } catch (e) {}
      }
      recorder.stop();
      if (audioContext) audioContext.close().catch(() => {});
      cleanupMediaElements();
      throw new Error('Export cancelled by user');
    }

    // Audio Hardware Master Clock: Derive frame timestamp directly from audio crystal clock
    const hardwareTime = audioContext
      ? Math.max(0, audioContext.currentTime - audioStartTime)
      : (performance.now() - recordStartTime) / 1000;

    const frameTargetTime = (frameIndex / totalFrames) * totalDuration;

    // If hardware clock hasn't reached scheduled frame timestamp yet, pace smoothly
    if (hardwareTime < frameTargetTime) {
      const waitMs = (frameTargetTime - hardwareTime) * 1000;
      if (waitMs > 1) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    // Sample-accurate timestamp locked to hardware audio clock
    const currentTime = audioContext
      ? Math.max(0, Math.min(totalDuration, audioContext.currentTime - audioStartTime))
      : Math.min(totalDuration, (frameIndex / totalFrames) * totalDuration);

    // If hardware clock advanced (e.g. video seek delay), catch up frameIndex immediately
    const currentFrameAtClock = Math.min(totalFrames - 1, Math.floor((currentTime / totalDuration) * totalFrames));
    if (currentFrameAtClock > frameIndex) {
      frameIndex = currentFrameAtClock;
    }

    // Draw Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Find Active Video Clip(s)
    let accumulatedTime = 0;
    let activeClip: VideoClip | null = null;
    let clipLocalTime = 0;
    let clipIndex = 0;

    for (let i = 0; i < videoClips.length; i++) {
      const c = videoClips[i];
      if (currentTime >= accumulatedTime && currentTime < accumulatedTime + c.duration) {
        activeClip = c;
        clipLocalTime = currentTime - accumulatedTime;
        clipIndex = i;
        break;
      }
      accumulatedTime += c.duration;
    }

    if (!activeClip && videoClips.length > 0) {
      activeClip = videoClips[videoClips.length - 1];
      clipLocalTime = activeClip.duration;
      clipIndex = videoClips.length - 1;
    }

    // Render Video Clip Frame (Real Video Seeking or Static Frame Fallback)
    if (activeClip) {
      const videoEl = videoMap.get(activeClip.id);
      const isVideoReady = Boolean(videoEl && videoEl.readyState >= 2 && !videoEl.error);

      if (isVideoReady && videoEl) {
        const sourceOffset = activeClip.sourceIn ?? activeClip.startOffset ?? 0;
        const speed = activeClip.speed && activeClip.speed > 0 ? activeClip.speed : 1.0;
        const targetVideoTime = sourceOffset + (clipLocalTime * speed);

        // Seek video element to target timestamp
        if (Math.abs(videoEl.currentTime - targetVideoTime) > 0.02) {
          videoEl.currentTime = Math.max(
            0,
            Math.min(targetVideoTime, Math.max(0, (videoEl.duration || 1000) - 0.04))
          );
          await new Promise<void>((res) => {
            let done = false;
            const onSeeked = () => {
              if (!done) {
                done = true;
                videoEl.removeEventListener('seeked', onSeeked);
                res();
              }
            };
            videoEl.addEventListener('seeked', onSeeked);
            setTimeout(onSeeked, 50);
          });
        }
      }

      const img =
        imageMap.get(activeClip.thumbnailUrl) ||
        (activeClip.frames?.length ? imageMap.get(activeClip.frames[0]) : null);

      if (isVideoReady || img) {
        ctx.save();

        // Keyframe Interpolation for active clip
        let kfTransform = { scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1.0 };
        if (activeClip.keyframes && activeClip.keyframes.length > 0) {
          kfTransform = interpolateKeyframes(activeClip.keyframes, clipLocalTime);
        }

        // Apply Auto Ken Burns cinematic motion if enabled
        if (activeClip.kenBurns && activeClip.kenBurns.enabled) {
          const kb = getKenBurnsTransform(activeClip, clipLocalTime / Math.max(0.1, activeClip.duration));
          kfTransform.scale = (kfTransform.scale || 1.0) * kb.scale;
          kfTransform.x = (kfTransform.x || 0) + kb.translateXPercent;
          kfTransform.y = (kfTransform.y || 0) + kb.translateYPercent;
        }

        // Apply Opacity
        ctx.globalAlpha = Math.max(0, Math.min(1, kfTransform.opacity ?? 1));

        // Color adjustments filter
        const adj = activeClip.adjustments;
        if (adj) {
          const brightness = 1 + (adj.brightness || 0) / 100;
          const contrast = 1 + (adj.contrast || 0) / 100;
          const saturate = 1 + (adj.saturation || 0) / 100;
          ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
        }

        // Apply Transform (center origin)
        ctx.translate(width / 2, height / 2);
        if (kfTransform.x || kfTransform.y) {
          ctx.translate((kfTransform.x / 100) * width, (kfTransform.y / 100) * height);
        }
        if (kfTransform.rotation) {
          ctx.rotate((kfTransform.rotation * Math.PI) / 180);
        }
        if (kfTransform.scale) {
          ctx.scale(kfTransform.scale, kfTransform.scale);
        }

        // Draw active video element or image covering the canvas aspect
        if (isVideoReady && videoEl) {
          const vW = videoEl.videoWidth || width;
          const vH = videoEl.videoHeight || height;
          const videoAspect = vW / vH;
          const canvasAspect = width / height;
          let drawW = width;
          let drawH = height;

          if (videoAspect > canvasAspect) {
            drawH = height;
            drawW = height * videoAspect;
          } else {
            drawW = width;
            drawH = width / videoAspect;
          }
          ctx.drawImage(videoEl, -drawW / 2, -drawH / 2, drawW, drawH);
        } else if (img) {
          const imgAspect = img.width / img.height;
          const canvasAspect = width / height;
          let drawW = width;
          let drawH = height;

          if (imgAspect > canvasAspect) {
            drawH = height;
            drawW = height * imgAspect;
          } else {
            drawW = width;
            drawH = width / imgAspect;
          }
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        }

        ctx.restore();

        // Filter Preset Tint Effects
        if (activeClip.filterPreset && activeClip.filterPreset !== 'none') {
          ctx.save();
          if (activeClip.filterPreset === 'cyberpunk') {
            ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
            ctx.fillRect(0, 0, width, height);
          } else if (activeClip.filterPreset === 'cinematic-teal') {
            ctx.fillStyle = 'rgba(20, 184, 166, 0.15)';
            ctx.fillRect(0, 0, width, height);
          } else if (activeClip.filterPreset === 'kodak-vintage') {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
            ctx.fillRect(0, 0, width, height);
          } else if (activeClip.filterPreset === 'dark-noir') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.restore();
        }

        // Vignette Overlay
        if (adj?.vignette && adj.vignette > 0) {
          ctx.save();
          const grad = ctx.createRadialGradient(
            width / 2,
            height / 2,
            Math.min(width, height) * 0.3,
            width / 2,
            height / 2,
            Math.max(width, height) * 0.7
          );
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, `rgba(0,0,0,${(adj.vignette / 100) * 0.8})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      }
    }

    // Render Active Overlays (Picture-in-Picture / Stickers)
    for (const ov of overlays) {
      if (currentTime >= ov.startTime && currentTime < ov.startTime + ov.duration) {
        const ovImg = imageMap.get(ov.thumbnailUrl);
        if (ovImg) {
          ctx.save();
          ctx.globalAlpha = ov.opacity ?? 0.9;
          if (ov.blendMode === 'screen') ctx.globalCompositeOperation = 'screen';
          else if (ov.blendMode === 'multiply') ctx.globalCompositeOperation = 'multiply';
          else if (ov.blendMode === 'overlay') ctx.globalCompositeOperation = 'overlay';

          const tX = ((ov.transform?.x ?? 0) / 100) * width + width / 2;
          const tY = ((ov.transform?.y ?? 0) / 100) * height + height / 2;
          const scale = (ov.transform?.scale ?? 1) * 0.4;
          const rot = ((ov.transform?.rotation ?? 0) * Math.PI) / 180;

          ctx.translate(tX, tY);
          ctx.rotate(rot);
          ctx.scale(scale, scale);

          const oW = (ovImg.width || 300) * (width / 1080);
          const oH = (ovImg.height || 300) * (width / 1080);
          ctx.drawImage(ovImg, -oW / 2, -oH / 2, oW, oH);
          ctx.restore();
        }
      }
    }

    // Render Active Captions / Subtitles
    const activeCap = captions.find(
      (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration
    );

    if (activeCap) {
      ctx.save();
      const capProgress = (currentTime - activeCap.startTime) / activeCap.duration;
      const fontSize = Math.round(width * 0.052);
      ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const capY = height * 0.78;

      if (activeCap.stylePreset === 'hormozi') {
        // Hormozi Style: Bold yellow/cyan highlighted words with black border
        const words = activeCap.text.split(' ');
        const activeWordIdx = Math.min(
          words.length - 1,
          Math.floor(capProgress * words.length)
        );

        // Measure full sentence width to center it
        let totalW = 0;
        const wordMetrics = words.map((w) => {
          const wWidth = ctx.measureText(w + ' ').width;
          totalW += wWidth;
          return { word: w, width: wWidth };
        });

        let curX = width / 2 - totalW / 2;

        words.forEach((w, idx) => {
          const isHighlighted = idx === activeWordIdx;
          const wWidth = wordMetrics[idx].width;
          const wordCenterX = curX + wWidth / 2;

          if (isHighlighted) {
            // Highlight Pill Background
            ctx.fillStyle = '#facc15'; // yellow-400
            const pillW = wWidth + 12;
            const pillH = fontSize * 1.35;
            ctx.beginPath();
            ctx.roundRect(wordCenterX - pillW / 2, capY - pillH / 2, pillW, pillH, 8);
            ctx.fill();

            // Highlighted text in black
            ctx.fillStyle = '#000000';
            ctx.fillText(w, wordCenterX, capY);
          } else {
            // Standard word with stroke
            ctx.lineWidth = Math.max(4, fontSize * 0.12);
            ctx.strokeStyle = '#000000';
            ctx.strokeText(w, wordCenterX, capY);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(w, wordCenterX, capY);
          }

          curX += wWidth;
        });
      } else if (activeCap.stylePreset === 'bold-stroke') {
        // Bold Stroke / MrBeast Style
        ctx.lineWidth = Math.max(6, fontSize * 0.16);
        ctx.strokeStyle = '#000000';
        ctx.strokeText(activeCap.text, width / 2, capY);

        ctx.fillStyle = '#fbbf24'; // Amber
        ctx.fillText(activeCap.text, width / 2, capY);
      } else {
        // Clean Documentary Subtitle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const textWidth = ctx.measureText(activeCap.text).width;
        ctx.fillRect(
          width / 2 - textWidth / 2 - 16,
          capY - fontSize * 0.8,
          textWidth + 32,
          fontSize * 1.6
        );

        ctx.fillStyle = '#ffffff';
        ctx.fillText(activeCap.text, width / 2, capY);
      }

      ctx.restore();
    }

    // Watermark (if enabled)
    if (settings.watermark) {
      ctx.save();
      ctx.font = `bold ${Math.round(width * 0.024)}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'right';
      ctx.fillText('⚡ CapCut Pro Studio', width - 24, height - 24);
      ctx.restore();
    }

    // Yield thread periodically to keep browser UI responsive
    if (frameIndex % 3 === 0 || frameIndex === totalFrames - 1) {
      await new Promise((r) => setTimeout(r, 0));
    }

    // Periodic progress update locked to hardware elapsed time
    const elapsed = Math.round(currentTime);
    if (elapsed !== lastReportedSec || frameIndex === totalFrames - 1) {
      lastReportedSec = elapsed;
      const percent = Math.min(99, Math.max(5, Math.round((currentTime / totalDuration) * 98)));
      const remaining = Math.max(0, Math.round(totalDuration - currentTime));

      onProgress({
        percent,
        currentFrame: frameIndex + 1,
        totalFrames,
        stage: `Encoding hardware-synced frames (${frameIndex + 1}/${totalFrames} • ${fps}fps)...`,
        elapsedSeconds: elapsed,
        estimatedRemainingSeconds: remaining,
        renderedCanvas: canvas,
      });
    }
  }

  // 6. Stop Recorder & Finalize Container
  // Wait if needed so audio stream captures the full requested duration
  const finalAudioTime = audioContext
    ? (audioContext.currentTime - audioStartTime)
    : ((performance.now() - recordStartTime) / 1000);
  if (finalAudioTime < totalDuration) {
    const padMs = Math.min(2000, Math.max(0, (totalDuration - finalAudioTime) * 1000));
    if (padMs > 0) {
      await new Promise((r) => setTimeout(r, padMs));
    }
  }

  onProgress({
    percent: 99,
    currentFrame: totalFrames,
    totalFrames,
    stage: 'Finalizing and packaging video file...',
    elapsedSeconds: Math.round((performance.now() - recordStartTime) / 1000),
    estimatedRemainingSeconds: 0,
  });

  return new Promise((resolve, reject) => {
    let finished = false;

    const finalize = () => {
      if (finished) return;
      finished = true;

      cleanupMediaElements();

      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
        } catch (e) {}
      }

      if (audioContext) {
        audioContext.close().catch(() => {});
      }

      const activeMime = recorder.mimeType || selectedMimeType || 'video/webm';
      const finalBlob = new Blob(chunks, { type: activeMime });
      const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9_-]/g, '_') || 'CapCut_Video';
      const ext = activeMime.includes('mp4') ? 'mp4' : 'webm';
      const filename = `${sanitizedTitle}_${settings.resolution}_${settings.frameRate}fps.${ext}`;
      const url = URL.createObjectURL(finalBlob);

      resolve({
        blob: finalBlob,
        url,
        filename,
        mimeType: activeMime,
        sizeBytes: finalBlob.size,
      });
    };

    recorder.onstop = finalize;

    recorder.onerror = (err) => {
      cleanupMediaElements();
      if (audioContext) audioContext.close().catch(() => {});
      reject(err);
    };

    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        finalize();
      }
    } catch (e) {
      finalize();
    }

    // Safety timeout in case onstop does not fire
    setTimeout(() => {
      if (!finished) finalize();
    }, 2500);
  });
}

// Export Project JSON file
export function exportProjectJSON(projectData: {
  title: string;
  aspectRatio: AspectRatio;
  videoClips: VideoClip[];
  captions: CaptionClip[];
  overlays: OverlayClip[];
  audioClips: AudioTrackClip[];
  totalDuration: number;
}): { blob: Blob; url: string; filename: string } {
  const jsonString = JSON.stringify(
    {
      version: '2.0-capcut-web',
      exportedAt: new Date().toISOString(),
      project: {
        title: projectData.title,
        aspectRatio: projectData.aspectRatio,
        totalDuration: projectData.totalDuration,
      },
      tracks: {
        video: projectData.videoClips,
        captions: projectData.captions,
        overlays: projectData.overlays,
        audio: projectData.audioClips,
      },
    },
    null,
    2
  );

  const blob = new Blob([jsonString], { type: 'application/json' });
  const sanitizedTitle = projectData.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'CapCut_Project';
  const filename = `${sanitizedTitle}.capcut.json`;
  const url = URL.createObjectURL(blob);

  return { blob, url, filename };
}

// Download a blob directly through browser with mobile-safe handling
export function triggerFileDownload(url: string, filename: string) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch (e) {}
    }, 1500);
  } catch (err) {
    console.warn('Direct file download error:', err);
  }
}
