import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatHistory from './ChatHistory';
import { selectCandidate } from './candidateEvents';
import {
  extractSearchTerms,
  generateSuggestions,
  buildSearchQuery,
  parseCandidateResponse,
  getGreetingMessage,
} from './rules';
import axios from 'axios';
import companyLogo from '../assets/company-logo.png';

const API_BASE = import.meta.env.VITE_CHATBOT_API_BASE || '';

export default function ChatPanel({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const [availableJobTitles, setAvailableJobTitles] = useState([]);
  const messagesEndRef = useRef(null);
  const initializedRef = useRef(false);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chatbot_conversations');
    if (saved) {
      setConversations(JSON.parse(saved));
    }
    
    // Initialize chat with welcome message
    if (!initializedRef.current) {
      const greeting = getGreetingMessage();
      setMessages([
        {
          type: 'bot',
          text: greeting,
          timestamp: new Date(),
        },
      ]);
      initializedRef.current = true;
    }
    
    // Load available job titles from backend
    loadAvailableJobTitles();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load available job titles dynamically from the system
  const loadAvailableJobTitles = async () => {
    try {
      // Fetch top job titles from stats endpoint
      const response = await axios.get(`${API_BASE}/stats`);
      if (response.data && response.data.top_job_titles) {
        const jobTitles = response.data.top_job_titles.map(item => item.title);
        if (jobTitles.length > 0) {
          setAvailableJobTitles(jobTitles);
          setSuggestions(jobTitles.slice(0, 5)); // Show top 5 job titles
        } else {
          // Fallback if no job titles returned
          setDefaultSuggestions();
        }
      } else {
        setDefaultSuggestions();
      }
    } catch (error) {
      console.error('Failed to load job titles:', error);
      // Fallback to default suggestions
      setDefaultSuggestions();
    }
  };

  const setDefaultSuggestions = () => {
    const fallbackTitles = [
      'Java Developer',
      'Full Stack Developer',
      'Data Engineer',
      'DevOps Engineer',
      'Frontend Engineer',
    ];
    setSuggestions(fallbackTitles);
    setAvailableJobTitles(fallbackTitles);
  };

  const initializeChat = () => {
    const greeting = getGreetingMessage();
    setMessages([
      {
        type: 'bot',
        text: greeting,
        timestamp: new Date(),
      },
    ]);
    // Use available job titles from API or fallback
    if (availableJobTitles.length > 0) {
      setSuggestions(availableJobTitles.slice(0, 5));
    } else {
      setDefaultSuggestions();
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

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = {
      type: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setSuggestions([]);
    setShowCandidates(false);
    setCandidates([]);

    try {
      // Normalize input and extract terms
      const normalized = buildSearchQuery(text);
      const terms = extractSearchTerms(normalized);

      // Always call backend chatbot search endpoint for any non-empty input
      // Primary: try /chatbot/search, fallback to /candidates if not available
      let response;
      try {
        response = await axios.get(`${API_BASE}/chatbot/search`, {
          params: { q: normalized },
        });
      } catch (err) {
        // If chatbot endpoint missing (404) or any error, attempt legacy /candidates
        try {
          response = await axios.get(`${API_BASE}/candidates`, {
            params: { q: normalized, limit: 100 },
          });
        } catch (err2) {
          console.error('Both chatbot.search and /candidates failed', err, err2);
          const botMessage = {
            type: 'bot',
            text: 'Search failed due to a technical error. Please try again.',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
          setLoading(false);
          return;
        }
      }

      const raw = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.candidates)
        ? response.data.candidates
        : [];

      // Flexible matching: match name or jobTitle or partial tokens (case-insensitive)
      const q = (normalized || '').toLowerCase();
      const filteredRaw = raw.filter((c) => {
        const job = (c.job_title || c.jobTitle || c.title || '').toString().toLowerCase();
        const name = (`${c.first_name || c.firstName || ''} ${c.last_name || c.lastName || ''}`.trim() || c.name || '').toString().toLowerCase();

        if (!q) return false;
        if (name.includes(q)) return true;
        if (job.includes(q)) return true;

        // token-based partial match: any token in q appears in job, or any token in job appears in q
        const qTokens = q.split(' ').filter(Boolean);
        const jobTokens = job.split(' ').filter(Boolean);

        for (const t of qTokens) {
          if (t.length > 1 && job.includes(t)) return true;
        }
        for (const t of jobTokens) {
          if (t.length > 1 && q.includes(t)) return true;
        }

        return false;
      });

      const results = parseCandidateResponse(filteredRaw);

      if (results.length > 0) {
        setCandidates(results);
        setShowCandidates(true);

        const botMessage = {
          type: 'bot',
          text: `Found ${results.length} candidate${results.length !== 1 ? 's' : ''} matching "${normalized}". Click on a name to view their profile.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        // No results - generate new suggestions
        const newSuggestions = generateSuggestions(terms.length ? terms : [normalized || text.trim()]);
        setSuggestions(newSuggestions);

        const botMessage = {
          type: 'bot',
          text: `No exact matches for "${normalized}". Try one of these suggestions or search with different keywords.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Search error:', error);
      // Only show error when the backend request fails; do not display 'no results' when valid results exist
      const botMessage = {
        type: 'bot',
        text: "Search failed due to a technical error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
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
    // Keep chat open so user can see results
  };

  const handleEndConversation = () => {
    saveConversation();
    initializeChat();
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
        {messages.map((msg, idx) => (
          <MessageBubble
            key={idx}
            message={msg.text}
            isUser={msg.type === 'user'}
            timestamp={msg.timestamp}
          />
        ))}

        {/* Candidates List */}
        {showCandidates && candidates.length > 0 && (
          <div className="chatbot-candidates-list">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="chatbot-candidate-item"
                onClick={(e) => handleCandidateClick(candidate, e)}
              >
                <div className="chatbot-candidate-name">{candidate.name}</div>
                {candidate.jobTitle && (
                  <div className="chatbot-candidate-role">{candidate.jobTitle}</div>
                )}
                {candidate.location && (
                  <div className="chatbot-candidate-location">📍 {candidate.location}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && !showCandidates && (
          <div className="chatbot-suggestions">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                className="chatbot-suggestion-chip"
                onClick={(e) => {
                  e.preventDefault();
                  handleSuggestionClick(suggestion, e);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

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
