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

// ─── Message Listener (from popup.js and content.js) ─────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "logExtraction") {
    logExtraction(request.data);
    sendResponse({ success: true });
  }

  if (request.action === "extractSkillsViaTab") {
    extractSkillsViaTab(request.url)
      .then(sendResponse)
      .catch(() => sendResponse({ skills: [] }));
    return true;
  }

  if (request.action === "extractExperienceViaTab") {
    extractExperienceViaTab(request.url)
      .then(sendResponse)
      .catch(() => sendResponse({ experiences: [] }));
    return true;
  }

  if (request.action === "extractContactViaTab") {
    extractContactViaTab(request.url)
      .then(sendResponse)
      .catch(() => sendResponse({ email: "", phone: "" }));
    return true;
  }

  return true;
});

// ─── Open a background tab, wait for full render, extract skills ──────
async function extractSkillsViaTab(url) {
  return new Promise((resolve) => {
    // Open the skills detail page in a background tab (not focused)
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;
      let settled = false;

      function finish(skills) {
        if (settled) return;
        settled = true;
        chrome.tabs.remove(tabId, () => {});
        resolve({ skills });
      }

      // Safety timeout — close tab after 12 s regardless
      const timeout = setTimeout(() => finish([]), 12000);

      function doExtract() {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => {
              // ── Run inside the fully-rendered LinkedIn skills page ──
              // BULLETPROOF approach: clone each list item, physically remove
              // all nested sub-component divs (endorsers), then read the
              // first aria-hidden span — guaranteed to be the skill name.
              const skills = [];
              const seen = new Set();

              // Person-name filter: 2+ capitalized words, no tech chars
              function looksLikePersonName(t) {
                const words = t.split(/\s+/);
                if (words.length < 2 || words.length > 4) return false;
                const allCap = words.every(w => /^[A-Z]/.test(w) && /^[A-Za-z'.\-]+$/.test(w));
                return allCap && !/[#\+\/\(\)\d]/.test(t);
              }

              function addSkill(t) {
                t = (t || "").trim();
                if (
                  t && t.length > 1 && t.length < 80 &&
                  !/^\d+$/.test(t) &&
                  !t.toLowerCase().includes("endorsement") &&
                  !t.toLowerCase().includes("show all") &&
                  !looksLikePersonName(t) &&
                  !seen.has(t.toLowerCase())
                ) {
                  seen.add(t.toLowerCase());
                  skills.push(t);
                }
              }

              // Find all top-level skill list items
              const allItems = document.querySelectorAll(
                "li.pvs-list__paged-list-item, li.pvs-list__item--line-separated, li.artdeco-list__item"
              );
              const topItems = Array.from(allItems).filter(li => {
                // Skip items nested inside another skill item or sub-components
                return !li.parentElement.closest(
                  'li.pvs-list__paged-list-item, li.pvs-list__item--line-separated, .pvs-entity__sub-components'
                );
              });

              // Strategy A: Clone-and-strip — physically remove endorser sections
              topItems.forEach(item => {
                const clone = item.cloneNode(true);
                // Remove ALL nested sub-component sections (endorsers, details)
                clone.querySelectorAll(
                  '.pvs-entity__sub-components, .pvs-list__outer-container ul ul, [class*="sub-components"]'
                ).forEach(el => el.remove());
                // Now the first aria-hidden span should be the skill name
                const span = clone.querySelector("span[aria-hidden='true']");
                if (span) addSkill(span.textContent);
              });

              // Strategy B: hoverable-link-text (only if A found nothing)
              if (skills.length === 0) {
                document.querySelectorAll(".hoverable-link-text span[aria-hidden='true']").forEach(el => {
                  if (!el.closest('.pvs-entity__sub-components')) addSkill(el.textContent);
                });
              }

              // Strategy C: all pvs-entity__content first spans (stripped)
              if (skills.length === 0) {
                document.querySelectorAll(".pvs-entity__content").forEach(div => {
                  if (div.closest('.pvs-entity__sub-components')) return;
                  const span = div.querySelector("span[aria-hidden='true']");
                  if (span) addSkill(span.textContent);
                });
              }

              return skills;
            },
          },
          (results) => {
            if (chrome.runtime.lastError) {
              finish([]);
              return;
            }
            const skills = results?.[0]?.result || [];
            if (skills.length > 0 || attempts >= 2) {
              clearTimeout(timeout);
              finish(skills);
            } else {
              // Retry once more with longer wait (page may still be hydrating)
              attempts++;
              setTimeout(doExtract, 2000);
            }
          }
        );
      }

      let attempts = 0;

      // Wait for tab to finish loading, then extract
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          // Give LinkedIn's React time to hydrate — longer on first visit
          setTimeout(doExtract, 2500);
        }
      });
    });
  });
}

