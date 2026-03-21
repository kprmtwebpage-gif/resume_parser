// KPRMT LinkedIn Extension - Background Service Worker
// Handles JWT token refresh, rate limiting, extraction history logging

// ─── Rate Limit Reset (daily) ────────────────────────────────────────
// NOTE: chrome.alarms.create must NOT be called at top level in MV3
// service workers — it runs inside onInstalled/onStartup instead.

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

  // ─── CSRF Token retrieval (for Voyager API authentication) ─────────
  if (request.action === "getCsrfToken") {
    chrome.cookies.get({ url: 'https://www.linkedin.com', name: 'JSESSIONID' }, (cookie) => {
      if (cookie && cookie.value) {
        // CSRF token = JSESSIONID value with surrounding quotes stripped
        const token = 'ajax:' + cookie.value.replace(/"/g, '');
        sendResponse({ token });
      } else {
        sendResponse({ token: null });
      }
    });
    return true;
  }

  if (request.action === "extractSkillsViaTab") {
    extractSkillsViaTab(request.url, sender.tab?.id)
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

  if (request.action === "extractEducationViaTab") {
    extractEducationViaTab(request.url)
      .then(sendResponse)
      .catch(() => sendResponse({ educations: [] }));
    return true;
  }

  // ─── Proxy API calls from content script ─────────────────────────
  // Content scripts run in the web page's origin (linkedin.com), so
  // cross-origin fetch() sends Origin: https://www.linkedin.com which
  // the backend CORS rejects. Routing through the service worker sends
  // the request from the chrome-extension:// origin instead.
  if (request.action === "apiRequest") {
    const { method, headers, body } = request;
    // Always force HTTPS to avoid 301 redirect that converts POST → GET
    const url = request.url.replace(/^http:\/\//i, 'https://');
    fetch(url, { method, headers, body })
      .then(async (resp) => {
        const data = await resp.json().catch(() => ({}));
        sendResponse({ ok: resp.ok, status: resp.status, data });
      })
      .catch((err) => {
        sendResponse({ ok: false, status: 0, error: err.message });
      });
    return true;
  }

  return true;
});

// ─── Human-like random delay helper ────────────────────────────────
function randomDelay(minMs, maxMs) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

// ─── Open a background tab, poll until skills appear, extract ─────────────────
async function extractSkillsViaTab(url, senderTabId) {
  // Small random delay — looks like a human thinking before clicking
  await randomDelay(800, 2200);
  return new Promise((resolve) => {
    console.log('[KPRMT bg] Creating skills tab for:', url);
    // Keep active:false — the fetch approach in content.js is now primary.
    // Using active:true would steal tab focus and close the extension popup.
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        console.log('[KPRMT bg] Tab creation failed:', chrome.runtime.lastError?.message);
        return resolve({ skills: [] });
      }
      const tabId = tab.id;
      console.log('[KPRMT bg] Skills tab created, id:', tabId);
      let settled = false;

      function finish(skills) {
        if (settled) return;
        settled = true;
        console.log('[KPRMT bg] FINISH skills:', skills.length);
        chrome.tabs.remove(tabId).catch(() => {});
        resolve({ skills });
      }

      // Hard safety timeout
      const timeout = setTimeout(() => {
        console.log('[KPRMT bg] Skills HARD TIMEOUT after 25s, best:', bestSkills.length);
        finish(bestSkills);
      }, 25000);

      let attempts = 0;
      const MAX_ATTEMPTS = 15;
      let bestSkills = [];
      let stableCount = 0;

      function pollExtract() {
        if (settled) return;
        attempts++;

        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: (attemptNum) => {
              // Incremental scroll: each attempt scrolls further down.
              // This triggers lazy-loading of skill sections that aren't
              // initially visible (e.g. Cell Therapy, Quality System etc.)
              const scrollTarget = Math.min(
                attemptNum * 1500,
                document.body.scrollHeight
              );
              window.scrollTo({ top: scrollTarget, behavior: 'instant' });
              // Also force bottom on later attempts
              if (attemptNum >= 3) {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
              }

              const skills = [];
              const seen = new Set();
              const debug = {
                attempt: attemptNum,
                url: location.href,
                bodyLen: document.body?.innerText?.length || 0,
                boldSpans: 0,
                hoverLinks: 0,
                pvsEntities: 0,
                rawBold: [],
                rawHover: [],
                rawPvs: [],
                rejected: [],
              };

              const TECH_WORDS = new Set([
                'learning','processing','language','intelligence','framework',
                'requirements','analysis','development','engineering','science',
                'computing','architecture','design','programming','management',
                'mining','modeling','visualization','testing','automation',
                'integration','security','database','network','systems','system',
                'server','cloud','web','mobile','data','software','hardware',
                'api','devops','frontend','backend','fullstack','agile','scrum',
                'lifecycle','deployment','continuous','delivery','monitoring',
                'analytics','warehouse','pipeline','orchestration','container',
                'virtual','machine','deep','reinforcement','neural','natural',
                'artificial','big','business','object','oriented','functional',
                'distributed','parallel','concurrent','embedded','operations',
                'infrastructure','platform','service','stack','computer',
                'scripting','statistical','algorithms','optimization','modeling',
              ]);

              function isLikelyPersonName(s) {
                const words = s.split(/\s+/);
                if (words.length < 2 || words.length > 5) return false;
                if (/[#\+\/\(\)\[\]{}<>\d@&]/.test(s)) return false;
                if (words.some(w => TECH_WORDS.has(w.toLowerCase().replace(/[.]/g, '')))) return false;
                if (!words.every(w => /^[A-Z][a-zA-Z'.\-]*$/.test(w))) return false;
                if (words.some(w => /^[A-Z]\.$/.test(w))) return true;
                return true;
              }

              function addSkill(t) {
                t = (t || '').trim();
                if (!t || t.length <= 1 || t.length >= 80) return;
                const lc = t.toLowerCase();
                if (/^\d+$/.test(t)) { debug.rejected.push(t.substring(0,40)+'|digits'); return; }
                if (lc.includes('endorsement')) { debug.rejected.push(t.substring(0,40)+'|endorse'); return; }
                if (lc.includes('endorsed by')) return;
                if (lc.includes('show all') || lc.includes('see all')) return;
                if (lc.includes('show more') || lc.includes('show less')) return;
                if (lc.includes('experiences across') || lc.includes('experience across')) { debug.rejected.push(t.substring(0,40)+'|expacross'); return; }
                if (lc.includes('educational experiences') || lc.includes('educational experience')) return;
                if (lc.includes('person in the last')) return;
                if (/^\d+ (experience|endorsement|person)/.test(lc)) { debug.rejected.push(t.substring(0,40)+'|numexp'); return; }
                // NOTE: We intentionally do NOT apply isLikelyPersonName here.
                // On /details/skills/ page every bold-span heading IS a skill name —
                // endorser names only appear in sub-text, not in bold title spans.
                // Filtering by person-name heuristic was removing real skills like
                // "Problem Solving", "Cell Therapy", "Microsoft Power BI".
                // Reject LinkedIn UI / sidebar / footer navigation items
                if (/linkedin/i.test(t)) { debug.rejected.push(t.substring(0,40)+'|linkedinUI'); return; }
                if (/\b(post a job|start a job|find people|try premium|get hired|company page)\b/i.test(t)) { debug.rejected.push(t.substring(0,40)+'|nav'); return; }
                if (/\b(advertise|recruit on|sell with|learn with|elevate your|business services)\b/i.test(t)) { debug.rejected.push(t.substring(0,40)+'|nav'); return; }
                if (/\b(sign in|sign up|sign out|log in|log out|join now)\b/i.test(t)) { debug.rejected.push(t.substring(0,40)+'|auth'); return; }
                if (seen.has(lc)) return;
                seen.add(lc);
                skills.push(t);
              }

              const CATEGORY_NAMES = new Set([
                'industry knowledge', 'tools & technologies', 'other skills',
                'interpersonal skills', 'top skills', 'languages', 'certifications',
                'recommendations', 'interests', 'courses', 'projects', 'honors & awards',
                'publications', 'patents', 'test scores', 'organizations',
                'volunteer experience', 'skills', 'featured',
              ]);

              // Scope selectors to main content area to avoid sidebar/nav/footer
              const mainArea = document.querySelector('main') || document.querySelector('.scaffold-layout__main') || document;

              // Strategy 1: Bold text in main content area
              const boldSpans = mainArea.querySelectorAll(
                'span.t-bold span[aria-hidden="true"], .t-bold > span[aria-hidden="true"]'
              );
              debug.boldSpans = boldSpans.length;
              debug.rawBold = Array.from(boldSpans).slice(0, 15).map(s => s.textContent.trim().substring(0, 60));
              boldSpans.forEach(span => {
                const t = span.textContent.trim();
                if (!CATEGORY_NAMES.has(t.toLowerCase())) addSkill(t);
              });

              // Strategy 2: hoverable links in main content area
              const hoverLinks = mainArea.querySelectorAll(
                '.hoverable-link-text span[aria-hidden="true"], a[data-field="skill_card_skill_topic"] span[aria-hidden="true"]'
              );
              debug.hoverLinks = hoverLinks.length;
              debug.rawHover = Array.from(hoverLinks).slice(0, 15).map(s => s.textContent.trim().substring(0, 60));
              hoverLinks.forEach(span => {
                const t = span.textContent.trim();
                if (!CATEGORY_NAMES.has(t.toLowerCase())) addSkill(t);
              });

              // Strategy 3: pvs-entity in main content area
              const pvsEntities = mainArea.querySelectorAll(
                '.pvs-entity__content span[aria-hidden="true"]:first-child'
              );
              debug.pvsEntities = pvsEntities.length;
              debug.rawPvs = Array.from(pvsEntities).slice(0, 15).map(s => s.textContent.trim().substring(0, 60));
              pvsEntities.forEach(span => {
                const t = span.textContent.trim();
                if (!CATEGORY_NAMES.has(t.toLowerCase())) addSkill(t);
              });

              // Diagnostic: capture all aria-hidden spans on first attempt
              if (attemptNum <= 2) {
                debug.allSpans = Array.from(document.querySelectorAll('span[aria-hidden="true"]')).slice(0, 30).map(s => s.textContent.trim().substring(0, 50));
              }

              console.log('[KPRMT tab] Skills attempt', attemptNum, ':', skills.length, 'rejected:', debug.rejected.length, 'debug:', JSON.stringify(debug));
              return { skills, debug };
            },
            args: [attempts],
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.log('[KPRMT bg] Skills executeScript error (attempt', attempts, '):', chrome.runtime.lastError.message);
              if (attempts >= MAX_ATTEMPTS) { clearTimeout(timeout); finish(bestSkills); }
              else setTimeout(pollExtract, 1000);
              return;
            }
            const data = results?.[0]?.result || { skills: [], debug: {} };
            const skills = data.skills || [];
            console.log('[KPRMT bg] Skills poll', attempts, ': got', skills.length, 'best:', bestSkills.length, 'debug:', JSON.stringify(data.debug));

            if (skills.length > bestSkills.length) {
              bestSkills = skills;
              stableCount = 0;
            } else if (skills.length === bestSkills.length && skills.length > 0) {
              stableCount++;
            }

            const bodyLen = data.debug?.bodyLen || 0;
            if (stableCount >= 3 && bestSkills.length > 0 && (bodyLen > 3000 || attempts >= 6)) {
              console.log('[KPRMT bg] Skills STABLE at', bestSkills.length, 'after', attempts, 'polls, bodyLen:', bodyLen);
              clearTimeout(timeout);
              finish(bestSkills);
            } else if (attempts >= MAX_ATTEMPTS) {
              console.log('[KPRMT bg] Skills MAX attempts reached, returning best:', bestSkills.length, 'bodyLen:', bodyLen);
              clearTimeout(timeout);
              finish(bestSkills);
            } else {
              setTimeout(pollExtract, 1000);
            }
          }
        );
      }

      // CRITICAL: Wait for the tab to finish loading before we start polling.
      // Without this, the page is blank and we waste all attempts on an empty DOM.
      let listenerFired = false;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          if (listenerFired) return;
          listenerFired = true;
          console.log('[KPRMT bg] Skills tab loaded (onUpdated), starting polls in 2s...');
          setTimeout(pollExtract, 2000);
        }
      });

      // Safety: if the tab is already complete when we add the listener, start immediately
      chrome.tabs.get(tabId, (t) => {
        if (t && t.status === 'complete' && !listenerFired) {
          listenerFired = true;
          console.log('[KPRMT bg] Skills tab already complete, starting polls in 2s...');
          setTimeout(pollExtract, 2000);
        }
      });
    });
  });
}

