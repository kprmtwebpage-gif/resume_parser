# HR Chatbot Widget

A SignalHire-style chatbot widget for the Resume Parsing application. Built with React, no AI/LLM required.

## Features

- **Floating Button**: Bottom-right circular button with gradient
- **Chat Interface**: Clean, modern side panel with message bubbles
- **Rule-Based Search**: Keyword extraction and suggestion generation
- **Candidate Display**: Click candidate names to open existing profile modal
- **Conversation History**: Store and retrieve past chats from localStorage
- **Responsive Design**: Works on desktop and mobile
- **No External APIs**: Uses only the existing backend `/candidates` endpoint

## Components

- `ChatLauncher.jsx` - Floating button + main launcher
- `ChatPanel.jsx` - Main chat interface
- `ChatHistory.jsx` - Conversation history view
- `MessageBubble.jsx` - Individual message component
- `rules.js` - Rule-based logic (keyword extraction, suggestions)
- `chatbot.css` - All styling
- `index.js` - Exports

## How It Works

### Rule-Based Logic (No AI)

1. User types a query (e.g., "Java Developer")
2. `extractSearchTerms()` finds keywords in the query
3. `generateSuggestions()` creates relevant suggestions
4. User clicks a suggestion or presses send
5. Backend `/candidates` endpoint is called with the search query
6. Results are displayed as clickable candidate names
7. Clicking a name opens the existing profile modal using the main SearchPeople component

### Local Storage

Conversations are saved with:
- Unique ID (timestamp)
- Title (first 30 chars of user message)
- Full message history
- Date created

Users can view history and resume previous conversations.

## Integration

In `App.jsx`:

```jsx
import ChatLauncher from './chatbot/ChatLauncher'

export default function App() {
  return (
    <div>
      <DashboardLayout>
        <SearchPeople />
      </DashboardLayout>
      <ChatLauncher />
    </div>
  )
}
```

## Backend API

Uses the existing `/candidates` endpoint:

```
GET /candidates?q=<query>&limit=50
```

Returns array of candidate objects with:
- `id`
- `first_name`, `last_name`
- `job_title`
- `skills` (array)
- `location`
- etc.

## Environment Variables

- `VITE_CHATBOT_API_BASE` - Base URL for chatbot API (defaults to `http://127.0.0.1:8000`)

## Styling

- Uses existing app colors (purple → blue gradient)
- Soft shadows and rounded corners
- Responsive layout for mobile/tablet/desktop
- No external CSS libraries needed

## No External Dependencies

- React only (hooks)
- axios (already installed)
- localStorage API (browser native)
- No LLMs, embeddings, or external AI services
