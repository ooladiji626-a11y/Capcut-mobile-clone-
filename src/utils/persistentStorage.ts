import {
  ProjectAsset,
  VideoClip,
  AudioTrackClip,
  CaptionClip,
  OverlayClip,
  AspectRatio,
  ProjectItem,
} from '../types';

export const DB_NAME = 'capcut_autoeditor_db';
export const DB_VERSION = 1;

export interface StoredFileRecord {
  id: string; // Asset/File unique ID
  name: string; // Original filename (e.g. Stickman_walking_into_bathroom.png)
  type: string; // MIME type (e.g. image/png, audio/mpeg)
  size: number; // File size in bytes
  lastModified: number; // Timestamp
  blob: Blob; // Actual binary blob
  projectId?: string;
  createdAt: number;
}

export interface StoredAssetMetadata {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio' | 'text';
  duration: number;
  width?: number;
  height?: number;
  uploadedAt: number;
  size?: number;
  textContent?: string;
  tags?: string[];
  rankingIndex?: number;
  waveformData?: number[];
  analysis?: ProjectAsset['analysis'];
  projectId?: string;
  thumbnailDataUrl?: string;
}

export interface StoredProjectRecord {
  id: string;
  name: string;
  thumbnailUrl?: string;
  aspectRatio: AspectRatio;
  duration: number;
  lastEdited: number;
  resolution: string;
  fps: number;
  category?: string;
  isFavorite?: boolean;
  activeScriptText?: string;
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  captionClips: CaptionClip[];
  overlayClips: OverlayClip[];
  assetIds: string[];
}

// Memory-tracked object URLs to allow clean revocation on reload/switch
const activeCreatedUrls = new Set<string>();

export function registerCreatedUrl(url: string): string {
  if (url && url.startsWith('blob:')) {
    activeCreatedUrls.add(url);
  }
  return url;
}

export function revokeAllCreatedUrls(): void {
  activeCreatedUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  });
  activeCreatedUrls.clear();
}

/**
 * Opens or upgrades the IndexedDB database safely without ever resetting existing data.
 */
let dbPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const timer = setTimeout(() => {
      dbPromise = null;
      reject(new Error('IndexedDB open timed out'));
    }, 1200);

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onblocked = () => {
        clearTimeout(timer);
        console.warn('[IndexedDB] Database open blocked.');
        if (request.result) resolve(request.result);
        else reject(new Error('IndexedDB blocked'));
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // 1. Files Store: holds actual Blobs
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('by_project', 'projectId', { unique: false });
          fileStore.createIndex('by_name', 'name', { unique: false });
        }

        // 2. Assets Metadata Store: fast queries without pulling large blobs
        if (!db.objectStoreNames.contains('assets_meta')) {
          const metaStore = db.createObjectStore('assets_meta', { keyPath: 'id' });
          metaStore.createIndex('by_project', 'projectId', { unique: false });
        }

        // 3. Projects Store: holds full project timelines and state
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        // 4. App State Store: holds active project ID, settings, screen
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        clearTimeout(timer);
        dbPromise = null;
        reject(request.error || new Error('Failed to open persistent storage database'));
      };
    } catch (err) {
      clearTimeout(timer);
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Checks storage quota and returns usage details.
 */
export async function checkStorageQuota(): Promise<{
  quota: number;
  usage: number;
  percentUsed: number;
  availableMb: number;
} | null> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await Promise.race([
        navigator.storage.estimate(),
        new Promise<StorageEstimate>((_, reject) => setTimeout(() => reject('timeout'), 500)),
      ]);
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const percentUsed = quota > 0 ? Number(((usage / quota) * 100).toFixed(1)) : 0;
      const availableMb = Math.max(0, Math.round((quota - usage) / (1024 * 1024)));
      return { quota, usage, percentUsed, availableMb };
    } catch {
      return null;
    }
  }
  return null;
}

