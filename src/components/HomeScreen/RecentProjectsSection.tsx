import React, { useState } from 'react';
import {
  Clock,
  Film,
  MoreVertical,
  Trash2,
  Copy,
  Edit2,
  FolderOpen,
  Sparkles,
  Plus,
  Play,
  Share2,
  Check,
} from 'lucide-react';
import { ProjectItem } from '../../types';
import { formatTime } from '../../utils/time';

interface RecentProjectsSectionProps {
  projects: ProjectItem[];
  onOpenProject: (project: ProjectItem) => void;
  onDeleteProject: (projectId: string) => void;
  onDuplicateProject: (project: ProjectItem) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onNewVideo: () => void;
  searchQuery?: string;
}

export const RecentProjectsSection: React.FC<RecentProjectsSectionProps> = ({
  projects,
  onOpenProject,
  onDeleteProject,
  onDuplicateProject,
  onRenameProject,
  onNewVideo,
  searchQuery = '',
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [menuOpenProjectId, setMenuOpenProjectId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');

  const filterCategories = [
    { id: 'all', label: 'All Projects' },
    { id: 'favorites', label: '★ Starred' },
    { id: '9:16', label: '9:16 Shorts' },
    { id: '16:9', label: '16:9 Wide' },
  ];

  // Filter projects by category & search query
  const filteredProjects = projects.filter((proj) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        proj.name.toLowerCase().includes(q) ||
        (proj.category && proj.category.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    if (activeFilter === 'favorites') return proj.isFavorite;
    if (activeFilter === '9:16') return proj.aspectRatio === '9:16';
    if (activeFilter === '16:9') return proj.aspectRatio === '16:9';
    return true;
  });

  const getRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleStartRename = (proj: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingProjectId(proj.id);
    setRenameInput(proj.name);
    setMenuOpenProjectId(null);
  };

  const handleConfirmRename = (projectId: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (renameInput.trim()) {
      onRenameProject(projectId, renameInput.trim());
    }
    setRenamingProjectId(null);
  };

  return (
    <section className="w-full select-none" id="home-recent-projects">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Recent Projects
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-zinc-300">
            {projects.length}
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {filterCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === cat.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-[#1a1a24] text-zinc-400 hover:text-zinc-200 hover:bg-[#242432]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid / List */}
      {filteredProjects.length === 0 ? (
        <div className="w-full py-12 px-4 rounded-2xl bg-[#161620] border border-white/5 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 mb-3">
            <Film className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">No Projects Found</h4>
          <p className="text-xs text-zinc-400 max-w-xs mb-4">
            {searchQuery ? `No projects matching "${searchQuery}"` : 'Start your first video creation with timeline editing.'}
          </p>
          <button
            onClick={onNewVideo}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/30 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Video</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredProjects.map((proj) => {
            const isMenuOpen = menuOpenProjectId === proj.id;
            const isRenaming = renamingProjectId === proj.id;

            return (
              <div
                key={proj.id}
                onClick={() => {
                  if (!isRenaming && !isMenuOpen) {
                    onOpenProject(proj);
                  }
                }}
                className="group relative rounded-2xl bg-[#181822] hover:bg-[#20202e] border border-white/[0.07] hover:border-blue-500/40 p-2.5 flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-[0.99] shadow-md overflow-hidden"
                id={`project-card-${proj.id}`}
              >
                {/* Project Thumbnail with 9:16 or 16:9 Aspect Frame */}
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/60 mb-2.5">
                  {proj.thumbnailUrl && proj.thumbnailUrl.trim() !== '' ? (
                    <img
                      src={proj.thumbnailUrl}
                      alt={proj.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500">
                      <Film className="w-8 h-8 opacity-40 mb-1" />
                      <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Project</span>
                    </div>
                  )}

                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {/* Play preview icon on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 pointer-events-none">
                    <div className="w-9 h-9 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg shadow-blue-600/50">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Top Badges: Aspect Ratio & Duration */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-black/70 text-white backdrop-blur-xs border border-white/10">
                      {proj.aspectRatio}
                    </span>
                    {proj.isFavorite && (
                      <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-amber-500/90 text-black">
                        ★
                      </span>
                    )}
                  </div>

                  {/* Duration Badge Bottom-Right */}
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/80 text-zinc-200 backdrop-blur-xs flex items-center gap-1 z-10 border border-white/10">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>{formatTime(proj.duration)}</span>
                  </div>
                </div>

                {/* Info and Actions */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <form
                        onSubmit={(e) => handleConfirmRename(proj.id, e)}
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          className="bg-[#2a2a38] text-xs text-white px-2 py-0.5 rounded border border-blue-500 focus:outline-none w-full"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover:text-blue-400 transition-colors">
                        {proj.name}
                      </h4>
                    )}

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                      <span>{getRelativeTime(proj.lastEdited)}</span>
                      <span>•</span>
                      <span className="text-zinc-500 font-mono">{proj.resolution || '1080P'}</span>
                    </div>
                  </div>

                  {/* 3-Dot Options Menu */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpenProjectId(isMenuOpen ? null : proj.id)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Project options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Popover Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-1 w-36 rounded-xl bg-[#222230] border border-white/10 shadow-2xl p-1 z-30 flex flex-col gap-0.5 text-xs text-zinc-200 backdrop-blur-md">
                        <button
                          onClick={() => {
                            onOpenProject(proj);
                            setMenuOpenProjectId(null);
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-white"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                          <span>Open</span>
                        </button>
                        <button
                          onClick={(e) => handleStartRename(proj, e)}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-zinc-300 hover:text-white"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Rename</span>
                        </button>
                        <button
                          onClick={() => {
                            onDuplicateProject(proj);
                            setMenuOpenProjectId(null);
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-zinc-300 hover:text-white"
                        >
                          <Copy className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Duplicate</span>
                        </button>
                        <div className="h-px bg-white/10 my-0.5" />
                        <button
                          onClick={() => {
                            onDeleteProject(proj.id);
                            setMenuOpenProjectId(null);
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-left text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
