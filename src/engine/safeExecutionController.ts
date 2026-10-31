import {
  VideoClip,
  AudioTrackClip,
  CaptionClip,
  OverlayClip,
  ProjectAsset,
  AspectRatio,
} from '../types';
import {
  ExplicitActionType,
  EditorContextSnapshot,
  CommandCondition,
  DetectedCommandAction,
} from './chatIntentDetector';
import { ActionExecutorUpdaters, ActionExecutionResult } from './chatActionExecutor';

export type LifecycleStatus =
  | 'PENDING'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'SUCCESS'
  | 'FAILED'
  | 'NEEDS_CLARIFICATION'
  | 'RETRY_ONCE'
  | 'LOOP_BLOCKED';

export interface ExecutionLogPayload {
  request: string;
  executionId: string;
  intent: string;
  action: ExplicitActionType | string;
  target: string;
  beforeState: string;
  executionResult: 'success' | 'failed';
  afterState: string;
  verificationResult: 'PASSED' | 'FAILED';
  retryCount: number;
  finalStatus: 'SUCCESS' | 'COMPLETED' | 'FAILED' | 'LOOP_BLOCKED';
}

/**
 * Lightweight development execution logging (Section 15).
 */
export function logAiExec(
  requestId: string,
  action: string,
  status: LifecycleStatus,
  intent: string = 'EDIT_COMMAND',
  verification?: boolean
): void {
  if (status === 'EXECUTING') {
    console.log(`[AI EXEC] request=${requestId}\nintent=${intent}\naction=${action}\nstatus=EXECUTING`);
  } else if (status === 'VERIFYING') {
    console.log(`[AI EXEC] request=${requestId}\naction=${action}\nstatus=VERIFYING`);
  } else if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'FAILED' || status === 'LOOP_BLOCKED') {
    const canonicalStatus = status === 'SUCCESS' ? 'COMPLETED' : status;
    const ver = verification !== undefined ? verification : (canonicalStatus === 'COMPLETED');
    console.log(`[AI EXEC] request=${requestId}\naction=${action}\nverification=${ver}\nstatus=${canonicalStatus}`);
  }
}

/**
 * Prints the structured debug execution log (Section 23).
 */
export function logStructuredExecution(log: ExecutionLogPayload): void {
  console.log(
`REQUEST: ${log.request}
executionId: ${log.executionId}
intent: ${log.intent}
action: ${log.action}
target: ${log.target}
BEFORE_STATE: ${log.beforeState}
EXECUTION_START
EXECUTION_RESULT: ${log.executionResult}
AFTER_STATE: ${log.afterState}
VERIFICATION_RESULT: ${log.verificationResult}
RETRY_COUNT: ${log.retryCount}
FINAL_STATUS: ${log.finalStatus}`
  );
}

export interface ExecutionRecord {
  executionId: string;
  fingerprint: string;
  actionType: ExplicitActionType;
  targetId?: string;
  status: LifecycleStatus;
  timestamp: number;
  result: ActionExecutionResult;
  stateSignature?: string;
}

/**
 * Global In-Memory Idempotency & Loop-Detection Registry (Singleton)
 */
class ExecutionRegistry {
  private completedExecutions = new Map<string, ExecutionRecord>();
  private activeExecutionIds = new Set<string>();
  private requestStatuses = new Map<string, LifecycleStatus>();
  private requestResults = new Map<string, ActionExecutionResult>();
  private recentAttempts: Array<{
    actionType: string;
    targetId?: string;
    paramsKey: string;
    timestamp: number;
    success: boolean;
    stateSignature: string;
  }> = [];

