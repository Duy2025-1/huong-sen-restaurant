import React, { useState, useEffect } from 'react';
import { MessageSquare, MessageCircle, X, Sparkles } from 'lucide-react';
import { ChatWindow } from './ChatWindow';

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Lắng nghe phím Esc để đóng / thu nhỏ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setHasUnread(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <>
      {/* 1. CỬA SỔ CHAT */}
      {isOpen && !isMinimized && (
        <ChatWindow
          isOpen={isOpen}
          onClose={handleClose}
          onMinimize={handleMinimize}
        />
      )}

      {/* 2. THANH THU NHỎ KHI ĐANG MỞ DANG DỞ */}
      {isOpen && isMinimized && (
        <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-lotus-900 text-cream-100 border border-lotus-700/60 shadow-xl hover:bg-lotus-800 transition active:scale-95"
            title="Mở lại khung tư vấn"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-serif font-bold text-xs">Hương Sen Tư Vấn</span>
            <span className="text-[10px] text-cream-300 font-light">(Nhấn để mở lại)</span>
          </button>
        </div>
      )}

      {/* 3. NÚT CHAT NỔI (FLOATING LAUNCHER BUTTON) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="relative group">
            {/* Tooltip Hover Badge on Desktop */}
            <div className="hidden sm:block absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <div className="bg-wood-950 text-cream-100 text-xs py-1.5 px-3 rounded-xl whitespace-nowrap shadow-lg border border-wood-800 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Nhân viên tư vấn Hương Sen</span>
              </div>
            </div>

            {/* Launcher Floating Button */}
            <button
              onClick={handleOpen}
              aria-label="Mở khung tư vấn khách hàng Hương Sen"
              className="w-14 h-14 rounded-full bg-lotus-800 hover:bg-lotus-900 text-cream-50 flex items-center justify-center shadow-2xl shadow-lotus-950/30 border border-lotus-700 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="relative">
                <MessageCircle className="w-6 h-6 text-cream-100" />
                {/* Active online pulse dot */}
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-lotus-800 rounded-full" />
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