// ─── Open background tab, extract contact info (email/phone) ─────────
async function extractContactViaTab(url) {
  await randomDelay(400, 1200);
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        return resolve({ email: '', phone: '' });
      }
      const tabId = tab.id;
      let settled = false;

      function finish(contact) {
        if (settled) return;
        settled = true;
        chrome.tabs.remove(tabId).catch(() => {});
        resolve(contact);
      }

      const timeout = setTimeout(() => {
        console.log('[KPRMT bg] Contact TIMEOUT, best:', JSON.stringify(bestContact));
        finish(bestContact);
      }, 8000);

      let contactAttempts = 0;
      let bestContact = { email: "", phone: "" };

      function tryExtract() {
        if (settled) return;
        contactAttempts++;
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

              // Phone: look for tel links first (most reliable)
              const telEl = document.querySelector('a[href^="tel:"]');
              if (telEl) {
                result.phone = telEl.href.replace('tel:', '').replace(/\D/g, '');
              } else {
                // Stricter regex: find candidate phone strings, then validate
                const candidates = text.match(/\+?[\d][\d\s().\-]{6,18}[\d]/g) || [];
                for (const c of candidates) {
                  const digits = c.replace(/\D/g, '');
                  // Must be 10–15 digits and NOT look like a concatenated year range
                  if (digits.length >= 10 && digits.length <= 15 &&
                      !/^(19|20)\d{2}(19|20)\d{2}/.test(digits)) {
                    result.phone = digits;
                    break;
                  }
                }
              }

              return result;
            },
          },
          (results) => {
            if (chrome.runtime.lastError) {
              if (contactAttempts >= 4) { clearTimeout(timeout); finish(bestContact); }
              else setTimeout(tryExtract, 800);
              return;
            }
            const contact = results?.[0]?.result || { email: "", phone: "" };
            // Update best if we found anything new
            if (contact.email) bestContact.email = contact.email;
            if (contact.phone) bestContact.phone = contact.phone;

            // If we have both, finish immediately
            if (bestContact.email && bestContact.phone) {
              clearTimeout(timeout);
              finish(bestContact);
            } else if (contactAttempts >= 4) {
              // After 4 polls, accept what we have
              clearTimeout(timeout);
              finish(bestContact);
            } else {
              setTimeout(tryExtract, 800);
            }
          }
        );
      }

      let listenerFired = false;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          if (listenerFired) return;
          listenerFired = true;
          setTimeout(tryExtract, 500);
        }
      });

      // Safety: if the tab is already complete
      chrome.tabs.get(tabId, (t) => {
        if (t && t.status === 'complete' && !listenerFired) {
          listenerFired = true;
          setTimeout(tryExtract, 500);
        }
      });
    });
  });
}

