import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  FileText,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Menu,
  SquarePen,
  Paperclip,
  Trash2,
  Scissors,
  Volume2,
  Tv,
  Eye,
  Check,
  ListOrdered,
  History,
  MessageSquare,
  Search,
  ChevronLeft,
  Wand2,
  Layers,
  HelpCircle,
  AlertCircle,
  Clock,
  Loader2,
  Subtitles,
  Clipboard,
} from 'lucide-react';
import { isSrtFormat, parseSrtText, separateScriptAndSrt } from '../../engine/srtParser';
import {
  AIChatMessage,
  AIEditPlan,
  EditingStyle,
  ProjectAsset,
  PhraseBreakdownItem,
  AIStatusState,
  CreativePlan,
  RecapActionPlan,
  TimelineState,
} from '../../types';
import {
  GeneralEditorChatSession,
  GeneralEditorProjectSnapshot,
  loadGeneralChatSessions,
  saveGeneralChatSession,
  deleteGeneralChatSession,
  syncSessionsFromIndexedDB,
} from '../../utils/chatSessionStorage';
import { VisualMatchingReviewModal } from './VisualMatchingReviewModal';
import { VisualBeat } from '../../engine/intelligentVisualEngine';
import { AssemblerSkillCard } from './AssemblerSkillCard';
import { AspectRatio } from '../../types';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AIChatMessage[];
  onSendMessage: (text: string, attachedAssets?: ProjectAsset[], script?: string, srt?: string) => Promise<void>;
  onExecutePlan: (plan: AIEditPlan | RecapActionPlan | CreativePlan) => Promise<void>;
  onRunAssemblerSkill?: (options: { aspectRatio: AspectRatio; autoKenBurns?: boolean; autoDucking?: boolean }) => Promise<void>;
  onRevertLastAISession?: () => void;
  canRevert?: boolean;
  onClearChat?: () => void;
  registeredAssets: ProjectAsset[];
  onUploadAssets: (files: FileList | File[]) => Promise<void>;
  currentStyle: EditingStyle;
  onSelectStyle: (style: EditingStyle) => void;
  customStyles: EditingStyle[];
  onSaveCustomStyle: (style: EditingStyle) => void;
  isExecuting?: boolean;
  activeActivityStep?: string;
  timelineState?: TimelineState;
  activeScriptText?: string;
  activeSrtText?: string;
  onRestoreSessionContext?: (snapshot?: GeneralEditorProjectSnapshot, messages?: AIChatMessage[]) => void;
  onStartNewChat?: () => void;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onExecutePlan,
  onRunAssemblerSkill,
  onRevertLastAISession,
  canRevert = false,
  onClearChat,
  registeredAssets,
  onUploadAssets,
  isExecuting = false,
  activeActivityStep,
  timelineState,
  activeScriptText,
  activeSrtText,
  onRestoreSessionContext,
  onStartNewChat,
}) => {
  const [statusState, setStatusState] = useState<AIStatusState>('ready');

  // Input and attachments
  const [inputText, setInputText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ProjectAsset[]>([]);
  const [pastedScript, setPastedScript] = useState(activeScriptText || '');
  const [pastedSrt, setPastedSrt] = useState(activeSrtText || '');
  const [scriptModalOpen, setScriptModalOpen] = useState(false);

  // Sync pastedScript & pastedSrt whenever props change
  useEffect(() => {
    if (activeScriptText && !pastedScript) {
      setPastedScript(activeScriptText);
    }
  }, [activeScriptText]);

  useEffect(() => {
    if (activeSrtText && !pastedSrt) {
      setPastedSrt(activeSrtText);
    }
  }, [activeSrtText]);

  // Chat History & Session Management
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [savedSessions, setSavedSessions] = useState<GeneralEditorChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => `session-${Date.now()}`);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Drag and Drop & Upload status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');

  // Intelligent Visual Review State
  const [reviewPlan, setReviewPlan] = useState<AIEditPlan | null>(null);
  const [reviewBeats, setReviewBeats] = useState<VisualBeat[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const srtFileInputRef = useRef<HTMLInputElement>(null);
  const modalSrtInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved sessions when drawer opens
  useEffect(() => {
    if (isOpen) {
      const loaded = loadGeneralChatSessions(timelineState?.projectId);
      setSavedSessions(loaded);

      // Hydrate from IndexedDB in case of fresh load or localStorage quota clearing
      syncSessionsFromIndexedDB().then((synced) => {
        if (synced && synced.length > 0) {
          const filtered = timelineState?.projectId
            ? synced.filter((s) => !s.projectId || s.projectId === timelineState?.projectId)
            : synced;
          setSavedSessions(filtered);
        }
      }).catch(() => {});
    }
  }, [isOpen, timelineState?.projectId]);

  // Auto-save active session as user interacts with General Editor
  useEffect(() => {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return;

    const firstPrompt = userMessages[0].content || 'Video Edit';
    const cleanTitle = firstPrompt.length > 36 ? firstPrompt.slice(0, 36) + '...' : firstPrompt;

    const snapshot: GeneralEditorProjectSnapshot = {
      videoClips: timelineState?.videoClips || [],
      audioClips: timelineState?.audioClips || [],
      captionClips: timelineState?.captions || [],
      overlayClips: timelineState?.overlays || [],
      aspectRatio: timelineState?.aspectRatio,
      activeScriptText: pastedScript || undefined,
    };

    const currentSession: GeneralEditorChatSession = {
      id: activeSessionId,
      projectId: timelineState?.projectId,
      title: cleanTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages,
      contextSnapshot: snapshot,
    };

    saveGeneralChatSession(currentSession);
    setSavedSessions(loadGeneralChatSessions(timelineState?.projectId));
  }, [messages, activeSessionId, timelineState, pastedScript]);

  // Scroll chat messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isExecuting]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(140, Math.max(38, textareaRef.current.scrollHeight))}px`;
    }
  }, [inputText]);

  if (!isOpen) return null;

  // New Chat handler
  const handleNewChat = () => {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length > 0) {
      const snapshot: GeneralEditorProjectSnapshot = {
        videoClips: timelineState?.videoClips || [],
        audioClips: timelineState?.audioClips || [],
        captionClips: timelineState?.captions || [],
        overlayClips: timelineState?.overlays || [],
        aspectRatio: timelineState?.aspectRatio,
        activeScriptText: pastedScript || undefined,
      };
      const prevSession: GeneralEditorChatSession = {
        id: activeSessionId,
        projectId: timelineState?.projectId,
        title: userMessages[0].content.slice(0, 36) || 'Video Edit',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages,
        contextSnapshot: snapshot,
      };
      saveGeneralChatSession(prevSession);
    }

    const newId = `session-${Date.now()}`;
    setActiveSessionId(newId);
    setInputText('');
    setPendingAttachments([]);
    setPastedScript('');
    setIsHistoryOpen(false);

    if (onStartNewChat) {
      onStartNewChat();
    } else if (onClearChat) {
      onClearChat();
    }

    setSavedSessions(loadGeneralChatSessions(timelineState?.projectId));
  };

  // Select old history item and restore
  const handleSelectSession = (session: GeneralEditorChatSession) => {
    setActiveSessionId(session.id);
    setIsHistoryOpen(false);

    if (onRestoreSessionContext) {
      onRestoreSessionContext(session.contextSnapshot, session.messages);
    }
  };

  // Delete session from history
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteGeneralChatSession(sessionId);
    const updated = loadGeneralChatSessions(timelineState?.projectId);
    setSavedSessions(updated);
    if (activeSessionId === sessionId) {
      handleNewChat();
    }
  };

  const formatRelativeTime = (timestamp: number): string => {
    if (!timestamp) return 'Recently';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filteredSessions = savedSessions.filter((s) => {
    if (!historySearchQuery.trim()) return true;
    const q = historySearchQuery.toLowerCase();
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      s.messages.some((m) => m.content && m.content.toLowerCase().includes(q))
    );
  });

  // Dedicated SRT Upload Handler
  const handleSrtUpload = async (file: File) => {
    try {
      const text = await file.text();
      if (isSrtFormat(text)) {
        const cues = parseSrtText(text);
        setPastedSrt(text);
        setUploadStatusText(`Attached SRT Subtitles: ${file.name} (${cues.length} cues parsed)`);
      } else {
        setPastedScript(text);
        setUploadStatusText(`Attached Script: ${file.name}`);
      }
    } catch (err) {
      console.warn('Failed reading SRT file:', err);
    }
  };

  // File Upload Handler
  const handleFileUpload = async (files: FileList | File[]) => {
    setIsUploading(true);
    setUploadStatusText('Importing media assets into editor...');
    try {
      const fileArray = Array.from(files);
      const srtFile = fileArray.find(
        (f) =>
          f.name.toLowerCase().endsWith('.srt') ||
          f.name.toLowerCase().endsWith('.vtt')
      );
      if (srtFile) {
        try {
          const text = await srtFile.text();
          if (isSrtFormat(text)) {
            const cues = parseSrtText(text);
            setPastedSrt(text);
            setUploadStatusText(`Attached SRT Subtitles: ${srtFile.name} (${cues.length} cues)`);
          }
        } catch (err) {
          console.warn('Failed reading SRT file in upload:', err);
        }
      }

      await onUploadAssets(files);
      setUploadStatusText('Assets registered on project.');
    } catch (err) {
      console.warn('Upload error:', err);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadStatusText(''), 3000);
    }
  };

  // Submit Message
  const handleSend = async () => {
    if ((!inputText.trim() && pendingAttachments.length === 0 && !pastedScript && !pastedSrt) || isExecuting) return;
    const textToSend = inputText.trim() || 'Process attached project assets with creative auto-edit';
    const attachments = [...pendingAttachments];
    const script = pastedScript;
    const srt = pastedSrt;

    setInputText('');
    setPendingAttachments([]);
    setStatusState('analyzing_media');

    try {
      await onSendMessage(textToSend, attachments, script, srt);
      setStatusState('ready');
    } catch (err) {
      setStatusState('error');
    }
  };

  // Quick Action Chips
  const handleQuickAction = async (promptText: string) => {
    setInputText(promptText);
    setStatusState('planning_edit');
    await onSendMessage(promptText, pendingAttachments, pastedScript, pastedSrt);
    setStatusState('ready');
  };

  // Open Visual Review Modal
  const handleOpenVisualReview = (plan: AIEditPlan) => {
    setReviewPlan(plan);
    const beats: VisualBeat[] = (plan.breakdown || []).map((b, idx) => ({
      id: b.id || `beat-${idx + 1}`,
      beatIndex: b.phraseIndex || idx + 1,
      sentenceIndex: idx + 1,
      text: b.text,
      fullSentence: b.fullSentence || b.text,
      startTime: b.startTime,
      endTime: Number((b.startTime + b.duration).toFixed(2)),
      duration: b.duration,
      suggestedVisualDescription: b.suggestedVisual,
      coreKeywords: b.extractedKeywords || [],
      actionVerbs: [],
      keyObjects: [],
      charactersOrSubjects: [],
      matchedAssetId: b.matchedAssetId,
      matchedAssetName: b.matchedAssetName,
      matchedAssetThumbnail: b.matchedThumbnail,
      matchedAssetUrl: registeredAssets.find((a) => a.id === b.matchedAssetId)?.url,
      matchScore: b.matchScore || 0.85,
      matchConfidence: (b.matchScore && b.matchScore >= 0.7 ? 'high' : b.matchScore && b.matchScore >= 0.4 ? 'medium' : b.isMissingVisual ? 'unmatched' : 'medium') as any,
      matchReason: b.matchJustification || '',
      isUnmatched: Boolean(b.isMissingVisual || !b.matchedAssetId),
      isMultiActionInSentence: Boolean(b.isMultiActionInSentence),
    }));
    setReviewBeats(beats);
    setIsReviewOpen(true);
  };

  const handleCommitVisualReview = (finalBeats: VisualBeat[]) => {
    if (!reviewPlan) return;
    setIsReviewOpen(false);

    const updatedBreakdown: PhraseBreakdownItem[] = finalBeats.map((beat, i) => ({
      id: beat.id,
      phraseIndex: beat.beatIndex,
      text: beat.text,
      fullSentence: beat.fullSentence,
      isMultiActionInSentence: beat.isMultiActionInSentence,
      startTime: Number(beat.startTime.toFixed(2)),
      duration: Number(beat.duration.toFixed(2)),
      suggestedVisual: beat.isUnmatched ? `[UNMATCHED ASSET] ${beat.text}` : `Visual: ${beat.matchedAssetName || 'Clip'}`,
      matchedAssetId: beat.matchedAssetId,
      matchedAssetName: beat.matchedAssetName,
      matchedThumbnail: beat.matchedAssetThumbnail,
      isMissingVisual: beat.isUnmatched,
      missingVisualReason: beat.isUnmatched ? beat.matchReason : undefined,
      matchJustification: beat.matchReason,
      matchScore: beat.matchScore,
      extractedKeywords: beat.coreKeywords,
      captionText: beat.text,
      transition: i === 0 ? undefined : (i % 3 === 0 ? 'dissolve' : 'slide-right'),
      keyframeZoom: true,
      instruction: `Synchronize visual "${beat.matchedAssetName}" with speech phrase`,
    }));

    const newCommands = [...(reviewPlan.commands || []).filter((c) => c.type !== 'ADD_CLIP')];
    finalBeats.forEach((beat, i) => {
      const asset = registeredAssets.find((a) => a.id === beat.matchedAssetId) || registeredAssets[i % Math.max(1, registeredAssets.length)];
      if (asset) {
        const clipId = `ai-clip-${i}-${Date.now()}`;
        newCommands.push({
          id: `cmd-clip-${i}`,
          type: 'ADD_CLIP',
          description: `Place visual "${beat.matchedAssetName || asset.name}" (${beat.duration}s) at ${beat.startTime.toFixed(1)}s`,
          targetId: clipId,
          targetType: 'video',
          payload: {
            id: clipId,
            title: beat.matchedAssetName || asset.name,
            type: asset.type,
            url: asset.url,
            file: asset.file,
            matchedAssetId: asset.id,
            thumbnailUrl: asset.thumbnailUrl || asset.url,
            duration: beat.duration,
            timelineStart: beat.startTime,
            timelineEnd: beat.endTime,
            color: 'from-cyan-700 to-blue-800',
            transitionAfter: undefined,
            keyframes: [
              { id: `kf-1-${i}`, time: 0, scale: 1.0, opacity: 1 },
              { id: `kf-2-${i}`, time: beat.duration, scale: 1.08, opacity: 1 },
            ],
          },
        });
      }
    });

    const updatedPlan: AIEditPlan = {
      ...reviewPlan,
      breakdown: updatedBreakdown,
      commands: newCommands,
      missingVisualCount: finalBeats.filter((b) => b.isUnmatched).length,
    };

    onExecutePlan(updatedPlan);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity duration-300"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.70)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex h-full w-full max-w-2xl flex-col bg-stone-900 text-stone-100 shadow-2xl border-l border-stone-800 overflow-hidden"
        style={{ backgroundColor: '#1c1917', color: '#f5f5f4' }}
      >
        
        {/* ========================================================= */}
        {/* 1. CLEAN CHATGPT-STYLE TOP BAR                             */}
        {/* Left: ☰ Chat History | Center: ✨ AI Video Editor | Right: ✎ New Chat | Far right: X Close */}
        {/* ========================================================= */}
        <div
          className="flex items-center justify-between border-b border-stone-800 bg-stone-950 px-4 py-3 shrink-0 select-none z-10"
          style={{ backgroundColor: '#0c0a09', borderColor: '#292524' }}
        >
          {/* Left: ☰ Chat History */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:text-white bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 transition cursor-pointer active:scale-95 shadow-xs"
              id="ai-editor-history-toggle-btn"
              title="Open Chat History"
            >
              <Menu className="h-4 w-4 text-stone-400" />
              <span className="hidden sm:inline">Chat History</span>
              {savedSessions.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono font-medium">
                  {savedSessions.length}
                </span>
              )}
            </button>
          </div>

          {/* Center: ✨ AI Video Editor */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-xs shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
                <span>AI Video Editor</span>
              </h2>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] text-stone-400">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${isExecuting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="truncate max-w-[130px] sm:max-w-none text-[10px] sm:text-[11px]">
                  {isExecuting
                    ? (activeActivityStep || 'Processing timeline edits...')
                    : 'Timeline Control Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Right & Far Right: ✎ New Chat + X Close */}
          <div className="flex items-center gap-2">
            {canRevert && (
              <button
                onClick={onRevertLastAISession}
                className="hidden md:flex items-center gap-1 rounded-lg bg-stone-900 px-2 py-1.5 text-[11px] font-medium text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800 transition"
                title="Undo last AI session"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Undo</span>
              </button>
            )}

            {/* ✎ New Chat */}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-200 hover:text-white bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 transition cursor-pointer active:scale-95 shadow-xs"
              id="ai-editor-new-chat-btn"
              title="Start a new conversation"
            >
              <SquarePen className="h-4 w-4 text-blue-400" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {/* X Close */}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-white transition cursor-pointer"
              title="Close AI Video Editor"
              id="ai-editor-close-btn"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Upload banner if uploading */}
        {uploadStatusText && (
          <div className="bg-blue-950/80 px-4 py-2 text-xs text-blue-300 border-b border-blue-800 flex items-center justify-between animate-in fade-in duration-150">
            <span className="flex items-center gap-2">
              {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{uploadStatusText}</span>
            </span>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. CHAT CONVERSATION STREAM (CHATGPT-STYLE)                */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: '#1c1917' }}>
          {messages.length === 0 ? (
            /* Empty State: ChatGPT-style welcome & quick action prompts */
            <div className="flex flex-col items-center justify-center min-h-[380px] text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 mb-4 shadow-md">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                How can I help edit your video?
              </h3>
              <p className="text-xs text-stone-400 max-w-sm mb-6 leading-relaxed">
                Directly command cuts, pacing, music ducking, captions, visual beat syncing, or auto-edits on your active timeline.
              </p>

              {/* Quick Action Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md text-left">
                <button
                  onClick={() => handleQuickAction('I want to make a video using my assets')}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-gradient-to-r from-blue-950/80 via-cyan-950/70 to-indigo-950/80 hover:from-blue-900/80 hover:to-cyan-900/70 border border-cyan-500/40 transition cursor-pointer group text-xs text-stone-300 shadow-md col-span-1 sm:col-span-2"
                >
                  <Layers className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span>Skill 1: The Assembler</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">Core Builder</span>
                    </span>
                    <span className="text-[11px] text-stone-300 block">Assemble timeline from voiceover, images/ZIP, and script beats</span>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickAction('Edit this into a 9:16 vertical YouTube Short / TikTok with active framing')}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-stone-700 transition cursor-pointer group text-xs text-stone-300 shadow-xs"
                >
                  <Tv className="h-4 w-4 text-blue-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-semibold text-white block">Turn into 9:16 Short</span>
                    <span className="text-[11px] text-stone-400">Crop and reformat for mobile</span>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickAction('Remove all long pauses and dead space greater than 0.8s')}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-stone-700 transition cursor-pointer group text-xs text-stone-300 shadow-xs"
                >
                  <Scissors className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-semibold text-white block">Remove Dead Space</span>
                    <span className="text-[11px] text-stone-400">Cut speaker pauses cleanly</span>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickAction('Add synchronized captions with active word highlights')}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-stone-700 transition cursor-pointer group text-xs text-stone-300 shadow-xs"
                >
                  <FileText className="h-4 w-4 text-purple-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-semibold text-white block">Add Dynamic Captions</span>
                    <span className="text-[11px] text-stone-400">Auto-subtitle speech beats</span>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickAction('Add background music ducked to 15% under voiceover')}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-stone-700 transition cursor-pointer group text-xs text-stone-300 shadow-xs"
                >
                  <Volume2 className="h-4 w-4 text-pink-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-semibold text-white block">Duck Music Under Voice</span>
                    <span className="text-[11px] text-stone-400">Lower music volume to 15%</span>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickAction('Match visual beats to audio using voiceover as the master clock and assemble on timeline')}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-stone-700 transition cursor-pointer group text-xs text-stone-300 shadow-xs"
                >
                  <Layers className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-semibold text-white block">Sync Images to Audio</span>
                    <span className="text-[11px] text-stone-400">Match visual assets to speech</span>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickAction('Edit this video yourself and make it professional with high engagement')}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-stone-700 transition cursor-pointer group text-xs text-stone-300 shadow-xs"
                >
                  <Wand2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-semibold text-white block">Creative Auto-Edit</span>
                    <span className="text-[11px] text-stone-400">Pacing, cuts & transitions</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* Message list */
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Assistant avatar indicator */}
                {msg.role !== 'user' && (
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] text-stone-400 font-medium pl-1">
                    <div className="h-4 w-4 rounded-md bg-blue-600/30 flex items-center justify-center text-blue-400 border border-blue-500/30">
                      <Sparkles className="h-2.5 w-2.5" />
                    </div>
                    <span>AI Video Editor</span>
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-xs shadow-sm'
                      : msg.role === 'system'
                      ? 'bg-stone-900 text-stone-300 border border-stone-800 rounded-tl-xs'
                      : 'bg-stone-800/90 text-stone-100 border border-stone-700/80 rounded-tl-xs shadow-sm'
                  }`}
                  style={
                    msg.role === 'user'
                      ? { backgroundColor: '#2563eb', color: '#ffffff' }
                      : msg.role === 'system'
                      ? { backgroundColor: '#1c1917', color: '#d6d3d1', borderColor: '#292524' }
                      : { backgroundColor: '#292524', color: '#f5f5f4', borderColor: '#44403c' }
                  }
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Skill 1: The Assembler Card if attached */}
                  {msg.assemblerSkill && (
                    <AssemblerSkillCard
                      data={msg.assemblerSkill}
                      isExecuting={isExecuting}
                      activeStepText={activeActivityStep}
                      onRunAssembler={(opts) => {
                        if (onRunAssemblerSkill) {
                          onRunAssemblerSkill(opts);
                        } else {
                          onSendMessage(`Assemble my video in ${opts.aspectRatio} aspect ratio`);
                        }
                      }}
                      onOpenReview={() => {
                        if (msg.editPlan) {
                          handleOpenVisualReview(msg.editPlan);
                        }
                      }}
                    />
                  )}

                  {/* Edit Plan Preview Card if attached */}
                  {msg.editPlan && (
                    <div className="mt-3 rounded-xl bg-stone-950 p-3.5 border border-stone-700/80 shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-xs">{msg.editPlan.title}</span>
                        <span className="text-[10px] text-blue-400 bg-blue-950 px-2 py-0.5 rounded-full border border-blue-800">
                          {msg.editPlan.projectType}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1 leading-normal">{msg.editPlan.description}</p>
                      
                      {/* Breakdown summary metrics */}
                      <div className="mt-2 text-[11px] text-stone-300 space-y-1 border-t border-stone-800/80 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span>📐 Aspect: {msg.editPlan.aspectRatio || '16:9'}</span>
                          <span>⏱️ Duration: {msg.editPlan.narrationDuration?.toFixed(1) || '0.0'}s</span>
                          <span className="text-cyan-400 font-semibold">🎬 Beats: {msg.editPlan.plannedVisualBeats || msg.editPlan.breakdown?.length || 0}</span>
                        </div>
                      </div>

                      {/* Intelligent Visual Sequence Preview */}
                      {msg.editPlan.breakdown && msg.editPlan.breakdown.length > 0 && (
                        <div className="mt-2.5 rounded-lg bg-stone-900/90 p-2 border border-stone-800 space-y-1.5 max-h-48 overflow-y-auto">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-300 pb-1 border-b border-stone-800">
                            <span className="flex items-center gap-1 text-cyan-400">
                              <Sparkles className="h-3 w-3" />
                              <span>Visual Plan Sequence</span>
                            </span>
                            <span className="text-stone-400 text-[10px]">
                              {msg.editPlan.breakdown.length} matched beats
                            </span>
                          </div>
                          {msg.editPlan.breakdown.slice(0, 5).map((beat, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-1.5 text-[10px] py-0.5 border-b border-stone-900/60 last:border-0">
                              <span className="font-mono text-cyan-400 font-bold shrink-0">
                                #{String(bIdx + 1).padStart(2, '0')}
                              </span>
                              <span className="text-stone-300 truncate flex-1" title={beat.text}>
                                "{beat.text}"
                              </span>
                              <span className="text-stone-500 font-mono text-[9px] shrink-0">
                                {beat.startTime.toFixed(1)}s-{(beat.startTime + beat.duration).toFixed(1)}s
                              </span>
                              <span className="text-emerald-400 font-medium truncate max-w-[120px] text-[9px] shrink-0 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-900/40" title={beat.matchedAssetName}>
                                {beat.matchedAssetName || 'Visual Clip'}
                              </span>
                            </div>
                          ))}
                          {msg.editPlan.breakdown.length > 5 && (
                            <div className="text-[10px] text-center text-stone-400 pt-0.5">
                              + {msg.editPlan.breakdown.length - 5} more beats in sequence...
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      {msg.editPlan.status !== 'completed' ? (
                        <div className="mt-3 flex flex-col gap-1.5">
                          {msg.editPlan.breakdown && msg.editPlan.breakdown.length > 0 && (
                            <button
                              onClick={() => handleOpenVisualReview(msg.editPlan!)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-cyan-300 border border-cyan-800/50 py-1.5 text-xs font-medium transition cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 text-cyan-400" />
                              <span>Review & Fine-Tune Visual Matches ({msg.editPlan.breakdown.length} Beats)</span>
                            </button>
                          )}
                          <button
                            onClick={() => onExecutePlan(msg.editPlan!)}
                            disabled={isExecuting}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white py-2 text-xs font-semibold shadow transition cursor-pointer"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>Apply Edit Plan to Timeline</span>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Applied to Timeline Engine</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span className="mt-1 text-[10px] text-stone-500 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}

          {/* AI Thinking / Executing Bubble */}
          {isExecuting && (
            <div className="flex flex-col items-start space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium pl-1">
                <div className="h-4 w-4 rounded-md bg-blue-600/30 flex items-center justify-center text-blue-400 border border-blue-500/30 animate-pulse">
                  <Sparkles className="h-2.5 w-2.5" />
                </div>
                <span>AI Video Editor</span>
              </div>
              <div className="rounded-2xl rounded-tl-xs bg-stone-800/80 border border-stone-700/80 px-4 py-3 text-xs text-stone-300 flex items-center gap-2.5 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
                <span>{activeActivityStep || 'Analyzing timeline and applying requested edits...'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips (above input) */}
        {messages.length > 0 && (
          <div className="px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-stone-800/60 bg-stone-950/60">
            <button
              onClick={() => handleQuickAction('I want to make a video using my assets')}
              className="shrink-0 px-2.5 py-1 rounded-full bg-cyan-950/60 hover:bg-cyan-900/80 text-[11px] text-cyan-300 hover:text-white border border-cyan-700/60 transition cursor-pointer font-semibold flex items-center gap-1"
            >
              <span>⚡ Skill 1: The Assembler</span>
            </button>
            <button
              onClick={() => handleQuickAction('Turn into 9:16 vertical Short')}
              className="shrink-0 px-2.5 py-1 rounded-full bg-stone-800/80 hover:bg-stone-700 text-[11px] text-stone-300 hover:text-white border border-stone-700/60 transition cursor-pointer"
            >
              📐 9:16 Short
            </button>
            <button
              onClick={() => handleQuickAction('Remove all speaker pauses greater than 0.8s')}
              className="shrink-0 px-2.5 py-1 rounded-full bg-stone-800/80 hover:bg-stone-700 text-[11px] text-stone-300 hover:text-white border border-stone-700/60 transition cursor-pointer"
            >
              ✂️ Cut Pauses
            </button>
            <button
              onClick={() => handleQuickAction('Add synchronized captions')}
              className="shrink-0 px-2.5 py-1 rounded-full bg-stone-800/80 hover:bg-stone-700 text-[11px] text-stone-300 hover:text-white border border-stone-700/60 transition cursor-pointer"
            >
              💬 Captions
            </button>
            <button
              onClick={() => handleQuickAction('Duck music to 15% under voice')}
              className="shrink-0 px-2.5 py-1 rounded-full bg-stone-800/80 hover:bg-stone-700 text-[11px] text-stone-300 hover:text-white border border-stone-700/60 transition cursor-pointer"
            >
              🎵 Duck Music
            </button>
            <button
              onClick={() => handleQuickAction('Sync images to audio master clock')}
              className="shrink-0 px-2.5 py-1 rounded-full bg-stone-800/80 hover:bg-stone-700 text-[11px] text-cyan-300 hover:text-white border border-cyan-800/50 transition cursor-pointer"
            >
              ⚡ Sync Images
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. CHATGPT-STYLE INPUT BAR                                 */}
        {/* ========================================================= */}
        <div
          className="border-t border-stone-800 bg-stone-950 p-3 space-y-2"
          style={{ backgroundColor: '#0c0a09', borderColor: '#292524' }}
        >
          
          {/* Pending Attachments Badges */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {pendingAttachments.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-1.5 rounded-lg bg-stone-800 px-2.5 py-1 text-xs text-stone-200 border border-stone-700"
                >
                  <span className="truncate max-w-[140px]">{asset.name}</span>
                  <button
                    onClick={() => setPendingAttachments((prev) => prev.filter((a) => a.id !== asset.id))}
                    className="text-stone-400 hover:text-red-400 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Attached Script Badge (270 Beats) */}
          {pastedScript && (
            <div className="flex items-center justify-between rounded-lg px-2.5 py-1 text-xs border bg-blue-950/40 border-blue-800/50 text-blue-300">
              <span className="flex items-center gap-1.5 truncate">
                <FileText className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                <span className="truncate font-medium">
                  {`Attached Script: ${pastedScript.split('\n').filter((l) => /\b\d+[\.\)]/.test(l)).length || pastedScript.split('\n').filter(Boolean).length} beats loaded`}
                </span>
              </span>
              <button
                onClick={() => setPastedScript('')}
                className="text-stone-400 hover:text-red-400 ml-2 cursor-pointer"
                title="Remove attached script"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Attached SRT Clock Badge (284 Subtitle Cues) */}
          {pastedSrt && (
            <div className="flex items-center justify-between rounded-lg px-2.5 py-1 text-xs border bg-emerald-950/50 border-emerald-700/60 text-emerald-300">
              <span className="flex items-center gap-1.5 truncate">
                <Subtitles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="truncate font-medium">
                  {`Attached SRT Clock: ${parseSrtText(pastedSrt).length} cues loaded (exact cuts)`}
                </span>
              </span>
              <button
                onClick={() => setPastedSrt('')}
                className="text-stone-400 hover:text-red-400 ml-2 cursor-pointer"
                title="Remove attached SRT"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ChatGPT-style Input Container */}
          <div
            className="rounded-2xl bg-stone-900 border border-stone-700/80 focus-within:border-blue-500/80 focus-within:ring-1 focus-within:ring-blue-500/30 p-2 shadow-inner transition"
            style={{ backgroundColor: '#1c1917', borderColor: '#44403c' }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message AI Video Editor (e.g. 'Match my 270 images to the script beats')..."
              className="w-full bg-transparent px-2 py-1 text-xs text-white placeholder-stone-500 focus:outline-none resize-none max-h-36 leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1.5 px-1 border-t border-stone-800/60 mt-1">
              <div className="flex items-center gap-1">
                {/* Media Attachment */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition cursor-pointer"
                  title="Attach media or ZIP archive"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="*/*,audio/*,video/*,image/*,text/*,application/octet-stream,.srt,.vtt,.txt,.zip"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                />

                {/* SRT Subtitle Attachment */}
                <button
                  onClick={() => srtFileInputRef.current?.click()}
                  className={`rounded-lg p-1.5 transition cursor-pointer ${
                    pastedSrt
                      ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/50'
                      : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                  }`}
                  title="Upload .SRT Subtitles file (used as master audio cut clock)"
                >
                  <Subtitles className="h-4 w-4" />
                </button>
                <input
                  ref={srtFileInputRef}
                  type="file"
                  accept="*/*,application/octet-stream,text/plain,text/*,.srt,.vtt,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files && e.target.files[0] && handleSrtUpload(e.target.files[0])}
                />

                {/* Narration Script Attachment Dialog */}
                <button
                  onClick={() => setScriptModalOpen(true)}
                  className={`rounded-lg p-1.5 transition cursor-pointer ${
                    pastedScript || pastedSrt
                      ? 'text-blue-400 bg-blue-950/40 border border-blue-800/50'
                      : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                  }`}
                  title="Attach Script (270 Beats) & SRT Clock (284 Cues)"
                >
                  <FileText className="h-4 w-4" />
                </button>

                <span className="hidden sm:inline text-[10px] text-stone-500 pl-1">
                  Enter to send, Shift+Enter for new line
                </span>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={isExecuting || (!inputText.trim() && pendingAttachments.length === 0 && !pastedScript && !pastedSrt)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
                  inputText.trim() || pendingAttachments.length > 0 || pastedScript || pastedSrt
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                    : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                }`}
                title="Send instruction to AI Video Editor"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 4. CHAT HISTORY SLIDE-IN OVERLAY PANEL (ChatGPT-STYLE)    */}
        {/* ========================================================= */}
        {isHistoryOpen && (
          <div
            className="absolute inset-0 z-40 flex flex-col bg-stone-950 text-white animate-in fade-in slide-in-from-left duration-200"
            style={{ backgroundColor: '#0c0a09' }}
            id="ai-editor-history-panel"
          >
            {/* History Header */}
            <div className="flex items-center justify-between border-b border-stone-800 p-3.5 bg-stone-900/95">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
                  title="Back to conversation"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Chat History</h3>
                </div>
              </div>

              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs active:scale-95"
                id="history-panel-new-chat-btn"
              >
                <SquarePen className="h-3.5 w-3.5" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Search & Filter */}
            <div className="p-3 border-b border-stone-800/80 bg-stone-900/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-500" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Search past conversations..."
                  className="w-full rounded-lg bg-stone-800/80 pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 border border-stone-700/60 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-stone-400 p-4">
                  <MessageSquare className="h-8 w-8 text-stone-600 mb-2 opacity-60" />
                  <p className="text-xs font-medium text-stone-300">
                    {historySearchQuery ? 'No matching conversations' : 'No saved conversations yet'}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1 max-w-xs">
                    {historySearchQuery
                      ? 'Try a different search keyword.'
                      : 'As you instruct the AI Video Editor, conversations and timeline context will be saved here.'}
                  </p>
                  <button
                    onClick={handleNewChat}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition cursor-pointer"
                  >
                    <SquarePen className="h-3.5 w-3.5 text-blue-400" />
                    <span>Start a new conversation</span>
                  </button>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const userMsgs = session.messages.filter((m) => m.role === 'user');
                  const lastMsg = session.messages[session.messages.length - 1];

                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className={`group flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                        isActive
                          ? 'bg-blue-950/50 border-blue-500/60 text-white shadow-xs'
                          : 'bg-stone-900/60 hover:bg-stone-800/80 border-stone-800 text-stone-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate text-white">
                            {session.title || 'Video Edit Conversation'}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded-full bg-blue-500/30 text-blue-300 text-[10px] font-medium shrink-0">
                              Active
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-stone-400 truncate mt-0.5">
                          {lastMsg?.content ? lastMsg.content.slice(0, 65) : `${session.messages.length} messages`}
                        </p>

                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-stone-500">
                          <span>{formatRelativeTime(session.updatedAt || session.createdAt)}</span>
                          <span>•</span>
                          <span>{userMsgs.length} prompt{userMsgs.length === 1 ? '' : 's'}</span>
                          {session.contextSnapshot?.videoClips && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400/90 font-medium">Timeline context saved</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="opacity-60 sm:opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/20 text-stone-500 hover:text-red-400 transition shrink-0 cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* History Footer */}
            <div className="p-3 border-t border-stone-800/80 bg-stone-900/70 flex items-center justify-between text-xs text-stone-400">
              <span>{savedSessions.length} saved conversation{savedSessions.length === 1 ? '' : 's'}</span>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-xs text-stone-300 hover:text-white px-2 py-1 rounded hover:bg-stone-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Script & SRT Modal (Dedicated Slots for 270 Beats and 284 SRT Cues) */}
      {scriptModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-stone-900 p-5 border border-stone-800 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Script Beats & SRT Subtitle Clock
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Pair your 270 script beats with your 284 SRT cues to get exact timeline cuts for all 270 images.
                  </p>
                </div>
              </div>
              <button onClick={() => setScriptModalOpen(false)} className="text-stone-400 hover:text-white cursor-pointer p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* SLOT 1: 270 NUMBERED SCRIPT BEATS */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-blue-300 flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-900/80 text-[10px] text-blue-200">1</span>
                  <span>Narration Script (e.g. 270 Numbered Beats for 270 Images)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-blue-400">
                    {pastedScript
                      ? `${pastedScript.split('\n').filter((l) => /\b\d+[\.\)]/.test(l)).length || pastedScript.split('\n').filter(Boolean).length} beats detected`
                      : '0 beats'}
                  </span>
                  {pastedScript && (
                    <button
                      type="button"
                      onClick={() => setPastedScript('')}
                      className="text-[10px] text-stone-500 hover:text-red-400 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Smart Helper: If user accidentally pasted SRT into Slot 1 */}
              {pastedScript && isSrtFormat(pastedScript) && !/\b\d+[\.\)]\s+[A-Za-z"“'‘]/.test(pastedScript) && (
                <div className="flex items-center justify-between rounded-lg bg-amber-950/40 border border-amber-700/60 p-2 text-xs text-amber-300">
                  <span>⚠️ You pasted an SRT subtitle format into Slot 1 (Script).</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPastedSrt(pastedScript);
                      setPastedScript('');
                    }}
                    className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-[11px] cursor-pointer"
                  >
                    Move to Slot 2 (SRT)
                  </button>
                </div>
              )}

              {/* Smart Helper: If user pasted mixed Script + SRT into Slot 1 */}
              {pastedScript && isSrtFormat(pastedScript) && /\b\d+[\.\)]\s+[A-Za-z"“'‘]/.test(pastedScript) && (
                <div className="flex items-center justify-between rounded-lg bg-blue-950/40 border border-blue-700/60 p-2 text-xs text-blue-300">
                  <span>💡 Mixed script and SRT cues detected in Slot 1.</span>
                  <button
                    type="button"
                    onClick={() => {
                      const sep = separateScriptAndSrt(pastedScript);
                      setPastedScript(sep.scriptText);
                      setPastedSrt(sep.srtText);
                    }}
                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] cursor-pointer"
                  >
                    Separate into Slot 1 & 2
                  </button>
                </div>
              )}

              <textarea
                rows={6}
                value={pastedScript}
                onChange={(e) => setPastedScript(e.target.value)}
                placeholder={'1. “At 8:17 on a Tuesday morning,”\n2. “the lights go out.”\n3. “Nobody panics.”\n... (up to 270 beats)'}
                className="w-full rounded-lg bg-stone-950 p-3 text-xs text-stone-200 placeholder-stone-600 border border-stone-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
              />
            </div>

            {/* SLOT 2: SRT SUBTITLE TIMING CLOCK */}
            <div className="space-y-1.5 pt-1 border-t border-stone-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-900/80 text-[10px] text-emerald-200">2</span>
                  <span>Audio Timestamps (.SRT Subtitles — e.g. 284 Cues)</span>
                </label>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => modalSrtInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80 transition cursor-pointer"
                  >
                    <Subtitles className="h-3.5 w-3.5" />
                    <span>Upload .SRT File</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clipText = await navigator.clipboard.readText();
                        if (clipText && clipText.trim()) {
                          setPastedSrt(clipText.trim());
                        }
                      } catch (err) {
                        console.warn('Clipboard read failed:', err);
                      }
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-stone-900 border border-stone-700 text-stone-300 hover:bg-stone-800 transition cursor-pointer"
                    title="Paste SRT text from clipboard"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    <span>Paste</span>
                  </button>
                  <input
                    ref={modalSrtInputRef}
                    type="file"
                    accept="*/*,application/octet-stream,text/plain,text/*,.srt,.vtt,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleSrtUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <span className="text-[11px] font-medium text-emerald-400">
                    {pastedSrt ? `${parseSrtText(pastedSrt).length} cues loaded` : '0 cues loaded'}
                  </span>
                  {pastedSrt && (
                    <button
                      type="button"
                      onClick={() => setPastedSrt('')}
                      className="text-[10px] text-stone-500 hover:text-red-400 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={6}
                value={pastedSrt}
                onChange={(e) => setPastedSrt(e.target.value)}
                placeholder={'1\n00:00:00,190 --> 00:00:02,150\nAt 8.17 on a Tuesday morning, the\n\n2\n00:00:02,150 --> 00:00:02,750\nlights go out.'}
                className="w-full rounded-lg bg-stone-950 p-3 text-xs text-stone-200 placeholder-stone-600 border border-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 resize-none font-mono"
              />
            </div>

            {/* Information Banner */}
            <div className="rounded-lg bg-stone-950/60 border border-stone-800 p-2.5 text-xs text-stone-300 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Exact Cut Calculation: </span>
                {pastedScript && pastedSrt
                  ? `Your ${pastedScript.split('\n').filter((l) => /\b\d+[\.\)]/.test(l)).length || 270} script beats will be calculated and matched against your ${parseSrtText(pastedSrt).length || 284} SRT cues. All images will snap to continuous, exact start and end times with 0 API quota.`
                  : pastedScript
                  ? `${pastedScript.split('\n').filter((l) => /\b\d+[\.\)]/.test(l)).length || 270} script beats provided. You can paste or upload your SRT file in Slot 2 to get millisecond cuts.`
                  : pastedSrt
                  ? `SRT provided (${parseSrtText(pastedSrt).length} cues). Paste your 270 beats in Slot 1 to calculate cuts for your exact beats.`
                  : `Paste your 270 beats in Slot 1 and your SRT in Slot 2 for the perfect 270-beat cut.`}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800">
              <span className="text-[11px] text-stone-500">
                {pastedScript && pastedSrt
                  ? '🟢 Both slots filled — ready for instant 270-beat calculation'
                  : 'Fill Slot 1 and Slot 2'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScriptModalOpen(false)}
                  className="rounded-lg bg-stone-800 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-700 transition cursor-pointer"
                >
                  Save & Apply
                </button>
                {pastedScript && (
                  <button
                    type="button"
                    onClick={() => {
                      setScriptModalOpen(false);
                      const beatCount =
                        pastedScript.split('\n').filter((l) => /\b\d+[\.\)]/.test(l)).length ||
                        pastedScript.split('\n').filter(Boolean).length ||
                        270;
                      onSendMessage(
                        `Match my ${beatCount} script beats to the SRT subtitles master clock`,
                        pendingAttachments,
                        pastedScript,
                        pastedSrt
                      );
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition cursor-pointer shadow-md"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>Calculate & Match Now</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Matching Review & Sequence Fine-Tuning Modal */}
      <VisualMatchingReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        beats={reviewBeats}
        onUpdateBeats={setReviewBeats}
        onCommitToTimeline={handleCommitVisualReview}
        availableAssets={registeredAssets}
        onRegisterAsset={(newAsset) => onUploadAssets?.([newAsset])}
        masterAudio={registeredAssets.find((a) => a.type === 'audio')}
        aspectRatio={reviewPlan?.aspectRatio || '16:9'}
      />

    </div>
  );
};
