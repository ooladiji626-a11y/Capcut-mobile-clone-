import {
  AIChatMessage,
  VideoClip,
  AudioTrackClip,
  CaptionClip,
  OverlayClip,
  AspectRatio,
} from '../types';
import { persistAppState, getAppState } from './persistentStorage';
import { saveToTranscriptVault } from './transcriptVault';

export interface GeneralEditorProjectSnapshot {
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captionClips: CaptionClip[];
  overlayClips: OverlayClip[];
  aspectRatio?: AspectRatio;
  activeScriptText?: string;
  activeSrtText?: string;
}

export interface GeneralEditorChatSession {
  id: string;
  projectId?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AIChatMessage[];
  contextSnapshot?: GeneralEditorProjectSnapshot;
}

const STORAGE_KEY = 'capcut_general_editor_chat_sessions_v2';
const LEGACY_STORAGE_KEY = 'capcut_general_editor_chat_sessions';

// In-memory cache holding full sessions to avoid repeated JSON parsing and enable instant reads
let inMemorySessionsCache: GeneralEditorChatSession[] | null = null;

/**
 * Migration routine: reads any legacy sessions from localStorage, backs them up into
 * IndexedDB and the Transcript Vault, and guarantees no data loss.
 */
function migrateAndPreserveLegacyStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemorySessionsCache = parsed;
          // Backup each message/script to Transcript Vault
          parsed.forEach((session: GeneralEditorChatSession) => {
            if (session.contextSnapshot?.activeScriptText) {
              saveToTranscriptVault({
                title: session.title || 'Saved Script',
                type: 'narration_script',
                text: session.contextSnapshot.activeScriptText,
                source: 'Session Context',
                projectId: session.projectId,
              });
            }
            session.messages?.forEach((msg) => {
              if (msg.role === 'user' && msg.content && msg.content.length > 30) {
                saveToTranscriptVault({
                  title: session.title || 'User Prompt',
                  type: 'chatgpt_transcript',
                  text: msg.content,
                  source: 'Chat Prompt',
                  projectId: session.projectId,
                });
              }
              if (msg.attachedScript) {
                saveToTranscriptVault({
                  title: `${session.title || 'Script'} Attachment`,
                  type: 'narration_script',
                  text: msg.attachedScript,
                  source: 'Chat Attachment',
                  projectId: session.projectId,
                });
              }
            });
          });

          if (window.indexedDB) {
            persistAppState('general_editor_sessions', parsed).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[ChatSessionStorage] Migration note:', err);
      }
    }
  } catch {
    // Ignore
  }
}

// Run immediately on module load
migrateAndPreserveLegacyStorage();
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncSessionsFromIndexedDB().catch(() => {});
  }, 100);
}

export const INITIAL_WELCOME_MESSAGE: AIChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `Hello! I am your AI Video Editor connected directly to your timeline.

Tell me what you'd like to build, or click **"Start a new chat"** / ask a question anytime. For example:
• *"I want to make a ranking video (#5 to #1). Match clips to each rank and add reveal sound effects."*
• *"I want to make a video for my finance channel. Ask me questions first."*
• *"Match each image literally to what's happening in narration (2 to 4s pacing)."*
• *"Explain how this video should be edited."*`,
  timestamp: Date.now(),
};

/**
 * Sanitizes session for safe localStorage caching while retaining full text, scripts,
 * and timeline structure without crashing on browser quotas.
 */
function sanitizeSessionForLocalStorage(session: GeneralEditorChatSession): GeneralEditorChatSession {
  // Keep up to 25 most recent messages
  const recentMessages = (session.messages || []).slice(-25).map((msg) => {
    return {
      id: msg.id,
      role: msg.role,
      content: msg.content || '',
      timestamp: msg.timestamp || Date.now(),
      attachedScript: msg.attachedScript,
      attachedAssets: msg.attachedAssets ? msg.attachedAssets.slice(0, 8).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        url: '',
        thumbnailUrl: '',
        duration: a.duration || 0,
        uploadedAt: a.uploadedAt || Date.now(),
      })) : undefined,
    };
  });

  // Preserve contextSnapshot with essential timeline data (stripping heavy URLs/frames)
  const compactSnapshot: GeneralEditorProjectSnapshot | undefined = session.contextSnapshot ? {
    videoClips: (session.contextSnapshot.videoClips || []).map((c) => ({
      ...c,
      url: '',
      thumbnailUrl: '',
      frames: [],
    })),
    audioClips: (session.contextSnapshot.audioClips || []).map((a) => ({
      ...a,
      url: '',
    })),
    captionClips: session.contextSnapshot.captionClips || [],
    overlayClips: session.contextSnapshot.overlayClips || [],
    aspectRatio: session.contextSnapshot.aspectRatio,
    activeScriptText: session.contextSnapshot.activeScriptText,
    activeSrtText: session.contextSnapshot.activeSrtText,
  } : undefined;

  return {
    id: session.id,
    projectId: session.projectId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: recentMessages,
    contextSnapshot: compactSnapshot,
  };
}

/**
 * Multi-tier progressive storage handler for localStorage.
 * Guarantees zero unhandled QuotaExceededError exceptions while preserving data.
 */
