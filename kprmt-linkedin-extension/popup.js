// KPRMT LinkedIn Extension - Popup Logic
// Handles login, extraction trigger, data preview, and API submission

(function () {
  "use strict";

  // ─── DOM References ────────────────────────────────────────────────
  const loginScreen = document.getElementById("login-screen");
  const mainScreen = document.getElementById("main-screen");
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");
  const btnExtract = document.getElementById("btn-extract");
  const btnAddToList = document.getElementById("btn-add-to-list");
  const loginError = document.getElementById("login-error");
  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");
  const previewSection = document.getElementById("preview-section");
  const successMsg = document.getElementById("success-msg");
  const successMsgText = document.getElementById("success-text");
  const errorMsg = document.getElementById("error-msg");
  const rateLimit = document.getElementById("rate-limit");

  let extractedData = null;

  // ─── INIT: Check if already logged in ──────────────────────────────
  chrome.storage.local.get(["jwt_token", "api_url", "daily_count", "daily_date"], (result) => {
    // Auto-migrate: if old production URL stored (no /dev), update it silently
    if (result.api_url === "https://kprmtglobalsolutions.duckdns.org") {
      result.api_url = "https://kprmtglobalsolutions.duckdns.org/dev";
      chrome.storage.local.set({ api_url: result.api_url });
    }
    if (result.jwt_token && result.api_url) {
      showMainScreen();
      updateRateLimit(result.daily_count || 0, result.daily_date);
    } else {
      showLoginScreen();
    }
  });

  // ─── Screen Management ─────────────────────────────────────────────
  function showLoginScreen() {
    loginScreen.classList.remove("hidden");
    mainScreen.classList.add("hidden");
  }

  function showMainScreen() {
    loginScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");
    checkLinkedInPage();
  }

  // ─── LOGIN ─────────────────────────────────────────────────────────
  btnLogin.addEventListener("click", async () => {
    const apiUrl = document.getElementById("api-url").value.trim().replace(/\/+$/, "");
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!apiUrl || !username || !password) {
      showError(loginError, "Please fill all fields");
      return;
    }

    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner"></span> Logging in...';
    hideError(loginError);

    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Login failed (${response.status})`);
      }

      const data = await response.json();

      // Store credentials
      chrome.storage.local.set({
        jwt_token: data.access_token,
        api_url: apiUrl,
        username: username,
        daily_count: 0,
        daily_date: new Date().toDateString(),
      });

      showMainScreen();
    } catch (err) {
      showError(loginError, err.message);
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = "Login";
    }
  });

  // ─── SETTINGS (change API URL without logout) ─────────────────────
  const btnSettings = document.getElementById("btn-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const settingsUrlInput = document.getElementById("settings-api-url");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const settingsMsg = document.getElementById("settings-msg");

  btnSettings.addEventListener("click", () => {
    const isHidden = settingsPanel.classList.toggle("hidden");
    if (!isHidden) {
      chrome.storage.local.get(["api_url"], (r) => {
        settingsUrlInput.value = r.api_url || "https://kprmtglobalsolutions.duckdns.org/dev";
      });
    }
  });

  btnSaveSettings.addEventListener("click", () => {
    const newUrl = settingsUrlInput.value.trim().replace(/\/+$/, "");
    if (!newUrl) return;
    chrome.storage.local.set({ api_url: newUrl }, () => {
      settingsMsg.style.display = "block";
      setTimeout(() => { settingsMsg.style.display = "none"; settingsPanel.classList.add("hidden"); }, 1500);
    });
  });

  // ─── LOGOUT ────────────────────────────────────────────────────────
  btnLogout.addEventListener("click", () => {
    chrome.storage.local.remove(["jwt_token", "api_url", "username"]);
    extractedData = null;
    showLoginScreen();
  });

  // ─── CHECK IF ON LINKEDIN PROFILE ──────────────────────────────────
  function checkLinkedInPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.includes("linkedin.com/in/")) {
        setStatus("ready", "LinkedIn profile detected - click Extract");
        btnExtract.disabled = false;
      } else {
        setStatus("error", "Navigate to a LinkedIn profile page");
        btnExtract.disabled = true;
      }
    });
  }

  // ─── EXTRACT PROFILE ──────────────────────────────────────────────
  btnExtract.addEventListener("click", async () => {
    btnExtract.disabled = true;
    btnExtract.innerHTML = '<span class="spinner"></span> Extracting...';
    setStatus("loading", "Extracting profile data...");
    hideAll();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url.includes("linkedin.com/in/")) {
        throw new Error("Not on a LinkedIn profile page");
      }

      // Send message to content script (auto-inject if not loaded)
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { action: "extractProfile" });
      } catch (connErr) {
        if (connErr.message && (connErr.message.includes("Receiving end") || connErr.message.includes("Cannot access"))) {
          // Content script not loaded — inject it and retry
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
          // Also inject CSS
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["content.css"],
          });
          // Wait a moment for script to initialize
          await new Promise(r => setTimeout(r, 500));
          response = await chrome.tabs.sendMessage(tab.id, { action: "extractProfile" });
        } else {
          throw connErr;
        }
      }

      if (!response || !response.success) {
        throw new Error(response?.error || "Extraction failed - try refreshing the page");
      }

      extractedData = response.data;
      displayPreview(extractedData);
      setStatus("ready", "Profile extracted successfully!");
    } catch (err) {
      if (err.message.includes("Cannot access") || err.message.includes("Receiving end")) {
        setStatus("error", "Please refresh the LinkedIn page and try again");
      } else {
        setStatus("error", err.message);
      }
      showError(errorMsg, err.message);
    } finally {
      btnExtract.disabled = false;
      btnExtract.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="8 17 12 21 16 17"/>
          <line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
        </svg>
        Extract Profile`;
    }
  });

  // ─── DISPLAY PREVIEW ──────────────────────────────────────────────
  function displayPreview(data) {
    previewSection.classList.remove("hidden");

    // Avatar initials
    const initials = (data.first_name?.[0] || "") + (data.last_name?.[0] || "");
    document.getElementById("avatar").textContent = initials.toUpperCase() || "??";

    // Basic info
    document.getElementById("preview-name").textContent = data.full_name || "--";
    document.getElementById("preview-title").textContent = data.headline || data.job_title || "--";
    document.getElementById("preview-location").textContent = data.location || "--";

    // Editable fields (email/phone often missing)
    document.getElementById("edit-email").value = data.email || "";
    document.getElementById("edit-phone").value = data.phone || "";

    // Company & experience
    document.getElementById("preview-company").textContent = data.current_company || "--";
    document.getElementById("preview-experience").textContent =
      data.years_of_experience ? `${data.years_of_experience} years` : "--";

    // Skills
    const skillsTags = document.getElementById("skills-tags");
    skillsTags.innerHTML = "";
    (data.skills || []).forEach((skill) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = skill;
      skillsTags.appendChild(tag);
    });
    document.getElementById("skills-count").textContent = (data.skills || []).length;

    // Experience
    const expItems = document.getElementById("exp-items");
    expItems.innerHTML = "";
    (data.experience || []).forEach((exp) => {
      const div = document.createElement("div");
      div.className = "exp-item";
      div.innerHTML = `
        <div class="exp-title">${escapeHtml(exp.title)}</div>
        <div class="exp-company">${escapeHtml(exp.company)}</div>
        <div class="exp-dates">${escapeHtml(exp.dates)}</div>
      `;
      expItems.appendChild(div);
    });
    document.getElementById("exp-count").textContent = (data.experience || []).length;

    // Education
    const eduItems = document.getElementById("edu-items");
    eduItems.innerHTML = "";
    (data.education || []).forEach((edu) => {
      const div = document.createElement("div");
      div.className = "edu-item";
      div.innerHTML = `
        <div class="edu-school">${escapeHtml(edu.school)}</div>
        <div class="edu-degree">${escapeHtml(edu.degree)}${edu.field ? " - " + escapeHtml(edu.field) : ""}</div>
        <div class="edu-dates">${escapeHtml(edu.dates)}</div>
      `;
      eduItems.appendChild(div);
    });
    document.getElementById("edu-count").textContent = (data.education || []).length;
  }

  // ─── COLLAPSIBLE TOGGLE ────────────────────────────────────────────
  document.querySelectorAll(".collapsible-header").forEach((header) => {
    header.addEventListener("click", () => {
      const targetId = header.getAttribute("data-target");
      const target = document.getElementById(targetId);
      target.classList.toggle("hidden");
    });
  });

  // ─── ADD TO LIST (Submit to API) ───────────────────────────────────
  btnAddToList.addEventListener("click", async () => {
    if (!extractedData) return;

    // Check rate limit
    const storage = await getStorage(["jwt_token", "api_url", "daily_count", "daily_date"]);
    const today = new Date().toDateString();
    let dailyCount = storage.daily_count || 0;

    // Reset count if new day
    if (storage.daily_date !== today) {
      dailyCount = 0;
    }

    if (dailyCount >= 50) {
      showError(errorMsg, "Daily limit reached (50/50). Try again tomorrow.");
      return;
    }

    btnAddToList.disabled = true;
    btnAddToList.innerHTML = '<span class="spinner"></span> Adding...';
    hideAll();

    try {
      // Allow HR to manually add email/phone
      const email = document.getElementById("edit-email").value.trim();
      const phone = document.getElementById("edit-phone").value.trim();

      const payload = {
        first_name: extractedData.first_name,
        last_name: extractedData.last_name,
        email: email || null,
        phone: phone || null,
        job_title: extractedData.job_title,
        headline: extractedData.headline,
        current_company: extractedData.current_company,
        location: extractedData.location,
        linkedin_url: extractedData.linkedin_url,
        skills: extractedData.skills || [],
        experience: extractedData.experience || [],
        education: extractedData.education || [],
        years_of_experience: extractedData.years_of_experience || 0,
        about: extractedData.about || "",
      };

      const response = await fetch(`${storage.api_url}/api/linkedin/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storage.jwt_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        showError(errorMsg, "Session expired. Please logout and login again.");
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to add (${response.status})`);
      }

      const result = await response.json();
      const isDuplicate = result.action === 'updated';

      // Only count new candidates toward the daily rate limit
      if (!isDuplicate) {
        dailyCount++;
        chrome.storage.local.set({ daily_count: dailyCount, daily_date: today });
        updateRateLimit(dailyCount);
      }

      // Show contextual feedback: green for new adds, amber for profile refreshes
      if (isDuplicate) {
        successMsg.style.background = '#fffbeb';
        successMsg.style.borderColor = '#fcd34d';
        successMsg.style.color = '#92400e';
        successMsgText.textContent = `Already in database — profile refreshed (ID: ${result.candidate_id})`;
        setStatus("ready", "Duplicate — existing profile updated");
      } else {
        successMsg.style.cssText = ''; // reset to default green
        successMsgText.textContent = `Added to People Search! (ID: ${result.candidate_id})`;
        setStatus("ready", "Candidate added successfully!");
      }
      successMsg.classList.remove("hidden");

      // Disable add button to prevent repeat submissions
      btnAddToList.disabled = true;
      btnAddToList.innerHTML = isDuplicate ? `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Already Exists` : `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Added!`;

      // Log to background for history
      chrome.runtime.sendMessage({
        action: "logExtraction",
        data: {
          name: extractedData.full_name,
          linkedin_url: extractedData.linkedin_url,
          candidate_id: result.candidate_id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      showError(errorMsg, err.message);
    } finally {
      if (btnAddToList.textContent.includes("Adding")) {
        btnAddToList.disabled = false;
        btnAddToList.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Add to List`;
      }
    }
  });

  // ─── HELPERS ───────────────────────────────────────────────────────
  function setStatus(type, text) {
    statusIcon.className = "status-icon " + type;
    statusText.textContent = text;
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideError(el) {
    el.classList.add("hidden");
  }

  function hideAll() {
    successMsg.classList.add("hidden");
    successMsg.style.cssText = ''; // reset any duplicate-warning inline style
    errorMsg.classList.add("hidden");
  }

  function updateRateLimit(count, date) {
    const today = new Date().toDateString();
    if (date && date !== today) count = 0;
    rateLimit.textContent = `${count}/50`;
    if (count >= 40) rateLimit.style.background = "#fef2f2";
    if (count >= 40) rateLimit.style.color = "#dc2626";
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function getStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }
})();
