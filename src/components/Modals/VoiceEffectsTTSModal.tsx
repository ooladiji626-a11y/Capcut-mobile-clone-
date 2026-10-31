import React, { useState } from 'react';
import {
  X,
  Check,
  Mic,
  Sparkles,
  Volume2,
  Play,
  Pause,
  Wand2,
  Flame,
  Music,
  Radio,
  Sliders,
  CheckCheck,
  Plus,
} from 'lucide-react';
import { AudioTrackClip, TTSVoice, VoiceEffect } from '../../types';
import { generateRealisticAudioWaveform } from '../../utils/audioWaveform';

interface VoiceEffectsTTSModalProps {
  isOpen: boolean;
  onClose: () => void;
  playheadTime: number;
  selectedAudioClip?: AudioTrackClip;
  onAddVoiceoverClip: (clip: AudioTrackClip) => void;
  onUpdateAudioClip: (id: string, updates: Partial<AudioTrackClip>) => void;
}

const TTS_VOICES: {
  id: TTSVoice;
  name: string;
  avatar: string;
  gender: string;
  accent: string;
  tone: string;
  sampleText: string;
  pitch: number;
  rate: number;
}[] = [
  {
    id: 'adam-documentary',
    name: 'Adam Documentary',
    avatar: '🎙️',
    gender: 'Male',
    accent: 'US Deep',
    tone: 'Authoritative, engaging, immersive cinematic storytelling',
    sampleText: 'In the heart of the deepest mountains, silence has its own story.',
    pitch: 0.85,
    rate: 0.95,
  },
  {
    id: 'rachel-storyteller',
    name: 'Rachel Storyteller',
    avatar: '✨',
    gender: 'Female',
    accent: 'US Warm',
    tone: 'Smooth, emotional, and captivating for long-form shorts',
    sampleText: 'Every detail in this frame reveals something hidden from the naked eye.',
    pitch: 1.1,
    rate: 1.0,
  },
  {
    id: 'marcus-deep-viral',
    name: 'Marcus Viral Hook',
    avatar: '🔥',
    gender: 'Male',
    accent: 'US Punchy',
    tone: 'High retention viral TikTok & Reels hook voice',
    sampleText: 'Nobody is talking about this secret trick, but you need to know.',
    pitch: 0.8,
    rate: 1.15,
  },
  {
    id: 'olivia-calm-british',
    name: 'Olivia British Calm',
    avatar: '🌿',
    gender: 'Female',
    accent: 'UK Royal',
    tone: 'Sophisticated, elegant, ambient documentary narration',
    sampleText: 'A delicate harmony between light, shadows, and pure nature.',
    pitch: 1.05,
    rate: 0.9,
  },
  {
    id: 'charlie-energetic',
    name: 'Charlie Hype',
    avatar: '⚡',
    gender: 'Male',
    accent: 'US Energetic',
    tone: 'Fast-paced vlog, gaming, and lifestyle energy',
    sampleText: 'Let’s jump right in and check out what happens next!',
    pitch: 1.2,
    rate: 1.25,
  },
  {
    id: 'serena-meditation',
    name: 'Serena Serene',
    avatar: '🧘‍♀️',
    gender: 'Female',
    accent: 'Neutral Soft',
    tone: 'Relaxing, whispery, mindful relaxation tone',
    sampleText: 'Take a slow deep breath, and let the moment take over.',
    pitch: 0.95,
    rate: 0.8,
  },
];

const VOICE_EFFECTS: {
  id: VoiceEffect;
  name: string;
  icon: string;
  category: string;
  description: string;
}[] = [
  {
    id: 'none',
    name: 'Original Clean',
    icon: '🎙️',
    category: 'Natural',
    description: 'Crisp studio voice with no modulation',
  },
  {
    id: 'deep-narrator',
    name: 'Deep Narrator',
    icon: '🎬',
    category: 'Cinematic',
    description: 'Bass-boosted movie trailer resonance',
  },
  {
    id: 'studio-mic',
    name: 'Studio Condenser',
    icon: '🎛️',
    category: 'Pro Audio',
    description: 'Warm broadcast compressor & de-esser',
  },
  {
    id: 'chipmunk',
    name: 'Chipmunk High',
    icon: '🐿️',
    category: 'Funny',
    description: 'High-pitched comedic cartoon pitch shift',
  },
  {
    id: 'robot',
    name: 'Cyber Robot',
    icon: '🤖',
    category: 'Sci-Fi',
    description: 'Metallic vocoder robotic modulation',
  },
  {
    id: 'megaphone',
    name: 'Megaphone PA',
    icon: '📢',
    category: 'Lo-Fi',
    description: 'Bandpass distortion with street siren acoustic',
  },
  {
    id: 'echo-cave',
    name: 'Echo Cave',
    icon: '🏔️',
    category: 'Ambient',
    description: 'Long stereo cavern delay and spatial reverb',
  },
  {
    id: 'radio-vintage',
    name: '1940s Vintage Radio',
    icon: '📻',
    category: 'Vintage',
    description: 'Warm analog harmonic crunch with tube noise',
  },
  {
    id: 'telephone',
    name: 'Phone Call',
    icon: '📞',
    category: 'Lo-Fi',
    description: 'Classic cellular narrow frequency band',
  },
];

