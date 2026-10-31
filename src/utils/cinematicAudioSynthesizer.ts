/**
 * Cinematic Audio Synthesizer & WAV Encoder
 * Generates rich, authentic, multi-layered cinematic soundtracks and sound effects
 * directly into AudioBuffers and playable WAV Blob URLs via Web Audio OfflineAudioContext.
 */

import { createManagedObjectUrl } from './imageMemoryManager';

// Converts an AudioBuffer into a standard 16-bit PCM Stereo WAV Blob
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16)

  // data Subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels & write 16-bit clamped samples
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Generates an epic Hans-Zimmer style documentary orchestral score
 * with deep sub bass, minor chord string pads, warm brass swells, and rhythmic cinematic pulse beats.
 */
export async function generateCinematicSoundtrack(
  duration: number = 21.5,
  sampleRate: number = 22050
): Promise<{ buffer: AudioBuffer; url: string }> {
  try {
    const safeDuration = Math.max(2.0, Math.min(24.0, duration));
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * safeDuration), sampleRate);

  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.75, 0);
  masterGain.connect(offlineCtx.destination);

  // 1. Lush Minor Chord String Pads (A minor -> F major -> C major -> G major progression)
  // Chord frequencies (Hz)
  const progressions = [
    [110, 130.81, 164.81, 220], // Am (A2, C3, E3, A3)
    [87.31, 130.81, 174.61, 220], // F (F2, C3, F3, A3)
    [130.81, 164.81, 196.0, 261.63], // C (C3, E3, G3, C4)
    [98.0, 146.83, 196.0, 246.94], // G (G2, D3, G3, B3)
  ];

  const chordDuration = 5.0;
  const numChords = Math.ceil(safeDuration / chordDuration);

  for (let i = 0; i < numChords; i++) {
    const chordTime = i * chordDuration;
    if (chordTime >= safeDuration) break;
    const notes = progressions[i % progressions.length];

    notes.forEach((freq, noteIdx) => {
      const osc = offlineCtx.createOscillator();
      const noteGain = offlineCtx.createGain();
      const filter = offlineCtx.createBiquadFilter();

      osc.type = noteIdx === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, chordTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 + noteIdx * 200, chordTime);
      filter.frequency.exponentialRampToValueAtTime(1400, chordTime + chordDuration * 0.7);

      // Envelope: gentle fade in, warm sustain, gentle fade out
      const actualEnd = Math.min(safeDuration, chordTime + chordDuration);
      noteGain.gain.setValueAtTime(0.001, chordTime);
      noteGain.gain.linearRampToValueAtTime(0.06 / notes.length, chordTime + 1.2);
      noteGain.gain.setValueAtTime(0.06 / notes.length, actualEnd - 0.8);
      noteGain.gain.linearRampToValueAtTime(0.001, actualEnd);

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(chordTime);
      osc.stop(actualEnd);
    });
  }

  // 2. Deep Sub-Bass Foundation (A1 55Hz / D1 36.7Hz)
  const bassOsc = offlineCtx.createOscillator();
  const bassGain = offlineCtx.createGain();
  bassOsc.type = 'sine';
  bassOsc.frequency.setValueAtTime(55, 0); // A1 note
  bassGain.gain.setValueAtTime(0.18, 0);
  bassGain.gain.linearRampToValueAtTime(0.18, safeDuration - 1.5);
  bassGain.gain.linearRampToValueAtTime(0.001, safeDuration);

  bassOsc.connect(bassGain);
  bassGain.connect(masterGain);
  bassOsc.start(0);
  bassOsc.stop(safeDuration);

  // 3. Cinematic Rhythmic Heartbeat / Sub-Drop Pulses (every 1.2 seconds)
  const pulseInterval = 1.2;
  const numPulses = Math.floor(safeDuration / pulseInterval);

  for (let p = 0; p < numPulses; p++) {
    const pulseTime = p * pulseInterval;
    const isDownbeat = p % 4 === 0;

    const pulseOsc = offlineCtx.createOscillator();
    const pulseGain = offlineCtx.createGain();

    pulseOsc.type = 'sine';
    const startFreq = isDownbeat ? 85 : 65;
    pulseOsc.frequency.setValueAtTime(startFreq, pulseTime);
    pulseOsc.frequency.exponentialRampToValueAtTime(28, pulseTime + 0.18);

    const hitAmp = isDownbeat ? 0.35 : 0.18;
    pulseGain.gain.setValueAtTime(hitAmp, pulseTime);
    pulseGain.gain.exponentialRampToValueAtTime(0.001, pulseTime + (isDownbeat ? 0.28 : 0.15));

    pulseOsc.connect(pulseGain);
    pulseGain.connect(masterGain);

    pulseOsc.start(pulseTime);
    pulseOsc.stop(pulseTime + 0.3);
  }

  // 4. Subtle Shimmering Atmospheric Texture
  const shimmerOsc = offlineCtx.createOscillator();
  const shimmerGain = offlineCtx.createGain();
  shimmerOsc.type = 'sine';
  shimmerOsc.frequency.setValueAtTime(440, 0); // A4
  shimmerGain.gain.setValueAtTime(0.015, 0);

  shimmerOsc.connect(shimmerGain);
  shimmerGain.connect(masterGain);
  shimmerOsc.start(0);
  shimmerOsc.stop(safeDuration);

  const renderedBuffer = await offlineCtx.startRendering();
  const blob = audioBufferToWavBlob(renderedBuffer);
  const url = createManagedObjectUrl(blob);

  return { buffer: renderedBuffer, url };
  } catch (err) {
    console.warn('Cinematic soundtrack synthesis fallback:', err);
    const fallbackCtx = new OfflineAudioContext(2, 22050, 22050);
    const buffer = fallbackCtx.createBuffer(2, 22050, 22050);
    const blob = audioBufferToWavBlob(buffer);
    const url = createManagedObjectUrl(blob);
    return { buffer, url };
  }
}

