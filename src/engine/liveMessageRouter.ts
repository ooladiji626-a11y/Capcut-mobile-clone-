import { AIChatMessage, ProjectAsset } from '../types';
import {
  EditorContextSnapshot,
  ChatIntentType,
  ExplicitActionType,
  DetectedCommandAction,
  detectChatIntent,
} from './chatIntentDetector';
import {
  ActionExecutorUpdaters,
  ActionExecutionResult,
  executeAndVerifyEditorAction,
  executeMultiEditorActions,
} from './chatActionExecutor';
import { generateConversationalReply } from './chatConversationalResponder';

export interface LiveMessageRouterOptions {
  isUserCorrection?: boolean;
  onSimulatedAttemptFailure?: (attempt: number) => boolean;
}

export interface RouteAndExecuteLiveMessageParams {
  text: string;
  snapshot: EditorContextSnapshot;
  aiMessages: AIChatMessage[];
  updaters: ActionExecutorUpdaters;
  attachedAssets?: ProjectAsset[];
  executionOptions?: LiveMessageRouterOptions;
  queryAiChat?: (userText: string, context: EditorContextSnapshot) => Promise<string | null>;
}

export interface LiveMessageRouterResponse {
  intentType: ChatIntentType;
  actionType?: ExplicitActionType;
  actions?: DetectedCommandAction[];
  executionResult?: ActionExecutionResult;
  assistantReply: string;
}

/**
 * Authoritative single routing pipeline for all chat messages submitted
 * in the AI Video Editor.
 *
 * Sequence:
 * 1. detect actionable request
 * 2. resolve action
 * 3. execute action
 * 4. verify state
 * 5. generate response from execution result
 *
 * Never returns generic timeline-status if an actionable intent was detected.
 */
export async function routeAndExecuteLiveMessage(
  params: RouteAndExecuteLiveMessageParams
): Promise<LiveMessageRouterResponse> {
  const { text, snapshot, aiMessages, updaters, attachedAssets, executionOptions, queryAiChat } = params;
  const trimmed = text.trim();

  // 1. Deterministic Intent Detection
  const detectedIntent = detectChatIntent(trimmed, snapshot, aiMessages);

  // 2. Route based on intent type
  // BRANCH A: CHAT / CONVERSATION (Zero mutations)
  if (detectedIntent.type === 'CHAT' || detectedIntent.type === 'NORMAL_CHAT') {
    let reply: string | null = null;
    if (queryAiChat) {
      try {
        reply = await queryAiChat(trimmed, snapshot);
      } catch {
        reply = null;
      }
    }
    if (!reply) {
      reply = generateConversationalReply(trimmed, snapshot, aiMessages);
    }
    return {
      intentType: 'CHAT',
      assistantReply: reply,
    };
  }

  // BRANCH B: NEEDS_CLARIFICATION / AMBIGUOUS (Zero mutations)
  if (detectedIntent.type === 'NEEDS_CLARIFICATION' || detectedIntent.type === 'AMBIGUOUS') {
    const question =
      detectedIntent.clarificationQuestion ||
      'Could you please clarify which clip or change you would like me to make?';
    return {
      intentType: 'NEEDS_CLARIFICATION',
      assistantReply: question,
    };
  }

  // BRANCH C: EDIT_COMMAND / EXPLICIT_COMMAND
  // Real Action Execution & Verification Pipeline
  if (detectedIntent.actions && detectedIntent.actions.length > 1) {
    const result = executeMultiEditorActions(
      detectedIntent.actions,
      snapshot,
      updaters,
      attachedAssets,
      executionOptions
    );
    return {
      intentType: 'EDIT_COMMAND',
      actionType: detectedIntent.actions[0].actionType,
      actions: detectedIntent.actions,
      executionResult: result,
      assistantReply: result.verifiedMessage,
    };
  }

  if (detectedIntent.actionType) {
    const result = executeAndVerifyEditorAction(
      detectedIntent.actionType,
      detectedIntent.parameters,
      snapshot,
      updaters,
      attachedAssets,
      detectedIntent.condition,
      executionOptions
    );
    return {
      intentType: 'EDIT_COMMAND',
      actionType: detectedIntent.actionType,
      executionResult: result,
      assistantReply: result.verifiedMessage,
    };
  }

  // Fallback if an unexpected EDIT_COMMAND without action reached here
  const fallbackReply = generateConversationalReply(trimmed, snapshot, aiMessages);
  return {
    intentType: 'CHAT',
    assistantReply: fallbackReply,
  };
}