// ============================================================================
// FILE / BLOB PERSISTENCE
// ============================================================================

/**
 * Persists an original uploaded File / Blob into IndexedDB.
 * Does not rename the file or duplicate binary data.
 */
export async function persistFile(
  file: File | Blob,
  assetId: string,
  originalFilename: string,
  projectId?: string
): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files'], 'readwrite');
    const store = tx.objectStore('files');

    const record: StoredFileRecord = {
      id: assetId,
      name: originalFilename,
      type: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: 'lastModified' in file ? file.lastModified : Date.now(),
      blob: file,
      projectId,
      createdAt: Date.now(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error(`Failed to persist file ${originalFilename}`));
  });
}

/**
 * Retrieves a persisted file record by ID.
 */
export async function getPersistedFile(assetId: string): Promise<StoredFileRecord | null> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files'], 'readonly');
    const store = tx.objectStore('files');
    const req = store.get(assetId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a persisted file record by ID.
 */
export async function deletePersistedFile(assetId: string): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files'], 'readwrite');
    const store = tx.objectStore('files');
    const req = store.delete(assetId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============================================================================
// ASSET PERSISTENCE & RECONSTRUCTION
// ============================================================================

/**
 * Persists a ProjectAsset and its underlying File/Blob.
 */
export async function persistAsset(asset: ProjectAsset, projectId?: string): Promise<void> {
  const db = await getDatabase();

  // 1. If asset has a real File or Blob, store binary in files store
  if (asset.file) {
    await persistFile(asset.file, asset.id, asset.name, projectId);
  }

  // 2. Store metadata in assets_meta store
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['assets_meta'], 'readwrite');
    const store = tx.objectStore('assets_meta');

    const meta: StoredAssetMetadata = {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      uploadedAt: asset.uploadedAt,
      size: asset.size || asset.file?.size,
      textContent: asset.textContent,
      tags: asset.tags,
      rankingIndex: asset.rankingIndex,
      waveformData: asset.waveformData,
      analysis: asset.analysis,
      projectId,
      // NEVER store base64 image data in storage
      thumbnailDataUrl: undefined,
    };

    const req = store.put(meta);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error(`Failed to persist asset metadata for ${asset.name}`));
  });
}

/**
 * Persists multiple ProjectAssets in batch.
 */
export async function persistAssetsBatch(assets: ProjectAsset[], projectId?: string): Promise<void> {
  for (const asset of assets) {
    try {
      await persistAsset(asset, projectId);
    } catch (err) {
      console.warn(`[PersistentStorage] Warning saving asset ${asset.name}:`, err);
    }
  }
}

/**
 * Deletes an asset metadata and its associated file blob.
 */
export async function deleteAsset(assetId: string): Promise<void> {
  const db = await getDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['assets_meta'], 'readwrite');
    const store = tx.objectStore('assets_meta');
    const req = store.delete(assetId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  await deletePersistedFile(assetId);
}

/**
 * Restores all ProjectAssets from IndexedDB, reconstructing native File objects and fresh object URLs.
 */
