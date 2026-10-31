import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FolderArchive,
  FolderPlus,
  Upload,
  Plus,
  Trash2,
  Search,
  Filter,
  Clock,
  HardDrive,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  Check,
  Copy,
  X,
  ChevronDown,
  Play,
  Pause,
  AlertTriangle,
  Grid,
  List,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ProjectAsset, VideoClip, AudioTrackClip } from '../../types';

interface AssetBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: ProjectAsset[];
  onImportFiles?: (files: FileList | File[]) => void;
  onUploadFiles?: (files: FileList | File[]) => void;
  onDeleteAsset: (assetId: string) => void;
  onAddToTimeline: (asset: ProjectAsset) => void;
  // Timeline references for usage detection and deletion safety
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  isImporting?: boolean;
  isUploading?: boolean;
  importProgressText?: string;
  uploadProgressText?: string;
}

type FilterType = 'all' | 'image' | 'video' | 'audio' | 'text';
type SortType = 'newest' | 'oldest' | 'name' | 'duration' | 'size';

export const AssetBinModal: React.FC<AssetBinModalProps> = ({
  isOpen,
  onClose,
  assets,
  onImportFiles,
  onUploadFiles,
  onDeleteAsset,
  onAddToTimeline,
  videoClips,
  audioClips,
  isImporting = false,
  isUploading = false,
  importProgressText = '',
  uploadProgressText = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<ProjectAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [itemsToShow, setItemsToShow] = useState<number>(60);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const effectiveImporting = isImporting || isUploading;
  const effectiveProgressText = importProgressText || uploadProgressText || '';

  const handleFilesImport = (files: FileList | File[]) => {
    if (onImportFiles) {
      onImportFiles(files);
    } else if (onUploadFiles) {
      onUploadFiles(files);
    }
  };

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (assetToDelete) {
          setAssetToDelete(null);
        } else if (selectedAssetId) {
          setSelectedAssetId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, assetToDelete, selectedAssetId, onClose]);

  // Reset pagination on filter change
  useEffect(() => {
    setItemsToShow(60);
  }, [searchQuery, selectedType, sortBy]);

  // Auto-select first asset if none selected
  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [selectedAssetId, assets]);

  // Check how many times an asset is referenced on the timeline
  const getTimelineUsageCount = (asset: ProjectAsset): number => {
    let count = 0;
    for (const clip of videoClips) {
      if (clip.assetId === asset.id || clip.sourceAssetId === asset.id || (clip.url && clip.url === asset.url)) {
        count++;
      }
    }
    for (const clip of audioClips) {
      if (clip.url === asset.url || clip.title === asset.name) {
        count++;
      }
    }
    return count;
  };

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let list = assets;

    // Type filter
    if (selectedType !== 'all') {
      list = list.filter((a) => a.type === selectedType);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((a) => {
        const matchName = a.name.toLowerCase().includes(q);
        const matchTag = a.tags?.some((t) => t.toLowerCase().includes(q));
        const matchDesc = a.analysis?.description?.toLowerCase().includes(q);
        return matchName || matchTag || matchDesc;
      });
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortBy === 'newest') {
        return (b.uploadedAt || 0) - (a.uploadedAt || 0);
      }
      if (sortBy === 'oldest') {
        return (a.uploadedAt || 0) - (b.uploadedAt || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'duration') {
        return (b.duration || 0) - (a.duration || 0);
      }
      if (sortBy === 'size') {
        return (b.size || b.file?.size || 0) - (a.size || a.file?.size || 0);
      }
      return 0;
    });
  }, [assets, selectedType, searchQuery, sortBy]);

  // Counts for filter pills
  const counts = useMemo(() => {
    return {
      all: assets.length,
      image: assets.filter((a) => a.type === 'image').length,
      video: assets.filter((a) => a.type === 'video').length,
      audio: assets.filter((a) => a.type === 'audio').length,
      text: assets.filter((a) => a.type === 'text').length,
    };
  }, [assets]);

  // Paginated/windowed list for performance
  const visibleAssets = useMemo(() => {
    return filteredAssets.slice(0, itemsToShow);
  }, [filteredAssets, itemsToShow]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesImport(e.dataTransfer.files);
    }
  };

  // Copy Asset ID helper
  const handleCopyId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Safe delete initiation
  const handleInitiateDelete = (asset: ProjectAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const usageCount = getTimelineUsageCount(asset);
    if (usageCount > 0) {
      setAssetToDelete(asset);
    } else {
      onDeleteAsset(asset.id);
      if (selectedAssetId === asset.id) {
        setSelectedAssetId(null);
      }
      setStatusNotification(`Removed "${asset.name}" from Asset Bin.`);
      setTimeout(() => setStatusNotification(null), 3000);
    }
  };

  // Confirmed delete
  const handleConfirmDelete = () => {
    if (!assetToDelete) return;
    onDeleteAsset(assetToDelete.id);
    if (selectedAssetId === assetToDelete.id) {
      setSelectedAssetId(null);
    }
    setStatusNotification(`Removed "${assetToDelete.name}" from Asset Bin. Timeline clips preserved.`);
    setTimeout(() => setStatusNotification(null), 3500);
    setAssetToDelete(null);
  };

  // Add to timeline helper
  const handleAdd = (asset: ProjectAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onAddToTimeline(asset);
    setStatusNotification(`Added "${asset.name}" to timeline.`);
    setTimeout(() => setStatusNotification(null), 3000);
  };

  // Format bytes helper
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format duration helper (e.g. 01:23)
  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none animate-in fade-in duration-150 p-2 sm:p-4"
      id="asset-bin-modal-overlay"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`relative flex flex-col w-full max-w-6xl h-[92vh] bg-[#14141c] border rounded-2xl shadow-2xl overflow-hidden transition-all duration-150 ${
          isDragOver ? 'border-cyan-400 ring-2 ring-cyan-400/50 bg-[#171726]' : 'border-white/10'
        }`}
        id="asset-bin-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="h-14 px-4 sm:px-6 bg-[#181822] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center">
              <FolderArchive className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">Asset Bin</h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-semibold">
                  {assets.length} {assets.length === 1 ? 'Asset' : 'Assets'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Project media bin • Select files from your computer to store in this project
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Standard File Upload - Opens System File Picker */}
            <label
              className="h-8 px-3 rounded-lg bg-[#252533] hover:bg-[#2e2e3f] border border-white/10 hover:border-cyan-500/50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
              title="Open system file picker to select media from your computer"
              id="asset-bin-upload-btn"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Import Files</span>
              <span className="sm:hidden">Import</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*,application/octet-stream,text/*,.srt,.vtt,.txt,audio/*,video/*,image/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.caf,.aiff,.aif,.wma,.opus,.m4r,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp4,.mov,.m4v,.webm,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.json,.zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesImport(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </label>

            {/* Folder Upload - Opens System Folder Picker */}
            <label
              className="h-8 px-3 rounded-lg bg-[#252533] hover:bg-[#2e2e3f] border border-white/10 hover:border-cyan-500/50 text-zinc-200 hover:text-white text-xs font-medium hidden sm:flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
              title="Select a specific folder from your computer to import its media"
              id="asset-bin-folder-btn"
            >
              <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import Folder</span>
              <input
                ref={folderInputRef}
                type="file"
                multiple
                {...({ webkitdirectory: '', directory: '' } as any)}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesImport(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </label>

            {/* Direct ZIP Archive Upload */}
            <label
              className="h-8 px-3 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
              title="Select a .ZIP archive to unpack into the Asset Bin"
              id="asset-bin-zip-btn"
            >
              <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Unpack ZIP</span>
              <input
                ref={zipInputRef}
                type="file"
                multiple
                accept="*/*,.zip,application/zip,application/x-zip-compressed,application/x-zip,multipart/x-zip,audio/*,video/*,image/*,.mp3,.wav,.m4a,.aac,.flac"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesImport(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </label>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center active:scale-95 transition-all ml-1"
              id="asset-bin-close-btn"
              title="Close Asset Bin (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* UPLOADING PROGRESS BANNER */}
        {effectiveImporting && (
          <div className="bg-cyan-950/80 border-b border-cyan-500/30 px-4 py-2 flex items-center gap-3 shrink-0 animate-pulse">
            <div className="w-4 h-4 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin shrink-0" />
            <span className="text-xs text-cyan-200 font-medium truncate">
              {effectiveProgressText || 'Importing assets to Asset Bin...'}
            </span>
          </div>
        )}

        {/* STATUS NOTIFICATION TOAST */}
        {statusNotification && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-1.5 flex items-center justify-between shrink-0 animate-in fade-in slide-in-from-top-1 text-xs text-emerald-200">
            <div className="flex items-center gap-2 truncate">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{statusNotification}</span>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-emerald-400 hover:text-white text-[11px] ml-2 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* FILTER, SEARCH, & SORT TOOLBAR */}
        <div className="px-4 py-2.5 bg-[#161622] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                { key: 'all', label: 'All', count: counts.all, icon: Layers },
                { key: 'image', label: 'Photos', count: counts.image, icon: ImageIcon },
                { key: 'video', label: 'Videos', count: counts.video, icon: Film },
                { key: 'audio', label: 'Audio', count: counts.audio, icon: Music },
                { key: 'text', label: 'Scripts', count: counts.text, icon: FileText },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedType === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedType(tab.key)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                  id={`asset-bin-filter-${tab.key}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-cyan-400 text-zinc-950 font-bold' : 'bg-white/10 text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search, Sort, View Toggle */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="w-full h-7 pl-8 pr-6 rounded-lg bg-[#20202c] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
                id="asset-bin-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="h-7 pl-2 pr-7 rounded-lg bg-[#20202c] border border-white/10 text-xs text-zinc-300 hover:text-white focus:outline-none cursor-pointer appearance-none"
                id="asset-bin-sort-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name (A-Z)</option>
                <option value="duration">Duration</option>
                <option value="size">File Size</option>
              </select>
              <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Grid / List Toggle */}
            <div className="flex items-center bg-[#20202c] rounded-lg p-0.5 border border-white/10">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Grid View"
                id="asset-bin-grid-view-btn"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="List View"
                id="asset-bin-list-view-btn"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT WORKSPACE: ASSETS GRID/LIST + INSPECTOR PANEL */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
          {/* DRAG OVERLAY INDICATOR */}
          {isDragOver && (
            <div className="absolute inset-0 z-40 bg-cyan-950/80 border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <Upload className="w-10 h-10 text-cyan-300 animate-bounce" />
              <p className="text-sm font-bold text-cyan-200">Drop media files or .ZIP archives to import</p>
              <p className="text-xs text-cyan-400">Assets will be stored in Asset Bin without altering timeline</p>
            </div>
          )}

          {/* LEFT: ASSETS COLLECTION AREA */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 custom-scrollbar">
            {filteredAssets.length === 0 ? (
              /* EMPTY STATE */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/10 rounded-2xl my-auto">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <FolderArchive className="w-7 h-7 text-zinc-500" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                  {searchQuery || selectedType !== 'all' ? 'No matching assets found' : 'Project Media Bin'}
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mb-4">
                  {searchQuery || selectedType !== 'all'
                    ? 'Try clearing your search query or selecting a different asset filter.'
                    : 'Select files or folders from your computer to import into this project. Assets remain in the bin until you choose to add them to the timeline.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    id="empty-state-import-files-btn"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Files</span>
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="h-8 px-3 rounded-lg bg-[#252533] hover:bg-[#2e2e3f] border border-white/10 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                    id="empty-state-import-folder-btn"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Import Folder</span>
                  </button>
                  <button
                    onClick={() => zipInputRef.current?.click()}
                    className="h-8 px-3.5 rounded-lg bg-[#252533] hover:bg-[#2d2d3e] border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                    id="empty-state-unpack-zip-btn"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Unpack ZIP</span>
                  </button>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" id="asset-bin-grid">
                {visibleAssets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  const usageCount = getTimelineUsageCount(asset);
                  const isOnTimeline = usageCount > 0;

                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`group relative flex flex-col rounded-xl overflow-hidden bg-[#1a1a24] border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg bg-[#1f1f2e]'
                          : 'border-white/10 hover:border-white/25 hover:bg-[#1e1e2c]'
                      }`}
                      id={`asset-card-${asset.id}`}
                    >
                      {/* Thumbnail Container */}
                      <div className="relative aspect-video w-full bg-[#101018] overflow-hidden flex items-center justify-center">
                        {asset.type === 'image' || asset.type === 'video' ? (
                          <img
                            src={asset.thumbnailUrl || asset.url}
                            alt={asset.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : asset.type === 'audio' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-950/50 to-indigo-950/50 p-2 text-blue-400">
                            <Music className="w-8 h-8 mb-1 opacity-80" />
                            <div className="flex items-center gap-0.5 h-4">
                              {(asset.waveformData || [0.3, 0.7, 0.4, 0.9, 0.6, 0.8, 0.5, 0.3])
                                .slice(0, 12)
                                .map((v, i) => (
                                  <div
                                    key={i}
                                    className="w-1 bg-cyan-400/70 rounded-full"
                                    style={{ height: `${Math.max(20, Math.min(100, v * 100))}%` }}
                                  />
                                ))}
                            </div>
                          </div>
                        ) : (
                          /* Text / Script */
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-950/40 to-orange-950/40 p-2 text-amber-300">
                            <FileText className="w-7 h-7 mb-1 opacity-80" />
                            <span className="text-[10px] font-mono text-zinc-400 text-center line-clamp-2 px-1">
                              {asset.textContent ? asset.textContent.slice(0, 40) : 'Script/Text'}
                            </span>
                          </div>
                        )}

                        {/* Top Left: Type Badge */}
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-bold text-white flex items-center gap-1 uppercase tracking-wider">
                            {asset.type === 'video' && <Film className="w-2.5 h-2.5 text-blue-400" />}
                            {asset.type === 'image' && <ImageIcon className="w-2.5 h-2.5 text-purple-400" />}
                            {asset.type === 'audio' && <Music className="w-2.5 h-2.5 text-cyan-400" />}
                            {asset.type === 'text' && <FileText className="w-2.5 h-2.5 text-amber-400" />}
                            {asset.type}
                          </span>
                        </div>

                        {/* Top Right: Timeline Indicator */}
                        {isOnTimeline && (
                          <div className="absolute top-1.5 right-1.5">
                            <span
                              className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40 text-[9px] font-semibold text-emerald-300 flex items-center gap-0.5"
                              title={`Used in ${usageCount} clip(s) on timeline`}
                            >
                              <Check className="w-2.5 h-2.5" />
                              <span>Timeline{usageCount > 1 ? ` (${usageCount})` : ''}</span>
                            </span>
                          </div>
                        )}

                        {/* Bottom Right: Duration Pill */}
                        {(asset.type === 'video' || asset.type === 'audio') && (
                          <div className="absolute bottom-1.5 right-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-zinc-200 font-medium">
                              {formatDuration(asset.duration)}
                            </span>
                          </div>
                        )}

                        {/* Hover Overlay Action: Quick Add to Timeline */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => handleAdd(asset, e)}
                            className="p-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-90 transition-all"
                            title="Add to Timeline"
                          >
                            <Plus className="w-4 h-4 stroke-[3]" />
                          </button>
                          <button
                            onClick={(e) => handleInitiateDelete(asset, e)}
                            className="p-2 rounded-full bg-red-600/80 hover:bg-red-600 text-white shadow-lg active:scale-90 transition-all"
                            title="Remove from Bin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Details Bar */}
                      <div className="p-2.5 flex flex-col gap-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white" title={asset.name}>
                            {asset.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span>{formatFileSize(asset.size || asset.file?.size)}</span>
                          {asset.width && asset.height && (
                            <span className="font-mono">{asset.width}×{asset.height}</span>
                          )}
                          {!asset.width && asset.duration && (
                            <span>{formatDuration(asset.duration)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="flex flex-col divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-[#181824]" id="asset-bin-list">
                {visibleAssets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  const usageCount = getTimelineUsageCount(asset);
                  const isOnTimeline = usageCount > 0;

                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`flex items-center justify-between px-3 py-2.5 transition-all cursor-pointer ${
                        isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Tiny Thumbnail */}
                        <div className="w-12 h-9 rounded bg-black overflow-hidden shrink-0 flex items-center justify-center">
                          {asset.type === 'image' || asset.type === 'video' ? (
                            <img
                              src={asset.thumbnailUrl || asset.url}
                              alt={asset.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : asset.type === 'audio' ? (
                            <Music className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-amber-400" />
                          )}
                        </div>

                        {/* Title & Tags */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-semibold text-white truncate">{asset.name}</span>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span className="capitalize">{asset.type}</span>
                            <span>•</span>
                            <span>{formatFileSize(asset.size || asset.file?.size)}</span>
                            {asset.duration && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{formatDuration(asset.duration)}</span>
                              </>
                            )}
                            {asset.width && asset.height && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{asset.width}×{asset.height}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {isOnTimeline && (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-[10px] text-emerald-300 font-medium">
                            On Timeline{usageCount > 1 ? ` (${usageCount})` : ''}
                          </span>
                        )}
                        <button
                          onClick={(e) => handleAdd(asset, e)}
                          className="h-7 px-2.5 rounded bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                          title="Add to timeline"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Add</span>
                        </button>
                        <button
                          onClick={(e) => handleInitiateDelete(asset, e)}
                          className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                          title="Remove from Bin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination / Load More Button for large collections (100, 200, 300+ items) */}
            {filteredAssets.length > itemsToShow && (
              <div className="flex flex-col items-center justify-center py-6 gap-2 shrink-0">
                <p className="text-xs text-zinc-400">
                  Showing {visibleAssets.length} of {filteredAssets.length} assets
                </p>
                <button
                  onClick={() => setItemsToShow((prev) => prev + 60)}
                  className="h-8 px-4 rounded-lg bg-[#252533] hover:bg-[#2d2d3e] border border-white/10 text-xs font-semibold text-white transition-all active:scale-95 cursor-pointer shadow-sm"
                  id="asset-bin-load-more-btn"
                >
                  Load Next 60 Assets
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: DETAILED INSPECTOR PANEL (when an asset is selected) */}
          {selectedAsset && (
            <div
              className="w-full md:w-80 lg:w-96 bg-[#161622] border-t md:border-t-0 md:border-l border-white/10 flex flex-col shrink-0 min-h-0 overflow-y-auto custom-scrollbar"
              id="asset-bin-inspector"
            >
              {/* Inspector Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Asset Details</span>
                </div>
                <button
                  onClick={() => setSelectedAssetId(null)}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 text-xs"
                  title="Close Inspector"
                >
                  ✕
                </button>
              </div>

              {/* Media Preview Box */}
              <div className="p-4 flex flex-col gap-3">
                <div className="aspect-video w-full rounded-xl bg-black overflow-hidden border border-white/10 relative flex items-center justify-center">
                  {selectedAsset.type === 'image' && (
                    <img
                      src={selectedAsset.url}
                      alt={selectedAsset.name}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {selectedAsset.type === 'video' && (
                    <video
                      src={selectedAsset.url}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  )}
                  {selectedAsset.type === 'audio' && (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-950/40 to-indigo-950/40 text-cyan-300">
                      <Music className="w-10 h-10 mb-2 opacity-80" />
                      <audio src={selectedAsset.url} controls className="w-full max-w-xs h-8" />
                    </div>
                  )}
                  {selectedAsset.type === 'text' && (
                    <div className="w-full h-full p-3 overflow-y-auto bg-zinc-950 font-mono text-xs text-zinc-300 leading-relaxed custom-scrollbar">
                      {selectedAsset.textContent || 'No text preview available.'}
                    </div>
                  )}
                </div>

                {/* Primary Action: Add to Timeline */}
                <button
                  onClick={() => handleAdd(selectedAsset)}
                  className="w-full h-9 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
                  id="asset-inspector-add-to-timeline-btn"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Add to Timeline</span>
                </button>

                {/* Metadata Table */}
                <div className="flex flex-col divide-y divide-white/5 bg-[#1a1a26] border border-white/5 rounded-xl overflow-hidden text-xs">
                  {/* Filename */}
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-zinc-400">File Name</span>
                    <span className="font-semibold text-white truncate max-w-[180px]" title={selectedAsset.name}>
                      {selectedAsset.name}
                    </span>
                  </div>

                  {/* Asset ID */}
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-zinc-400">Asset ID</span>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-cyan-300">
                      <span className="truncate max-w-[140px]">{selectedAsset.id}</span>
                      <button
                        onClick={() => handleCopyId(selectedAsset.id)}
                        className="p-1 hover:bg-white/10 rounded"
                        title="Copy Asset ID"
                      >
                        {copiedId === selectedAsset.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="p-2.5 flex items-center justify-between">
                    <span className="text-zinc-400">Type</span>
                    <span className="font-medium text-white uppercase">{selectedAsset.type}</span>
                  </div>

                  {/* File Size */}
                  <div className="p-2.5 flex items-center justify-between">
                    <span className="text-zinc-400">File Size</span>
                    <span className="font-medium text-white">
                      {formatFileSize(selectedAsset.size || selectedAsset.file?.size)}
                    </span>
                  </div>

                  {/* Dimensions */}
                  {selectedAsset.width && selectedAsset.height && (
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-zinc-400">Dimensions</span>
                      <span className="font-mono text-white">
                        {selectedAsset.width} × {selectedAsset.height} px
                      </span>
                    </div>
                  )}

                  {/* Duration */}
                  {selectedAsset.duration !== undefined && (
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-zinc-400">Duration</span>
                      <span className="font-mono text-white">
                        {formatDuration(selectedAsset.duration)} ({selectedAsset.duration}s)
                      </span>
                    </div>
                  )}

                  {/* Timeline Status */}
                  <div className="p-2.5 flex items-center justify-between">
                    <span className="text-zinc-400">Timeline</span>
                    {getTimelineUsageCount(selectedAsset) > 0 ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Used in {getTimelineUsageCount(selectedAsset)} clip(s)</span>
                      </span>
                    ) : (
                      <span className="text-zinc-500 italic">Not placed on timeline</span>
                    )}
                  </div>

                  {/* Upload Date */}
                  {selectedAsset.uploadedAt && (
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-zinc-400">Imported</span>
                      <span className="text-zinc-300">
                        {new Date(selectedAsset.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Semantic Analysis & Tags if available */}
                {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                  <div className="flex flex-col gap-1.5 bg-[#1a1a26] border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] font-bold text-zinc-400">Tags & Descriptors</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedAsset.tags.map((t, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-zinc-300">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remove Asset from Bin Action */}
                <button
                  onClick={() => handleInitiateDelete(selectedAsset)}
                  className="w-full h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 hover:text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer mt-2"
                  id="asset-inspector-delete-btn"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove from Asset Bin</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DELETION CONFIRMATION DIALOG (Safety Guard against destroying timeline clips) */}
        {assetToDelete && (
          <div
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            id="asset-delete-confirm-dialog"
          >
            <div className="w-full max-w-md bg-[#1a1a26] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Asset is in use on the timeline</h3>
                  <p className="text-xs text-zinc-400">
                    "{assetToDelete.name}" is referenced by {getTimelineUsageCount(assetToDelete)} timeline clip(s).
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#12121c] border border-white/5 rounded-xl text-xs text-zinc-300 leading-relaxed">
                Removing this asset from the Asset Bin will delete it from project media storage. Your existing timeline
                clips will remain intact and will retain their rendered frame caches.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setAssetToDelete(null)}
                  className="h-8 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-zinc-200 hover:text-white transition-all"
                  id="cancel-delete-asset-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="h-8 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition-all shadow-md active:scale-95"
                  id="confirm-delete-asset-btn"
                >
                  Delete from Bin (Keep Timeline)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
