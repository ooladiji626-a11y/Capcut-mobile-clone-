import React, { useState, useRef } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';

interface FloatingAIButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  isExecuting?: boolean;
  statusText?: string;
}

export const FloatingAIButton: React.FC<FloatingAIButtonProps> = ({
  isOpen,
  onToggle,
  isExecuting = false,
  statusText,
}) => {
  const [position, setPosition] = useState({ x: 20, y: 76 });
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialElemPos = useRef({ x: 0, y: 0 });
  const dragDistanceRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragDistanceRef.current = 0;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialElemPos.current = { ...position };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;
    const distance = Math.hypot(deltaX, deltaY);
    dragDistanceRef.current = distance;

    if (distance > 5) {
      // Keep within viewport boundaries
      const maxX = Math.max(10, window.innerWidth - 80);
      const maxY = Math.max(50, window.innerHeight - 120);
      const newX = Math.max(10, Math.min(maxX, initialElemPos.current.x - deltaX));
      const newY = Math.max(50, Math.min(maxY, initialElemPos.current.y + deltaY));
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const wasDragging = dragDistanceRef.current > 6;
    isDraggingRef.current = false;

    if (!wasDragging) {
      onToggle();
    }
  };

  return (
    <div
      style={{
        right: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      className="fixed z-50 select-none"
      id="floating-ai-editor-btn"
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={(e) => {
          // If pointer events did not trigger or for keyboard accessibility
          if (dragDistanceRef.current <= 6) {
            e.stopPropagation();
          }
        }}
        className={`relative group w-12 h-12 rounded-full border shadow-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
          isOpen
            ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/40 ring-2 ring-blue-400/40'
            : isExecuting
            ? 'bg-gradient-to-tr from-teal-500 to-blue-600 border-teal-300 text-white shadow-teal-500/50 animate-pulse ring-2 ring-teal-400/40'
            : 'bg-[#18181b]/95 backdrop-blur-md border-white/20 text-zinc-100 hover:border-cyan-500/60 hover:bg-[#22222a] hover:scale-105'
        }`}
        title={isExecuting ? (statusText || 'AI Editing in progress...') : isOpen ? 'Minimize AI Video Editor' : 'Open AI Video Editor'}
        aria-label="Toggle AI Video Editor"
      >
        {/* Glowing aura */}
        <div
          className={`absolute -inset-1.5 rounded-full blur-md opacity-50 -z-10 transition-opacity ${
            isExecuting
              ? 'bg-teal-400 opacity-90 animate-ping'
              : 'bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-500 group-hover:opacity-100'
          }`}
        />

        {/* Rotating border ring when executing */}
        {isExecuting && (
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/60 animate-spin" />
        )}

        <div className="relative flex items-center justify-center gap-1.5 pointer-events-none px-2">
          {isExecuting ? (
            <Wand2 className="w-5 h-5 text-amber-300 animate-spin shrink-0" />
          ) : (
            <Sparkles className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
          )}
          {isExecuting && (
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#121216] animate-ping" />
          )}
          <span className="text-[11px] font-bold tracking-tight text-white whitespace-nowrap hidden xs:inline sm:hidden">
            {isExecuting ? 'AI Working...' : 'AI Prompt'}
          </span>
        </div>

        {/* Floating tooltip label on hover */}
        <div className="absolute right-full mr-2.5 px-2.5 py-1 bg-[#18181f]/95 border border-white/15 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
          {isExecuting ? (statusText || 'AI Editing...') : isOpen ? 'Minimize AI Editor' : 'Open AI Editor'}
        </div>
      </button>
    </div>
  );
};

