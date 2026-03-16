// KPRMT LinkedIn Extension - Background Service Worker
// Handles JWT token refresh, rate limiting, extraction history logging

// ─── Rate Limit Reset (daily) ────────────────────────────────────────
chrome.alarms.create("resetDailyCount", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resetDailyCount") {
    chrome.storage.local.get(["daily_date"], (result) => {
      const today = new Date().toDateString();
      if (result.daily_date !== today) {
        chrome.storage.local.set({ daily_count: 0, daily_date: today });
      }
    });
  }
});

// ─── Message Listener (from popup.js) ────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "logExtraction") {
    logExtraction(request.data);
    sendResponse({ success: true });
  }
  return true;
});

// ─── Extraction History Logger ───────────────────────────────────────
function logExtraction(data) {
  chrome.storage.local.get(["extraction_history"], (result) => {
    const history = result.extraction_history || [];
    history.unshift({
      name: data.name,
      linkedin_url: data.linkedin_url,
      candidate_id: data.candidate_id,
      timestamp: data.timestamp,
    });
    // Keep last 200 entries
    if (history.length > 200) history.length = 200;
    chrome.storage.local.set({ extraction_history: history });
  });
}

// ─── Extension Install / Update Handler ──────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({
      daily_count: 0,
      daily_date: new Date().toDateString(),
      extraction_history: [],
    });
  }
});
