/**
 * Drift-Proof Export Engine
 * 
 * Hardware-clock locked video export pipeline designed to eliminate cumulative drift
 * and ensure audio, visual cuts, and subtitle timestamps stay locked across long timelines (10+ min).
 */

export interface ExportClip {
  id: string;
  assetUrl: string;
  start: number;      // in seconds (e.g. 12.35)
  duration: number;   // in seconds
  type?: 'image' | 'video';
}

export interface ExportOptions {
  audioUrl: string;                  // Voiceover / audio track URL
  clips: ExportClip[];               // Visual clips sorted by start time
  duration: number;                  // Total video length in seconds
  width?: number;                    // Default: 1080 (for 9:16) or 1920 (for 16:9)
  height?: number;                   // Default: 1920 (for 9:16) or 1080 (for 16:9)
  fps?: number;                      // Default: 30
  onProgress?: (progress: number) => void; // 0.0 to 1.0
  signal?: AbortSignal;
}

export async function exportAccurateVideo(
  options: ExportOptions
): Promise<{ blob: Blob; ext: string }> {
  const {
    audioUrl,
    clips,
    duration,
    width = 1080,
    height = 1920,
    fps = 30,
    onProgress,
    signal,
  } = options;

  // 1. Pick supported container format
  const mimeTypes = [
    "video/mp4;codecs=avc1,mp4a",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType =
    mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";

  // 2. Pre-decode audio buffer into memory (eliminates all playback lag)
  onProgress?.(0.02);
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass({
    sampleRate: 48000,
  });
  const audioResponse = await fetch(audioUrl);
  const audioArrayBuffer = await audioResponse.arrayBuffer();
  const decodedAudioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);

  // 3. Pre-load all visual images into memory
  const imgCache = new Map<string, HTMLImageElement>();
  let loadedCount = 0;
  await Promise.all(
    clips.map((clip) => {
      if (imgCache.has(clip.assetUrl)) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imgCache.set(clip.assetUrl, img);
          loadedCount++;
          onProgress?.(0.05 + 0.15 * (loadedCount / Math.max(1, clips.length)));
          resolve();
        };
        img.onerror = () => resolve(); // continue on single image error
        img.src = clip.assetUrl;
      });
    })
  );

  // 4. Setup canvas and master streams
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  const audioDest = audioCtx.createMediaStreamDestination();
  const captureFn = canvas.captureStream || (canvas as any).webkitCaptureStream;
  const combinedStream = captureFn.call(canvas, fps);
  audioDest.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recorderStopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  // 5. Connect sample-accurate buffer source
  const sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = decodedAudioBuffer;
  sourceNode.connect(audioDest);

  // 6. Draw helper (object-cover fill)
  const drawFrame = (currentTime: number) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    // Find the exact active clip for this audio millisecond
    const activeClip = clips.find(
      (c) =>
        currentTime >= c.start - 0.001 &&
        currentTime < c.start + c.duration - 0.001
    );

    if (activeClip) {
      const img = imgCache.get(activeClip.assetUrl);
      if (img && img.naturalWidth > 0) {
        // Calculate aspect cover coordinates
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const targetRatio = width / height;
        let sw, sh, sx, sy;

        if (imgRatio > targetRatio) {
          sh = img.naturalHeight;
          sw = sh * targetRatio;
          sx = (img.naturalWidth - sw) / 2;
          sy = 0;
        } else {
          sw = img.naturalWidth;
          sh = sw / targetRatio;
          sx = 0;
          sy = (img.naturalHeight - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      }
    }
  };

  // Draw initial frame at t = 0
  drawFrame(0);

  // Resume audio context and start recording
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  recorder.start(1000);

  // Start sound at exact hardware timestamp
  const audioStartTime = audioCtx.currentTime;
  sourceNode.start(audioStartTime);

  // 7. Master-Clock Animation Loop
  await new Promise<void>((resolve, reject) => {
    let animId: number;

    const tick = () => {
      if (signal?.aborted) {
        cancelAnimationFrame(animId);
        return reject(new DOMException("Aborted", "AbortError"));
      }

      // CRITICAL: Master clock is the audio hardware clock, NEVER wall-clock time
      const currentTime = audioCtx.currentTime - audioStartTime;

      drawFrame(currentTime);
      onProgress?.(0.2 + 0.8 * Math.min(1, currentTime / Math.max(0.1, duration)));

      if (currentTime >= duration) {
        cancelAnimationFrame(animId);
        resolve();
        return;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
  });

  // 8. Cleanup & Finalize
  try {
    sourceNode.stop();
  } catch {}
  recorder.stop();
  await recorderStopped;

  combinedStream.getTracks().forEach((track) => track.stop());
  await audioCtx.close();

  return {
    blob: new Blob(chunks, { type: mimeType.split(";")[0] }),
    ext,
  };
}
