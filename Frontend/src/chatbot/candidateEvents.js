/**
 * Candidate selection event dispatcher
 * Allows chatbot to notify other components when a candidate is selected
 * without requiring direct component modifications
 */

const CANDIDATE_SELECT_EVENT = 'candidateSelected';

export function selectCandidate(candidateId, candidateName) {
  const event = new CustomEvent(CANDIDATE_SELECT_EVENT, {
    detail: { id: candidateId, name: candidateName },
    bubbles: true,
  });
  window.dispatchEvent(event);
}

export function onCandidateSelected(callback) {
  window.addEventListener(CANDIDATE_SELECT_EVENT, callback);
  return () => window.removeEventListener(CANDIDATE_SELECT_EVENT, callback);
}
