// Listens for candidateSelected events and attempts to click the matching name
(function registerCandidateBridge() {
  const EVENT = 'candidateSelected';

  function findAndClick(name, id) {
    if (!name && !id) return false;

    // Try to find by exact full name first
    const buttons = Array.from(document.querySelectorAll('button'));

    // Normalize
    const normalize = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const targetName = normalize(name || '');

    for (const btn of buttons) {
      const text = normalize(btn.textContent || '');
      if (!text) continue;

      // Exact match
      if (targetName && text === targetName) {
        btn.click();
        return true;
      }
    }

    // If not found, try partial match (startsWith)
    if (targetName) {
      for (const btn of buttons) {
        const text = normalize(btn.textContent || '');
        if (!text) continue;
        if (text.toLowerCase().startsWith(targetName.toLowerCase())) {
          btn.click();
          return true;
        }
      }
    }

    // As a last resort, if an id is provided, try to find a row with matching candidate id in DOM
    if (id != null) {
      // Look for elements that include Candidate #<id> text
      const idText = `Candidate #${id}`;
      for (const btn of buttons) {
        if ((btn.textContent || '').includes(idText)) {
          btn.click();
          return true;
        }
      }
    }

    return false;
  }

  function handler(e) {
    const { id, name } = e.detail || {};
    // Attempt click; if not found, try to focus SearchPeople input (best-effort)
    const clicked = findAndClick(name, id);
    if (!clicked) {
      console.warn('Candidate bridge: could not find matching candidate element in DOM for', name, id);
    }
  }

  window.addEventListener(EVENT, handler);
})();