const SFX_LIBRARY: {
  id: string;
  name: string;
  category: 'Cinematic' | 'Transitions' | 'UI' | 'Impact';
  duration: number;
  icon: string;
}[] = [
  { id: 'sfx-whoosh-fast', name: 'Fast Whip Whoosh', category: 'Transitions', duration: 0.8, icon: '💨' },
  { id: 'sfx-cinematic-braam', name: 'Cinematic Hans Braam', category: 'Impact', duration: 2.2, icon: '💥' },
  { id: 'sfx-camera-shutter', name: 'Vintage Camera Click', category: 'UI', duration: 0.6, icon: '📸' },
  { id: 'sfx-sub-bass-drop', name: 'Heavy Sub Bass Boom', category: 'Impact', duration: 1.8, icon: '💣' },
  { id: 'sfx-riser-tension', name: 'Dramatic Tension Riser', category: 'Cinematic', duration: 3.0, icon: '📈' },
  { id: 'sfx-glitch-digital', name: 'Cyber Cyber Glitch', category: 'Transitions', duration: 0.9, icon: '⚡' },
  { id: 'sfx-pop-bubble', name: 'Clean UI Pop Click', category: 'UI', duration: 0.4, icon: '✨' },
];

export const VoiceEffectsTTSModal: React.FC<VoiceEffectsTTSModalProps> = ({
  isOpen,
  onClose,
  playheadTime,
  selectedAudioClip,
  onAddVoiceoverClip,
  onUpdateAudioClip,
}) => {
  const [activeTab, setActiveTab] = useState<'tts' | 'effects' | 'sfx'>('tts');

  // TTS Generator State
  const [ttsScript, setTtsScript] = useState<string>(
    'In a world full of rapid distractions, taking a single moment to master your craft changes everything.'
  );
  const [selectedVoice, setSelectedVoice] = useState<TTSVoice>('adam-documentary');
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);

  // Voice Effect State for Selected Audio Clip
  const [selectedEffect, setSelectedEffect] = useState<VoiceEffect>(
    selectedAudioClip?.voiceEffect || 'none'
  );

  if (!isOpen) return null;

  // Real Speech Synthesis Preview
  const handlePreviewTTS = (textToSpeak?: string, voiceId?: TTSVoice) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    if (isPlayingPreview && !textToSpeak) {
      setIsPlayingPreview(false);
      return;
    }

    const voiceConfig = TTS_VOICES.find((v) => v.id === (voiceId || selectedVoice)) || TTS_VOICES[0];
    const text = textToSpeak || ttsScript;
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = voiceConfig.pitch;
    utterance.rate = voiceConfig.rate;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (voiceConfig.gender === 'Female') {
        const femaleVoice = voices.find((v) => /female|samantha|karen|victoria|zira|natural/i.test(v.name));
        if (femaleVoice) utterance.voice = femaleVoice;
      } else {
        const maleVoice = voices.find((v) => /male|daniel|george|alex|david|guy/i.test(v.name));
        if (maleVoice) utterance.voice = maleVoice;
      }
    }

    utterance.onend = () => setIsPlayingPreview(false);
    utterance.onerror = () => setIsPlayingPreview(false);

    setIsPlayingPreview(true);
    window.speechSynthesis.speak(utterance);
  };

  // Generate Voiceover and add onto audio track
  const handleGenerateAndAddVoiceover = () => {
    if (!ttsScript.trim()) return;
    const voiceConfig = TTS_VOICES.find((v) => v.id === selectedVoice) || TTS_VOICES[0];

    // Estimate duration based on word count: ~140 words per minute / rate
    const words = ttsScript.trim().split(/\s+/).length;
    const calculatedDuration = Math.max(1.5, Math.round((words / (2.4 * voiceConfig.rate)) * 10) / 10);

    const newClip: AudioTrackClip = {
      id: `voiceover-${Date.now()}`,
      title: `${voiceConfig.name} - Voiceover`,
      category: 'voiceover',
      ttsVoice: selectedVoice,
      transcript: ttsScript,
      startTime: Math.round(playheadTime * 10) / 10,
      duration: calculatedDuration,
      volume: 100,
      waveformData: generateRealisticAudioWaveform(calculatedDuration, 'speech'),
    };

    onAddVoiceoverClip(newClip);
    onClose();
  };

  // Add Sound Effect to timeline
  const handleAddSFX = (sfx: (typeof SFX_LIBRARY)[0]) => {
    const newClip: AudioTrackClip = {
      id: `sfx-${Date.now()}`,
      title: sfx.name,
      category: 'sfx',
      startTime: Math.round(playheadTime * 10) / 10,
      duration: sfx.duration,
      volume: 90,
      waveformData: generateRealisticAudioWaveform(sfx.duration, 'impact'),
    };

    onAddVoiceoverClip(newClip);
    onClose();
  };

  // Apply Voice Effect to selected audio clip
  const handleApplyVoiceEffect = () => {
    if (selectedAudioClip) {
      onUpdateAudioClip(selectedAudioClip.id, { voiceEffect: selectedEffect });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              <Mic className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Voiceover, SFX & Audio FX
              </h2>
              <p className="text-[10px] text-zinc-400 truncate max-w-[260px]">
                Insert at playhead <span className="font-mono text-emerald-400 font-bold">{playheadTime.toFixed(1)}s</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 bg-[#181818]">
          <button
            onClick={() => setActiveTab('tts')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'tts'
                ? 'text-emerald-300 border-b-2 border-emerald-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Voiceover
          </button>
          <button
            onClick={() => setActiveTab('effects')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'effects'
                ? 'text-emerald-300 border-b-2 border-emerald-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Voice Changers
          </button>
          <button
            onClick={() => setActiveTab('sfx')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'sfx'
                ? 'text-emerald-300 border-b-2 border-emerald-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            SFX Library
          </button>
        </div>

        {/* Tab 1: AI Text-to-Speech (TTS Voiceover) */}
        {activeTab === 'tts' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[46vh]">
            {/* Script Text Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-300 font-semibold flex items-center gap-1">
                  <Wand2 className="w-3.5 h-3.5 text-emerald-400" /> Script / Narration Prompt
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {ttsScript.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <textarea
                rows={3}
                value={ttsScript}
                onChange={(e) => setTtsScript(e.target.value)}
                placeholder="Type script for AI narrator to speak..."
                className="w-full bg-[#181818] border border-white/15 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 resize-none font-sans"
              />
            </div>

            {/* Voice Persona Picker */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-semibold block">Select Narrator Voice</span>
              <div className="grid grid-cols-2 gap-2">
                {TTS_VOICES.map((voice) => {
                  const isSelected = selectedVoice === voice.id;
                  return (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all relative active:scale-98 ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg text-white'
                          : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:bg-[#222]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{voice.avatar}</span>
                        <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-zinc-300">
                          {voice.accent}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <p className="text-xs font-bold truncate">{voice.name}</p>
                        <p className="text-[9px] text-zinc-400 line-clamp-1">{voice.tone}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice Preview Button */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handlePreviewTTS()}
                className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all active:scale-95 ${
                  isPlayingPreview
                    ? 'bg-emerald-500 text-black border-emerald-400 animate-pulse'
                    : 'bg-[#222] text-zinc-300 border-white/10 hover:bg-[#2a2a2a]'
                }`}
              >
                {isPlayingPreview ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                {isPlayingPreview ? 'Playing Preview...' : 'Listen Preview Voice'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Voice Effects / Modulation for Selected Audio */}
        {activeTab === 'effects' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[46vh]">
            <div className="text-xs text-zinc-400">
              {selectedAudioClip ? (
                <span>
                  Applying voice modulator to <span className="text-emerald-400 font-bold">{selectedAudioClip.title}</span>
                </span>
              ) : (
                <span>Choose a voice changer effect to apply to your clips:</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {VOICE_EFFECTS.map((eff) => {
                const isSelected = selectedEffect === eff.id;
                return (
                  <button
                    key={eff.id}
                    onClick={() => setSelectedEffect(eff.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-400 text-white font-bold ring-2 ring-emerald-400/40 shadow-lg'
                        : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:bg-[#222]'
                    }`}
                  >
                    <span className="text-2xl">{eff.icon}</span>
                    <span className="text-[11px] font-semibold truncate max-w-full">{eff.name}</span>
                    <span className="text-[8px] text-zinc-500 font-mono">{eff.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Cinematic & Viral SFX Library */}
        {activeTab === 'sfx' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[46vh]">
            <p className="text-xs text-zinc-400 pb-1">
              Tap any sound effect to instantly add it to your audio track:
            </p>
            <div className="space-y-1.5">
              {SFX_LIBRARY.map((sfx) => (
                <div
                  key={sfx.id}
                  className="bg-[#1c1c1c] border border-white/10 p-2.5 rounded-xl flex items-center justify-between hover:bg-[#242424] transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{sfx.icon}</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">{sfx.name}</h4>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {sfx.category} • {sfx.duration}s
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddSFX(sfx)}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500 hover:text-black text-emerald-300 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-[#181818] border-t border-white/10 flex items-center gap-2">
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-[#242424] text-zinc-300 text-xs font-semibold hover:bg-[#2c2c2c] active:scale-95 transition-all"
          >
            Cancel
          </button>
          {activeTab === 'tts' && (
            <button
              onClick={handleGenerateAndAddVoiceover}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all"
              id="generate-voiceover-btn"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Generate & Add Voiceover
            </button>
          )}
          {activeTab === 'effects' && (
            <button
              onClick={handleApplyVoiceEffect}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Apply Voice Changer
            </button>
          )}
          {activeTab === 'sfx' && (
            <div className="text-[10px] text-zinc-400 text-right flex-1">
              Select any SFX above to place at playhead
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
