import React, { useState, useEffect, useRef } from 'react';
import ChatPanel from './ChatPanel';
import { onModalOpened, notifyChatbotOpened, notifyChatbotClosed } from './modalEvents';
import './chatbot.css';

export default function ChatLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Refs to always read the latest state inside event callbacks (prevents stale closure)
  const isOpenRef = useRef(isOpen);
  const isMinimizedRef = useRef(isMinimized);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isMinimizedRef.current = isMinimized; }, [isMinimized]);

  // Listen for Profile Drawer opening - always minimize chatbot (never close/unmount)
  useEffect(() => {
    const unsubscribe = onModalOpened(() => {
      if (isOpenRef.current) {
        // Minimize only - never close. Preserves conversation state.
        setIsMinimized(true);
      }
    });
    return unsubscribe;
  }, []); // Empty deps - uses refs to avoid stale closure

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
    notifyChatbotOpened();
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
    notifyChatbotClosed();
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    notifyChatbotOpened();
  };

  // Determine visibility state
  const showPanel = isOpen && !isMinimized;

  return (
    <>
      {/* Floating Button - shown when chatbot is fully closed */}
      {!isOpen && (
        <button
          type="button"
          className="chatbot-launcher-btn"
          onClick={handleOpen}
          title="Open HR Chatbot"
        >
          <span className="chatbot-launcher-icon">💬</span>
        </button>
      )}

      {/* Minimized Icon - shown when chatbot is open but minimized */}
      {isOpen && isMinimized && (
        <button
          type="button"
          className="chatbot-minimized-icon"
          onClick={handleRestore}
          title="Restore HR Chatbot"
        >
          <span className="chatbot-launcher-icon">💬</span>
        </button>
      )}

      {/*
        ChatPanel is ALWAYS mounted once opened - never unmounted.
        Visibility is controlled purely via CSS class (no inline display override).
        This preserves all conversation state across open/close/minimize cycles.
      */}
      <div
        className={`chatbot-overlay${showPanel ? '' : ' chatbot-hidden'}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }
        }}
      >
        <div
          className="chatbot-panel-wrapper"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <ChatPanel onClose={handleClose} onMinimize={handleMinimize} isVisible={showPanel} />
        </div>
      </div>
    </>
  );
}
