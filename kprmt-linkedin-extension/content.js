// KPRMT LinkedIn Profile Extractor - Content Script
// Extracts candidate data from LinkedIn profile pages via DOM parsing

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__kprmt_injected) return;
  window.__kprmt_injected = true;

  // ─── Helper: safe text extraction ───────────────────────────────────
  function getText(selector, context) {
    const el = (context || document).querySelector(selector);
    return el ? el.textContent.trim() : "";
  }

  function getAll(selector, context) {
    return Array.from((context || document).querySelectorAll(selector));
  }

  // ─── NAME extraction ───────────────────────────────────────────────
  function extractName() {
    // Primary: LinkedIn's profile name heading
    const selectors = [
      "h1.text-heading-xlarge",
      "h1.inline.t-24",
      ".pv-top-card--list h1",
      '[data-anonymize="person-name"]',
      ".ph5 h1",
      "h1",
    ];
    for (const sel of selectors) {
      const name = getText(sel);
      if (name && name.length > 1 && name.length < 80) {
        const parts = name.split(/\s+/);
        if (parts.length >= 2) {
          return {
            first_name: parts[0],
            last_name: parts.slice(1).join(" "),
            full_name: name,
          };
        }
        return { first_name: name, last_name: "", full_name: name };
      }
    }
    return { first_name: "", last_name: "", full_name: "" };
  }

  // ─── HEADLINE / JOB TITLE extraction ───────────────────────────────
  function extractHeadline() {
    const selectors = [
      ".text-body-medium.break-words",
      ".pv-top-card--list .text-body-medium",
      '[data-anonymize="headline"]',
      ".ph5 .text-body-medium",
      ".top-card-layout__headline",
    ];
    for (const sel of selectors) {
      const headline = getText(sel);
      if (headline && headline.length > 2) return headline;
    }
    return "";
  }

  // ─── LOCATION extraction ───────────────────────────────────────────
  function extractLocation() {
    const selectors = [
      ".text-body-small.inline.t-black--light.break-words",
      ".pv-top-card--list-bullet .text-body-small",
      '[data-anonymize="location"]',
      ".ph5 .text-body-small",
      ".top-card-layout__first-subline .top-card__subline-item",
    ];
    for (const sel of selectors) {
      const loc = getText(sel);
      if (loc && loc.length > 2 && !loc.includes("connection") && !loc.includes("follower")) {
        return loc;
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
    // Method 1: anchor element with id
    const anchor = document.querySelector("#" + id);
    if (anchor) {
      const section = anchor.closest("section");
      if (section) return section;
    }
    // Method 2: search section headings by text
    const headings = document.querySelectorAll("section h2, section h3, section [class*='pvs-header'] span");
    for (const h of headings) {
      const txt = h.textContent.trim().toLowerCase();
      if (txt === headingText.toLowerCase() || txt.includes(headingText.toLowerCase())) {
        const section = h.closest("section");
        if (section) return section;
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

  // ─── EXPERIENCE extraction ─────────────────────────────────────────
  async function extractExperience() {
    // Step 1: try background tab on the /details/experience/ page
    // (gets full hydrated DOM — all positions, correct descriptions vs locations)
    const showAllLink = Array.from(document.querySelectorAll("a[href*='/details/experience']")).find(el => {
      return el.textContent.trim().length < 80;
    });

    if (showAllLink && showAllLink.href) {
      try {
        const result = await chrome.runtime.sendMessage({
          action: "extractExperienceViaTab",
          url: showAllLink.href,
        });
        if (result && Array.isArray(result.experiences) && result.experiences.length > 0) {
          return result.experiences;
        }
      } catch (_) {
        // background not responding — fall through
      }
    }

    // Step 2: fall back to on-page parsing with smart field detection
    const section = findSection("experience", "Experience");
    if (!section) return [];

    const items = getSectionItems(section);
    const experiences = [];
    const titleSeen = new Set();

    items.forEach((item) => {
      const subItems = item.querySelectorAll("ul.pvs-list > li");

      if (subItems.length > 0) {
        // Multi-position under one company
        const companyEl = item.querySelector("span.t-bold span[aria-hidden='true']");
        const company = companyEl ? companyEl.textContent.trim() : "";

        subItems.forEach((sub) => {
          const exp = parseExpItem(sub);
          if (exp && exp.title && !titleSeen.has(exp.title)) {
            titleSeen.add(exp.title);
            if (!exp.company) exp.company = company;
            experiences.push(exp);
          }
        });
      } else {
        const exp = parseExpItem(item);
        if (exp && exp.title && !titleSeen.has(exp.title)) {
          titleSeen.add(exp.title);
          experiences.push(exp);
        }
      }
    });

    return experiences;
  }

  // ─── EDUCATION extraction ──────────────────────────────────────────
  function extractEducation() {
    const educations = [];
    const section = findSection("education", "Education");
    if (!section) return educations;

    const items = getSectionItems(section);

    items.forEach((item) => {
      const visuals = getVisualTexts(item);
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

    return educations;
  }

  // ─── SKILLS: collect from any container ────────────────────────────
  function collectSkillsFromContainer(container) {
    const skills = [];
    if (!container) return skills;
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
      if (t && t.length > 1 && t.length < 80 && !/^\d+$/.test(t)
          && !t.toLowerCase().includes("endorsement")
          && !looksLikePersonName(t)
          && !seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase());
        skills.push(t);
      }
    }

    // Strategy 1: Clone-and-strip — physically remove endorser sub-sections
    const items = getSectionItems({ querySelectorAll: (s) => container.querySelectorAll(s) });
    items.forEach(item => {
      if (item.closest('.pvs-entity__sub-components')) return;
      const clone = item.cloneNode(true);
      clone.querySelectorAll('.pvs-entity__sub-components, .pvs-list__outer-container ul ul, [class*="sub-components"]').forEach(el => el.remove());
      const span = clone.querySelector("span[aria-hidden='true']");
      if (span) addSkill(span.textContent);
    });
    if (skills.length > 0) return skills;

    // Strategy 2: hoverable-link-text spans outside sub-components
    container.querySelectorAll(".hoverable-link-text span[aria-hidden='true']").forEach(el => {
      if (!el.closest('.pvs-entity__sub-components')) addSkill(el.textContent);
    });

    return skills;
  }

  // ─── SKILLS extraction ─────────────────────────────────────────────
  async function extractSkills() {
    // Step 1: find "Show all X skills" link and delegate to background service worker
    // (opening a real tab gets the fully React-hydrated DOM, unlike fetch() which
    //  returns SSR HTML where class names like t-bold haven't been applied yet)
    const showAllLink = Array.from(document.querySelectorAll("a[href*='/details/skills']")).find(el => {
      const txt = el.textContent.trim().toLowerCase();
      return txt.length < 80;
    });

    if (showAllLink && showAllLink.href) {
      try {
        const result = await chrome.runtime.sendMessage({
          action: "extractSkillsViaTab",
          url: showAllLink.href,
        });
        if (result && Array.isArray(result.skills) && result.skills.length > 0) {
          return result.skills;
        }
      } catch (_) {
        // background not responding — fall through
      }
    }

    // Step 2: fall back to the skills section visible on the current profile page
    const section = findSection("skills", "Skills");
    if (section) {
      const skills = collectSkillsFromContainer(section);
      if (skills.length > 0) return skills;
    }

    // Step 3: broader scan — any section whose heading contains "skill"
    for (const sec of document.querySelectorAll("section")) {
      for (const h of sec.querySelectorAll("h2, h3, [class*='pvs-header'] span")) {
        if (h.textContent.trim().toLowerCase().includes("skill")) {
          const skills = collectSkillsFromContainer(sec);
          if (skills.length > 0) return skills;
        }
      }
    }

    return [];
  }

  // ─── CONTACT INFO extraction ───────────────────────────────────────
  async function extractContactInfo() {
    const contact = { email: "", phone: "", linkedin_url: "" };

    // Clean LinkedIn URL from current page
    const cleanUrl = window.location.href.split("?")[0].replace(/\/$/, "");
    contact.linkedin_url = cleanUrl;

    // Build contact overlay URL directly from profile URL
    // Format: https://www.linkedin.com/in/username/overlay/contact-info/
    const contactOverlayUrl = cleanUrl + "/overlay/contact-info/";

    // Also try finding a link/button on the page
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
      const m = document.body.innerText.match(/(?:\+?\d[\d\s().\-]{6,20}\d)/);
      if (m) contact.phone = m[0].trim();
    }

    return contact;
  }

  // ─── CALCULATE YEARS OF EXPERIENCE ─────────────────────────────────
  function calculateExperienceYears(experiences) {
    if (!experiences.length) return 0;

    let earliestStart = null;
    const now = new Date();

    for (const exp of experiences) {
      const dates = exp.dates || "";
      // Match patterns like "Jan 2020", "2020", "January 2020"
      const startMatch = dates.match(
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})|^(\d{4})/i
      );
      if (startMatch) {
        const year = parseInt(startMatch[1] || startMatch[2], 10);
        const startDate = new Date(year, 0, 1);
        if (!earliestStart || startDate < earliestStart) {
          earliestStart = startDate;
        }
      }
    }

    if (earliestStart) {
      const years = (now - earliestStart) / (1000 * 60 * 60 * 24 * 365.25);
      return Math.round(years * 10) / 10;
    }
    return 0;
  }

  // ─── MAIN: Extract all profile data ────────────────────────────────
  async function extractProfileData() {
    const name = extractName();
    const headline = extractHeadline();
    const location = extractLocation();
    const about = extractAbout();
    const experience = await extractExperience();  // async: may open background tab
    const education = extractEducation();
    const skills = await extractSkills();   // async: may open background tab
    const contact = await extractContactInfo();  // async: may open contact overlay tab
    const yearsOfExperience = calculateExperienceYears(experience);

    // Current company from most recent experience
    let currentCompany = "";
    if (experience.length > 0) {
      const current = experience.find(
        (e) => e.dates && e.dates.toLowerCase().includes("present")
      );
      currentCompany = current ? current.company : experience[0].company;
    }

    return {
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
    };
  }

  // ─── Auto-scroll to load lazy sections ──────────────────────────────
  async function scrollToLoadAll() {
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const totalHeight = document.body.scrollHeight;
    let pos = 0;
    while (pos < totalHeight) {
      pos += 600;
      window.scrollTo({ top: pos, behavior: "instant" });
      await delay(250);
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    await delay(400);
    window.scrollTo({ top: 0, behavior: "instant" });
    await delay(200);
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

  // ─── Inject floating KPRMT badge on LinkedIn profile pages ────────
  function injectBadge() {
    if (document.querySelector("#kprmt-badge")) return;

    const badge = document.createElement("div");
    badge.id = "kprmt-badge";
    badge.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 80px;
        z-index: 9999;
        background: linear-gradient(135deg, #1a56db, #3b82f6);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(26,86,219,0.4);
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: transform 0.2s, box-shadow 0.2s;
      " 
      onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(26,86,219,0.5)'"
      onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(26,86,219,0.4)'"
      title="Click extension icon to extract profile">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        KPRMT Ready
      </div>
    `;
    document.body.appendChild(badge);
  }

  // Wait for page to fully load, then inject badge
  if (document.readyState === "complete") {
    setTimeout(injectBadge, 1500);
  } else {
    window.addEventListener("load", () => setTimeout(injectBadge, 1500));
  }
})();
