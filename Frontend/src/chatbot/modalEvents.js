/**
 * Modal event dispatcher
 * Ensures ProfileModal and Chatbot are mutually exclusive
 */

const MODAL_OPEN_EVENT = 'profileModalOpened';
const MODAL_CLOSE_EVENT = 'profileModalClosed';
const CHATBOT_OPEN_EVENT = 'chatbotOpened';
const CHATBOT_CLOSE_EVENT = 'chatbotClosed';

// Profile Modal Events
export function notifyModalOpened() {
  const event = new CustomEvent(MODAL_OPEN_EVENT, { bubbles: true });
  window.dispatchEvent(event);
}

export function notifyModalClosed() {
  const event = new CustomEvent(MODAL_CLOSE_EVENT, { bubbles: true });
  window.dispatchEvent(event);
}

export function onModalOpened(callback) {
  window.addEventListener(MODAL_OPEN_EVENT, callback);
  return () => window.removeEventListener(MODAL_OPEN_EVENT, callback);
}

export function onModalClosed(callback) {
  window.addEventListener(MODAL_CLOSE_EVENT, callback);
  return () => window.removeEventListener(MODAL_CLOSE_EVENT, callback);
}

// Chatbot Events
export function notifyChatbotOpened() {
  const event = new CustomEvent(CHATBOT_OPEN_EVENT, { bubbles: true });
  window.dispatchEvent(event);
}

export function notifyChatbotClosed() {
  const event = new CustomEvent(CHATBOT_CLOSE_EVENT, { bubbles: true });
  window.dispatchEvent(event);
}

export function onChatbotOpened(callback) {
  window.addEventListener(CHATBOT_OPEN_EVENT, callback);
  return () => window.removeEventListener(CHATBOT_OPEN_EVENT, callback);
}

export function onChatbotClosed(callback) {
  window.addEventListener(CHATBOT_CLOSE_EVENT, callback);
  return () => window.removeEventListener(CHATBOT_CLOSE_EVENT, callback);
}