// ─── Open background tab, poll until experience items appear, extract ──────
async function extractExperienceViaTab(url) {
  await randomDelay(600, 1800);
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        return resolve({ experiences: [] });
      }
      const tabId = tab.id;
      let settled = false;

      function finish(experiences) {
        if (settled) return;
        settled = true;
        chrome.tabs.remove(tabId).catch(() => {});
        resolve({ experiences });
      }

      const timeout = setTimeout(() => {
        console.log('[KPRMT bg] Experience tab hard timeout after 35s, returning best:', bestExps.length);
        finish(bestExps);
      }, 35000);

      let attempts = 0;
      const MAX_ATTEMPTS = 15;
      let bestExps = [];      // highest count seen so far
      let stableCount = 0;    // how many consecutive polls returned same count

      function pollExtract() {
        if (settled) return;
        attempts++;
        console.log('[KPRMT bg] Experience poll attempt', attempts);

        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: (attemptNum) => {
              // Multi-step scroll to trigger progressive lazy loading.
              // LinkedIn only renders items when they enter the viewport,
              // so a single jump to scrollHeight misses mid-page entries.
              const h = document.body.scrollHeight;
              window.scrollTo(0, Math.floor(h * 0.25));
              window.scrollTo(0, Math.floor(h * 0.5));
              window.scrollTo(0, Math.floor(h * 0.75));
              window.scrollTo(0, h);

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
                  if (t.length > 250) continue;
                  if (!company && !isDates(t) && !/^\d+$/.test(t)) { company = t.split('·')[0].trim(); continue; }
                  if (!dates && isDates(t)) { dates = t; continue; }
                  if (dates && !location && !isDates(t) && t.length < 100) { location = t; break; }
                }
                return { title, company, dates, location };
              }

              const titleSeen = new Set();
              const exps = [];

              const topItems = Array.from(
                document.querySelectorAll('.pvs-list > li.artdeco-list__item, .scaffold-finite-scroll__content li.artdeco-list__item')
              ).filter(li => !li.parentElement.closest('li.artdeco-list__item'));

              topItems.forEach(item => {
                const nested = item.querySelector('ul.pvs-list');
                const subItems = nested ? Array.from(nested.querySelectorAll('li.artdeco-list__item')) : [];

                if (subItems.length > 0) {
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

              console.log('[KPRMT] Experience attempt', attemptNum, ':', exps.length, exps);
              return exps;
            },
            args: [attempts],
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.log('[KPRMT bg] Experience executeScript error:', chrome.runtime.lastError.message);
              if (attempts >= MAX_ATTEMPTS) { clearTimeout(timeout); finish([]); }
              else setTimeout(pollExtract, 800);
              return;
            }
            const exps = results?.[0]?.result || [];
            console.log('[KPRMT bg] Exp poll', attempts, ': got', exps.length, 'best so far', bestExps.length);

            // Keep the best (highest count) result
            if (exps.length > bestExps.length) {
              bestExps = exps;
              stableCount = 0;
            } else if (exps.length === bestExps.length && exps.length > 0) {
              stableCount++;
            }

            // Done if: count stabilized for 3 consecutive polls (avoids stopping
            // while LinkedIn is still lazy-loading older entries), OR max attempts
            if (stableCount >= 3 && bestExps.length > 0) {
              console.log('[KPRMT bg] Experience STABLE at', bestExps.length, 'after', attempts, 'polls');
              clearTimeout(timeout);
              finish(bestExps);
            } else if (attempts >= MAX_ATTEMPTS) {
              console.log('[KPRMT bg] Experience MAX attempts, returning best:', bestExps.length);
              clearTimeout(timeout);
              finish(bestExps);
            } else {
              setTimeout(pollExtract, 1500); // give LinkedIn time to render lazy-loaded entries
            }
          }
        );
      }

      // Wait for tab to finish loading before polling
      let listenerFired = false;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          if (listenerFired) return;
          listenerFired = true;
          console.log('[KPRMT bg] Experience tab loaded (onUpdated), starting polls...');
          setTimeout(pollExtract, 1000);
        }
      });

      // Safety: if the tab is already complete when we add the listener
      chrome.tabs.get(tabId, (t) => {
        if (t && t.status === 'complete' && !listenerFired) {
          listenerFired = true;
          console.log('[KPRMT bg] Experience tab already complete, starting polls...');
          setTimeout(pollExtract, 1000);
        }
      });
    });
  });
}

