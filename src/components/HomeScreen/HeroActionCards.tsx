import React, { useRef, useState } from 'react';
import { Plus, Image as ImageIcon, FolderArchive, Sparkles, Upload, ArrowRight, Loader2, Wand2 } from 'lucide-react';
import { processUploadFilesOrZips } from '../../utils/zipHandler';
import { ProjectAsset, CaptionClip } from '../../types';

interface HeroActionCardsProps {
  onNewVideo: () => void;
  onEditPhoto: () => void;
  onOpenAIEditor: () => void;
  onImportZipSuccess: (data: {
    assets: ProjectAsset[];
    scriptText?: string;
    subtitleCaptions?: CaptionClip[];
    zipName: string;
    totalFiles: number;
    supportedAssetsCount: number;
  }) => void;
}

export const HeroActionCards: React.FC<HeroActionCardsProps> = ({
  onNewVideo,
  onEditPhoto,
  onOpenAIEditor,
  onImportZipSuccess,
}) => {
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [isUnpackingZip, setIsUnpackingZip] = useState<boolean>(false);
  const [unpackStatusText, setUnpackStatusText] = useState<string>('');

  const handleZipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUnpackingZip(true);
      setUnpackStatusText('Reading ZIP archive...');

      const result = await processUploadFilesOrZips(files, (status) => {
        setUnpackStatusText(status);
      });

      const totalFilesCount = result.zipSummaries.reduce((sum, z) => sum + z.count, 0) || result.assets.length;
      const supportedCount = result.assets.length + (result.scriptText ? 1 : 0) + (result.subtitleCaptions?.length ? 1 : 0);

      onImportZipSuccess({
        assets: result.assets,
        scriptText: result.scriptText,
        subtitleCaptions: result.subtitleCaptions,
        zipName: files[0]?.name || 'Imported_Archive.zip',
        totalFiles: totalFilesCount,
        supportedAssetsCount: supportedCount,
      });
    } catch (err: any) {
      console.error('Failed to unpack ZIP archive:', err);
      setUnpackStatusText('Error unpacking archive. Please use a valid .zip file.');
      setTimeout(() => setUnpackStatusText(''), 4000);
    } finally {
      setIsUnpackingZip(false);
      setUnpackStatusText('');
      if (e.target) e.target.value = '';
    }
  };

  return (
    <section className="w-full select-none" id="home-hero-actions">
      {/* Hidden File Input for Audio, Media, SRT and ZIP */}
      <input
        ref={zipInputRef}
        type="file"
        multiple
        accept="*/*,application/octet-stream,text/*,.srt,.vtt,.txt,audio/*,video/*,image/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.caf,.aiff,.aif,.wma,.opus,.m4r,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/flac,audio/x-aiff,.zip,application/zip,application/x-zip-compressed,application/x-zip,multipart/x-zip"
        className="hidden"
        onChange={handleZipFileChange}
      />

      {/* Main Large Action: New Project */}
      <div className="relative mb-3 group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-3xl opacity-40 group-hover:opacity-75 blur-md transition duration-300 pointer-events-none" />
        <button
          onClick={onNewVideo}
          className="relative w-full h-32 sm:h-36 rounded-2xl bg-gradient-to-br from-[#1b2234] via-[#161a29] to-[#12141e] border border-blue-500/30 hover:border-blue-400/60 p-4 sm:p-5 flex items-center justify-between text-left overflow-hidden transition-all active:scale-[0.99] shadow-xl"
          id="btn-new-video-hero"
        >
          {/* Background Ambient Glow & Motif */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 right-24 w-32 h-32 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />

          {/* Left info */}
          <div className="flex items-center gap-4 z-10">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/40 ring-4 ring-white/10 group-hover:scale-105 transition-transform shrink-0">
              <Plus className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">New Project</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  START
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium line-clamp-1">
                Create with timeline, auto-captions & keyframes
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> 9:16 & 16:9
                </span>
                <span>•</span>
                <span>4K 60FPS</span>
                <span>•</span>
                <span>Auto-Beat</span>
              </div>
            </div>
          </div>

          {/* Right Arrow indicator */}
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-white/5 border border-white/10 items-center justify-center text-zinc-300 group-hover:bg-blue-600 group-hover:text-white transition-all z-10">
            <ArrowRight className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Secondary Row: Import ZIP, AI Video Editor, Edit Photo */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* 1. Import Media Button (Audio, Video, Images, or ZIP) with Progress */}
        <button
          onClick={() => zipInputRef.current?.click()}
          disabled={isUnpackingZip}
          className="relative h-24 sm:h-28 rounded-2xl bg-gradient-to-br from-[#16201e] to-[#121616] border border-emerald-500/30 hover:border-emerald-400/60 p-3 flex flex-col justify-between text-left overflow-hidden group transition-all active:scale-[0.98] shadow-md"
          id="btn-import-zip-hero"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              {isUnpackingZip ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
              ) : (
                <FolderArchive className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              )}
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 uppercase">
              AUDIO/ZIP
            </span>
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold text-white block leading-tight">
              {isUnpackingZip ? 'Importing...' : 'Import Media'}
            </span>
            <span className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
              {isUnpackingZip ? unpackStatusText : 'Audio, video or ZIP'}
            </span>
          </div>
        </button>

        {/* 2. AI Video Editor / AutoCut Studio */}
        <button
          onClick={onOpenAIEditor}
          className="relative h-24 sm:h-28 rounded-2xl bg-gradient-to-br from-[#201826] to-[#16121c] border border-purple-500/30 hover:border-purple-400/60 p-3 flex flex-col justify-between text-left overflow-hidden group transition-all active:scale-[0.98] shadow-md"
          id="btn-ai-editor-hero"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-300 animate-pulse" />
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 uppercase">
              AI
            </span>
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold text-white block leading-tight">
              AI Video Editor
            </span>
            <span className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
              Script to video & chat
            </span>
          </div>
        </button>

        {/* 3. Edit Photo / Cover */}
        <button
          onClick={onEditPhoto}
          className="relative h-24 sm:h-28 rounded-2xl bg-gradient-to-br from-[#1c1c24] to-[#14141a] border border-white/10 hover:border-white/20 p-3 flex flex-col justify-between text-left overflow-hidden group transition-all active:scale-[0.98] shadow-md"
          id="btn-edit-photo-hero"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-zinc-200 group-hover:scale-105 transition-transform">
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 text-zinc-300 uppercase">
              IMAGE
            </span>
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold text-white block leading-tight">
              Edit Photo
            </span>
            <span className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
              Thumbnails & LUTs
            </span>
          </div>
        </button>
      </div>

      {/* Unpacking Overlay Toast if actively extracting */}
      {isUnpackingZip && (
        <div className="mt-3 p-3 rounded-xl bg-[#16201e] border border-emerald-500/40 flex items-center gap-3 animate-pulse">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          <div className="text-xs text-emerald-200 font-medium truncate">
            {unpackStatusText || 'Extracting video clips, audio tracks, and narration scripts...'}
          </div>
        </div>
      )}
    </section>
  );
};
