import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatHistory from './ChatHistory';
import { selectCandidate } from './candidateEvents';
import { parseCandidateResponse, getGreetingMessage } from './rules';
import axios from 'axios';
import companyLogo from '../assets/company-logo.png';

const API_BASE = import.meta.env.VITE_CHATBOT_API_BASE || '';
const ROLES_CACHE_KEY = 'chatbot_roles_cache';
const SESSION_KEY = 'chatbot_session_id';
const MESSAGES_CACHE_KEY = 'chatbot_messages_cache';

export default function ChatPanel({ onClose, onMinimize, isVisible }) {
  // Initialize messages from localStorage to persist across visibility changes
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(MESSAGES_CACHE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        return parsed.map(msg => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));
      } catch (error) {
        console.error('Failed to parse cached messages:', error);
      }
    }
    return [];
  });
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const [availableJobTitles, setAvailableJobTitles] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const initializedRef = useRef(false);
  const rolesLoadedRef = useRef(false);

  const getOrCreateSession = async () => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(SESSION_KEY, sid);
    }

    try {
      await axios.post(`${API_BASE}/chat/session`, {
        session_id: sid,
        user_id: 'hr_user'
      });
    } catch (error) {
      console.error('Error creating session:', error);
    }

    return sid;
  };

  const loadChatHistory = async (sid) => {
    try {
      const response = await axios.get(`${API_BASE}/chat/history/${sid}`);
      if (response.data?.messages && response.data.messages.length > 0) {
        const loadedMessages = response.data.messages.map(msg => ({
          type: msg.type,
          text: msg.text,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));
        setMessages(loadedMessages);
        return true;
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
    return false;
  };

  const saveMessageToDb = async (message) => {
    if (!sessionId) return;

    try {
      await axios.post(`${API_BASE}/chat/message/${sessionId}`, {
        sender: message.type,
        message_text: message.text,
        timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  useEffect(() => {
    const initializeChat = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      const sid = await getOrCreateSession();
      setSessionId(sid);

      // If we already have messages in localStorage, use them (don't load from DB)
      if (messages.length > 0) {
        loadAvailableJobTitles();
        return;
      }

      // Otherwise try to load from database
      const hasHistory = await loadChatHistory(sid);

      // Skip welcome message - just load job titles directly
      loadAvailableJobTitles();
    };

    initializeChat();

    const saved = localStorage.getItem('chatbot_conversations');
    if (saved) {
      setConversations(JSON.parse(saved));
    }
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load available job titles dynamically from the system
  const loadAvailableJobTitles = async () => {
    if (rolesLoadedRef.current) return;
    rolesLoadedRef.current = true;

    const cached = localStorage.getItem(ROLES_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAvailableJobTitles(parsed);
          setSuggestions(parsed);
          // Show in chat if not already there
          setMessages(prev => {
            const alreadyShown = prev.some(m => m.type === 'jobtitles');
            if (alreadyShown) return prev;
            return [...prev, { type: 'jobtitles', titles: parsed, timestamp: new Date() }];
          });
          return;
        }
      } catch (error) {
        console.error('Failed to parse cached roles:', error);
      }
    }

    try {
      // Fetch ALL job roles from chatbot/roles endpoint
      const response = await axios.get(`${API_BASE}/chatbot/roles`);
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const jobTitles = response.data;
        setAvailableJobTitles(jobTitles);
        setSuggestions(jobTitles);
        localStorage.setItem(ROLES_CACHE_KEY, JSON.stringify(jobTitles));

        // Show job titles as a clickable list inside the chat
        setMessages(prev => {
          const alreadyShown = prev.some(m => m.type === 'jobtitles');
          if (alreadyShown) return prev;
          return [...prev, { type: 'jobtitles', titles: jobTitles, timestamp: new Date() }];
        });
      } else {
        setAvailableJobTitles([]);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Failed to load job roles:', error);
      setAvailableJobTitles([]);
      setSuggestions([]);
    }
  };

  const initializeChat = async () => {
    saveConversation();
    
    // Clear localStorage messages cache when starting new conversation
    localStorage.removeItem(MESSAGES_CACHE_KEY);
    
    if (sessionId) {
      try {
        await axios.delete(`${API_BASE}/chat/history/${sessionId}`);
      } catch (error) {
        console.error('Error deleting chat history:', error);
      }
    }

    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(SESSION_KEY, newSessionId);
    setSessionId(newSessionId);

    try {
      await axios.post(`${API_BASE}/chat/session`, {
        session_id: newSessionId,
        user_id: 'hr_user'
      });
    } catch (error) {
      console.error('Error creating new session:', error);
    }

    const greeting = getGreetingMessage();
    const greetingMsg = {
      type: 'bot',
      text: greeting,
      timestamp: new Date(),
    };
    setMessages([greetingMsg]);
    
    if (newSessionId) {
      try {
        await axios.post(`${API_BASE}/chat/message/${newSessionId}`, {
          sender: 'bot',
          message_text: greeting,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error saving greeting:', error);
      }
    }

    if (availableJobTitles.length > 0) {
      setSuggestions(availableJobTitles);
      // Re-show job titles list in the fresh chat
      setMessages(prev => [...prev, { type: 'jobtitles', titles: availableJobTitles, timestamp: new Date() }]);
    } else {
      setSuggestions([]);
    }
    setCurrentConvId(null);
    setCandidates([]);
    setShowCandidates(false);
  };

  const saveConversation = () => {
    if (messages.length <= 1) return;

    const convId = Date.now();
    const userMessages = messages.filter((m) => m.type === 'user');
    const lastMessage = userMessages[userMessages.length - 1]?.text || 'Chat';
    const title = lastMessage.substring(0, 30) + (lastMessage.length > 30 ? '...' : '');

    const newConv = {
      id: convId,
      title,
      lastMessage: lastMessage,
      messages: messages,
      date: new Date().toISOString(),
    };

    const updated = [newConv, ...conversations];
    setConversations(updated);
    localStorage.setItem('chatbot_conversations', JSON.stringify(updated));
  };

  const getDynamicSuggestions = (queryText) => {
    const normalizedInput = (queryText || '').trim().toLowerCase();
    if (!normalizedInput) return availableJobTitles;
    return availableJobTitles.filter((role) =>
      String(role).toLowerCase().includes(normalizedInput)
    );
  };

  const handleSendMessage = async (text) => {
    const cleanQuery = text.trim();
    if (!cleanQuery) return;

    const userMessage = {
      type: 'user',
      text: cleanQuery,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await saveMessageToDb(userMessage);
    
    setInput('');
    setLoading(true);
    setSuggestions([]);
    setShowCandidates(false);
    setCandidates([]);

    try {
      // Use the flexible search endpoint
      const response = await axios.get(`${API_BASE}/chatbot/search?q=${encodeURIComponent(cleanQuery)}`);

      const data = response.data;
      const candidatePayload = Array.isArray(data)
        ? data
        : (data?.candidates || data?.results || []);
      const results = parseCandidateResponse(candidatePayload);

      if (results.length > 0) {
        setCandidates(results);
        setShowCandidates(true);

        const botMessage = {
          type: 'bot',
          text: `Found ${results.length} candidate${results.length !== 1 ? 's' : ''} matching "${cleanQuery}". Click a name to open their profile.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        await saveMessageToDb(botMessage);

        // Also push candidates as a special in-chat message
        setMessages((prev) => [...prev, {
          type: 'candidates',
          candidates: results,
          timestamp: new Date(),
        }]);
      } else {
        const relatedSuggestions = getDynamicSuggestions(cleanQuery);
        setSuggestions(relatedSuggestions);

        const botMessage = {
          type: 'bot',
          text: 'No candidates found.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        await saveMessageToDb(botMessage);
      }
    } catch (error) {
      console.error('Search error:', error);
      if (error?.response?.status === 404) {
        const relatedSuggestions = getDynamicSuggestions(cleanQuery);
        setSuggestions(relatedSuggestions);
        const botMessage = {
          type: 'bot',
          text: 'Search endpoint not found. Please try again in a moment.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        await saveMessageToDb(botMessage);
      } else {
      const botMessage = {
        type: 'bot',
        text: "Search failed due to a technical error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      await saveMessageToDb(botMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    handleSendMessage(suggestion);
  };

  const handleCandidateClick = (candidate, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    selectCandidate(candidate.id, candidate.name);
    // Minimize chatbot so the profile modal is visible
    onMinimize?.();
  };

  const handleEndConversation = async () => {
    await initializeChat();
  };

  const handleViewHistory = () => {
    setShowHistory(true);
  };

  const handleSelectConversation = (convId) => {
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      setMessages(conv.messages);
      setCurrentConvId(convId);
      setShowHistory(false);
      setSuggestions([]);
      setShowCandidates(false);
    }
  };

  if (showHistory) {
    return <ChatHistory conversations={conversations} onSelectConversation={handleSelectConversation} onClose={() => setShowHistory(false)} />;
  }

  return (
    <div className="chatbot-panel">
      {/* Header */}
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <img src={companyLogo} alt="KPRMT Logo" className="chatbot-logo-img" />
          <div>
            <h3 className="chatbot-company-title">KPRMT GLOBAL SOLUTIONS</h3>
            <span className="chatbot-online">● Online</span>
          </div>
        </div>
        <div className="chatbot-header-actions">
          {conversations.length > 0 && (
            <button
              type="button"
              className="chatbot-history-icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleViewHistory();
              }}
              title="View history"
            >
              🕐
            </button>
          )}
          <button
            type="button"
            className="chatbot-minimize-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMinimize?.();
            }}
            title="Minimize"
          >
            −
          </button>
          <button 
            type="button"
            className="chatbot-close-btn" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}>
            ✕
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chatbot-messages">
        {messages.map((msg, idx) => {
          // Job titles list in chat
          if (msg.type === 'jobtitles') {
            return (
              <div key={idx} className="chatbot-jobtitles-msg">
                <div className="chatbot-jobtitles-grid">
                  {(msg.titles || []).map((title, ti) => (
                    <button
                      key={ti}
                      type="button"
                      className="chatbot-jobtitle-btn"
                      onClick={(e) => { e.preventDefault(); handleSuggestionClick(title, e); }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          // Candidates list in chat
          if (msg.type === 'candidates') {
            return (
              <div key={idx} className="chatbot-candidates-list">
                {(msg.candidates || []).map((candidate) => (
                  <div
                    key={candidate.id}
                    className="chatbot-candidate-item"
                    onClick={(e) => handleCandidateClick(candidate, e)}
                  >
                    <div className="chatbot-candidate-name">{candidate.name}</div>
                    {candidate.jobTitle && <div className="chatbot-candidate-role">{candidate.jobTitle}</div>}
                    {candidate.location && <div className="chatbot-candidate-location">📍 {candidate.location}</div>}
                  </div>
                ))}
              </div>
            );
          }
          // Regular bot / user messages
          return (
            <MessageBubble
              key={idx}
              message={msg.text}
              isUser={msg.type === 'user'}
              timestamp={msg.timestamp}
            />
          );
        })}

        {loading && <div className="chatbot-typing">Searching...</div>}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chatbot-input-area">
        <input
          type="text"
          className="chatbot-input"
          placeholder="Search for skills or roles..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !loading) {
              handleSendMessage(input);
            }
          }}
          disabled={loading}
        />
        <button
          type="button"
          className="chatbot-send-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSendMessage(input);
          }}
          disabled={loading || !input.trim()}
        >
          →
        </button>
      </div>

      {/* Footer */}
      <div className="chatbot-footer">
        <button 
          type="button"
          className="chatbot-end-btn" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleEndConversation();
          }}>
          End Conversation
        </button>
      </div>
    </div>
  );
}
