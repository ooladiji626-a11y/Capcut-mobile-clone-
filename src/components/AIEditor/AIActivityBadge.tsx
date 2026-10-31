import React, { useState } from 'react';
import { CheckCircle2, Loader2, Minimize2, Maximize2, Sparkles } from 'lucide-react';

interface AIActivityBadgeProps {
  isVisible: boolean;
  currentStepIndex: number;
  steps: string[];
  onOpenFullChat: () => void;
}

export const AIActivityBadge: React.FC<AIActivityBadgeProps> = ({
  isVisible,
  currentStepIndex,
  steps,
  onOpenFullChat,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-24 right-4 z-40 max-w-xs w-72 bg-[#121216]/95 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-3 shadow-2xl text-white select-none transition-all animate-in fade-in slide-in-from-bottom-3"
      id="ai-live-activity-panel"
    >
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
          <span className="text-xs font-bold tracking-tight text-cyan-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> AI EDITOR LIVE
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-2 space-y-1.5 text-xs">
          {steps.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={idx}
                className={`flex items-center gap-2 py-0.5 px-1 rounded transition-colors ${
                  isCurrent ? 'text-cyan-200 font-semibold bg-cyan-950/30' : isDone ? 'text-zinc-400' : 'text-zinc-600'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0" />
                )}
                <span className="truncate">{step}</span>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={onOpenFullChat}
        className="w-full mt-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-medium text-zinc-300 hover:text-white text-center transition-colors"
      >
        View AI Editor Conversation
      </button>
    </div>
  );
};