/**
 * Generates a cinematic sub-drop and whoosh sound effect
 */
export async function generateSubDropAndWhoosh(
  duration: number = 3.5,
  sampleRate: number = 22050
): Promise<{ buffer: AudioBuffer; url: string }> {
  try {
    const safeDuration = Math.max(1.0, Math.min(4.0, duration));
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * safeDuration), sampleRate);

    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(0.8, 0);
    masterGain.connect(offlineCtx.destination);

  // 1. Whoosh Noise Riser
  const bufferSize = sampleRate * 1.5;
  const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = offlineCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;

  const bandpass = offlineCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.Q.setValueAtTime(2.0, 0);
  bandpass.frequency.setValueAtTime(200, 0);
  bandpass.frequency.exponentialRampToValueAtTime(1800, 0.8);
  bandpass.frequency.exponentialRampToValueAtTime(150, 1.4);

  const noiseGain = offlineCtx.createGain();
  noiseGain.gain.setValueAtTime(0.01, 0);
  noiseGain.gain.linearRampToValueAtTime(0.25, 0.7);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, 1.4);

  whiteNoise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(masterGain);

  whiteNoise.start(0);

  // 2. Sub-Bass Heavy Drop Impact (at 0.75 seconds)
  const impactTime = 0.75;
  const subOsc = offlineCtx.createOscillator();
  const subGain = offlineCtx.createGain();

  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(160, impactTime);
  subOsc.frequency.exponentialRampToValueAtTime(28, impactTime + 0.6);

  subGain.gain.setValueAtTime(0.7, impactTime);
  subGain.gain.exponentialRampToValueAtTime(0.001, impactTime + 1.8);

  subOsc.connect(subGain);
  subGain.connect(masterGain);

  subOsc.start(impactTime);
  subOsc.stop(safeDuration);

  const renderedBuffer = await offlineCtx.startRendering();
  const blob = audioBufferToWavBlob(renderedBuffer);
  const url = createManagedObjectUrl(blob);

  return { buffer: renderedBuffer, url };
  } catch (err) {
    console.warn('Sub-drop synthesis fallback:', err);
    const fallbackCtx = new OfflineAudioContext(2, 22050, 22050);
    const buffer = fallbackCtx.createBuffer(2, 22050, 22050);
    const blob = audioBufferToWavBlob(buffer);
    const url = createManagedObjectUrl(blob);
    return { buffer, url };
  }
}

// In-memory cache for synthesized audio URLs by clip id / parameters
const synthesizedAudioCache = new Map<string, string>();
let audioGenerationQueue: Promise<void> = Promise.resolve();

/**
 * Ensures an AudioTrackClip has a real playable URL, generating a realistic
 * high-fidelity score or SFX audio file if none is present.
 * Serializes requests into a queue so multiple clips never synthesize in parallel.
 */
export async function ensureAudioClipHasUrl(clip: {
  id: string;
  title?: string;
  duration: number;
  url?: string;
  category?: string;
}): Promise<string> {
  if (clip.url && (clip.url.startsWith('blob:') || clip.url.startsWith('data:') || clip.url.startsWith('http'))) {
    return clip.url;
  }

  if (synthesizedAudioCache.has(clip.id)) {
    const cachedUrl = synthesizedAudioCache.get(clip.id)!;
    clip.url = cachedUrl;
    return cachedUrl;
  }

  // Queue execution to prevent spiking mobile memory
  return new Promise<string>((resolve) => {
    audioGenerationQueue = audioGenerationQueue
      .then(async () => {
        if (synthesizedAudioCache.has(clip.id)) {
          const cachedUrl = synthesizedAudioCache.get(clip.id)!;
          clip.url = cachedUrl;
          resolve(cachedUrl);
          return;
        }

        const lowerTitle = (clip.title || '').toLowerCase();
        let generatedUrl = '';

        try {
          if (lowerTitle.includes('whoosh') || lowerTitle.includes('sub-drop') || clip.category === 'sfx') {
            const sfx = await generateSubDropAndWhoosh(clip.duration || 3.5);
            generatedUrl = sfx.url;
          } else {
            const soundtrack = await generateCinematicSoundtrack(clip.duration || 21.5);
            generatedUrl = soundtrack.url;
          }
        } catch {
          generatedUrl = '';
        }

        synthesizedAudioCache.set(clip.id, generatedUrl);
        clip.url = generatedUrl;
        resolve(generatedUrl);
      })
      .catch(() => {
        resolve('');
      });
  });
}

