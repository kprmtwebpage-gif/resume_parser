// KPRMT LinkedIn Profile Extractor - Content Script
// Extracts candidate data from LinkedIn profile pages via DOM parsing

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__kprmt_injected) return;
  window.__kprmt_injected = true;
  // Note: fetch interception is done by skill_interceptor.js in MAIN world.
  // This isolated-world script reads the captured skills via DOM dataset.

  // ─── Helper: safe text extraction ───────────────────────────────────
  function getText(selector, context) {
    const el = (context || document).querySelector(selector);
    return el ? el.textContent.trim() : "";
  }

  function getAll(selector, context) {
    return Array.from((context || document).querySelectorAll(selector));
  }

  // ─── Human-like random delay ───────────────────────────────────────
  function randomDelay(minMs, maxMs) {
    return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
  }

  // ─── NAME extraction ───────────────────────────────────────────────
  function extractName() {
    // Strategy 1: grab the first aria-hidden span INSIDE h1 (avoids doubled text
    // from visually-hidden clones that LinkedIn adds for screen readers)
    const h1 = document.querySelector('h1');
    if (h1) {
      const firstSpan = h1.querySelector('span[aria-hidden="true"]');
      const raw = firstSpan ? firstSpan.textContent.trim() : h1.textContent.trim();
      if (raw && raw.length > 1 && raw.length < 80) {
        console.log('[KPRMT] Name from h1:', raw);
        const parts = raw.split(/\s+/);
        return {
          first_name: parts[0] || '',
          last_name: parts.slice(1).join(' '),
          full_name: raw,
        };
      }
    }

    // Strategy 2: standard CSS class selectors (LinkedIn has changed these over time)
    const cssSelectors = [
      'h1.text-heading-xlarge span[aria-hidden="true"]',
      'h1.text-heading-xlarge',
      '[data-anonymize="person-name"]',
      '.pv-top-card--list h1',
      '.ph5 h1',
      '.top-card-layout__title',
      '.profile-header__name',
      '.artdeco-entity-lockup__title',
    ];
    for (const sel of cssSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const raw = el.textContent.trim();
      if (raw && raw.length > 1 && raw.length < 80) {
        console.log('[KPRMT] Name via selector', sel, ':', raw);
        const parts = raw.split(/\s+/);
        return {
          first_name: parts[0] || '',
          last_name: parts.slice(1).join(' '),
          full_name: raw,
        };
      }
    }

    // Strategy 3: parse from document.title (always "Name | LinkedIn" or "Name - Title | LinkedIn")
    const rawTitle = document.title || '';
    const cleanTitle = rawTitle.replace(/^\(\d+\)\s*/, ''); // strip "(2) " notification badge
    const pipeIdx = cleanTitle.indexOf(' | ');
    if (pipeIdx > 0) {
      let namePart = cleanTitle.substring(0, pipeIdx);
      // Remove " - Subtitle" if present
      const dashIdx = namePart.indexOf(' - ');
      if (dashIdx > 0) namePart = namePart.substring(0, dashIdx);
      namePart = namePart.trim();
      if (namePart && namePart.length > 1 && namePart.length < 80 &&
          !namePart.toLowerCase().includes('linkedin')) {
        console.log('[KPRMT] Name from document.title:', namePart);
        const parts = namePart.split(/\s+/);
        return {
          first_name: parts[0] || '',
          last_name: parts.slice(1).join(' '),
          full_name: namePart,
        };
      }
    }

    // Strategy 4: og:title meta tag
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    if (ogTitle && ogTitle.length > 1 && ogTitle.length < 80 &&
        !ogTitle.toLowerCase().includes('linkedin')) {
      console.log('[KPRMT] Name from og:title:', ogTitle);
      const parts = ogTitle.trim().split(/\s+/);
      return {
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' '),
        full_name: ogTitle.trim(),
      };
    }

    console.log('[KPRMT] WARNING: Name not found. h1s:', document.querySelectorAll('h1').length, 'title:', document.title);
    return { first_name: '', last_name: '', full_name: '' };
  }

  // ─── Shared helper: find aria-hidden spans in document order after h1 ──
  // LinkedIn ALWAYS renders: [name-span] → [headline-span] → [location-span]
  // Positional scan is class-name-independent and works across all A/B variants.
  function getSpansAfterH1() {
    const h1 = document.querySelector('h1');
    if (!h1) return [];
    const nameSpan = h1.querySelector('span[aria-hidden="true"]');
    if (!nameSpan) return [];
    const allSpans = Array.from(document.querySelectorAll('span[aria-hidden="true"]'));
    const nameIdx = allSpans.indexOf(nameSpan);
    if (nameIdx < 0) return [];
    return allSpans.slice(nameIdx + 1, nameIdx + 15); // next 14 spans after name
  }

  // ─── HEADLINE / JOB TITLE extraction ───────────────────────────────
  function extractHeadline() {
    // --- Strategy 1: CSS selectors (covers pre-2026 layouts) ---
    const selectors = [
      '.pv-text-details__left-panel .text-body-medium span[aria-hidden="true"]',
      '.pv-text-details__left-panel .text-body-medium',
      ".text-body-medium.break-words span[aria-hidden='true']",
      ".text-body-medium.break-words",
      ".pv-top-card--list .text-body-medium",
      '[data-anonymize="headline"]',
      ".ph5 .text-body-medium",
      ".top-card-layout__headline",
      '.profile-header__subtitle',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const t = el.textContent.trim();
      if (t && t.length > 2 && t.length < 300) return t;
    }

    // --- Strategy 2: Positional scan — first meaningful span after the name ---
    // LinkedIn always puts the headline as the first text block after the h1.
    // This works regardless of CSS class name changes.
    const spansAfterH1 = getSpansAfterH1();
    const h1 = document.querySelector('h1');
    const nameTxt = (h1?.querySelector('span[aria-hidden="true"]')?.textContent || '').trim().toLowerCase();
    for (const sp of spansAfterH1) {
      const t = sp.textContent.trim();
      if (!t || t.length < 3 || t.length > 300) continue;
      if (t.toLowerCase() === nameTxt) continue;                   // skip duplicate name
      if (/^(He|She|They|Ze|Xe)\//i.test(t)) continue;            // skip pronouns
      if (/^(2nd|3rd|1st|LION)\s*$/i.test(t)) continue;           // skip degree badge
      if (/\d+\s*(follower|connection)/i.test(t)) continue;        // skip social counts
      if (/^\d+$/.test(t)) continue;                               // skip pure numbers
      console.log('[KPRMT] Headline via positional scan:', t);
      return t;
    }

    // --- Strategy 3: meta description fallback ---
    const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    if (desc.length > 5) {
      const match = desc.match(/View [^']+?'s? (?:full )?profile[^.]*\. ([^.]+)\./i);
      if (match?.[1]) return match[1].trim();
    }
    return "";
  }

  // ─── LOCATION extraction ───────────────────────────────────────────
  function extractLocation() {
    // --- Strategy 1: CSS selectors ---
    const selectors = [
      '.pv-text-details__left-panel .text-body-small span[aria-hidden="true"]',
      '.pv-text-details__left-panel .text-body-small',
      ".text-body-small.inline.t-black--light.break-words span[aria-hidden='true']",
      ".text-body-small.inline.t-black--light.break-words",
      ".pv-top-card--list-bullet .text-body-small",
      '[data-anonymize="location"]',
      ".ph5 .text-body-small",
      ".top-card-layout__first-subline .top-card__subline-item",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const loc = el.textContent.trim();
      if (loc && loc.length > 2 && !loc.includes("connection") && !loc.includes("follower")) {
        return loc;
      }
    }

    // --- Strategy 2: Positional scan — first geographic-looking span after headline ---
    // Location is the span that comes after the headline in DOM order.
    // It is typically short (<80 chars) and does NOT contain "at" (that's the headline).
    const spansAfterH1 = getSpansAfterH1();
    const h1 = document.querySelector('h1');
    const nameTxt = (h1?.querySelector('span[aria-hidden="true"]')?.textContent || '').trim().toLowerCase();
    let headlineSkipped = false;
    for (const sp of spansAfterH1) {
      const t = sp.textContent.trim();
      if (!t || t.length < 3) continue;
      if (t.toLowerCase() === nameTxt) continue;
      if (/^(He|She|They|Ze|Xe)\//i.test(t)) continue;
      if (/^(2nd|3rd|1st|LION)\s*$/i.test(t)) continue;
      if (/\d+\s*(follower|connection)/i.test(t)) continue;
      if (/^\d+$/.test(t)) continue;
      if (!headlineSkipped) { headlineSkipped = true; continue; }  // skip headline span
      // location is short and typically doesn't contain " at " or long clauses
      if (t.length < 100
          && !t.includes('Contact info')
          && !/^\d{4}/.test(t)) {                                  // skip year ranges
        console.log('[KPRMT] Location via positional scan:', t);
        return t;
      }
    }
    return "";
  }

  // ─── ABOUT / SUMMARY extraction ────────────────────────────────────
  function extractAbout() {
    const aboutSection = document.querySelector("#about");
    if (aboutSection) {
      const container = aboutSection.closest("section");
      if (container) {
        const spans = container.querySelectorAll(
          ".inline-show-more-text span[aria-hidden='true'], .pv-shared-text-with-see-more span.visually-hidden"
        );
        if (spans.length > 0) return spans[0].textContent.trim();
        const textDiv = container.querySelector(
          ".display-flex .full-width span"
        );
        if (textDiv) return textDiv.textContent.trim();
      }
    }
    return "";
  }

  // ─── Find section by anchor ID or heading text ─────────────────────
  function findSection(id, headingText) {
    const lc = headingText.toLowerCase();

    // Recognise a meaningful profile-section container element.
    // LinkedIn 2026 uses .pv-profile-card / .pvs-list__outer-container
    // in addition to the classic <section> and .artdeco-card classes.
    function isContainer(el) {
      if (!el || el === document.body || el === document.documentElement) return false;
      if (el.tagName === 'SECTION') return true;
      const cls = typeof el.className === 'string' ? el.className : '';
      if (/artdeco-card|pv-profile-card|pvs-list__outer|scaffold-finite-scroll/i.test(cls)) return true;
      // Any div/article that directly contains a pvs-list is a section wrapper
      if ((el.tagName === 'DIV' || el.tagName === 'ARTICLE') &&
          el.querySelector(':scope > ul.pvs-list, :scope > div > ul.pvs-list')) return true;
      return false;
    }

    // Walk up at most 12 levels to find a container
    function nearestContainer(el) {
      let cur = el ? el.parentElement : null;
      for (let i = 0; i < 12 && cur && cur !== document.body; i++, cur = cur.parentElement) {
        if (isContainer(cur)) return cur;
      }
      return null;
    }

    // PRIMARY: scan ALL h2/h3 elements on the page and match visible text
    const allHeadings = document.querySelectorAll('h2, h3');
    for (const h of allHeadings) {
      const ariaSpan = h.querySelector('span[aria-hidden="true"]');
      const txt = (ariaSpan ? ariaSpan.textContent : h.textContent).trim().toLowerCase();
      if (txt === lc) {
        const c = nearestContainer(h);
        if (c) return c;
        // Fallback: return the heading's parent if it contains a list
        const p = h.parentElement;
        if (p && p.querySelector('ul, li')) return p;
      }
    }

    // SECONDARY: anchor id → next-sibling scan (up to 5 siblings) and parent siblings
    const anchor = document.querySelector('#' + id);
    if (anchor) {
      let sib = anchor.nextElementSibling;
      for (let i = 0; i < 5 && sib; i++, sib = sib.nextElementSibling) {
        if (isContainer(sib) || sib.querySelector('h2, h3, ul.pvs-list')) return sib;
      }
      // Also check the siblings of anchor's parent
      const p = anchor.parentElement;
      if (p) {
        let ps = p.nextElementSibling;
        for (let i = 0; i < 3 && ps; i++, ps = ps.nextElementSibling) {
          if (isContainer(ps) || ps.querySelector('h2, h3, ul.pvs-list')) return ps;
        }
      }
    }

    // TERTIARY: pvs-header span text scan
    const pvsSpans = document.querySelectorAll('[class*="pvs-header"] span[aria-hidden="true"]');
    for (const sp of pvsSpans) {
      if (sp.textContent.trim().toLowerCase() === lc) {
        const c = nearestContainer(sp);
        if (c) return c;
      }
    }

    // QUATERNARY: any aria-hidden span exactly matching the heading text
    const allSpans = document.querySelectorAll('span[aria-hidden="true"]');
    for (const sp of allSpans) {
      if (sp.textContent.trim().toLowerCase() === lc) {
        const c = nearestContainer(sp);
        if (c) return c;
      }
    }

    return null;
  }

  // ─── Get list items from a section (multiple selector strategies) ──
  function getSectionItems(section) {
    if (!section) return [];
    const selectors = [
      "ul.pvs-list > li.artdeco-list__item",
      "ul.pvs-list > li[class*='pvs-list']",
      "ul > li.artdeco-list__item",
      ".pvs-list > li",
      "ul > li"
    ];
    for (const sel of selectors) {
      const items = section.querySelectorAll(sel);
      if (items.length > 0) return Array.from(items);
    }
    return [];
  }

  // ─── Get aria-hidden spans text from an element ────────────────────
  function getVisualTexts(el) {
    const spans = el.querySelectorAll("span[aria-hidden='true']");
    const texts = [];
    spans.forEach(s => {
      const t = s.textContent.trim();
      if (t) texts.push(t);
    });
    return texts;
  }

  // ─── Helper: is this span text a date range? ──────────────────────
  function isDateRange(t) {
    return /\d{4}/.test(t) && (t.includes(" - ") || /\bpresent\b|\bcurrent\b/i.test(t));
  }

  // ─── Helper: parse one experience DOM item into {title,company,dates,location} ─
  function parseExpItem(item) {
    // Deduplicate spans while preserving order
    const seen = new Set();
    const visuals = Array.from(item.querySelectorAll("span[aria-hidden='true']"))
      .map(s => s.textContent.trim())
      .filter(t => {
        if (!t || seen.has(t)) return false;
        seen.add(t);
        return true;
      });

    if (!visuals.length) return null;

    const title = visuals[0];
    let company = "", dates = "", location = "";

    for (let i = 1; i < visuals.length; i++) {
      const t = visuals[i];
      // Skip long text — these are job descriptions, not metadata
      if (t.length > 250) continue;
      // First non-date, non-numeric line after title = company
      if (!company && !isDateRange(t) && !/^\d+$/.test(t)) {
        company = t.split("·")[0].trim();
        continue;
      }
      // Date range line
      if (!dates && isDateRange(t)) {
        dates = t;
        continue;
      }
      // First short line after dates = location (skip if > 100 chars = description)
      if (dates && !location && !isDateRange(t) && t.length < 100) {
        location = t;
        break;
      }
    }

    return { title, company, dates, location };
  }

  // ─── EXPERIENCE extraction ──────────────────────────────────────────
  async function extractExperience(codeTagData) {
    const vanity = window.location.pathname.match(/\/in\/([^/?#\s]+)/)?.[1] || '';

    // Check how many experiences are expected (from "Show all N experiences" link)
    // This mirrors the skills approach — avoids returning truncated DOM list early.
    const expShowAllLink = document.querySelector('a[href*="/details/experience"]');
    let expectedExpCount = 0;
    if (expShowAllLink) {
      const m = (expShowAllLink.textContent || expShowAllLink.getAttribute('aria-label') || '').match(/(\d+)/);
      if (m) expectedExpCount = parseInt(m[1]);
    }
    console.log('[KPRMT] Expected experience entries:', expectedExpCount || 'unknown');

    // Step 1: parse the current page DOM
    const section = findSection("experience", "Experience");
    let domExperiences = [];
    if (section) {
      const items = getSectionItems(section);
      console.log('[KPRMT] Experience section found, list items:', items.length);
      const titleSeen = new Set();

      items.forEach((item) => {
        const subItems = item.querySelectorAll("ul.pvs-list > li");
        if (subItems.length > 0) {
          const companyEl = item.querySelector("span.t-bold span[aria-hidden='true']");
          const company = companyEl ? companyEl.textContent.trim() : "";
          subItems.forEach((sub) => {
            const exp = parseExpItem(sub);
            if (exp && exp.title && !titleSeen.has(exp.title)) {
              titleSeen.add(exp.title);
              if (!exp.company) exp.company = company;
              domExperiences.push(exp);
            }
          });
        } else {
          const exp = parseExpItem(item);
          if (exp && exp.title && !titleSeen.has(exp.title)) {
            titleSeen.add(exp.title);
            domExperiences.push(exp);
          }
        }
      });
    } else {
      console.log('[KPRMT] Experience section NOT found in DOM');
    }

    // Return DOM result only if it appears complete (≥80% of expected entries).
    // If expectedExpCount === 0 the "Show all" link wasn't found — LinkedIn may be
    // hiding older entries without showing a count. Never trust DOM as complete in
    // that case; always fall through to background tab for the full history.
    const domIsComplete = domExperiences.length > 0 &&
      expectedExpCount > 0 &&
      domExperiences.length >= Math.floor(expectedExpCount * 0.8);

    if (domIsComplete) {
      console.log('[KPRMT] DOM has', domExperiences.length, 'experience entries (complete)');
      return domExperiences;
    }

    if (domExperiences.length > 0) {
      console.log('[KPRMT] DOM has', domExperiences.length, 'of', expectedExpCount,
        'expected entries — trying deeper sources for full history...');
    }

    // Track best result across ALL sources so we never discard data
    let best = domExperiences;

    // Step 2: <code> tag JSON from current page
    if (codeTagData?.experience?.length > 0) {
      console.log('[KPRMT] Code tags have', codeTagData.experience.length, 'experience entries');
      if (codeTagData.experience.length > best.length) best = codeTagData.experience;
      // Only accept code tags as final answer if they meet the expected count
      const codeIsComplete = expectedExpCount > 0 &&
        codeTagData.experience.length >= Math.floor(expectedExpCount * 0.8);
      if (codeIsComplete && codeTagData.experience.length >= domExperiences.length) {
        console.log('[KPRMT] Code tags appear complete, using them');
        return codeTagData.experience;
      }
      console.log('[KPRMT] Code tags incomplete (' + codeTagData.experience.length +
        ' vs expected ' + expectedExpCount + '), trying background tab...');
    }

    // Step 3: background tab — open /details/experience/ and extract full history
    if (vanity) {
      try {
        const expUrl = `https://www.linkedin.com/in/${encodeURIComponent(vanity)}/details/experience/`;
        console.log('[KPRMT] Opening experience background tab...');
        const result = await chrome.runtime.sendMessage({
          action: 'extractExperienceViaTab',
          url: expUrl,
        });
        if (result && Array.isArray(result.experiences) && result.experiences.length > 0) {
          console.log('[KPRMT] Background tab returned', result.experiences.length, 'experience entries');
          if (result.experiences.length > best.length) best = result.experiences;
        }
      } catch(e) { console.log('[KPRMT] Experience bg tab error:', e.message); }
    }

    // Return the best result we found across all sources
    console.log('[KPRMT] Returning best experience:', best.length, 'entries');
    return best;
  }

  // ─── EDUCATION extraction ──────────────────────────────────────────
  async function extractEducation(codeTagData) {
    const vanity = window.location.pathname.match(/\/in\/([^/?#\s]+)/)?.[1] || '';
    const educations = [];
    const section = findSection("education", "Education");
    if (section) {
      const items = getSectionItems(section);
      console.log('[KPRMT] Education section found, list items:', items.length);

      items.forEach((item) => {
        // Remove sub-components (endorsers, etc.) before extracting text
        const clone = item.cloneNode(true);
        clone.querySelectorAll('.pvs-entity__sub-components, [class*="sub-components"]').forEach(el => el.remove());
        const visuals = getVisualTexts(clone);
        // Usually: [school, degree · field, dates]
        const school = visuals[0] || "";
        const degreeField = visuals[1] || "";
        const dates = visuals[2] || "";

        // Parse degree and field
        let degree = "";
        let field = "";
        if (degreeField.includes(",")) {
          const parts = degreeField.split(",");
          degree = parts[0].trim();
          field = parts.slice(1).join(",").trim();
        } else if (degreeField.includes("·")) {
          const parts = degreeField.split("·");
          degree = parts[0].trim();
          field = parts.slice(1).join("·").trim();
        } else if (degreeField.includes(' - ') && !isDateRange(degreeField)) {
          const parts = degreeField.split(' - ');
          degree = parts[0].trim();
          field = parts.slice(1).join(' - ').trim();
        } else {
          degree = degreeField;
        }

        // Parse graduation year
        let graduationYear = "";
        const yearMatch = dates.match(/(\d{4})/g);
        if (yearMatch) {
          graduationYear = yearMatch[yearMatch.length - 1];
        }

        if (school) {
          educations.push({ school, degree, field, dates, graduationYear });
        }
      });

      if (educations.length > 0) {
        console.log('[KPRMT] DOM has', educations.length, 'education entries');
        return educations;
      }
    } else {
      console.log('[KPRMT] Education section NOT found in DOM');
    }

    // Fallback 1: <code> tag data
    if (codeTagData?.education?.length > 0) {
      console.log('[KPRMT] Using', codeTagData.education.length, 'education from <code> tags');
      return codeTagData.education;
    }

    // Fallback 2: background tab
    if (vanity) {
      try {
        const eduUrl = `https://www.linkedin.com/in/${encodeURIComponent(vanity)}/details/education/`;
        console.log('[KPRMT] Trying education background tab...');
        const result = await chrome.runtime.sendMessage({
          action: 'extractEducationViaTab',
          url: eduUrl,
        });
        if (result && Array.isArray(result.educations) && result.educations.length > 0) {
          console.log('[KPRMT] Background tab returned', result.educations.length, 'education entries');
          return result.educations;
        }
      } catch(e) { console.log('[KPRMT] Education bg tab error:', e.message); }
    }

    return educations;
  }

  // ─── SKILLS: collect from any container ────────────────────────────
  function collectSkillsFromContainer(container) {
    const skills = [];
    if (!container) return skills;
    const seen = new Set();

    // Smart person-name filter: keeps tech skills like "Machine Learning",
    // "Natural Language Processing" but removes endorser names like "Ashwin Kumar U."
    const TECH_WORDS_LOCAL = new Set([
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
      'scripting','statistical','algorithms','optimization',
    ]);
    function looksLikePersonName(t) {
      const words = t.split(/\s+/);
      if (words.length < 2 || words.length > 5) return false;
      if (/[#\+\/\(\)\[\]{}<>\d@&]/.test(t)) return false;
      if (words.some(w => TECH_WORDS_LOCAL.has(w.toLowerCase().replace(/[.]/g, '')))) return false;
      if (!words.every(w => /^[A-Z][a-zA-Z'.\-]*$/.test(w))) return false;
      if (words.some(w => /^[A-Z]\.$/.test(w))) return true;
      return true;
    }

    function addSkill(t) {
      t = (t || "").trim();
      if (t && t.length > 1 && t.length < 80 && !/^\d+$/.test(t)
          && !t.toLowerCase().includes("endorsement")
          && !t.toLowerCase().includes("endorsed by")
          && !t.toLowerCase().includes("show all")
          && !t.toLowerCase().includes("experiences across")
          && !t.toLowerCase().includes("experience across")
          && !t.toLowerCase().includes("person in the last")
          && !/ at /i.test(t)
          && !/^\d+ (experience|endorsement|person)/i.test(t)
          && !seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase());
        skills.push(t);
      }
    }

    const CATEGORY_NAMES = new Set([
      'industry knowledge', 'tools & technologies', 'other skills',
      'interpersonal skills', 'top skills', 'languages', 'certifications',
      'skills', 'featured',
    ]);

    // PRIMARY STRATEGY: Bold text = skill names (multiple bold-span patterns)
    container.querySelectorAll(
      'span.t-bold span[aria-hidden="true"], .t-bold > span[aria-hidden="true"]'
    ).forEach(span => {
      const t = span.textContent.trim();
      if (!CATEGORY_NAMES.has(t.toLowerCase())) addSkill(t);
    });

    // Also: hoverable links (skill name as link text)
    container.querySelectorAll(
      '.hoverable-link-text span[aria-hidden="true"]'
    ).forEach(span => {
      const t = span.textContent.trim();
      if (!CATEGORY_NAMES.has(t.toLowerCase())) addSkill(t);
    });

    // Also: pvs-entity first aria-hidden span (covers condensed layout)
    container.querySelectorAll(
      '.pvs-entity__content span[aria-hidden="true"]:first-child'
    ).forEach(span => {
      const t = span.textContent.trim();
      if (!CATEGORY_NAMES.has(t.toLowerCase())) addSkill(t);
    });

    // Last resort if still empty: first aria-hidden span in list items (with sub-components removed)
    if (skills.length === 0) {
      getSectionItems({ querySelectorAll: (s) => container.querySelectorAll(s) }).forEach(item => {
        const clone = item.cloneNode(true);
        clone.querySelectorAll('.pvs-entity__sub-components, [class*="sub-components"]').forEach(el => el.remove());
        const span = clone.querySelector('span[aria-hidden="true"]');
        if (span) {
          const t = span.textContent.trim();
          if (!CATEGORY_NAMES.has(t.toLowerCase())) addSkill(t);
        }
      });
    }

    return skills;
  }

  // ─── Extract skills/experience/education from current page <code> tags ──
  // LinkedIn embeds JSON payloads in <code> tags with full profile data.
  // This is the SAFEST approach — zero additional HTTP requests.
  function extractDataFromCodeTags(targetDoc) {
    const result = { skills: [], experience: [], education: [], profile: null };
    const skillSet = new Set();
    const expSet = new Set();
    const eduSet = new Set();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Vanity name from current URL helps pick the RIGHT profile item when there
    // are multiple profile objects in the JSON (e.g. viewer + endorsers).
    const vanityFromUrl = (targetDoc || document).location?.pathname
      ?.match(/\/in\/([^/?#\s]+)/)?.[1] || '';

    const codeTags = (targetDoc || document).querySelectorAll('code');
    for (const el of codeTags) {
      const txt = el.textContent;
      if (txt.length < 50) continue;
      let data;
      try { data = JSON.parse(txt); } catch { continue; }

      const included = data.included || data?.data?.included;
      if (!Array.isArray(included)) continue;

      for (const item of included) {
        if (!item || typeof item !== 'object') continue;
        const urn = typeof item.entityUrn === 'string' ? item.entityUrn : '';
        const rawType = item['$type'] || item['_type'] || item['$recipeType'] || '';
        const type = typeof rawType === 'string' ? rawType : '';

        // ── Profile name / headline / location ──
        // Look for miniProfile or full profile items that have firstName + lastName
        const isProfileItem =
          /fsd_profile|fs_miniProfile|MiniProfile|identity.*[Pp]rofile/i.test(urn + type);
        if (isProfileItem && (item.firstName || item.lastName)) {
          const fn = (item.firstName || '').trim();
          const ln = (item.lastName || '').trim();
          const full = (fn + ' ' + ln).trim();
          const pubId = item.publicIdentifier || '';
          const headline = item.headline || item.occupation || '';
          const location = item.locationName || item.geoLocationName ||
            item.location?.basicLocation?.countryCode || '';
          // Accept this item if we don't have one yet, or if it matches the
          // page's vanity name (which means it IS the profile we're viewing).
          if (!result.profile || (vanityFromUrl && pubId === vanityFromUrl)) {
            result.profile = {
              first_name: fn,
              last_name: ln,
              full_name: full,
              headline: headline,
              location: location,
            };
          }
        }

        // ── Skills ──
        if (/skill/i.test(urn) || /skill/i.test(type)) {
          for (const key of ['name', 'localizedName']) {
            const name = item[key];
            if (typeof name === 'string' && name.length > 1 && name.length < 80) {
              const lc = name.trim().toLowerCase();
              if (!skillSet.has(lc)) {
                skillSet.add(lc);
                result.skills.push(name.trim());
              }
            }
          }
        }

        // ── Experience (Position) ──
        if (/position/i.test(urn) || /position/i.test(type)) {
          const title = item.title;
          const companyName = item.companyName || (item.company && typeof item.company === 'object' ? item.company.name : '') || '';
          if (typeof title === 'string' && title.length > 1) {
            const key = `${title}|${companyName}`.toLowerCase();
            if (!expSet.has(key)) {
              expSet.add(key);
              let dates = '';
              const tp = item.timePeriod;
              if (tp) {
                const start = tp.startDate;
                const end = tp.endDate;
                if (start) {
                  dates = (start.month ? MONTHS[start.month - 1] + ' ' : '') + (start.year || '');
                  dates += ' - ';
                  if (end) {
                    dates += (end.month ? MONTHS[end.month - 1] + ' ' : '') + (end.year || '');
                  } else {
                    dates += 'Present';
                  }
                }
              }
              result.experience.push({
                title: title.trim(),
                company: (typeof companyName === 'string' ? companyName : '').trim(),
                dates: dates,
                location: item.locationName || item.geoLocationName || ''
              });
            }
          }
        }

        // ── Education ──
        if (/education/i.test(urn) || /education/i.test(type)) {
          const school = item.schoolName || (item.school && typeof item.school === 'object' ? item.school.name : '') || '';
          if (typeof school === 'string' && school.length > 1) {
            const key = school.trim().toLowerCase();
            if (!eduSet.has(key)) {
              eduSet.add(key);
              const degree = item.degreeName || '';
              const field = item.fieldOfStudy || '';
              let dates = '';
              let graduationYear = '';
              const tp = item.timePeriod;
              if (tp) {
                if (tp.startDate?.year) dates += tp.startDate.year;
                if (tp.endDate?.year) {
                  dates += ' - ' + tp.endDate.year;
                  graduationYear = String(tp.endDate.year);
                } else if (tp.startDate?.year) {
                  graduationYear = String(tp.startDate.year);
                }
              }
              result.education.push({
                school: school.trim(),
                degree: (typeof degree === 'string' ? degree : '').trim(),
                field: (typeof field === 'string' ? field : '').trim(),
                dates: dates,
                graduationYear: graduationYear
              });
            }
          }
        }

        // ── Skill from entityComponent (profile cards) ──
        const ec = item.components?.entityComponent || item.entityComponent;
        if (ec && (/skill/i.test(urn) || /skill/i.test(type))) {
          const skillText = ec.title?.text || ec.titleV2?.text?.text;
          if (typeof skillText === 'string' && skillText.length > 1 && skillText.length < 80) {
            const lc = skillText.trim().toLowerCase();
            if (!skillSet.has(lc)) {
              skillSet.add(lc);
              result.skills.push(skillText.trim());
            }
          }
        }
      }
    }

    console.log('[KPRMT] Code tags parsed: skills:', result.skills.length,
      'experience:', result.experience.length, 'education:', result.education.length);
    return result;
  }

  // ─── SKILLS: fetch the /details/skills/ page and parse skill names ──
  // NOTE: This function is DISABLED from the main flow to prevent LinkedIn
  // rate-limiting. It's kept here for potential manual "deep fetch" feature.
  async function extractSkillsViaFetch() {
    const vanityName = window.location.pathname.match(/\/in\/([^/?#\s]+)/)?.[1] || '';
    if (!vanityName) return [];

    const seen = new Set();
    const allSkills = [];

    const NOISE = new Set([
      'skills', 'skill', 'show all', 'see all', 'show more', 'show less',
      'industry knowledge', 'tools & technologies', 'other skills',
      'interpersonal skills', 'top skills', 'languages', 'certifications',
      'recommendations', 'interests', 'courses', 'projects', 'featured',
      'honors & awards', 'publications', 'patents', 'test scores',
      'organizations', 'volunteer experience',
      // LinkedIn UI / navigation items
      'sell with linkedin', 'start a job post', 'advertise on linkedin',
      'elevate your small business', 'create a company page', 'learn with linkedin',
      'post a job', 'find people', 'try premium', 'get hired faster',
      'my network', 'messaging', 'notifications', 'jobs', 'home',
      'sales navigator', 'recruiter', 'learning', 'groups',
      'talent solutions', 'marketing solutions', 'sales solutions',
      'linkedin business', 'linkedin pages', 'linkedin events',
      'about', 'accessibility', 'help center', 'privacy & terms',
      'ad choices', 'advertising', 'business services',
      'get the linkedin app', 'more',
    ]);

    function addSkill(name) {
      const t = (name || '').trim();
      if (!t || t.length <= 1 || t.length >= 80) return;
      const lc = t.toLowerCase();
      if (/^\d+$/.test(t)) return;
      if (NOISE.has(lc)) return;
      if (lc.includes('endorsement') || lc.includes('endorsed by')) return;
      if (lc.includes('show all') || lc.includes('see all')) return;
      if (lc.includes('show more') || lc.includes('show less')) return;
      if (lc.startsWith('http') || lc.includes('linkedin.com')) return;
      if (lc.includes('experiences across') || lc.includes('experience across')) return;
      if (lc.includes('person in the last')) return;
      if (/ at /i.test(t)) return;
      if (/^\d+ (experience|endorsement|person)/i.test(lc)) return;
      // Reject LinkedIn UI / navigation / sidebar / footer text
      if (/linkedin/i.test(t)) return;
      if (/\b(post a job|start a job|find people|try premium|get hired)\b/i.test(t)) return;
      if (/\b(advertise|recruit on|sell with|learn with|elevate your)\b/i.test(t)) return;
      if (/\b(company page|business services|talent solutions|marketing solutions)\b/i.test(t)) return;
      if (/\b(sign in|sign up|sign out|log in|log out|join now)\b/i.test(t)) return;
      if (seen.has(lc)) return;
      seen.add(lc);
      allSkills.push(t);
    }

    try {
      const htmlResp = await fetch(
        `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/details/skills/`,
        { credentials: 'include', headers: { 'accept': 'text/html,*/*', 'accept-language': 'en-US,en;q=0.9' } }
      );
      const html = await htmlResp.text();
      console.log('[KPRMT skills] fetch status:', htmlResp.status, 'len:', html.length);
      if (!htmlResp.ok || html.length < 2000) return allSkills;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const codeTags = [...doc.querySelectorAll('code')];

      // ── Strategy 1: Parse JSON — ONLY from "included" array items ────
      // No blind deepWalk! Only extract from:
      //   a) Items with skill-related URNs → name, localizedName
      //   b) Items with entityComponent (data entities, not nav) → title.text
      //   c) Element references resolved via URN map
      for (const el of codeTags) {
        const txt = el.textContent;
        if (txt.length < 50) continue;
        let data;
        try { data = JSON.parse(txt); } catch { continue; }
        if (!data.included || !Array.isArray(data.included)) continue;

        // Build URN → item lookup
        const urnMap = new Map();
        for (const item of data.included) {
          if (item && typeof item.entityUrn === 'string') {
            urnMap.set(item.entityUrn, item);
          }
        }

        // Pass 1: Direct skill entities (items with "skill" in URN or type)
        for (const item of data.included) {
          if (!item || typeof item !== 'object') continue;
          const urn = typeof item.entityUrn === 'string' ? item.entityUrn : '';
          const rawT = item['$type'] || item['_type'] || item['$recipeType'] || '';
          const type = typeof rawT === 'string' ? rawT : '';
          if (/skill/i.test(urn) || /skill/i.test(type)) {
            if (typeof item.name === 'string') addSkill(item.name);
            if (typeof item.localizedName === 'string') addSkill(item.localizedName);
          }
        }

        // Pass 2: Component entities with entityComponent
        // Only extract title from items that are data entities, NOT navigation
        // Navigation items have external URL fields; skill components don't
        for (const item of data.included) {
          if (!item || typeof item !== 'object') continue;
          const ec = item.components?.entityComponent || item.entityComponent;
          if (!ec) continue;
          // Skip if the component links to an external URL (nav/footer item)
          const navUrl = ec.url?.url || ec.navigationUrl || item.navigationUrl || '';
          if (navUrl && !navUrl.includes('/in/') && !navUrl.includes('/details/')) continue;
          if (ec.title?.text) addSkill(ec.title.text);
          if (ec.titleV2?.text?.text) addSkill(ec.titleV2.text.text);
        }

        // Pass 3: Resolve element references from data.data.elements
        const elements = data?.data?.elements || data?.data?.$paging?.elements || data?.elements || [];
        if (Array.isArray(elements)) {
          for (const ref of elements) {
            const item = typeof ref === 'string' ? urnMap.get(ref) : ref;
            if (!item || typeof item !== 'object') continue;
            const ec = item.components?.entityComponent;
            if (ec?.title?.text) addSkill(ec.title.text);
            if (ec?.titleV2?.text?.text) addSkill(ec.titleV2.text.text);
            if (typeof item.name === 'string') addSkill(item.name);
            // Resolve star-references (*entityComponent etc.)
            if (item.components) {
              for (const [key, val] of Object.entries(item.components)) {
                if (key.startsWith('*') && typeof val === 'string') {
                  const resolved = urnMap.get(val);
                  if (resolved) {
                    const rec = resolved.components?.entityComponent;
                    if (rec?.title?.text) addSkill(rec.title.text);
                    if (rec?.titleV2?.text?.text) addSkill(rec.titleV2.text.text);
                    if (typeof resolved.name === 'string') addSkill(resolved.name);
                  }
                }
              }
            }
          }
        }
      }
      console.log('[KPRMT skills] Strategy 1 (targeted JSON):', allSkills.length, 'skills');
      if (allSkills.length > 0) {
        console.log('[KPRMT skills] Found:', allSkills.slice(0, 20));
        return allSkills;
      }

      // ── Strategy 2: URN-anchored name regex (narrow 500-char window) ──
      let m;
      const fwdRe = /fsd_(?:profile)?[Ss]kill[^"]{0,500}"name"\s*:\s*"([^"]{2,60})"/g;
      while ((m = fwdRe.exec(html)) !== null) addSkill(m[1]);
      const revRe = /"name"\s*:\s*"([^"]{2,60})"[^"]{0,500}fsd_(?:profile)?[Ss]kill/g;
      while ((m = revRe.exec(html)) !== null) addSkill(m[1]);
      console.log('[KPRMT skills] Strategy 2 (URN regex):', allSkills.length, 'skills');
      if (allSkills.length > 0) {
        console.log('[KPRMT skills] Found:', allSkills.slice(0, 20));
        return allSkills;
      }

      // ── Diagnostic: dump structure if all strategies fail ──────────
      for (const el of codeTags) {
        const txt = el.textContent;
        if (txt.length < 500) continue;
        let data;
        try { data = JSON.parse(txt); } catch { continue; }
        if (!data.included) continue;
        const topKeys = Object.keys(data).slice(0, 10);
        // Find an item with entityComponent for diagnostic
        const ecSample = data.included.find(i => i?.components?.entityComponent);
        const skillSample = data.included.find(i => /skill/i.test(typeof i?.entityUrn === 'string' ? i.entityUrn : ''));
        console.log('[KPRMT DIAG] keys:', topKeys,
          'included count:', data.included.length,
          'entityComponent sample:', ecSample ? JSON.stringify(ecSample).substring(0, 500) : 'NONE',
          'skill-URN sample:', skillSample ? JSON.stringify(skillSample).substring(0, 500) : 'NONE');
        break;
      }

    } catch(e) { console.log('[KPRMT skills] error:', e.message); }

    console.log('[KPRMT skills] All strategies returned 0');
    return allSkills;
  }

  // ─── SKILLS extraction ──────────────────────────────────────────
  async function extractSkills(codeTagData) {
    const vanity = window.location.pathname.match(/\/in\/([^/?#\s]+)/)?.[1] || '';

    // Check how many skills are expected (from "Show all N skills" link)
    let expectedCount = 0;
    const showAllLink = document.querySelector('a[href*="/details/skills"]');
    if (showAllLink) {
      const m = (showAllLink.textContent || showAllLink.getAttribute('aria-label') || '').match(/(\d+)/);
      if (m) expectedCount = parseInt(m[1]);
    }
    console.log('[KPRMT] Expected skills:', expectedCount || 'unknown');

    // Track the best result found across ALL methods.
    // Never throw away partial results — always keep the largest set.
    let best = [];

    function isComplete(arr) {
      return arr.length >= 3 && expectedCount > 0 && arr.length >= Math.floor(expectedCount * 0.8);
    }

    // 1. On-page DOM
    const section = findSection('skills', 'Skills');
    if (section) {
      const domSkills = collectSkillsFromContainer(section);
      console.log('[KPRMT] DOM skills section:', domSkills.length);
      if (domSkills.length > best.length) best = domSkills;
      if (isComplete(domSkills)) return domSkills;
    }

    // 2. Code tags — JSON embedded in current page
    const codeSkills = codeTagData?.skills || [];
    if (codeSkills.length > best.length) best = codeSkills;
    if (codeSkills.length >= 5 && isComplete(codeSkills)) {
      console.log('[KPRMT] Code tags have', codeSkills.length, 'complete skills');
      return codeSkills;
    }
    if (codeSkills.length > 0) {
      console.log('[KPRMT] Code tags have', codeSkills.length, 'skills (incomplete, trying deeper)');
    }

    // 3. Interceptor — skills captured from Voyager API responses in MAIN world
    try {
      const raw = document.documentElement.dataset.kprmtSkills;
      if (raw) {
        const intercepted = JSON.parse(raw);
        if (Array.isArray(intercepted) && intercepted.length > 0) {
          console.log('[KPRMT] Interceptor captured', intercepted.length, 'skills');
          if (intercepted.length > best.length) best = intercepted;
          if (isComplete(intercepted)) return intercepted;
        }
      }
    } catch(e) {}

    // 4. Background tab — opens /details/skills/, polls until React renders all skills.
    if (vanity) {
      try {
        const skillsUrl = `https://www.linkedin.com/in/${encodeURIComponent(vanity)}/details/skills/`;
        console.log('[KPRMT] Opening skills background tab...');
        const result = await chrome.runtime.sendMessage({
          action: 'extractSkillsViaTab',
          url: skillsUrl,
        });
        if (result && Array.isArray(result.skills) && result.skills.length > 0) {
          console.log('[KPRMT] Background tab returned', result.skills.length, 'skills');
          if (result.skills.length > best.length) best = result.skills;
        }
      } catch(e) { console.log('[KPRMT] Background tab error:', e.message); }
    }

    // Return the best result across all methods (never return empty if ANY method found skills)
    console.log('[KPRMT] Returning best skills:', best.length);
    return best;
  }

  // ─── CONTACT INFO extraction ───────────────────────────────────────
  async function extractContactInfo() {
    const contact = { email: "", phone: "", linkedin_url: "" };

    // Clean LinkedIn URL from current page
    const cleanUrl = window.location.href.split("?")[0].replace(/\/$/, "");
    contact.linkedin_url = cleanUrl;

    // Fast check: scan visible page text first (works for 1st-degree connections
    // where email/phone may already be in the DOM without opening any overlay)
    const pageText = document.body.innerText || "";
    const mailtoEl = document.querySelector('a[href^="mailto:"]');
    if (mailtoEl) contact.email = mailtoEl.href.replace('mailto:', '').split('?')[0].trim();
    if (!contact.email) {
      const m = pageText.match(/[\w.+\-]+@[\w\-]+\.[\w.\-]+/);
      if (m) contact.email = m[0];
    }
    const telEl = document.querySelector('a[href^="tel:"]');
    if (telEl) contact.phone = telEl.href.replace('tel:', '').replace(/\D/g, '');
    if (!contact.phone) {
      const candidates = pageText.match(/\+?[\d][\d\s().\-]{6,18}[\d]/g) || [];
      for (const c of candidates) {
        const digits = c.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 15 &&
            !/^(19|20)\d{2}(19|20)\d{2}/.test(digits)) {
          contact.phone = digits;
          break;
        }
      }
    }

    // If we already have both, skip opening the contact overlay tab entirely
    if (contact.email && contact.phone) return contact;

    // Otherwise open the contact overlay tab for the rest
    const contactOverlayUrl = cleanUrl + "/overlay/contact-info/";
    const contactLink = document.querySelector(
      'a[href*="/overlay/contact-info"], a[id*="contact-info"], [href*="contact-info"]'
    );
    const urlToOpen = (contactLink && contactLink.href) ? contactLink.href : contactOverlayUrl;

    try {
      const result = await chrome.runtime.sendMessage({
        action: "extractContactViaTab",
        url: urlToOpen,
      });
      if (result) {
        if (result.email) contact.email = result.email;
        if (result.phone) contact.phone = result.phone;
      }
    } catch (_) {
      // background unavailable — fall through to page scan
    }

    // Fallback: scan visible page text
    if (!contact.email) {
      const m = document.body.innerText.match(/[\w.+\-]+@[\w\-]+\.[\w.\-]+/);
      if (m) contact.email = m[0];
    }
    if (!contact.phone) {
      const candidates = document.body.innerText.match(/\+?[\d][\d\s().\-]{6,18}[\d]/g) || [];
      for (const c of candidates) {
        const digits = c.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 15 &&
            !/^(19|20)\d{2}(19|20)\d{2}/.test(digits)) {
          contact.phone = digits;
          break;
        }
      }
    }

    return contact;
  }

  // ─── CALCULATE YEARS OF EXPERIENCE ─────────────────────────────────
  // Parse month names to 0-based index
  const MONTH_MAP = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  function parseDateFromString(str) {
    if (!str) return null;
    // "Present" / "Current" → now
    if (/present|current/i.test(str)) return new Date();
    // "Mon YYYY" → Date
    const m1 = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
    if (m1) {
      const mo = MONTH_MAP[m1[1].toLowerCase()];
      return new Date(parseInt(m1[2], 10), mo !== undefined ? mo : 0, 1);
    }
    // Bare "YYYY"
    const m2 = str.match(/\b(\d{4})\b/);
    if (m2) {
      const y = parseInt(m2[1], 10);
      if (y >= 1980 && y <= new Date().getFullYear()) return new Date(y, 0, 1);
    }
    return null;
  }

  function calculateExperienceYears(experiences) {
    if (!experiences.length) return 0;
    const now = new Date();

    // Collect all intervals from parsed date ranges
    let earliestStart = null;
    const intervals = [];
    for (const exp of experiences) {
      const dStr = exp.dates || "";

      // Approach A: parse "Mon YYYY – Mon YYYY" date range
      const parts = dStr.split(/\s*[\-–—]\s*/);
      const sd = parseDateFromString(parts[0] || "");
      if (sd) {
        let ed = now;
        if (parts.length >= 2) {
          const endStr = parts.slice(1).join("-").split("·")[0].trim();
          const parsed = parseDateFromString(endStr);
          if (parsed) ed = parsed;
        }
        if (ed >= sd) {
          intervals.push([sd.getTime(), ed.getTime()]);
          if (!earliestStart || sd < earliestStart) earliestStart = sd;
          continue;
        }
      }

      // Approach B: parse "· X yrs Y mos" duration shown by LinkedIn
      const durMatch = dStr.match(/·\s*(?:(\d+)\s*yrs?\s*)?(?:(\d+)\s*mos?)?/i);
      if (durMatch && (durMatch[1] || durMatch[2])) {
        const yrs = parseInt(durMatch[1] || '0', 10);
        const mos = parseInt(durMatch[2] || '0', 10);
        const totalMs = (yrs * 12 + mos) * 30.44 * 24 * 60 * 60 * 1000;
        if (totalMs > 0) {
          const syntheticStart = new Date(now.getTime() - totalMs);
          intervals.push([syntheticStart.getTime(), now.getTime()]);
          if (!earliestStart || syntheticStart < earliestStart) earliestStart = syntheticStart;
        }
      }
    }

    if (intervals.length === 0) return 0;

    // Career span = earliest start → today.
    // This is exactly how SignalHire and LinkedIn calculate total experience.
    // No artificial cap — if someone worked 7 years (with gaps) they have 7 years experience.
    const careerSpanYears = earliestStart
      ? (now.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      : 0;

    return Math.round(careerSpanYears * 10) / 10;
  }

  // ─── DATA CLEANING: Normalize and validate extracted profile data ────

  // Generic / soft-skill words that are NOT real technical skills
  const GENERIC_SKILL_WORDS = new Set([
    "programming", "communication", "leadership", "teamwork", "management",
    "analytical", "planning", "strategy",
    "collaboration", "innovation", "presentation", "writing", "marketing",
    "time management", "interpersonal", "critical thinking", "adaptability",
    // Soft / generic skills with no signal for tech sourcing
    "attention to detail", "public speaking", "negotiation", "multitasking",
    "self-motivated", "detail-oriented", "fast learner", "hard working",
    "organizational skills", "decision making", "mentoring", "coaching",
    "microsoft office", "microsoft word", "microsoft excel", "microsoft powerpoint",
    "customer service", "customer satisfaction", "relationship management",
  ]);

  // Normalize verbose LinkedIn skill names, e.g. "Python (Programming Language)" → "Python"
  function normalizeSkillName(s) {
    return s
      .replace(/\s*\(Programming Language\)\s*/gi, '')
      .replace(/\s*\(Language\)\s*/gi, '')
      .replace(/\s*\(Framework\)\s*/gi, '')
      .replace(/\s*\(Software\)\s*/gi, '')
      .replace(/\s*\(Tool\)\s*/gi, '')
      .replace(/\s*\(Platform\)\s*/gi, '')
      .replace(/\s*\(Database\)\s*/gi, '')
      .trim();
  }

  function sanitizePhone(raw) {
    if (!raw) return "";
    // Strip everything except digits
    const digits = raw.replace(/\D/g, "");
    // Must be 10–15 digits
    if (digits.length < 10 || digits.length > 15) return "";
    // Reject if it looks like a year range concatenated (e.g. "20192023")
    if (/^(19|20)\d{2}(19|20)\d{2}/.test(digits)) return "";
    // Reject if it is just a 4-digit year repeated/extended
    if (/^(19|20)\d{2,6}$/.test(digits) && digits.length <= 8) return "";
    return digits;
  }

  // Same tech vocabulary for sanitize pass (final safety net)
  const TECH_WORDS_SANITIZE = new Set([
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
    'scripting','statistical','algorithms','optimization',
  ]);

  function isPersonName(s) {
    const words = s.split(/\s+/);
    if (words.length < 2 || words.length > 5) return false;
    if (/[#\+\/\(\)\[\]{}<>\d@&]/.test(s)) return false;
    if (words.some(w => TECH_WORDS_SANITIZE.has(w.toLowerCase().replace(/[.]/g, '')))) return false;
    if (!words.every(w => /^[A-Z][a-zA-Z'.\-]*$/.test(w))) return false;
    if (words.some(w => /^[A-Z]\.$/.test(w))) return true;
    return true;
  }

  function sanitizeSkills(skills) {
    if (!Array.isArray(skills)) return [];
    // Normalize first (strips LinkedIn verbose suffixes like "(Programming Language)"),
    // then deduplicate. Note: normalization may produce 1-char names like "R" or "C"
    // which are valid programming languages — allow them.
    const normalized = skills.map(skill =>
      typeof skill === 'string' ? normalizeSkillName(skill.trim()) : skill
    );
    const seen = new Set();
    return normalized.filter(skill => {
      if (!skill || typeof skill !== "string") return false;
      const s = skill.trim();
      if (!s) return false; // only reject truly empty strings
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      // Filter soft/generic skills that add no signal for tech sourcing
      if (GENERIC_SKILL_WORDS.has(key)) return false;
      if (/ at /i.test(s)) return false;
      if (/^\d+$/.test(s)) return false;
      if (/experiences? across/i.test(s)) return false;
      if (/endorsed by/i.test(s)) return false;
      if (/person in the last/i.test(s)) return false;
      if (/^\d+ (experience|endorsement|person)/i.test(s)) return false;
      // NOTE: intentionally NO isPersonName() check here.
      // The background tab's /details/skills/ extraction already skips that filter
      // because on that page every bold title IS a skill, not a person name.
      // Applying isPersonName would drop legitimate skills like "Cell Therapy",
      // "Microsoft Power BI", "Problem Solving", etc.
      return true;
    });
  }

  function sanitizeExperience(experience) {
    if (!Array.isArray(experience)) return [];
    return experience.filter(exp => {
      if (!exp) return false;
      // Must have a title; company is optional (some profiles don't show it)
      return exp.title && exp.title.trim().length > 1;
    });
  }

  function cleanExtractedData(data) {
    const cleanedExperience = sanitizeExperience(data.experience);
    return {
      ...data,
      phone: sanitizePhone(data.phone),
      skills: sanitizeSkills(data.skills),
      experience: cleanedExperience,
      // Recalculate years using only sanitized experience
      years_of_experience: calculateExperienceYears(cleanedExperience),
    };
  }

  // ─── MAIN: Extract all profile data ────────────────────────────────
  async function extractProfileData() {
    console.log('[KPRMT] === Starting profile extraction ===');
    console.log('[KPRMT] URL:', window.location.href);
    console.log('[KPRMT] Body length:', document.body?.innerText?.length || 0);
    console.log('[KPRMT] Sections in DOM:', document.querySelectorAll('section').length);
    console.log('[KPRMT] #experience exists:', !!document.querySelector('#experience'));
    console.log('[KPRMT] #education exists:', !!document.querySelector('#education'));
    console.log('[KPRMT] #skills exists:', !!document.querySelector('#skills'));

    const name = extractName();
    console.log('[KPRMT] Extracted name:', JSON.stringify(name));
    let headline = extractHeadline();
    let location = extractLocation();
    const about = extractAbout();

    // Parse <code> tags ONCE — initial data from current page (zero requests)
    console.log('[KPRMT] Step 1: Parsing current page <code> tags...');
    const codeTagData = extractDataFromCodeTags();

    // If CSS-selector extraction of name/headline/location FAILED, fall back
    // to whatever was found in the embedded JSON (code tags).
    const ctProfile = codeTagData.profile;
    if (ctProfile) {
      if (!name.full_name && ctProfile.full_name) {
        name.full_name  = ctProfile.full_name;
        name.first_name = ctProfile.first_name;
        name.last_name  = ctProfile.last_name;
        console.log('[KPRMT] Name from code tags:', ctProfile.full_name);
      }
      if (!headline && ctProfile.headline) {
        headline = ctProfile.headline;
        console.log('[KPRMT] Headline from code tags:', ctProfile.headline);
      }
      if (!location && ctProfile.location) {
        location = ctProfile.location;
        console.log('[KPRMT] Location from code tags:', ctProfile.location);
      }
    }

    // Extract skills first (may open background tab for skills page)
    console.log('[KPRMT] Step 2: Extracting skills...');
    const skills = await extractSkills(codeTagData);

    // Experience and education from DOM (instant, no requests)
    console.log('[KPRMT] Step 3: Extracting experience...');
    const experience = await extractExperience(codeTagData);

    console.log('[KPRMT] Step 4: Extracting education...');
    const education = await extractEducation(codeTagData);

    // Contact: background tab for overlay (single request)
    console.log('[KPRMT] Step 5: Extracting contact info...');
    const contact = await extractContactInfo();

    const yearsOfExperience = calculateExperienceYears(experience);

    // Current company from most recent experience
    let currentCompany = "";
    if (experience.length > 0) {
      const current = experience.find(
        (e) => e.dates && e.dates.toLowerCase().includes("present")
      );
      currentCompany = current ? current.company : experience[0].company;
    }

    return cleanExtractedData({
      first_name: name.first_name,
      last_name: name.last_name,
      full_name: name.full_name,
      headline: headline,
      job_title: headline.split(" at ")[0].split(" @ ")[0].trim(),
      current_company: currentCompany,
      location: location,
      about: about,
      email: contact.email,
      phone: contact.phone,
      linkedin_url: contact.linkedin_url,
      skills: skills,
      experience: experience,
      education: education,
      years_of_experience: yearsOfExperience,
      extracted_at: new Date().toISOString(),
    });
  }

  // ─── Auto-scroll to load lazy sections ──────────────────────────────
  async function scrollToLoadAll() {
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    // Scroll down slowly to trigger LinkedIn's lazy-loading of all sections
    const totalHeight = document.body.scrollHeight;
    let pos = 0;
    while (pos < totalHeight) {
      pos += 400;
      window.scrollTo({ top: pos, behavior: "instant" });
      await delay(300);
    }
    // Reach the very bottom and wait for any final lazy loads
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    await delay(800);
    // Scroll back slowly so all sections have fully rendered
    const newHeight = document.body.scrollHeight;
    for (let p = newHeight; p > 0; p -= 800) {
      window.scrollTo({ top: p, behavior: "instant" });
      await delay(150);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    await delay(500);
  }

  // ─── Listen for messages from popup ────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractProfile") {
      scrollToLoadAll()
        .then(() => extractProfileData())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    }
    return true; // Keep channel open for async response
  });

  // ─── Inject KPRMT side panel (FAB + slide panel) into LinkedIn page ─
  function injectSidePanel() {
    if (document.getElementById('kprmt-root')) return;

    // ── Styles injected into <head> ──────────────────────────────────
    const styleEl = document.createElement('style');
    styleEl.id = 'kprmt-styles';
    styleEl.textContent = `
      #kprmt-fab {
        position:fixed; right:0; top:50%; transform:translateY(-50%);
        z-index:2147483646; width:44px; height:48px;
        border-radius:10px 0 0 10px;
        background:linear-gradient(160deg,#1a56db,#3b82f6);
        color:#fff; display:flex; align-items:center; justify-content:center;
        cursor:pointer; box-shadow:-3px 0 14px rgba(26,86,219,.4);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-weight:800; font-size:15px; letter-spacing:-.5px;
        transition:width .2s,opacity .2s; user-select:none;
      }
      #kprmt-fab:hover { width:50px; }
      #kprmt-fab.kprmt-hidden { opacity:0; pointer-events:none; }
      #kprmt-panel {
        position:fixed; top:0; right:0; bottom:0; width:360px;
        background:#fff; z-index:2147483645;
        box-shadow:-5px 0 30px rgba(0,0,0,.18);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        font-size:13px; color:#111;
        transform:translateX(100%);
        transition:transform .3s cubic-bezier(.4,0,.2,1);
        display:flex; flex-direction:column; overflow:hidden;
      }
      #kprmt-panel.kprmt-open { transform:translateX(0); }
      .kp-hdr {
        background:linear-gradient(135deg,#1a56db,#3b82f6);
        color:#fff; padding:13px 14px;
        display:flex; align-items:center; justify-content:space-between;
        flex-shrink:0;
      }
      .kp-logo-row { display:flex; align-items:center; gap:9px; }
      .kp-logo-box {
        width:40px; height:40px; border-radius:9px;
        overflow:hidden; display:flex;
        align-items:center; justify-content:center;
        background:rgba(255,255,255,.18);
      }
      .kp-brand { font-weight:700; font-size:14px; letter-spacing:.3px; }
      .kp-sub { font-size:10px; opacity:.75; margin-top:1px; }
      #kprmt-close {
        background:rgba(255,255,255,.15); border:none; color:#fff;
        width:28px; height:28px; border-radius:50%; cursor:pointer;
        font-size:15px; display:flex; align-items:center; justify-content:center;
        padding:0; transition:background .15s;
      }
      #kprmt-close:hover { background:rgba(255,255,255,.3); }
      #kp-body {
        flex:1; overflow-y:auto; padding:12px;
        display:flex; flex-direction:column; gap:9px;
      }
      #kp-statusbar {
        display:flex; align-items:center; gap:8px;
        padding:8px 11px; background:#f8fafc;
        border:1px solid #e2e8f0; border-radius:8px;
        font-size:12px; color:#475569;
      }
      .kp-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; background:#94a3b8; }
      .kp-dot.ready { background:#22c55e; }
      .kp-dot.loading { background:#f59e0b; animation:kp-pulse 1s infinite; }
      .kp-dot.error { background:#ef4444; }
      @keyframes kp-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .kp-rate {
        margin-left:auto; font-size:11px; background:#e0e7ff;
        color:#3730a3; padding:2px 7px; border-radius:10px;
        font-weight:600; flex-shrink:0;
      }
      #kp-btn-extract {
        background:linear-gradient(135deg,#1a56db,#3b82f6); color:#fff;
        border:none; border-radius:10px; padding:12px; font-size:13px;
        font-weight:600; cursor:pointer; display:flex; align-items:center;
        justify-content:center; gap:8px; transition:opacity .2s,transform .1s;
        font-family:inherit; width:100%;
      }
      #kp-btn-extract:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); }
      #kp-btn-extract:disabled { opacity:.6; cursor:not-allowed; transform:none; }
      .kp-login-note {
        text-align:center; padding:18px 12px; color:#64748b;
        font-size:12px; line-height:1.7; background:#f8fafc;
        border:1px solid #e2e8f0; border-radius:8px;
      }
      .kp-login-note b { color:#1a56db; }
      .kp-card {
        background:#f8fafc; border:1px solid #e2e8f0;
        border-radius:10px; padding:12px;
        display:flex; align-items:center; gap:11px;
      }
      .kp-avatar {
        width:44px; height:44px; border-radius:10px;
        background:linear-gradient(135deg,#1a56db,#3b82f6);
        color:#fff; display:flex; align-items:center; justify-content:center;
        font-weight:700; font-size:16px; flex-shrink:0;
      }
      .kp-pname { font-weight:700; font-size:14px; color:#0f172a; line-height:1.3; }
      .kp-ptitle { font-size:12px; color:#475569; line-height:1.3; }
      .kp-ploc { font-size:11px; color:#94a3b8; margin-top:2px; }
      .kp-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .kp-item label {
        display:block; font-size:10px; font-weight:600; color:#94a3b8;
        text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px;
      }
      .kp-field {
        width:100%; padding:7px 9px; border:1px solid #e2e8f0;
        border-radius:6px; font-size:12px; font-family:inherit;
        color:#0f172a; background:#fff; box-sizing:border-box; outline:none;
      }
      .kp-field:focus { border-color:#3b82f6; }
      .kp-field::placeholder { color:#cbd5e1; font-style:italic; font-size:11px; }
      .kp-val { font-size:13px; font-weight:600; color:#0f172a; }
      .kp-sect { border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
      .kp-sect-hdr {
        display:flex; align-items:center; justify-content:space-between;
        padding:10px 12px; cursor:pointer; background:#fff;
        font-weight:600; font-size:13px; color:#0f172a; user-select:none;
      }
      .kp-sect-hdr:hover { background:#f8fafc; }
      .kp-badge {
        background:#dbeafe; color:#1d4ed8; font-size:11px;
        font-weight:700; padding:2px 8px; border-radius:10px;
      }
      .kp-sect-body {
        border-top:1px solid #f1f5f9; padding:10px;
        background:#fafbfc; display:none;
      }
      .kp-sect-body.kp-open { display:block; }
      .kp-tags { display:flex; flex-wrap:wrap; gap:5px; }
      .kp-tag {
        background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;
        padding:3px 8px; border-radius:12px; font-size:11px; font-weight:500;
        display:inline-flex; align-items:center; gap:3px;
      }
      .kp-tag-remove {
        background:none; border:none; cursor:pointer; color:#1d4ed8;
        font-size:13px; padding:0; line-height:1; opacity:.5; font-family:inherit;
      }
      .kp-tag-remove:hover { opacity:1; }
      .kp-exp { padding:8px 0; border-bottom:1px solid #f1f5f9; }
      .kp-exp:last-child { border-bottom:none; }
      .kp-exp-title { font-weight:600; font-size:12px; color:#0f172a; }
      .kp-exp-co { font-size:11px; color:#475569; margin-top:1px; }
      .kp-exp-dt { font-size:10px; color:#94a3b8; margin-top:2px; }
      #kp-btn-add {
        background:#16a34a; color:#fff; border:none; border-radius:10px;
        padding:13px; font-size:13px; font-weight:600; cursor:pointer;
        display:flex; align-items:center; justify-content:center; gap:8px;
        transition:opacity .2s; font-family:inherit; width:100%; margin-top:2px;
      }
      #kp-btn-add:hover:not(:disabled) { opacity:.9; }
      #kp-btn-add:disabled { opacity:.7; cursor:not-allowed; }
      .kp-success {
        display:flex; align-items:flex-start; gap:8px; padding:10px 12px;
        background:#f0fdf4; border:1px solid #bbf7d0;
        border-radius:8px; font-size:12px; font-weight:600; color:#16a34a;
      }
      .kp-success.kp-dup { background:#fffbeb; border-color:#fcd34d; color:#92400e; }
      .kp-err {
        padding:10px 12px; background:#fef2f2; border:1px solid #fecaca;
        border-radius:8px; font-size:12px; color:#dc2626;
      }
      .kp-spin {
        width:14px; height:14px; border:2px solid rgba(255,255,255,.4);
        border-top-color:#fff; border-radius:50%; flex-shrink:0;
        animation:kp-sp .7s linear infinite;
      }
      @keyframes kp-sp { to{transform:rotate(360deg)} }
    `;
    document.head.appendChild(styleEl);

    // ── Root HTML ────────────────────────────────────────────────────
    const logoUrl = chrome.runtime.getURL('icons/kprmt_company_new_logo.jpeg');
    const root = document.createElement('div');
    root.id = 'kprmt-root';
    root.innerHTML = `
      <div id="kprmt-fab" title="KPRMT Extractor">
        <img src="${logoUrl}" style="width:36px;height:36px;object-fit:contain;border-radius:6px;">
      </div>
      <div id="kprmt-panel">
        <div class="kp-hdr">
          <div class="kp-logo-row">
            <div class="kp-logo-box"><img src="${logoUrl}" style="width:100%;height:100%;object-fit:contain;"></div>
            <div><div class="kp-brand">KPRMT</div><div class="kp-sub">LinkedIn Extractor</div></div>
          </div>
          <button id="kprmt-close" title="Close">✕</button>
        </div>
        <div id="kp-body">
          <div id="kp-statusbar">
            <div class="kp-dot" id="kp-dot"></div>
            <span id="kp-status">Ready to extract</span>
            <span class="kp-rate" id="kp-rate">0/50</span>
          </div>
          <button id="kp-btn-extract">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
            </svg>
            Extract Profile
          </button>
          <div id="kp-login-note" class="kp-login-note" style="display:none">
            Please <b>login</b> via the KPRMT extension popup first, then come back here.
          </div>
          <div id="kp-preview" style="display:none;flex-direction:column;gap:9px;">
            <div class="kp-card">
              <div class="kp-avatar" id="kp-avatar">?</div>
              <div>
                <div class="kp-pname" id="kp-name">—</div>
                <div class="kp-ptitle" id="kp-title">—</div>
                <div class="kp-ploc" id="kp-loc"></div>
              </div>
            </div>
            <div class="kp-grid">
              <div class="kp-item"><label>Email</label>
                <input type="email" id="kp-email" class="kp-field" placeholder="Not found — enter manually"></div>
              <div class="kp-item"><label>Phone</label>
                <input type="tel" id="kp-phone" class="kp-field" placeholder="Not found — enter manually"></div>
              <div class="kp-item"><label>Company</label><input type="text" id="kp-company" class="kp-field" placeholder="Not found"></div>
              <div class="kp-item"><label>Experience</label><input type="text" id="kp-years" class="kp-field" placeholder="—"></div>
            </div>
            <div class="kp-sect">
              <div class="kp-sect-hdr" data-kp="kp-skills-body">
                <span>Skills</span><span class="kp-badge" id="kp-skills-n">0</span>
              </div>
              <div class="kp-sect-body" id="kp-skills-body"><div class="kp-tags" id="kp-skills-tags"></div></div>
            </div>
            <div class="kp-sect">
              <div class="kp-sect-hdr" data-kp="kp-exp-body">
                <span>Work Experience</span><span class="kp-badge" id="kp-exp-n">0</span>
              </div>
              <div class="kp-sect-body" id="kp-exp-body"><div id="kp-exp-items"></div></div>
            </div>
            <div class="kp-sect">
              <div class="kp-sect-hdr" data-kp="kp-edu-body">
                <span>Education</span><span class="kp-badge" id="kp-edu-n">0</span>
              </div>
              <div class="kp-sect-body" id="kp-edu-body"><div id="kp-edu-items"></div></div>
            </div>
            <button id="kp-btn-add">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Add to List
            </button>
          </div>
          <div id="kp-success" style="display:none"></div>
          <div id="kp-error" style="display:none"></div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    // ── Element refs ─────────────────────────────────────────────────
    const fab       = document.getElementById('kprmt-fab');
    const panel     = document.getElementById('kprmt-panel');
    const closeBtn  = document.getElementById('kprmt-close');
    const dot       = document.getElementById('kp-dot');
    const statusEl  = document.getElementById('kp-status');
    const rateEl    = document.getElementById('kp-rate');
    const extractBtn= document.getElementById('kp-btn-extract');
    const loginNote = document.getElementById('kp-login-note');
    const preview   = document.getElementById('kp-preview');
    const addBtn    = document.getElementById('kp-btn-add');
    const successEl = document.getElementById('kp-success');
    const errorEl   = document.getElementById('kp-error');
    let extractedData = null;

    // ── Helpers ──────────────────────────────────────────────────────
    function getStorage(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }

    function setStatus(type, text) {
      dot.className = 'kp-dot ' + type;
      statusEl.textContent = text;
    }

    function updateRate(count, date) {
      const n = (date !== new Date().toDateString()) ? 0 : (count || 0);
      rateEl.textContent = n + '/50';
      rateEl.style.background = n >= 40 ? '#fee2e2' : '#e0e7ff';
      rateEl.style.color      = n >= 40 ? '#b91c1c' : '#3730a3';
    }

    function esc(s) {
      if (!s) return '';
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    async function checkAuth() {
      const s = await getStorage(['jwt_token','api_url','daily_count','daily_date']);
      updateRate(s.daily_count, s.daily_date);
      if (!s.jwt_token || !s.api_url) {
        loginNote.style.display = 'block';
        extractBtn.disabled = true;
      } else {
        loginNote.style.display = 'none';
        extractBtn.disabled = false;
      }
      return s;
    }

    // ── Open / close ─────────────────────────────────────────────────
    fab.addEventListener('click', () => {
      panel.classList.add('kprmt-open');
      fab.classList.add('kprmt-hidden');
      checkAuth();
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.remove('kprmt-open');
      fab.classList.remove('kprmt-hidden');
    });

    // ── Collapsible section toggles ──────────────────────────────────
    document.querySelectorAll('[data-kp]').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const body = document.getElementById(hdr.dataset.kp);
        if (body) body.classList.toggle('kp-open');
      });
    });

    // ── Remove skill tag ─────────────────────────────────────────────
    document.getElementById('kp-skills-tags').addEventListener('click', (e) => {
      const btn = e.target.closest('.kp-tag-remove');
      if (!btn) return;
      const skill = btn.dataset.skill;
      btn.closest('.kp-tag').remove();
      if (extractedData && extractedData.skills) {
        extractedData.skills = extractedData.skills.filter(s => s !== skill);
        document.getElementById('kp-skills-n').textContent = extractedData.skills.length;
      }
    });

    // ── Extract button ────────────────────────────────────────────────
    extractBtn.addEventListener('click', async () => {
      const s = await checkAuth();
      if (!s.jwt_token) return;

      extractBtn.disabled = true;
      extractBtn.innerHTML = '<div class="kp-spin"></div> Extracting…';
      setStatus('loading', 'Extracting profile data…');
      successEl.style.display = 'none';
      errorEl.style.display   = 'none';
      addBtn.disabled = false;
      addBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="8.5" cy="7" r="4"/>
          <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
        </svg>
        Add to List`;

      try {
        await scrollToLoadAll();
        const data = await extractProfileData();
        extractedData = data;

        // Profile card
        const ini = ((data.first_name||'')[0]+(data.last_name||'')[0]).toUpperCase()||'?';
        document.getElementById('kp-avatar').textContent = ini;
        document.getElementById('kp-name').textContent   = data.full_name || '—';
        document.getElementById('kp-title').textContent  = data.job_title || data.headline || '—';
        document.getElementById('kp-loc').textContent    = data.location  || '';
        document.getElementById('kp-email').value  = data.email || '';
        document.getElementById('kp-phone').value  = data.phone || '';
        document.getElementById('kp-company').value = data.current_company || '';
        document.getElementById('kp-years').value   = data.years_of_experience
          ? data.years_of_experience + ' years' : '';

        // Skills
        document.getElementById('kp-skills-tags').innerHTML =
          (data.skills||[]).map(sk => `<span class="kp-tag">${esc(sk)}<button class="kp-tag-remove" data-skill="${esc(sk)}" title="Remove">×</button></span>`).join('');
        document.getElementById('kp-skills-n').textContent = (data.skills||[]).length;

        // Experience
        document.getElementById('kp-exp-items').innerHTML =
          (data.experience||[]).map(e => `
            <div class="kp-exp">
              <div class="kp-exp-title">${esc(e.title||'')}</div>
              ${e.company?`<div class="kp-exp-co">${esc(e.company)}</div>`:''}
              ${e.dates  ?`<div class="kp-exp-dt">${esc(e.dates)}</div>`  :''}
            </div>`).join('');
        document.getElementById('kp-exp-n').textContent = (data.experience||[]).length;

        // Education
        document.getElementById('kp-edu-items').innerHTML =
          (data.education||[]).map(e => `
            <div class="kp-exp">
              <div class="kp-exp-title">${esc(e.school||e.university||'')}</div>
              ${(e.degree||e.field)?`<div class="kp-exp-co">${esc([e.degree,e.field].filter(Boolean).join(' · '))}</div>`:''}
              ${e.dates?`<div class="kp-exp-dt">${esc(e.dates)}</div>`:''}
            </div>`).join('');
        document.getElementById('kp-edu-n').textContent = (data.education||[]).length;

        preview.style.display = 'flex';
        setStatus('ready', 'Profile extracted!');
        extractBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
          </svg>
          Re-extract`;
        extractBtn.disabled = false;

      } catch (err) {
        setStatus('error', 'Extraction failed');
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        extractBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
          </svg>
          Extract Profile`;
        extractBtn.disabled = false;
      }
    });

    // ── Add to List button ────────────────────────────────────────────
    addBtn.addEventListener('click', async () => {
      if (!extractedData) return;
      const s = await getStorage(['jwt_token','api_url','daily_count','daily_date']);
      const today = new Date().toDateString();
      let count = (s.daily_date !== today) ? 0 : (s.daily_count || 0);

      if (count >= 50) {
        errorEl.textContent = 'Daily limit reached (50/50). Try again tomorrow.';
        errorEl.style.display = 'block';
        return;
      }

      addBtn.disabled = true;
      addBtn.innerHTML = '<div class="kp-spin"></div> Adding…';
      successEl.style.display = 'none';
      errorEl.style.display   = 'none';

      try {
        const email   = document.getElementById('kp-email').value.trim();
        const phone   = document.getElementById('kp-phone').value.trim();
        const company = document.getElementById('kp-company').value.trim();
        const yearsRaw = parseFloat(document.getElementById('kp-years').value) || extractedData.years_of_experience || 0;

        const resp = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'apiRequest',
            url: `${s.api_url}/api/linkedin/parse`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${s.jwt_token}`,
            },
            body: JSON.stringify({
              first_name: extractedData.first_name,
              last_name:  extractedData.last_name,
              email:  email || null,
              phone:  phone || null,
              job_title:       extractedData.job_title,
              headline:        extractedData.headline,
              current_company: company || extractedData.current_company,
              location:        extractedData.location,
              linkedin_url:    extractedData.linkedin_url,
              skills:     extractedData.skills    || [],
              experience: extractedData.experience|| [],
              education:  extractedData.education || [],
              years_of_experience: yearsRaw,
              about: extractedData.about || '',
            }),
          }, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });

        if (!resp || resp.error) {
          throw new Error(resp?.error || 'Failed to fetch');
        }
        if (resp.status === 401) {
          errorEl.textContent = 'Session expired — please logout and login again via the popup.';
          errorEl.style.display = 'block';
          addBtn.disabled = false;
          addBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Add to List`;
          return;
        }
        if (!resp.ok) {
          throw new Error(resp.data?.detail || `Failed (${resp.status})`);
        }

        const result = resp.data;
        const isDup = result.action === 'updated';

        if (!isDup) {
          count++;
          chrome.storage.local.set({ daily_count: count, daily_date: today });
          updateRate(count, today);
        }

        successEl.className = isDup ? 'kp-success kp-dup' : 'kp-success';
        successEl.textContent = isDup
          ? `⚠ Already in database — profile refreshed (ID: ${result.candidate_id})`
          : `✓ Added to People Search! (ID: ${result.candidate_id})`;
        successEl.style.display = 'block';
        setStatus('ready', isDup ? 'Duplicate — profile updated' : 'Candidate added!');

        addBtn.disabled = true;
        addBtn.innerHTML = isDup
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Already Exists`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Added!`;

        chrome.runtime.sendMessage({ action:'logExtraction', data:{
          name: extractedData.full_name,
          linkedin_url: extractedData.linkedin_url,
          candidate_id: result.candidate_id,
          timestamp: new Date().toISOString(),
        }});

      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        addBtn.disabled = false;
        addBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Add to List`;
      }
    });
  }

  // Wait for page to fully load, then inject panel
  if (document.readyState === 'complete') {
    setTimeout(injectSidePanel, 1200);
  } else {
    window.addEventListener('load', () => setTimeout(injectSidePanel, 1200));
  }
})();
