import React, { useState } from 'react';
import { HomeHeader } from './HomeHeader';
import { HeroActionCards } from './HeroActionCards';
import { QuickToolsSection } from './QuickToolsSection';
import { RecentProjectsSection } from './RecentProjectsSection';
import { TemplatesSection } from './TemplatesSection';
import { AILabSection } from './AILabSection';
import { InboxSection } from './InboxSection';
import { ProfileSection } from './ProfileSection';
import { BottomNav, HomeTab } from './BottomNav';
import { ProjectItem, TemplatePreset, ZipImportResult } from '../../types';

interface HomeScreenProps {
  projects: ProjectItem[];
  onNewVideo: () => void;
  onEditPhoto: () => void;
  onOpenAIEditor: () => void;
  onOpenProject: (project: ProjectItem) => void;
  onDeleteProject: (projectId: string) => void;
  onDuplicateProject: (project: ProjectItem) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onUseTemplate: (template: TemplatePreset) => void;
  onImportZipSuccess: (result: ZipImportResult) => void;
  onSelectQuickTool: (toolKey: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  projects,
  onNewVideo,
  onEditPhoto,
  onOpenAIEditor,
  onOpenProject,
  onDeleteProject,
  onDuplicateProject,
  onRenameProject,
  onUseTemplate,
  onImportZipSuccess,
  onSelectQuickTool,
}) => {
  const [activeTab, setActiveTab] = useState<HomeTab>('edit');
  const [searchQuery, setSearchQuery] = useState<string>('');

  return (
    <div
      className="min-h-screen w-full bg-[#0e0e14] text-white flex flex-col justify-between selection:bg-blue-500 selection:text-white"
      id="capcut-homescreen-root"
    >
      {/* Top Fixed Header */}
      <HomeHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setActiveTab('profile')}
        onOpenNotifications={() => setActiveTab('inbox')}
        onOpenAIAssistant={onOpenAIEditor}
      />

      {/* Main Content Area (Scrollable with bottom padding for safe nav bar) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pt-16 pb-24 flex flex-col gap-6">
        {/* Tab 1: 'edit' - The default CapCut Home View */}
        {activeTab === 'edit' && (
          <>
            {/* 1. Hero Big Action Cards (New Video, AI Editor, Photo, ZIP Import) */}
            <HeroActionCards
              onNewVideo={onNewVideo}
              onEditPhoto={onEditPhoto}
              onOpenAIEditor={onOpenAIEditor}
              onImportZipSuccess={onImportZipSuccess}
            />

            {/* 2. AI & Creative Quick Tools Bar */}
            <QuickToolsSection onSelectTool={onSelectQuickTool} />

            {/* 3. Recent Projects Gallery */}
            <RecentProjectsSection
              projects={projects}
              onOpenProject={onOpenProject}
              onDeleteProject={onDeleteProject}
              onDuplicateProject={onDuplicateProject}
              onRenameProject={onRenameProject}
              onNewVideo={onNewVideo}
              searchQuery={searchQuery}
            />

            {/* 4. Trending Templates Preview in Edit View */}
            <TemplatesSection
              onUseTemplate={onUseTemplate}
              searchQuery={searchQuery}
            />
          </>
        )}

        {/* Tab 2: 'templates' - Dedicated Templates Gallery */}
        {activeTab === 'templates' && (
          <div className="flex flex-col gap-4">
            <TemplatesSection
              onUseTemplate={onUseTemplate}
              searchQuery={searchQuery}
            />
          </div>
        )}

        {/* Tab 3: 'ailab' - AI Tools & Copilot Hub */}
        {activeTab === 'ailab' && (
          <div className="flex flex-col gap-4">
            <AILabSection
              onOpenAIEditor={onOpenAIEditor}
              onSelectAITool={onSelectQuickTool}
            />
          </div>
        )}

        {/* Tab 4: 'projects' - Dedicated Full-Screen Projects Manager */}
        {activeTab === 'projects' && (
          <div className="flex flex-col gap-4">
            <RecentProjectsSection
              projects={projects}
              onOpenProject={onOpenProject}
              onDeleteProject={onDeleteProject}
              onDuplicateProject={onDuplicateProject}
              onRenameProject={onRenameProject}
              onNewVideo={onNewVideo}
              searchQuery={searchQuery}
            />
          </div>
        )}

        {/* Tab 5: 'inbox' - Notifications & Announcements */}
        {activeTab === 'inbox' && (
          <div className="flex flex-col gap-4">
            <InboxSection
              onOpenAIEditor={onOpenAIEditor}
              onExploreTemplates={() => setActiveTab('templates')}
            />
          </div>
        )}

        {/* Tab 6: 'profile' / 'me' - User Dashboard & Settings */}
        {activeTab === 'profile' && (
          <div className="flex flex-col gap-4">
            <ProfileSection
              onNewVideo={onNewVideo}
              projectCount={projects.length}
            />
          </div>
        )}
      </main>

      {/* Persistent CapCut Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        unreadInboxCount={2}
      />
    </div>
  );
};