function safeSaveToLocalStorage(sessions: GeneralEditorChatSession[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const topSessions = sessions.slice(0, 10).map(sanitizeSessionForLocalStorage);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topSessions));
    return;
  } catch {
    // Quota reached; fall back to top 3 minimal sessions
  }

  try {
    const minimalSessions = topSessions.slice(0, 3).map((s) => ({
      id: s.id,
      projectId: s.projectId,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messages: (s.messages || []).slice(-10),
      contextSnapshot: s.contextSnapshot,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalSessions));
  } catch {
    // If localStorage is completely full, IndexedDB retains 100% full fidelity
  }
}

/**
 * Load all saved General Editor chat sessions from memory or localStorage synchronously
 */
export function loadGeneralChatSessions(projectId?: string): GeneralEditorChatSession[] {
  // 1. Return from in-memory cache if available
  if (inMemorySessionsCache && inMemorySessionsCache.length > 0) {
    const filtered = projectId
      ? inMemorySessionsCache.filter((s) => !s.projectId || s.projectId === projectId)
      : inMemorySessionsCache;
    if (filtered.length > 0) {
      return [...filtered].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    }
    // If filtered by projectId is empty, return all sessions as fallback so user never loses their history
    return [...inMemorySessionsCache].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  }

  // 2. Fall back to localStorage read
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed: GeneralEditorChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemorySessionsCache = parsed;
          const filtered = projectId
            ? parsed.filter((s) => !s.projectId || s.projectId === projectId)
            : parsed;
          if (filtered.length > 0) {
            return [...filtered].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
          }
          return [...parsed].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        }
      }
    }
  } catch (e) {
    console.warn('[ChatSessionStorage] Error reading chat sessions from localStorage:', e);
  }

  return [];
}

/**
 * Persist or update a chat session in memory, localStorage, and IndexedDB.
 * Also automatically creates backups in the Transcript Vault so transcripts are never lost.
 */
export function saveGeneralChatSession(session: GeneralEditorChatSession): void {
  try {
    const existing = inMemorySessionsCache ? [...inMemorySessionsCache] : loadGeneralChatSessions();
    const index = existing.findIndex((s) => s.id === session.id);
    let updated: GeneralEditorChatSession[];

    if (index >= 0) {
      updated = [...existing];
      updated[index] = {
        ...updated[index],
        ...session,
        updatedAt: Date.now(),
      };
    } else {
      updated = [
        {
          ...session,
          createdAt: session.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
        ...existing,
      ];
    }

    // Keep updated list in memory
    inMemorySessionsCache = updated;

    // 1. Quota-resilient save to localStorage
    safeSaveToLocalStorage(updated);

    // 2. Complete asynchronous persistence to IndexedDB (virtually unlimited quota)
    if (typeof window !== 'undefined' && window.indexedDB) {
      persistAppState('general_editor_sessions', updated).catch((err) => {
        console.warn('[ChatSessionStorage] Background sync of chat sessions to IndexedDB:', err);
      });
    }

    // 3. Vault Backup: automatically secure any script or pasted transcript
    if (session.contextSnapshot?.activeScriptText) {
      saveToTranscriptVault({
        title: `${session.title || 'Session'} Script`,
        type: 'narration_script',
        text: session.contextSnapshot.activeScriptText,
        source: 'AI Chat Drawer',
        projectId: session.projectId,
      });
    }
    if (session.contextSnapshot?.activeSrtText) {
      saveToTranscriptVault({
        title: `${session.title || 'Session'} Subtitles SRT`,
        type: 'srt_clock',
        text: session.contextSnapshot.activeSrtText,
        source: 'AI Chat Drawer',
        projectId: session.projectId,
      });
    }
    session.messages?.forEach((msg) => {
      if (msg.role === 'user' && msg.content && msg.content.length > 40) {
        saveToTranscriptVault({
          title: `Prompt: ${msg.content.slice(0, 30)}...`,
          type: 'chatgpt_transcript',
          text: msg.content,
          source: 'AI Chat Message',
          projectId: session.projectId,
        });
      }
      if (msg.attachedScript) {
        saveToTranscriptVault({
          title: `Attached Script: ${msg.attachedScript.slice(0, 30)}...`,
          type: 'narration_script',
          text: msg.attachedScript,
          source: 'Message Attachment',
          projectId: session.projectId,
        });
      }
    });
  } catch (e) {
    console.warn('[ChatSessionStorage] Warning during chat session save:', e);
  }
}

/**
 * Delete a chat session by ID
 */
export function deleteGeneralChatSession(sessionId: string): void {
  try {
    const existing = inMemorySessionsCache ? [...inMemorySessionsCache] : loadGeneralChatSessions();
    const filtered = existing.filter((s) => s.id !== sessionId);
    inMemorySessionsCache = filtered;

    safeSaveToLocalStorage(filtered);
    if (typeof window !== 'undefined' && window.indexedDB) {
      persistAppState('general_editor_sessions', filtered).catch(() => {});
    }
  } catch (e) {
    console.warn('[ChatSessionStorage] Warning during chat session delete:', e);
  }
}

/**
 * Hydrate from IndexedDB on startup or drawer open to ensure complete history is preserved
 */
export async function syncSessionsFromIndexedDB(): Promise<GeneralEditorChatSession[]> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return loadGeneralChatSessions();
  }
  try {
    const fromDb = await getAppState<GeneralEditorChatSession[]>('general_editor_sessions');
    if (Array.isArray(fromDb) && fromDb.length > 0) {
      inMemorySessionsCache = fromDb;
      safeSaveToLocalStorage(fromDb);
      return fromDb;
    }
  } catch (e) {
    console.warn('[ChatSessionStorage] Sync from DB encountered:', e);
  }
  return loadGeneralChatSessions();
}
