import React, { useRef } from 'react';
import {
  Plus,
  Image as ImageIcon,
  Sparkles,
  FolderArchive,
  UploadCloud,
  Film,
  Zap,
  Wand2,
  ChevronRight,
  Video,
} from 'lucide-react';
import { motion } from 'motion/react';

interface HeroActionsProps {
  onNewProject: () => void;
  onEditPhoto: () => void;
  onOpenAIEditor: () => void;
  onImportMedia: (files: FileList | File[]) => void;
}

export const HeroActions: React.FC<HeroActionsProps> = ({
  onNewProject,
  onEditPhoto,
  onOpenAIEditor,
  onImportMedia,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onImportMedia(e.dataTransfer.files);
    }
  };

  return (
    <section className="w-full" id="hero-actions-section">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4">
        {/* PRIMARY HERO: NEW VIDEO / NEW PROJECT (Takes 6 cols on desktop) */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewProject}
          className="md:col-span-6 group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 p-[1.5px] cursor-pointer shadow-xl shadow-blue-900/20"
        >
          <div className="relative h-full w-full rounded-[14.5px] bg-gradient-to-br from-[#161622]/95 to-[#1c1d2e]/95 p-5 sm:p-6 flex flex-col justify-between overflow-hidden">
            {/* Ambient Background Glow Effect */}
            <div className="absolute -right-8 -top-8 w-44 h-44 bg-blue-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-400/30 transition-all duration-500" />
            <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/30 group-hover:shadow-cyan-400/40 transition-all">
                  <div className="w-full h-full bg-[#11111a] rounded-[14px] flex items-center justify-center">
                    <Plus className="w-7 h-7 text-cyan-300 group-hover:scale-110 transition-transform duration-200" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-bold text-blue-300 uppercase tracking-wide">
                      Primary
                    </span>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                      <Film className="w-3 h-3 text-cyan-400" /> Multi-Track
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                    New Project
                  </h2>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-white transition-all">
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <p className="text-xs text-zinc-300 max-w-[260px] sm:max-w-xs font-normal">
                Start from a blank multi-track timeline, import video clips, audio tracks, and keyframes.
              </p>
              <div className="px-3.5 py-1.5 rounded-xl bg-blue-600 group-hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all">
                <Video className="w-3.5 h-3.5" />
                <span>Create</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* SECONDARY ACTION 1: AI VIDEO EDITOR / PROMPT TO VIDEO (Takes 3 cols on desktop) */}
        <motion.div
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenAIEditor}
          className="md:col-span-3 group relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/30 via-purple-500/20 to-pink-500/20 p-[1.5px] cursor-pointer shadow-lg shadow-purple-900/10"
        >
          <div className="relative h-full w-full rounded-[14.5px] bg-[#171724]/95 p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/30 transition-all duration-500" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-purple-500 p-0.5 shadow-md shadow-cyan-500/20">
                  <div className="w-full h-full bg-[#12121d] rounded-[10px] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-[10px] font-bold text-cyan-300 uppercase">
                  AI Auto-Edit
                </span>
              </div>

              <h3 className="text-base font-black text-white tracking-tight">
                AI Video Editor
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                Prompt-to-edit, auto-match visual assets, and sync narration cadences.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-cyan-300 font-semibold group-hover:text-cyan-200">
              <span className="flex items-center gap-1">
                <Wand2 className="w-3.5 h-3.5" /> Prompt Studio
              </span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </motion.div>

        {/* SECONDARY ACTION 2: EDIT PHOTO & IMPORT (Takes 3 cols on desktop) */}
        <div className="md:col-span-3 flex flex-col gap-3">
          {/* Edit Photo Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onEditPhoto}
            className="flex-1 group relative overflow-hidden rounded-2xl bg-[#1a1a26] hover:bg-[#202030] border border-white/10 hover:border-emerald-500/30 p-3.5 sm:p-4 cursor-pointer transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <ImageIcon className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Edit Photo
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Cutout, crop ratios & filters
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-transform" />
          </motion.div>

          {/* Import Media / ZIP Dropzone Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex-1 group relative overflow-hidden rounded-2xl bg-[#1a1a26] hover:bg-[#202030] border border-dashed border-white/15 hover:border-blue-400/50 p-3.5 sm:p-4 cursor-pointer transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <FolderArchive className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span>Import Media</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">
                    ZIP / Files
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Videos, audio tracks, archives
                </p>
              </div>
            </div>
            <UploadCloud className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 transition-colors" />

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*,application/octet-stream,text/*,.srt,.vtt,.txt,audio/*,video/*,image/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.caf,.aiff,.aif,.wma,.opus,.m4r,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp4,.mov,.m4v,.webm,.jpg,.jpeg,.png,.webp,.gif,.zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onImportMedia(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
