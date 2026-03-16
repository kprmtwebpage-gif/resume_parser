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

  // ─── EXPERIENCE extraction ─────────────────────────────────────────
  function extractExperience() {
    const experiences = [];
    const section = findSection("experience", "Experience");
    if (!section) return experiences;

    const items = getSectionItems(section);

    items.forEach((item) => {
      // Check if multi-position (company with sub-roles)
      const subList = item.querySelector("ul.pvs-list li");

      if (subList && item.querySelectorAll("ul.pvs-list li").length > 0) {
        // Multi-position under one company
        const companyEl = item.querySelector(
          "span.t-bold span[aria-hidden='true']"
        ) || item.querySelector("span.t-bold");
        const company = companyEl ? companyEl.textContent.trim() : "";

        const subItems = item.querySelectorAll("ul.pvs-list li");
        subItems.forEach((sub) => {
          const visuals = getVisualTexts(sub);
          const title = visuals[0] || "";
          const dates = visuals[1] || "";
          const location = visuals[2] || "";

          if (title) {
            experiences.push({ title, company, dates, location });
          }
        });
      } else {
        // Single position
        const visuals = getVisualTexts(item);

        // Usually: [title, company · type, dates · duration, location]
        const title = visuals[0] || "";
        const companyRaw = visuals[1] || "";
        const company = companyRaw.split("·")[0].trim();
        const dates = visuals[2] || "";
        const location = visuals[3] || "";

        if (title) {
          experiences.push({ title, company, dates, location });
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

  // ─── SKILLS extraction ─────────────────────────────────────────────
  function extractSkills() {
    const skills = [];
    const section = findSection("skills", "Skills");
    if (!section) return skills;

    const items = getSectionItems(section);
    items.forEach((item) => {
      // Try bold span first
      const nameEl = item.querySelector(
        "span.t-bold span[aria-hidden='true']"
      );
      if (nameEl) {
        const skill = nameEl.textContent.trim();
        if (skill && !skills.includes(skill)) {
          skills.push(skill);
        }
        return;
      }
      // Fallback: first aria-hidden span
      const visuals = getVisualTexts(item);
      if (visuals[0] && !skills.includes(visuals[0])) {
        skills.push(visuals[0]);
      }
    });

    return skills;
  }

  // ─── CONTACT INFO extraction ───────────────────────────────────────
  function extractContactInfo() {
    // Contact info is in a modal, may not be visible
    // Try to extract email/phone if visible on page
    const contact = { email: "", phone: "", linkedin_url: "" };

    // LinkedIn URL from current page
    contact.linkedin_url = window.location.href.split("?")[0];

    // Try email patterns visible on page
    const pageText = document.body.innerText;
    const emailMatch = pageText.match(
      /[\w.+-]+@[\w-]+\.[\w.-]+/
    );
    if (emailMatch) {
      contact.email = emailMatch[0];
    }

    // Try phone patterns visible on page
    const phoneMatch = pageText.match(
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    );
    if (phoneMatch) {
      contact.phone = phoneMatch[0];
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
  function extractProfileData() {
    const name = extractName();
    const headline = extractHeadline();
    const location = extractLocation();
    const about = extractAbout();
    const experience = extractExperience();
    const education = extractEducation();
    const skills = extractSkills();
    const contact = extractContactInfo();
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
    const scrollStep = 600;
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const totalHeight = document.body.scrollHeight;
    let pos = 0;

    // Scroll down incrementally
    while (pos < totalHeight) {
      pos += scrollStep;
      window.scrollTo({ top: pos, behavior: "instant" });
      await delay(300);
    }
    // Scroll a bit past bottom to trigger any remaining lazy loads
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    await delay(500);
    // Scroll back to top
    window.scrollTo({ top: 0, behavior: "instant" });
    await delay(200);
  }

  // ─── Listen for messages from popup ────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractProfile") {
      // Scroll page first to load lazy sections, then extract
      scrollToLoadAll().then(() => {
        try {
          const data = extractProfileData();
          sendResponse({ success: true, data: data });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    }
    return true; // Keep message channel open for async response
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
