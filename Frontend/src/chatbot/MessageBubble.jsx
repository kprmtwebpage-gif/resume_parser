import React from 'react';

export default function MessageBubble({ message, isUser, timestamp }) {
  const formatTime = (ts) => {
    if (!ts) return '';
    
    const date = ts instanceof Date ? ts : new Date(ts);
    
    if (isNaN(date.getTime())) return '';
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className={`chatbot-message ${isUser ? 'user' : 'bot'}`}>
      <div className={`chatbot-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
        {message}
      </div>
      <div className="chatbot-timestamp">
        {formatTime(timestamp)}
      </div>
    </div>
  );
}
