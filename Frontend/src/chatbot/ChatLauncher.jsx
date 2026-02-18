import React, { useState, useEffect } from 'react';
import ChatPanel from './ChatPanel';
import './chatbot.css';

export default function ChatLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          type="button"
          className="chatbot-launcher-btn"
          onClick={() => setIsOpen(true)}
          title="Open HR Chatbot"
        >
          <span className="chatbot-launcher-icon">💬</span>
        </button>
      )}

      {/* Side Panel */}
      {isOpen && (
        <div
          className="chatbot-overlay"
          onClick={(e) => {
            // Only close if clicking on overlay background, not on panel or other elements
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }
          }}
        >
          <div
            className="chatbot-panel-wrapper"
            onClick={(e) => {
              // Stop propagation so overlay click doesn't trigger
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <ChatPanel onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