export async function restoreAllAssets(projectId?: string): Promise<ProjectAsset[]> {
  try {
    const db = await getDatabase();

    // 1. Get all asset metadata with 800ms timeout
    const metaList = await new Promise<StoredAssetMetadata[]>((resolve) => {
      const timer = setTimeout(() => resolve([]), 800);
      try {
        const tx = db.transaction(['assets_meta'], 'readonly');
        const store = tx.objectStore('assets_meta');
        let req: IDBRequest;

        if (projectId) {
          const idx = store.index('by_project');
          req = idx.getAll(projectId);
        } else {
          req = store.getAll();
        }

        req.onsuccess = () => {
          clearTimeout(timer);
          resolve(req.result || []);
        };
        req.onerror = () => {
          clearTimeout(timer);
          resolve([]);
        };
      } catch {
        clearTimeout(timer);
        resolve([]);
      }
    });

    if (metaList.length === 0) return [];

    // 2. Fetch corresponding file blobs and reconstruct usable File objects and URLs
    const restoredAssets: ProjectAsset[] = [];

    for (const meta of metaList) {
      try {
        const fileRecord = await Promise.race([
          getPersistedFile(meta.id),
          new Promise<StoredFileRecord | null>((r) => setTimeout(() => r(null), 300)),
        ]);
        let file: File | undefined;
        let url = '';
        let thumbnailUrl = meta.thumbnailDataUrl || '';

        if (fileRecord && fileRecord.blob) {
          // Reconstruct true native browser File object with exact original name
          file = new File([fileRecord.blob], fileRecord.name || meta.name, {
            type: fileRecord.type || (meta.type === 'audio' ? 'audio/mpeg' : meta.type === 'video' ? 'video/mp4' : 'image/png'),
            lastModified: fileRecord.lastModified || Date.now(),
          });
          url = registerCreatedUrl(URL.createObjectURL(file));
          if (!thumbnailUrl) {
            thumbnailUrl = meta.type === 'image' ? url : (meta.type === 'audio' ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80' : url);
          }
        } else {
          url = meta.type === 'audio'
            ? 'https://actions.google.com/sounds/v1/ambiences/outdoor_rain.ogg'
            : 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1280&auto=format&fit=crop&q=80';
          if (!thumbnailUrl) thumbnailUrl = url;
        }

        restoredAssets.push({
          id: meta.id,
          name: meta.name,
          type: meta.type,
          url,
          thumbnailUrl,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          uploadedAt: meta.uploadedAt,
          size: meta.size || file?.size,
          textContent: meta.textContent,
          file,
          tags: meta.tags,
          rankingIndex: meta.rankingIndex,
          waveformData: meta.waveformData,
          analysis: meta.analysis,
        });
      } catch (err) {
        console.warn(`[PersistentStorage] Could not restore asset ${meta.name} (${meta.id}):`, err);
      }
    }

    return restoredAssets;
  } catch {
    return [];
  }
}

// ============================================================================
// PROJECT PERSISTENCE & RESTORATION
// ============================================================================

export interface LightweightClipMeta {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  trackId?: string;
  beatIndex?: number;
}

/**
 * Saves only lightweight clip metadata to localStorage:
 * { id, name, startTime, duration, trackId, beatIndex }
 * NEVER store base64 image data or file buffers in localStorage.
 */
export function saveClipsMetadataToLocalStorage(clips: VideoClip[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const lightweight: LightweightClipMeta[] = clips.map((c, idx) => ({
      id: c.id,
      name: c.title,
      startTime: c.timelineStart ?? 0,
      duration: c.duration,
      trackId: 'video-track',
      beatIndex: (c as any).beatIndex ?? idx + 1,
    }));
    window.localStorage.setItem('timeline_clips_metadata', JSON.stringify(lightweight));
  } catch (err) {
    console.warn('[PersistentStorage] Notice saving lightweight clip metadata to localStorage:', err);
  }
}

export function getClipsMetadataFromLocalStorage(): LightweightClipMeta[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem('timeline_clips_metadata');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Sanitizes VideoClips and AudioClips for storage (stripping ephemeral object URLs and heavy base64 data).
 */
function sanitizeClipsForStorage<T extends { url?: string; file?: File; thumbnailUrl?: string; frames?: string[] }>(clips: T[]): T[] {
  return clips.map((clip) => {
    const { url, file, ...rest } = clip as any;
    // Strip base64 image strings to guarantee zero storage quota crashes
    const safeThumbnail =
      typeof rest.thumbnailUrl === 'string' && rest.thumbnailUrl.startsWith('data:')
        ? ''
        : rest.thumbnailUrl;
    const safeFrames = Array.isArray(rest.frames)
      ? rest.frames.filter((f: any) => typeof f === 'string' && !f.startsWith('data:'))
      : [];

    return {
      ...rest,
      thumbnailUrl: safeThumbnail,
      frames: safeFrames,
    } as T;
  });
}

/**
 * Persists an entire project's state.
 */
export async function persistProject(project: StoredProjectRecord): Promise<void> {
  // Save lightweight clip metadata to localStorage without base64 or binary data
  saveClipsMetadataToLocalStorage(project.videoClips || []);

  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects'], 'readwrite');
    const store = tx.objectStore('projects');

    const cleanThumbnail =
      project.thumbnailUrl && project.thumbnailUrl.startsWith('data:')
        ? ''
        : project.thumbnailUrl;

    const cleanRecord: StoredProjectRecord = {
      ...project,
      thumbnailUrl: cleanThumbnail,
      lastEdited: Date.now(),
      videoClips: sanitizeClipsForStorage(project.videoClips || []),
      audioClips: sanitizeClipsForStorage(project.audioClips || []),
    };

    const req = store.put(cleanRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error(`Failed to save project ${project.name}`));
  });
}