// ─── Open background tab, extract contact info (email/phone) ─────────
async function extractContactViaTab(url) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;
      let settled = false;

      function finish(contact) {
        if (settled) return;
        settled = true;
        chrome.tabs.remove(tabId, () => {});
        resolve(contact);
      }

      const timeout = setTimeout(() => finish({ email: "", phone: "" }), 12000);

      function tryExtract() {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => {
              const result = { email: "", phone: "" };
              const text = document.body.innerText || "";

              // Email: look for mailto links first (most reliable)
              const mailtoEl = document.querySelector('a[href^="mailto:"]');
              if (mailtoEl) {
                result.email = mailtoEl.href.replace('mailto:', '').split('?')[0].trim();
              } else {
                const m = text.match(/[\w.+\-]+@[\w\-]+\.[\w.\-]+/);
                if (m) result.email = m[0];
              }

              // Phone: look for tel links first
              const telEl = document.querySelector('a[href^="tel:"]');
              if (telEl) {
                result.phone = telEl.href.replace('tel:', '').trim();
              } else {
                const m = text.match(/(?:\+?\d[\d\s().\-]{6,20}\d)/);
                if (m) result.phone = m[0].trim();
              }

              return result;
            },
          },
          (results) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) { finish({ email: "", phone: "" }); return; }
            finish(results?.[0]?.result || { email: "", phone: "" });
          }
        );
      }

      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(tryExtract, 1500);
        }
      });
    });
  });
}

// ─── Open background tab, wait for full render, extract work experience ──────
async function extractExperienceViaTab(url) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;
      let settled = false;

      function finish(experiences) {
        if (settled) return;
        settled = true;
        chrome.tabs.remove(tabId, () => {});
        resolve({ experiences });
      }

      const timeout = setTimeout(() => finish([]), 15000);

      function tryExtract() {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => {
              function isDates(t) {
                return /\d{4}/.test(t) && (t.includes(' - ') || /\bpresent\b|\bcurrent\b/i.test(t));
              }

              function deduped(item) {
                const seen = new Set();
                return Array.from(item.querySelectorAll("span[aria-hidden='true']"))
                  .map(s => s.textContent.trim())
                  .filter(t => { if (!t || seen.has(t)) return false; seen.add(t); return true; });
              }

              function parseOne(item) {
                const vs = deduped(item);
                if (!vs.length) return null;
                let title = vs[0], company = '', dates = '', location = '';
                for (let i = 1; i < vs.length; i++) {
                  const t = vs[i];
                  if (t.length > 250) continue; // skip descriptions
                  if (!company && !isDates(t) && !/^\d+$/.test(t)) { company = t.split('·')[0].trim(); continue; }
                  if (!dates && isDates(t)) { dates = t; continue; }
                  if (dates && !location && !isDates(t) && t.length < 100) { location = t; break; }
                }
                return { title, company, dates, location };
              }

              const titleSeen = new Set();
              const exps = [];

              // Top-level list items on the /details/experience/ page
              const topItems = Array.from(
                document.querySelectorAll('.pvs-list > li.artdeco-list__item, .scaffold-finite-scroll__content li.artdeco-list__item')
              ).filter(li => !li.parentElement.closest('li.artdeco-list__item'));

              topItems.forEach(item => {
                const nested = item.querySelector('ul.pvs-list');
                const subItems = nested ? Array.from(nested.querySelectorAll('li.artdeco-list__item')) : [];

                if (subItems.length > 0) {
                  // Multi-role under one company
                  const coSpan = item.querySelector("span.t-bold span[aria-hidden='true']");
                  const co = coSpan ? coSpan.textContent.trim() : '';
                  subItems.forEach(sub => {
                    const e = parseOne(sub);
                    if (e && e.title && !titleSeen.has(e.title)) {
                      titleSeen.add(e.title);
                      if (!e.company) e.company = co;
                      exps.push(e);
                    }
                  });
                } else {
                  const e = parseOne(item);
                  if (e && e.title && !titleSeen.has(e.title)) {
                    titleSeen.add(e.title);
                    exps.push(e);
                  }
                }
              });

              return exps;
            },
          },
          (results) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) { finish([]); return; }
            finish(results?.[0]?.result || []);
          }
        );
      }

      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Wait for React hydration
          setTimeout(tryExtract, 2000);
        }
      });
    });
  });
}

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
