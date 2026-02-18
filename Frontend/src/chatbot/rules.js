/**
 * Rule-based chatbot logic - NO AI/LLM
 * Parses user queries and generates suggestions
 */

const SKILL_KEYWORDS = [
  'java', 'python', 'javascript', 'typescript', 'react', 'angular', 'vue',
  'node', 'nodejs', 'express', 'django', 'flask', 'fastapi',
  'sql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
  'aws', 'azure', 'docker', 'kubernetes', 'jenkins', 'git',
  'api', 'rest', 'graphql', 'microservice', 'agile', 'scrum',
  'data', 'machine learning', 'ml', 'ai', 'nlp', 'tensorflow', 'pytorch',
  'devops', 'ci/cd', 'linux', 'windows', 'golang', 'rust', 'csharp',
  '.net', 'scala', 'kotlin', 'php', 'ruby', 'swift', 'kotlin',
  'html', 'css', 'bootstrap', 'tailwind', 'sass', 'less',
  'fullstack', 'full stack', 'full-stack', 'backend', 'frontend', 'frontend',
  'database', 'design', 'ui', 'ux', 'mobile', 'web', 'cloud',
  'hadoop', 'spark', 'kafka', 'rabbitmq', 'bitcoin', 'blockchain',
  'security', 'cybersecurity', 'testing', 'qa', 'devops',
];

const JOB_TITLE_KEYWORDS = [
  'engineer', 'developer', 'architect', 'lead', 'senior', 'junior',
  'manager', 'analyst', 'consultant', 'specialist', 'expert',
  'fullstack', 'frontend', 'backend', 'devops', 'data', 'machine learning',
  'qa', 'testing', 'automation', 'security', 'cloud', 'infrastructure',
];

/**
 * Extract search terms from query
 */
export function extractSearchTerms(query) {
  const lower = query.toLowerCase().trim();
  const terms = [];

  // Extract skill keywords
  SKILL_KEYWORDS.forEach((skill) => {
    if (lower.includes(skill)) {
      terms.push(skill);
    }
  });

  // Extract job title keywords
  JOB_TITLE_KEYWORDS.forEach((title) => {
    if (lower.includes(title)) {
      terms.push(title);
    }
  });

  // Remove duplicates
  return [...new Set(terms)];
}

/**
 * Generate suggestion phrases based on extracted terms
 */
export function generateSuggestions(terms) {

  if (!terms || terms.length === 0) {
    return [
      'Java Developer',
      'Full Stack Developer',
      'Data Engineer',
      'DevOps Engineer',
      'Frontend Engineer',
    ];
  }

  const suggestions = [];

  // Combine terms with common job titles
  const commonTitles = ['Developer', 'Engineer', 'Architect', 'Lead', 'Senior'];

  terms.forEach((term) => {
    // Special-case Java for richer suggestions
    if (term.toLowerCase() === 'java') {
      const javaSug = ['Java Developer', 'Senior Java Developer', 'Full Stack Developer'];
      javaSug.forEach((s) => { if (!suggestions.includes(s)) suggestions.push(s); });
      return;
    }

    commonTitles.forEach((title) => {
      const suggestion = `${term.charAt(0).toUpperCase() + term.slice(1)} ${title}`;
      if (!suggestions.includes(suggestion)) {
        suggestions.push(suggestion);
      }
    });
  });

  return suggestions.slice(0, 5);
}

/**
 * Build API query to send to /chatbot/search
 */
export function buildSearchQuery(suggestion) {
  return normalizeInput(suggestion);
}

/**
 * Parse API response and extract candidate names
 */
export function parseCandidateResponse(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((candidate) => {
    const first = candidate.first_name || candidate.firstName || '';
    const last = candidate.last_name || candidate.lastName || '';
    const fullName = (candidate.name || `${first} ${last}`).trim();
    const job = candidate.job_title || candidate.jobTitle || candidate.title || '';
    let skills = [];
    if (Array.isArray(candidate.skills)) skills = candidate.skills;
    else if (typeof candidate.skills === 'string' && candidate.skills.trim()) skills = candidate.skills.split(',').map(s => s.trim()).filter(Boolean);

    return {
      id: candidate.id,
      name: fullName,
      jobTitle: job,
      skills,
      location: candidate.location || candidate.address || '',
    };
  });
}

/**
 * Generate bot greeting message
 */
export function getGreetingMessage() {
  // KPRMT GLOBAL SOLUTIONS welcome message
  return 'Welcome to KPRMT GLOBAL SOLUTIONS! How can we assist you today?'
}

/**
 * Generate helpful tips
 */
export function getHelpTips() {
  return [
    'Try searching by skill (e.g., "Java", "Python")',
    'Search by job title (e.g., "Developer", "Engineer")',
    'Browse candidates by expertise',
    'View full profiles by clicking on names',
  ];
}

/**
 * Normalize user input: lowercase, trim, collapse spaces
 */
export function normalizeInput(s) {
  if (!s) return '';
  return s.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}