/**
 * Retrieves a project by ID from IndexedDB.
 */
export async function getPersistedProject(projectId: string): Promise<StoredProjectRecord | null> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects'], 'readonly');
    const store = tx.objectStore('projects');
    const req = store.get(projectId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all saved projects from IndexedDB.
 */
export async function getAllPersistedProjects(): Promise<StoredProjectRecord[]> {
  try {
    const db = await getDatabase();
    return await new Promise<StoredProjectRecord[]>((resolve) => {
      const timer = setTimeout(() => resolve([]), 800);
      try {
        const tx = db.transaction(['projects'], 'readonly');
        const store = tx.objectStore('projects');
        const req = store.getAll();
        req.onsuccess = () => {
          clearTimeout(timer);
          resolve(req.result || []);
        };
        req.onerror = () => {
          clearTimeout(timer);
          resolve([]);
        };
      } catch {
        clearTimeout(timer);
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

/**
 * Deletes a project by ID.
 */
export async function deletePersistedProject(projectId: string): Promise<void> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects'], 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.delete(projectId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error
  }
}

// ============================================================================
// APP STATE (ACTIVE PROJECT ID, SCREEN)
// ============================================================================

export async function persistAppState(key: string, value: any): Promise<void> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['app_state'], 'readwrite');
      const store = tx.objectStore('app_state');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error
  }
}

export async function getAppState<T>(key: string): Promise<T | null> {
  try {
    const db = await getDatabase();
    return await new Promise<T | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 500);
      try {
        const tx = db.transaction(['app_state'], 'readonly');
        const store = tx.objectStore('app_state');
        const req = store.get(key);
        req.onsuccess = () => {
          clearTimeout(timer);
          resolve(req.result ? (req.result.value as T) : null);
        };
        req.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

// ============================================================================
// TIMELINE RECONSTRUCTION (RECONNECTING CLIPS TO RESTORED ASSETS)
// ============================================================================

/**
 * Connects restored VideoClips and AudioClips to restored ProjectAssets so they
 * receive valid browser File instances and fresh object URLs.
 */
export function reconnectTimelineToAssets(
  storedVideoClips: VideoClip[],
  storedAudioClips: AudioTrackClip[],
  restoredAssets: ProjectAsset[]
): {
  reconnectedVideoClips: VideoClip[];
  reconnectedAudioClips: AudioTrackClip[];
} {
  const assetMap = new Map<string, ProjectAsset>();
  const nameMap = new Map<string, ProjectAsset>();

  restoredAssets.forEach((asset) => {
    assetMap.set(asset.id, asset);
    nameMap.set(asset.name.toLowerCase(), asset);
  });

  const reconnectedVideoClips: VideoClip[] = storedVideoClips.map((clip) => {
    // Find matching asset by ID or filename
    const matchedAsset =
      (clip.assetId && assetMap.get(clip.assetId)) ||
      (clip.sourceAssetId && assetMap.get(clip.sourceAssetId)) ||
      nameMap.get(clip.title.toLowerCase()) ||
      restoredAssets.find((a) => (a.type === 'video' || a.type === 'image') && a.name.includes(clip.title));

    if (matchedAsset && matchedAsset.url) {
      return {
        ...clip,
        url: matchedAsset.url,
        file: matchedAsset.file,
        thumbnailUrl: clip.thumbnailUrl || matchedAsset.thumbnailUrl || matchedAsset.url,
        frames: clip.frames && clip.frames.length > 0 ? clip.frames : [matchedAsset.thumbnailUrl || matchedAsset.url],
        assetId: matchedAsset.id,
      };
    }

    return clip;
  });

  const reconnectedAudioClips: AudioTrackClip[] = storedAudioClips.map((audio) => {
    const matchedAsset =
      (audio.id && assetMap.get(audio.id)) ||
      nameMap.get(audio.title.toLowerCase()) ||
      restoredAssets.find((a) => a.type === 'audio' && a.name.includes(audio.title));

    if (matchedAsset && matchedAsset.url) {
      return {
        ...audio,
        url: matchedAsset.url,
        file: matchedAsset.file,
        waveformData: audio.waveformData && audio.waveformData.length > 0 ? audio.waveformData : (matchedAsset.waveformData || []),
      };
    }

    return audio;
  });

  return { reconnectedVideoClips, reconnectedAudioClips };
}

// ============================================================================
// PROJECT BACKUP EXPORT & IMPORT (ZIP / JSON ARCHIVE)
// ============================================================================

import JSZip from 'jszip';

export async function exportProjectArchive(projectId: string): Promise<Blob> {
  const project = await getPersistedProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found for export.`);

  const assets = await restoreAllAssets(projectId);
  const zip = new JSZip();

  // 1. Write project metadata JSON
  zip.file('project.json', JSON.stringify(project, null, 2));

  // 2. Create media folder with original files
  const mediaFolder = zip.folder('media');
  if (mediaFolder) {
    for (const asset of assets) {
      if (asset.file) {
        mediaFolder.file(asset.name, asset.file);
      }
    }
  }

  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function importProjectArchive(file: File): Promise<{
  project: StoredProjectRecord;
  assets: ProjectAsset[];
}> {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid project backup: project.json missing.');

  const projectText = await projectFile.async('text');
  const projectData: StoredProjectRecord = JSON.parse(projectText);

  // Assign a fresh ID if needed or preserve
  const projectId = projectData.id || `proj-${Date.now()}`;
  projectData.id = projectId;

  const restoredAssets: ProjectAsset[] = [];
  const mediaFolder = zip.folder('media');

  if (mediaFolder) {
    const files = mediaFolder.filter((_, f) => !f.dir);
    for (const entry of files) {
      const blob = await entry.async('blob');
      const filename = entry.name.replace(/^media\//, '');
      const mimeType = blob.type || (filename.endsWith('.mp3') || filename.endsWith('.wav') ? 'audio/mpeg' : filename.endsWith('.mp4') ? 'video/mp4' : 'image/png');
      const reconstitutedFile = new File([blob], filename, { type: mimeType, lastModified: Date.now() });

      const assetId = `asset-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      await persistFile(reconstitutedFile, assetId, filename, projectId);

      const url = registerCreatedUrl(URL.createObjectURL(reconstitutedFile));
      const type = mimeType.startsWith('audio') ? 'audio' : mimeType.startsWith('video') ? 'video' : 'image';

      const asset: ProjectAsset = {
        id: assetId,
        name: filename,
        type,
        url,
        thumbnailUrl: url,
        duration: 5.0,
        uploadedAt: Date.now(),
        file: reconstitutedFile,
      };

      await persistAsset(asset, projectId);
      restoredAssets.push(asset);
    }
  }

  await persistProject(projectData);
  return { project: projectData, assets: restoredAssets };
}