  public generateExecutionId(prefix = 'edit'): string {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 6);
    return `${prefix}_${ymd}_${rand}`;
  }

  public getStatus(requestId: string): LifecycleStatus | undefined {
    return this.requestStatuses.get(requestId);
  }

  public setStatus(requestId: string, status: LifecycleStatus): void {
    this.requestStatuses.set(requestId, status);
    if (status === 'EXECUTING' || status === 'VERIFYING') {
      this.activeExecutionIds.add(requestId);
    } else {
      this.activeExecutionIds.delete(requestId);
    }
  }

  public getResult(requestId: string): ActionExecutionResult | undefined {
    return this.requestResults.get(requestId);
  }

  public setResult(requestId: string, result: ActionExecutionResult): void {
    this.requestResults.set(requestId, result);
  }

  public computeStateSignature(snapshot: EditorContextSnapshot): string {
    const clips = snapshot.videoClips.map((c) => `${c.id}:${c.duration.toFixed(2)}:${c.timelineStart ?? 0}`).join(',');
    const audios = snapshot.audioClips.map((a) => `${a.id}:${a.volume ?? 100}`).join(',');
    const caps = snapshot.captions.length;
    const overs = snapshot.overlays.length;
    const assets = snapshot.registeredAssets?.length || 0;
    return `v[${clips}]|a[${audios}]|c[${caps}]|o[${overs}]|ast[${assets}]|sel[${snapshot.selectedClipId || 'none'}]|ar[${snapshot.aspectRatio}]`;
  }

  public computeFingerprint(
    actionType: ExplicitActionType,
    targetId?: string,
    parameters?: any
  ): string {
    const pStr = parameters ? JSON.stringify(parameters) : '';
    return `${actionType}::${targetId || 'any'}::${pStr}`;
  }

  public isAlreadyExecuting(executionId: string): boolean {
    return this.activeExecutionIds.has(executionId);
  }

  public markExecuting(executionId: string): void {
    this.activeExecutionIds.add(executionId);
  }

  public markFinished(executionId: string): void {
    this.activeExecutionIds.delete(executionId);
  }

  public getCompleted(executionId: string): ExecutionRecord | undefined {
    return this.completedExecutions.get(executionId);
  }

  public findRecentDuplicate(
    fingerprint: string,
    stateSignature?: string,
    maxAgeMs = 3000
  ): ExecutionRecord | undefined {
    const now = Date.now();
    for (const record of this.completedExecutions.values()) {
      if (record.fingerprint === fingerprint && now - record.timestamp < maxAgeMs) {
        if (stateSignature && record.stateSignature && record.stateSignature !== stateSignature) {
          continue;
        }
        return record;
      }
    }
    return undefined;
  }

  public recordCompleted(record: ExecutionRecord): void {
    this.completedExecutions.set(record.executionId, record);
    // Keep cache size bounded
    if (this.completedExecutions.size > 200) {
      const oldestKey = this.completedExecutions.keys().next().value;
      if (oldestKey) this.completedExecutions.delete(oldestKey);
    }
  }

  public checkLoop(
    actionType: string,
    targetId: string | undefined,
    paramsKey: string,
    stateSignature: string
  ): boolean {
    const now = Date.now();
    // Prune attempts older than 15 seconds
    this.recentAttempts = this.recentAttempts.filter((a) => now - a.timestamp < 15000);

    const matches = this.recentAttempts.filter(
      (a) =>
        a.actionType === actionType &&
        a.targetId === targetId &&
        a.paramsKey === paramsKey &&
        a.stateSignature === stateSignature
    );

    // If the exact same action on the exact same state without progression occurred >= 2 times
    return matches.length >= 2;
  }

  public recordAttempt(
    actionType: string,
    targetId: string | undefined,
    paramsKey: string,
    success: boolean,
    stateSignature: string
  ): void {
    this.recentAttempts.push({
      actionType,
      targetId,
      paramsKey,
      timestamp: Date.now(),
      success,
      stateSignature,
    });
  }

  public reset(): void {
    this.completedExecutions.clear();
    this.activeExecutionIds.clear();
    this.requestStatuses.clear();
    this.requestResults.clear();
    this.recentAttempts = [];
  }
}

export const executionRegistry = new ExecutionRegistry();

export interface ExecutionOptions {
  executionId?: string;
  requestText?: string;
  allowOneRetryOnRecoverableFailure?: boolean;
  onSimulatedAttemptFailure?: (attempt: number) => boolean; // For testing controlled retries
  forceTargetDiscrepancy?: boolean; // For testing unrelated state mutation detection (Test G)
  isUserCorrection?: boolean;
  isSeparateCommand?: boolean;
}

/**
 * Validates whether the target clip for an action exists and is not stale.
 * Returns { valid: true, targetClip } or { valid: false, reason: string }
 */
export function validateActionTarget(
  actionType: ExplicitActionType,
  parameters: any,
  snapshot: EditorContextSnapshot
): { valid: boolean; targetClip?: VideoClip; reason?: string } {
  // Actions that target video clips
  const clipTargetingActions: ExplicitActionType[] = [
    'DELETE_SELECTED_CLIP',
    'DELETE_CLIP',
    'MOVE_CLIP',
    'TRIM_CLIP',
    'SET_CLIP_DURATION',
    'SPLIT_CLIP',
    'DUPLICATE_CLIP',
    'ADD_OVERLAY',
  ];

  if (!clipTargetingActions.includes(actionType)) {
    return { valid: true };
  }

  if (snapshot.videoClips.length === 0) {
    return { valid: false, reason: "The timeline is empty." };
  }

  // 1. Explicit clip ID provided
  if (parameters?.clipId) {
    const found = snapshot.videoClips.find((c) => c.id === parameters.clipId);
    if (!found) {
      return {
        valid: false,
        reason: `Target clip "${parameters.clipId}" no longer exists on the timeline.`,
      };
    }
    return { valid: true, targetClip: found };
  }

  // 2. Explicit clip index provided
  if (parameters?.clipIndex !== undefined) {
    const found = snapshot.videoClips[parameters.clipIndex];
    if (!found) {
      return {
        valid: false,
        reason: `Clip at index ${parameters.clipIndex} no longer exists.`,
      };
    }
    return { valid: true, targetClip: found };
  }

  // 3. Target selected clip
  if (snapshot.selectedClipId) {
    const found = snapshot.videoClips.find((c) => c.id === snapshot.selectedClipId);
    if (!found) {
      // Stale selection! Do NOT guess another clip.
      return {
        valid: false,
        reason: `The selected clip no longer exists on the timeline.`,
      };
    }
    return { valid: true, targetClip: found };
  }

  // 4. Fallback: single clip on timeline
  if (snapshot.videoClips.length === 1) {
    return { valid: true, targetClip: snapshot.videoClips[0] };
  }

  // 5. Multiple clips exist but none selected
  return {
    valid: false,
    reason: `No clip is selected on the timeline.`,
  };
}