// ─── Open background tab, poll until education items appear, extract ──────
async function extractEducationViaTab(url) {
  await randomDelay(600, 1500);
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        return resolve({ educations: [] });
      }
      const tabId = tab.id;
      let settled = false;

      function finish(educations) {
        if (settled) return;
        settled = true;
        chrome.tabs.remove(tabId).catch(() => {});
        resolve({ educations });
      }

      const timeout = setTimeout(() => {
        console.log('[KPRMT bg] Education tab hard timeout, returning best:', bestEdus.length);
        finish(bestEdus);
      }, 15000);

      let attempts = 0;
      const MAX_ATTEMPTS = 7;
      let bestEdus = [];
      let stableCount = 0;

      function pollExtract() {
        if (settled) return;
        attempts++;

        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: (attemptNum) => {
              window.scrollTo(0, document.body.scrollHeight);

              function isDates(t) {
                return /\d{4}/.test(t) && (t.includes(' - ') || /\bpresent\b|\bcurrent\b/i.test(t));
              }

              const edus = [];
              const seen = new Set();

              // Find all top-level list items
              const items = Array.from(
                document.querySelectorAll('.pvs-list > li.artdeco-list__item, .scaffold-finite-scroll__content li.artdeco-list__item')
              ).filter(li => !li.parentElement.closest('li.artdeco-list__item'));

              items.forEach(item => {
                // Remove sub-components before extracting text
                const clone = item.cloneNode(true);
                clone.querySelectorAll('.pvs-entity__sub-components, [class*="sub-components"]').forEach(el => el.remove());
                const spans = Array.from(clone.querySelectorAll('span[aria-hidden="true"]'));
                const texts = spans.map(s => s.textContent.trim()).filter(Boolean);
                if (texts.length === 0) return;

                const school = texts[0] || '';
                const degreeField = texts[1] || '';
                const dates = texts[2] || '';

                let degree = '', field = '';
                if (degreeField.includes(',')) {
                  const parts = degreeField.split(',');
                  degree = parts[0].trim();
                  field = parts.slice(1).join(',').trim();
                } else if (degreeField.includes('·')) {
                  const parts = degreeField.split('·');
                  degree = parts[0].trim();
                  field = parts.slice(1).join('·').trim();
                } else if (degreeField.includes(' - ') && !isDates(degreeField)) {
                  const parts = degreeField.split(' - ');
                  degree = parts[0].trim();
                  field = parts.slice(1).join(' - ').trim();
                } else {
                  degree = degreeField;
                }

                let graduationYear = '';
                const yearMatch = dates.match(/(\d{4})/g);
                if (yearMatch) graduationYear = yearMatch[yearMatch.length - 1];

                const key = school.toLowerCase();
                if (school && !seen.has(key)) {
                  seen.add(key);
                  edus.push({ school, degree, field, dates, graduationYear });
                }
              });

              console.log('[KPRMT] Education attempt', attemptNum, ':', edus.length);
              return edus;
            },
            args: [attempts],
          },
          (results) => {
            if (chrome.runtime.lastError) {
              if (attempts >= MAX_ATTEMPTS) { clearTimeout(timeout); finish(bestEdus); }
              else setTimeout(pollExtract, 800);
              return;
            }
            const edus = results?.[0]?.result || [];

            if (edus.length > bestEdus.length) {
              bestEdus = edus;
              stableCount = 0;
            } else if (edus.length === bestEdus.length && edus.length > 0) {
              stableCount++;
            }

            if (stableCount >= 1 && bestEdus.length > 0) {
              console.log('[KPRMT bg] Education STABLE at', bestEdus.length);
              clearTimeout(timeout);
              finish(bestEdus);
            } else if (attempts >= MAX_ATTEMPTS) {
              clearTimeout(timeout);
              finish(bestEdus);
            } else {
              setTimeout(pollExtract, 1000);
            }
          }
        );
      }

      let listenerFired = false;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          if (listenerFired) return;
          listenerFired = true;
          setTimeout(pollExtract, 1000);
        }
      });

      chrome.tabs.get(tabId, (t) => {
        if (t && t.status === 'complete' && !listenerFired) {
          listenerFired = true;
          setTimeout(pollExtract, 1000);
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
  // Create the daily reset alarm (safe to call here, not at top level)
  chrome.alarms.create("resetDailyCount", { periodInMinutes: 60 });
  if (details.reason === "install") {
    chrome.storage.local.set({
      daily_count: 0,
      daily_date: new Date().toDateString(),
      extraction_history: [],
    });
  }
});

// Re-create alarm when service worker restarts (MV3 alarms don't persist across restarts)
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("resetDailyCount", { periodInMinutes: 60 });
});
