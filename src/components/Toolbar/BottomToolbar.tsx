import React from 'react';
import { ActiveTool, AspectRatio } from '../../types';
import {
  Scissors,
  Music,
  Type,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Crop,
  ChevronLeft,
  Wand2,
  Trash2,
  Copy,
  Gauge,
  Volume2,
  Play,
  Plus,
  Mic,
  Smile,
  Split as SplitIcon,
  Subtitles,
  Star,
  Film,
  Sparkle,
  Upload,
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  FolderArchive,
  ArrowUpRight,
} from 'lucide-react';

interface BottomToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  onOpenAssetBin?: () => void;
  assetCount?: number;
  // Edit Actions
  onSplitClipAtPlayhead: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onOpenSpeedModal: () => void;
  onOpenVolumeModal: () => void;
  onOpenFilterAdjustModal: () => void;
  onOpenChromaKeyModal?: () => void;
  onOpenVideoEffectsModal?: () => void;
  onOpenPIPBlendMaskModal?: () => void;
  selectedClipId: string | null;
  selectedOverlayId?: string | null;
  selectedAudioId?: string | null;
  selectedCaptionId?: string | null;
  onDeselectAll?: () => void;
  // Keyframe Actions
  hasKeyframeAtPlayhead?: boolean;
  onToggleKeyframe?: () => void;
  onOpenKeyframeModal?: () => void;
  // Text Actions
  onOpenAutoCaptions: () => void;
  onOpenSmartHighlightsModal?: () => void;
  onAddTextClip: () => void;
  // Audio Actions
  onAddAudioClip: () => void;
  onUploadAudioFile?: (file: File) => void;
  onOpenVoiceEffectsTTSModal?: () => void;
  onOpenBeatDetectorModal?: () => void;
  // Overlay Actions
  onAddOverlayClip: () => void;
  // Chart Actions
  onOpenChartModal?: (presetType?: 'bar' | 'line' | 'pie' | 'metric' | 'progress') => void;
  isChartSelected?: boolean;
  onEditSelectedChart?: () => void;
  // AI Actions
  onOpenAIEditor?: () => void;
  // Export Action
  onOpenExport?: () => void;
  // Ratio
  aspectRatio: AspectRatio;
  onSelectAspectRatio: (ratio: AspectRatio) => void;
  // Sound & Motion
  isAutoKenBurnsActive?: boolean;
  onToggleAutoKenBurns?: () => void;
  isAutoDuckingActive?: boolean;
  onToggleAutoDucking?: () => void;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = React.memo(({
  activeTool,
  setActiveTool,
  onOpenAssetBin,
  assetCount = 0,
  onOpenExport,
  onSplitClipAtPlayhead,
  onDeleteSelected,
  onDuplicateSelected,
  onOpenSpeedModal,
  onOpenVolumeModal,
  onOpenFilterAdjustModal,
  onOpenChromaKeyModal,
  onOpenVideoEffectsModal,
  onOpenPIPBlendMaskModal,
  selectedClipId,
  selectedOverlayId,
  selectedAudioId,
  selectedCaptionId,
  onDeselectAll,
  hasKeyframeAtPlayhead = false,
  onToggleKeyframe,
  onOpenKeyframeModal,
  onOpenAutoCaptions,
  onOpenSmartHighlightsModal,
  onAddTextClip,
  onAddAudioClip,
  onUploadAudioFile,
  onOpenVoiceEffectsTTSModal,
  onOpenBeatDetectorModal,
  onAddOverlayClip,
  onOpenChartModal,
  isChartSelected = false,
  onEditSelectedChart,
  onOpenAIEditor,
  aspectRatio,
  onSelectAspectRatio,
  isAutoKenBurnsActive = true,
  onToggleAutoKenBurns,
  isAutoDuckingActive = true,
  onToggleAutoDucking,
}) => {
  // If an Overlay is selected (Screenshot 2)
  if (selectedOverlayId) {
    return (
      <div className="w-full bg-[#181818] border-t border-white/10 shrink-0 z-40 select-none pb-safe">
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          {/* Back button */}
          <button
            onClick={() => onDeselectAll && onDeselectAll()}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
            title="Deselect Overlay"
            id="overlay-deselect-back"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            {isChartSelected && (
              <ToolbarButton
                icon={<BarChart3 className="w-5 h-5 text-cyan-400" />}
                label="Edit Chart"
                onClick={onEditSelectedChart || (() => {})}
                highlight
                badge="Data"
                id="overlay-edit-chart-sub"
              />
            )}
            <ToolbarButton
              icon={<Plus className="w-5 h-5 text-white" />}
              label="Add overlay"
              onClick={onAddOverlayClip}
              id="overlay-add-sub"
            />
            <ToolbarButton
              icon={<SplitIcon className="w-5 h-5 text-white" />}
              label="Split"
              onClick={onSplitClipAtPlayhead}
              id="overlay-split-sub"
            />
            <ToolbarButton
              icon={<Layers className="w-5 h-5 text-white" />}
              label="Splice"
              onClick={onOpenPIPBlendMaskModal || (() => {})}
              id="overlay-splice-sub"
            />
            <ToolbarButton
              icon={<Play className="w-5 h-5 text-white" />}
              label="Animations"
              onClick={onOpenPIPBlendMaskModal || (() => {})}
              id="overlay-anim-sub"
            />
            <ToolbarButton
              icon={<Trash2 className="w-5 h-5 text-rose-400" />}
              label="Delete"
              onClick={onDeleteSelected}
              id="overlay-del-sub"
            />
          </div>
        </div>
      </div>
    );
  }

  // If an Audio Clip is selected (Screenshot 4)
  if (selectedAudioId) {
    return (
      <div className="w-full bg-[#181818] border-t border-white/10 shrink-0 z-40 select-none pb-safe">
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          {/* Back button */}
          <button
            onClick={() => onDeselectAll && onDeselectAll()}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
            title="Deselect Audio"
            id="audio-deselect-back"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            <ToolbarButton
              icon={<Star className="w-5 h-5 text-amber-300" />}
              label="Sound FX"
              onClick={onOpenVoiceEffectsTTSModal || onAddAudioClip}
              id="audio-sfx-sub"
            />
            <ToolbarButton
              icon={<SplitIcon className="w-5 h-5 text-white" />}
              label="Split"
              onClick={onSplitClipAtPlayhead}
              id="audio-split-sub"
            />
            <ToolbarButton
              icon={<Volume2 className="w-5 h-5 text-white" />}
              label="Volume"
              onClick={onOpenVolumeModal}
              id="audio-vol-sub"
            />
            <ToolbarButton
              icon={<Copy className="w-5 h-5 text-white" />}
              label="Duplicate"
              onClick={onDuplicateSelected}
              id="audio-dup-sub"
            />
            <ToolbarButton
              icon={<Trash2 className="w-5 h-5 text-rose-400" />}
              label="Delete"
              onClick={onDeleteSelected}
              id="audio-del-sub"
            />
          </div>
        </div>
      </div>
    );
  }

  // If a Main Video Clip is selected
  if (selectedClipId) {
    return (
      <div className="w-full bg-[#181818] border-t border-white/10 shrink-0 z-40 select-none pb-safe">
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          {/* Back button */}
          <button
            onClick={() => onDeselectAll && onDeselectAll()}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
            title="Deselect Video"
            id="video-deselect-back"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            <ToolbarButton
              icon={<SplitIcon className="w-5 h-5 text-white" />}
              label="Split"
              onClick={onSplitClipAtPlayhead}
              id="video-split-sub"
            />
            <ToolbarButton
              icon={<Gauge className="w-5 h-5 text-white" />}
              label="Speed"
              onClick={onOpenSpeedModal}
              id="video-speed-sub"
            />
            <ToolbarButton
              icon={<Volume2 className="w-5 h-5 text-white" />}
              label="Volume"
              onClick={onOpenVolumeModal}
              id="video-volume-sub"
            />
            <ToolbarButton
              icon={<Sparkles className="w-5 h-5 text-purple-400" />}
              label="Effects"
              onClick={onOpenVideoEffectsModal || (() => {})}
              id="video-effects-sub"
            />
            <ToolbarButton
              icon={<SlidersHorizontal className="w-5 h-5 text-amber-300" />}
              label="Filters"
              onClick={onOpenFilterAdjustModal}
              id="video-filters-sub"
            />
            <ToolbarButton
              icon={<Copy className="w-5 h-5 text-white" />}
              label="Duplicate"
              onClick={onDuplicateSelected}
              id="video-duplicate-sub"
            />
            <ToolbarButton
              icon={<Trash2 className="w-5 h-5 text-rose-400" />}
              label="Delete"
              onClick={onDeleteSelected}
              id="video-delete-sub"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-[#181818] border-t border-white/10 shrink-0 z-40 select-none pb-safe"
      id="bottom-toolbar-container"
    >
      {/* 1. ROOT MENU */}
      {activeTool === 'root' && (
        <div className="h-16 px-3 flex items-center justify-around overflow-x-auto no-scrollbar gap-1">
          {/* AI Prompt / AI Editor Button */}
          <ToolbarButton
            icon={<Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />}
            label="AI Prompt"
            onClick={onOpenAIEditor || (() => {})}
            badge="AI"
            highlight
            id="toolbar-ai-btn"
          />

          {/* Asset Bin / Media Storage */}
          {onOpenAssetBin && (
            <ToolbarButton
              icon={<FolderArchive className="w-5 h-5 text-cyan-400" />}
              label="Asset Bin"
              onClick={onOpenAssetBin}
              badge={assetCount > 0 ? String(assetCount) : undefined}
              id="toolbar-asset-bin-btn"
            />
          )}

          {/* Edit (Scissors) */}
          <ToolbarButton
            icon={<Scissors className="w-5 h-5 text-white" />}
            label="Edit"
            onClick={() => setActiveTool('edit')}
            id="toolbar-edit-btn"
          />

          {/* Audio (Music) */}
          <ToolbarButton
            icon={<Music className="w-5 h-5 text-white" />}
            label="Audio"
            onClick={() => setActiveTool('audio')}
            id="toolbar-audio-btn"
          />

          {/* Text (T) */}
          <ToolbarButton
            icon={<Type className="w-5 h-5 text-white" />}
            label="Text"
            onClick={() => setActiveTool('text')}
            id="toolbar-text-btn"
          />

          {/* Chart (BarChart3) */}
          <ToolbarButton
            icon={<BarChart3 className="w-5 h-5 text-cyan-400" />}
            label="Chart"
            onClick={() => setActiveTool('chart')}
            badge="NEW"
            highlight
            id="toolbar-chart-btn"
          />

          {/* Effects (Star with shine) */}
          <ToolbarButton
            icon={<Star className="w-5 h-5 text-white" />}
            label="Effects"
            onClick={onOpenVideoEffectsModal || (() => {})}
            id="toolbar-effects-btn"
          />

          {/* Overlay (Picture in picture) */}
          <ToolbarButton
            icon={<Film className="w-5 h-5 text-white" />}
            label="Overlay"
            onClick={() => setActiveTool('overlay')}
            id="toolbar-overlay-btn"
          />

          {/* Captions (Subtitles card) */}
          <ToolbarButton
            icon={<Subtitles className="w-5 h-5 text-white" />}
            label="Captions"
            onClick={onOpenAutoCaptions}
            id="toolbar-captions-btn"
          />

          {/* Export Action */}
          {onOpenExport && (
            <ToolbarButton
              icon={<ArrowUpRight className="w-5 h-5 text-blue-400" />}
              label="Export"
              onClick={onOpenExport}
              highlight
              badge="HD"
              id="toolbar-export-btn"
            />
          )}
        </div>
      )}

      {/* 2. TEXT NESTED MENU */}
      {activeTool === 'text' && (
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <button
            onClick={() => setActiveTool('root')}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
            id="back-from-text-btn"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            <ToolbarButton
              icon={<Sparkles className="w-5 h-5 text-amber-300" />}
              label="Auto-Captions"
              onClick={onOpenAutoCaptions}
              badge="AI"
              highlight
              id="subtool-auto-captions-btn"
            />
            <ToolbarButton
              icon={<Plus className="w-5 h-5 text-white" />}
              label="Add text"
              onClick={onAddTextClip}
              id="subtool-add-text-btn"
            />
            <ToolbarButton
              icon={<Sparkle className="w-5 h-5 text-cyan-300" />}
              label="Templates"
              onClick={onAddTextClip}
              id="subtool-templates-btn"
            />
            <ToolbarButton
              icon={<Smile className="w-5 h-5 text-white" />}
              label="Stickers"
              onClick={onAddOverlayClip}
              id="subtool-stickers-btn"
            />
          </div>
        </div>
      )}

      {/* 3. EDIT NESTED MENU */}
      {activeTool === 'edit' && (
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <button
            onClick={() => setActiveTool('root')}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
            id="back-from-edit-btn"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            <ToolbarButton
              icon={<SplitIcon className="w-5 h-5 text-white" />}
              label="Split"
              onClick={onSplitClipAtPlayhead}
              id="subtool-split-btn"
            />
            <ToolbarButton
              icon={<Gauge className="w-5 h-5 text-white" />}
              label="Speed"
              onClick={onOpenSpeedModal}
              id="subtool-speed-btn"
            />
            <ToolbarButton
              icon={<Volume2 className="w-5 h-5 text-white" />}
              label="Volume"
              onClick={onOpenVolumeModal}
              id="subtool-volume-btn"
            />
            <ToolbarButton
              icon={<Sparkles className="w-5 h-5 text-purple-400" />}
              label="Effects"
              onClick={onOpenVideoEffectsModal || (() => {})}
              id="subtool-effects-btn"
            />
            <ToolbarButton
              icon={<SlidersHorizontal className="w-5 h-5 text-amber-300" />}
              label="Filters"
              onClick={onOpenFilterAdjustModal}
              id="subtool-filters-btn"
            />
            <ToolbarButton
              icon={<Crop className="w-5 h-5 text-white" />}
              label="Ratio"
              onClick={() => setActiveTool('ratio')}
              id="subtool-ratio-btn"
            />
            {onToggleAutoKenBurns && (
              <ToolbarButton
                icon={<Wand2 className={`w-5 h-5 ${isAutoKenBurnsActive ? 'text-cyan-400' : 'text-zinc-400'}`} />}
                label={isAutoKenBurnsActive ? 'Motion: ON' : 'Ken Burns'}
                onClick={onToggleAutoKenBurns}
                highlight={isAutoKenBurnsActive}
                id="subtool-ken-burns-btn"
              />
            )}
          </div>
        </div>
      )}

      {/* 4. AUDIO NESTED MENU */}
      {activeTool === 'audio' && (
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <button
            onClick={() => setActiveTool('root')}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
            id="back-from-audio-btn"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            <ToolbarButton
              icon={<Music className="w-5 h-5 text-cyan-300" />}
              label="Sounds"
              onClick={onAddAudioClip}
              id="subtool-sounds-btn"
            />
            {onUploadAudioFile && (
              <label
                className="flex flex-col items-center justify-center min-w-[54px] h-14 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer select-none"
                id="subtool-upload-audio-btn"
                title="Import audio file (MP3, WAV, M4A)"
              >
                <Upload className="w-5 h-5 text-emerald-400" />
                <span className="text-[10px] font-medium tracking-tight mt-1 text-center truncate max-w-[58px]">
                  Import
                </span>
                <input
                  type="file"
                  multiple
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.caf,.aiff,.aif,.wma,.opus,.m4r,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/flac,audio/x-aiff,*/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      Array.from(files).forEach((file) => onUploadAudioFile(file));
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            )}
            <ToolbarButton
              icon={<Star className="w-5 h-5 text-amber-300" />}
              label="Sound FX"
              onClick={onOpenVoiceEffectsTTSModal || onAddAudioClip}
              id="subtool-sfx-btn"
            />
            <ToolbarButton
              icon={<Mic className="w-5 h-5 text-emerald-400" />}
              label="Voiceover"
              onClick={onOpenVoiceEffectsTTSModal || (() => {})}
              id="subtool-voiceover-btn"
            />
            <ToolbarButton
              icon={<Sparkles className="w-5 h-5 text-rose-400" />}
              label="Beats"
              onClick={onOpenBeatDetectorModal || (() => {})}
              id="subtool-beats-btn"
            />
            {onToggleAutoDucking && (
              <ToolbarButton
                icon={<Volume2 className={`w-5 h-5 ${isAutoDuckingActive ? 'text-emerald-400' : 'text-zinc-400'}`} />}
                label={isAutoDuckingActive ? 'Duck: ON' : 'Auto-Duck'}
                onClick={onToggleAutoDucking}
                highlight={isAutoDuckingActive}
                id="subtool-autoduck-btn"
              />
            )}
          </div>
        </div>
      )}

      {/* 5. OVERLAY NESTED MENU */}
      {activeTool === 'overlay' && (
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <button
            onClick={() => setActiveTool('root')}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            <ToolbarButton
              icon={<Plus className="w-5 h-5 text-white" />}
              label="Add overlay"
              onClick={onAddOverlayClip}
            />
            <ToolbarButton
              icon={<Layers className="w-5 h-5 text-emerald-400" />}
              label="Blend & Mask"
              onClick={onOpenPIPBlendMaskModal || (() => {})}
            />
          </div>
        </div>
      )}

      {/* 6. RATIO NESTED MENU */}
      {activeTool === 'ratio' && (
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <button
            onClick={() => setActiveTool('root')}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            {(['9:16', '16:9', '1:1', '4:5'] as AspectRatio[]).map((r) => (
              <button
                key={r}
                onClick={() => onSelectAspectRatio(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  aspectRatio === r
                    ? 'bg-white text-zinc-950 shadow-md ring-2 ring-white'
                    : 'bg-[#252525] text-zinc-300 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}

            {onToggleAutoKenBurns && (
              <button
                onClick={onToggleAutoKenBurns}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                  isAutoKenBurnsActive
                    ? 'bg-cyan-500 text-zinc-950 shadow-md ring-2 ring-cyan-400'
                    : 'bg-[#252525] text-zinc-300 hover:text-white'
                }`}
                title="Toggle Auto Ken Burns alternating zooms & pans"
                id="ratio-subtool-kenburns-btn"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Motion {isAutoKenBurnsActive ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 7. CHART NESTED MENU */}
      {activeTool === 'chart' && (
        <div className="h-16 px-3 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <button
            onClick={() => setActiveTool('root')}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 shrink-0"
            id="back-from-chart-btn"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 justify-around">
            <ToolbarButton
              icon={<SlidersHorizontal className="w-5 h-5 text-cyan-400" />}
              label="Studio"
              onClick={() => onOpenChartModal && onOpenChartModal()}
              highlight
              badge="Pro"
              id="subtool-chart-studio-btn"
            />
            <ToolbarButton
              icon={<BarChart3 className="w-5 h-5 text-emerald-400" />}
              label="Bar Chart"
              onClick={() => onOpenChartModal && onOpenChartModal('bar')}
              id="subtool-chart-bar-btn"
            />
            <ToolbarButton
              icon={<TrendingUp className="w-5 h-5 text-cyan-300" />}
              label="Line Trend"
              onClick={() => onOpenChartModal && onOpenChartModal('line')}
              id="subtool-chart-line-btn"
            />
            <ToolbarButton
              icon={<PieChartIcon className="w-5 h-5 text-purple-400" />}
              label="Pie / Donut"
              onClick={() => onOpenChartModal && onOpenChartModal('pie')}
              id="subtool-chart-pie-btn"
            />
            <ToolbarButton
              icon={<Sparkles className="w-5 h-5 text-amber-300" />}
              label="Metric Stat"
              onClick={() => onOpenChartModal && onOpenChartModal('metric')}
              id="subtool-chart-metric-btn"
            />
            <ToolbarButton
              icon={<Gauge className="w-5 h-5 text-rose-400" />}
              label="Progress"
              onClick={() => onOpenChartModal && onOpenChartModal('progress')}
              id="subtool-chart-progress-btn"
            />
          </div>
        </div>
      )}
    </div>
  );
});

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
  badge?: string;
  disabled?: boolean;
  id?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  onClick,
  highlight,
  badge,
  disabled,
  id,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative min-w-[52px] h-13 rounded-xl flex flex-col items-center justify-center gap-1 px-1 transition-all active:scale-90 ${
        disabled
          ? 'opacity-30 cursor-not-allowed'
          : highlight
          ? 'text-amber-300 hover:text-amber-200'
          : 'text-zinc-200 hover:text-white'
      }`}
      id={id}
    >
      {badge && (
        <span className="absolute 0 right-0 bg-amber-400 text-zinc-950 text-[7.5px] font-extrabold px-1 rounded-full uppercase leading-tight shadow">
          {badge}
        </span>
      )}
      <div className="shrink-0">{icon}</div>
      <span className="text-[11px] font-medium tracking-tight truncate max-w-[62px] leading-none text-zinc-200">
        {label}
      </span>
    </button>
  );
};
