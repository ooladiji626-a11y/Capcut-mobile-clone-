import React from 'react';
import { Undo2, Redo2, ArrowUpRight, ChevronDown, Sparkles, FolderArchive, ChevronLeft, Download, CheckCircle2, Loader2, Upload } from 'lucide-react';

interface EditorHeaderProps {
  projectTitle: string;
  onBackToHome?: () => void;
  onOpenExport: () => void;
  onOpenSmartHighlights?: () => void;
  onOpenAIEditor?: () => void;
  onOpenAssetBin?: () => void;
  assetCount?: number;
  onImportMedia?: (files: FileList | File[]) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  resolution: string;
  isStorageSaving?: boolean;
  onExportBackup?: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = React.memo(({
  projectTitle,
  onBackToHome,
  onOpenExport,
  onOpenSmartHighlights,
  onOpenAIEditor,
  onOpenAssetBin,
  assetCount = 0,
  onImportMedia,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  resolution,
  isStorageSaving = false,
  onExportBackup,
}) => {
  return (
    <header
      className="h-12 w-full bg-[#121212] border-b border-white/10 px-3 flex items-center justify-between z-40 shrink-0 select-none"
      id="editor-top-header"
    >
      {/* Left: Back to Home + Project title & App badge */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="p-1.5 -ml-1 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white flex items-center gap-1 transition-all active:scale-95 group shrink-0"
            title="Back to Home Dashboard"
            id="editor-back-to-home-btn"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-400 group-hover:text-white" />
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0">
              C
            </div>
          </button>
        )}
        {!onBackToHome && (
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0">
            C
          </div>
        )}
        <span className="text-xs font-semibold text-white truncate max-w-[70px] xs:max-w-[110px] sm:max-w-xs">
          {projectTitle}
        </span>

        {/* Persistent Storage Status Badge */}
        <div
          className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 border border-white/5 text-zinc-400 shrink-0"
          title="Automatic persistent local IndexedDB storage enabled"
        >
          {isStorageSaving ? (
            <>
              <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
              <span className="text-cyan-400 text-[10px]">Saving...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              <span className="text-zinc-400 text-[10px]">Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Undo & Redo */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 disabled:opacity-30 active:scale-90 transition-all"
          title="Undo (Ctrl+Z)"
          id="undo-btn"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 disabled:opacity-30 active:scale-90 transition-all"
          title="Redo (Ctrl+Y)"
          id="redo-btn"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Asset Bin, Import, AI Editor, Resolution, Export */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onOpenAssetBin && (
          <button
            onClick={onOpenAssetBin}
            className="h-7 px-2 sm:px-2.5 rounded-md bg-[#1d1d28] hover:bg-[#252535] border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all shadow-sm shrink-0 cursor-pointer"
            title="Open Asset Bin (Project Media Storage)"
            id="header-asset-bin-btn"
          >
            <FolderArchive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] font-bold hidden md:inline">Asset Bin</span>
            <span className="px-1 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[9px] sm:text-[10px] font-bold">
              {assetCount}
            </span>
          </button>
        )}

        {onImportMedia && (
          <label
            className="h-7 px-2 rounded-md bg-[#1d1d24] hover:bg-[#252530] border border-white/10 hover:border-cyan-500/40 text-zinc-200 text-xs font-semibold hidden xs:flex items-center gap-1 cursor-pointer active:scale-95 transition-all shrink-0"
            title="Import media files or .ZIP from your computer into the Asset Bin"
            id="header-import-zip-btn"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] font-medium hidden md:inline">Import</span>
            <input
              type="file"
              multiple
              accept="*/*,application/octet-stream,text/*,.srt,.vtt,.txt,audio/*,video/*,image/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.caf,.aiff,.aif,.wma,.opus,.m4r,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp4,.mov,.m4v,.webm,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.json,.zip,application/zip,application/x-zip-compressed,application/x-zip,multipart/x-zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onImportMedia(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </label>
        )}

        {onOpenAIEditor && (
          <button
            onClick={onOpenAIEditor}
            className="h-7 px-2 sm:px-2.5 rounded-md bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm shrink-0"
            title="Open Conversational AI Editor (Prompts & Instructions)"
            id="header-aieditor-btn"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
            <span className="text-[11px] font-bold hidden sm:inline">AI Prompt</span>
          </button>
        )}

        {onOpenSmartHighlights && (
          <button
            onClick={onOpenSmartHighlights}
            className="h-7 px-2.5 rounded-md bg-gradient-to-r from-rose-500/20 to-amber-500/20 hover:from-rose-500/30 hover:to-amber-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold hidden lg:flex items-center gap-1 active:scale-95 transition-all shadow-sm shrink-0"
            title="Auto-Cut Smart Highlights"
            id="header-autocut-btn"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="hidden sm:inline">Auto-Cut</span>
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1 bg-[#202020] px-2 py-1 rounded-md text-[11px] font-mono text-zinc-300 border border-white/10 shrink-0">
          <span>{resolution}</span>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </div>

        {onExportBackup && (
          <button
            onClick={onExportBackup}
            className="h-7 px-2 rounded-md bg-[#1d1d24] hover:bg-[#252530] border border-white/10 text-zinc-300 hover:text-white text-xs font-medium hidden md:flex items-center gap-1 active:scale-95 transition-all shrink-0"
            title="Export project backup archive with media files (.zip)"
            id="header-backup-btn"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] hidden md:inline">Backup</span>
          </button>
        )}

        {/* CapCut Signature Export Button - ALWAYS Pinned, Visible, and Fully Functional */}
        <button
          onClick={onOpenExport}
          className="h-7 px-3 rounded-md bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1 shadow-md transition-all shrink-0 cursor-pointer z-10"
          title="Export video project"
          id="header-export-btn"
        >
          <span>Export</span>
          <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </header>
  );
});

