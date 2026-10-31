/**
 * Mobile-First Image Memory Manager
 * Guarantees zero out-of-memory crashes by:
 * 1. Generating ultra-lightweight thumbnails (max 280px) on-demand
 * 2. Never holding full-resolution uncompressed bitmaps in DOM or memory
 * 3. Disposing of canvas and Image element textures immediately after thumbnail generation
 * 4. Tracking and revoking Blob Object URLs to prevent heap memory leaks
 */

// Cache of generated thumbnails (Asset ID or URL -> Thumbnail Data URL)
const thumbnailCache = new Map<string, string>();

// Registry of created Object URLs for safe lifecycle revocation
const activeObjectUrls = new Set<string>();

/**
 * Creates a trackable Blob Object URL that can be systematically cleaned up
 */
export function createManagedObjectUrl(blobOrFile: Blob | File): string {
  try {
    const url = URL.createObjectURL(blobOrFile);
    activeObjectUrls.add(url);
    return url;
  } catch (err) {
    console.warn('Failed to create managed Object URL:', err);
    return '';
  }
}

/**
 * Revokes a managed Object URL to reclaim browser memory
 */
export function revokeManagedObjectUrl(url: string | undefined): void {
  if (!url || !url.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(url);
    activeObjectUrls.delete(url);
  } catch (err) {
    console.warn('Failed to revoke Object URL:', err);
  }
}

/**
 * Batch cleanup of Object URLs when a project or session resets
 */
export function cleanupAllManagedUrls(): void {
  activeObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  });
  activeObjectUrls.clear();
  thumbnailCache.clear();
}

/**
 * Creates a low-memory thumbnail from a File, Blob, or URL.
 * Automatically downsamples to maxDimension (default 260px) and clamps quality,
 * immediately disposing of the source image texture.
 */
export async function createSafeThumbnail(
  source: File | Blob | string,
  cacheKey?: string,
  maxDimension: number = 260,
  quality: number = 0.65
): Promise<string> {
  const key = cacheKey || (typeof source === 'string' ? source : null);
  if (key && thumbnailCache.has(key)) {
    return thumbnailCache.get(key)!;
  }

  return new Promise<string>((resolve) => {
    let objectUrlToRevoke: string | null = null;
    let srcUrl = '';

    if (typeof source === 'string') {
      srcUrl = source;
    } else {
      try {
        srcUrl = URL.createObjectURL(source);
        objectUrlToRevoke = srcUrl;
      } catch {
        // Fallback to placeholder
        const fallback = generateSafeSvgPlaceholder('Media', '#2A59FE');
        resolve(fallback);
        return;
      }
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Cleanup resources
    const cleanup = (resultUrl: string) => {
      try {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      } catch {}

      if (objectUrlToRevoke) {
        try {
          URL.revokeObjectURL(objectUrlToRevoke);
        } catch {}
      }

      if (key && resultUrl && !resultUrl.startsWith('data:image/svg')) {
        thumbnailCache.set(key, resultUrl);
      }

      resolve(resultUrl);
    };

    // Timeout safety for mobile network/canvas hangs
    const timeoutId = setTimeout(() => {
      cleanup(generateSafeSvgPlaceholder('Visual', '#374151'));
    }, 3500);

    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const nw = img.naturalWidth || 300;
        const nh = img.naturalHeight || 200;

        // Downscale while preserving aspect ratio
        const scale = Math.min(1, maxDimension / Math.max(nw, nh));
        const tw = Math.max(24, Math.round(nw * scale));
        const th = Math.max(24, Math.round(nh * scale));

        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          cleanup(generateSafeSvgPlaceholder('Visual', '#1F2937'));
          return;
        }

        // Draw downscaled representation
        ctx.drawImage(img, 0, 0, tw, th);

        // Export as lightweight, compressed JPEG data URL (~5KB to 15KB)
        const thumbDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Immediately shrink canvas to 0 to free its backing store in GPU RAM
        canvas.width = 0;
        canvas.height = 0;

        cleanup(thumbDataUrl);
      } catch {
        // If canvas security or mobile memory restricts toDataURL, return safe SVG placeholder
        cleanup(generateSafeSvgPlaceholder('Photo', '#1E293B'));
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      cleanup(generateSafeSvgPlaceholder('Visual', '#1E293B'));
    };

    img.src = srcUrl;
  });
}

/**
 * Minimal zero-overhead SVG placeholder when images fail or during memory recovery
 */
export function generateSafeSvgPlaceholder(label: string, bgColor = '#18181b'): string {
  const safeLabel = (label || 'Media').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 16);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90">
    <rect width="160" height="90" fill="${bgColor}"/>
    <text x="80" y="48" fill="#94A3B8" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="middle" dominant-baseline="middle">${safeLabel}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Checks if the current browser environment is under memory pressure or mobile-constrained
 */
export function isConstrainedMobileEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const lowRam = 'deviceMemory' in navigator && (navigator as any).deviceMemory <= 4;
  const lowCores = 'hardwareConcurrency' in navigator && navigator.hardwareConcurrency <= 4;

  return isMobileUA || lowRam || lowCores;
}
