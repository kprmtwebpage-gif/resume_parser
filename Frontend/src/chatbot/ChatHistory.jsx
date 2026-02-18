import React from 'react';

export default function ChatHistory({ conversations, onSelectConversation, onClose }) {
  if (!conversations || conversations.length === 0) {
    return (
      <div className="chatbot-history">
        <div className="chatbot-history-header">
          <button className="chatbot-back-btn" onClick={onClose}>
            ← Back
          </button>
          <h3>Conversation History</h3>
        </div>
        <div className="chatbot-empty-history">
          <p>📭 No conversations yet</p>
          <p>Start a new chat to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chatbot-history">
      <div className="chatbot-history-header">
        <button 
          type="button"
          className="chatbot-back-btn" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}>
          ← Back
        </button>
        <h3>Conversation History</h3>
      </div>
      <div style={{ padding: 12 }}>
        <button
          type="button"
          className="chatbot-end-btn"
          style={{ marginBottom: 8 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.confirm('Delete ALL conversations?')) {
              localStorage.removeItem('chatbot_conversations')
              // reload list
              onSelectConversation(null)
              window.location.reload()
            }
          }}
        >
          Delete All Conversations
        </button>
      </div>
      <div className="chatbot-history-list">
        {conversations.map((conv) => (
          <div key={conv.id} className="chatbot-history-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onSelectConversation(conv.id)}>
                <div className="chatbot-history-item-title">{conv.title || 'Untitled Chat'}</div>
                <div className="chatbot-history-item-preview">{conv.lastMessage || 'No messages'}</div>
                <div className="chatbot-history-item-date">{new Date(conv.date).toLocaleDateString()}</div>
              </div>
              <div style={{ marginLeft: 8 }}>
                <button
                  type="button"
                  className="chatbot-end-btn"
                  style={{ padding: '6px 10px', background: '#fff', color: '#d02929', border: '1px solid #f5c2c2' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm('Delete this conversation?')) {
                      const saved = JSON.parse(localStorage.getItem('chatbot_conversations') || '[]')
                      const filtered = saved.filter((c) => c.id !== conv.id)
                      localStorage.setItem('chatbot_conversations', JSON.stringify(filtered))
                      window.location.reload()
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
