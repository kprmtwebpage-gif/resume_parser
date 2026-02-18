# Job Title Search Intent Classifier

## Overview
The Job Title Search Intent Classifier is an intelligent search endpoint for the ATS (Applicant Tracking System) that returns relevant job titles from the database based on user input. It uses different search strategies depending on the query characteristics.

## Endpoint

```
GET /job-titles/search?q={query}&limit={limit}
```

### Parameters
- `q` (required): Search query for job titles
- `limit` (optional): Maximum number of results to return (default: 100, max: 500)

### Response Format
```json
{
  "query": "string",
  "strategy": "broad_search|exact_match|fuzzy_match|token_match",
  "match_type": "partial|exact|fuzzy|token",
  "results": ["array", "of", "job", "titles"],
  "count": 0
}
```

## Search Rules

### 1. Broad Exploratory Search
**Trigger:** Query is either:
- Shorter than 8 characters, OR
- Contains only one word

**Behavior:**
- Performs case-insensitive partial match
- Returns ALL matching job titles
- Ordered alphabetically
- Used for exploration and discovery

**Examples:**
- `"dev"` → Returns: `.NET Developer`, `Java Developer`, `Full Stack Developer`, etc.
- `"engineer"` → Returns: `Software Engineer`, `Data Engineer`, `Principal Software Engineer`, etc.
- `"Java"` → Returns: `Java Developer`, `Java Full Stack Developer`, `Angular Java Engineer`

### 2. Exact Match (Priority)
**Trigger:** Multi-word query (2+ words) that exactly matches a job title

**Behavior:**
- Case-insensitive exact phrase match
- Returns ONLY the matching title
- Highest priority (checked first)

**Examples:**
- `"Software Engineer"` → Returns: `["Software Engineer"]`
- `"Data Scientist"` → Returns: `["Data Scientist"]`

### 3. Fuzzy Semantic Match
**Trigger:** Multi-word query (2+ words) with no exact match

**Behavior:**
- Uses PostgreSQL pg_trgm similarity scoring
- Returns up to 5 closest matches
- Ranked by similarity score (descending)
- Minimum similarity threshold: 0.1

**Examples:**
- `"Senior Software Developer"` → Returns:
  - `Software Developer` (0.76)
  - `Amazon Junior Software Developer` (0.61)
  - `Senior Software Development Engineer` (0.61)
  - `Senior Software Engineer` (0.48)
  - `.NET Developer` (0.34)

- `"Full Stack Python Developer"` → Returns:
  - `Python Full Stack Developer` (1.00) ← Perfect match!
  - `Full Stack Developer` (0.75)
  - `Net Full Stack Developer` (0.66)
  - `Java Full Stack Developer` (0.64)
  - `Full Stack Engineer` (0.33)

### 4. Token-Based Match (Fallback)
**Trigger:** Fuzzy match returns no results

**Behavior:**
- Splits query into individual words
- Searches for titles containing ALL words (case-insensitive)
- Returns up to 5 results
- Ordered alphabetically

**Example:**
- `"Backend Node Developer"` → Searches for titles containing "backend" AND "node" AND "developer"

## Database Setup

### Prerequisites
The endpoint requires the PostgreSQL `pg_trgm` extension for fuzzy matching:

```bash
python db_enable_fuzzy_search.py
```

This script:
1. Enables the `pg_trgm` extension
2. Creates a GIN index on `job_titles` table for faster similarity searches

### Database Schema
```sql
CREATE TABLE public.job_titles (
    id SERIAL PRIMARY KEY,
    job_title TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_titles_trgm 
ON public.job_titles 
USING GIN (job_title gin_trgm_ops);
```

## Testing

### Run Direct Database Tests
```bash
python test_job_search_direct.py
```

### Run API Integration Tests
1. Start the API server:
```bash
python api_server.py
```

2. In another terminal:
```bash
python test_job_search.py
```

### Test via API Documentation
Navigate to `http://127.0.0.1:8000/docs` and test the `/job-titles/search` endpoint interactively.

## Example Usage

### From Frontend (JavaScript/React)
```javascript
async function searchJobTitles(query) {
  const response = await fetch(
    `http://127.0.0.1:8000/job-titles/search?q=${encodeURIComponent(query)}`
  );
  const data = await response.json();
  
  console.log(`Strategy: ${data.strategy}`);
  console.log(`Results: ${data.count}`);
  return data.results;
}

// Examples
await searchJobTitles("dev");                    // Broad search
await searchJobTitles("Software Engineer");      // Exact match
await searchJobTitles("Senior Python Developer"); // Fuzzy match
```

### From Python
```python
import requests

def search_job_titles(query: str, limit: int = 100):
    response = requests.get(
        "http://127.0.0.1:8000/job-titles/search",
        params={"q": query, "limit": limit}
    )
    return response.json()

# Examples
result = search_job_titles("engineer")
print(f"Found {result['count']} titles using {result['strategy']}")
for title in result['results'][:5]:
    print(f"  - {title}")
```

### cURL
```bash
# Broad search
curl "http://127.0.0.1:8000/job-titles/search?q=dev"

# Exact match
curl "http://127.0.0.1:8000/job-titles/search?q=Software%20Engineer"

# Fuzzy match
curl "http://127.0.0.1:8000/job-titles/search?q=Senior%20Python%20Developer"
```

## Performance Considerations

1. **GIN Index**: The GIN index on `job_title` significantly speeds up similarity searches
2. **Result Limits**: Broad searches are limited to prevent overwhelming clients
3. **Query Optimization**: Short queries trigger simpler, faster partial matches
4. **Caching**: Consider implementing caching for frequently searched terms

## Design Decisions

### Why Different Strategies?

1. **Short Queries = Exploration**
   - Users typing "dev" likely want to see all developer roles
   - Discovery-focused, not precision-focused

2. **Exact Match Priority**
   - If user types "Software Engineer", they want exactly that
   - No need for fuzzy matching when we have the exact title

3. **Fuzzy Matching**
   - Handles typos, word order variations, similar titles
   - Example: "Senior Python Developer" finds "Python Developer Senior"

4. **Limited Fuzzy Results**
   - Top 5 prevents overwhelming the user
   - Most relevant results ranked first

### Why Not Full-Text Search?

While PostgreSQL's full-text search (tsvector) is powerful, the trigram-based similarity matching provides:
- Better handling of word order variations
- More intuitive similarity scores
- Simpler implementation for short text matches
- Excellent performance with GIN indexes

## Future Enhancements

1. **Synonym Support**: Map "programmer" → "developer", "analyst" → "engineer"
2. **Abbreviation Handling**: "SWE" → "Software Engineer", "FE" → "Frontend Engineer"
3. **Learning from Selection**: Track which results users click to improve ranking
4. **Category Grouping**: Group results by category (Frontend, Backend, Data, etc.)
5. **Autocomplete**: Real-time suggestions as user types
6. **Analytics**: Track popular searches and zero-result queries

## Troubleshooting

### No Results for Valid Queries
- Check if `pg_trgm` extension is enabled: `python db_enable_fuzzy_search.py`
- Verify job titles exist in database: `SELECT * FROM job_titles LIMIT 10;`

### Slow Performance
- Ensure GIN index exists: `\d+ job_titles` in psql
- Check query execution plan: `EXPLAIN ANALYZE SELECT ...`
- Consider adjusting similarity threshold

### Unexpected Results
- Review similarity scores in fuzzy matches
- Check for data quality issues (duplicates, inconsistent formatting)
- Adjust fuzzy matching parameters

## API Response Examples

### Broad Search
```json
{
  "query": "dev",
  "strategy": "broad_search",
  "match_type": "partial",
  "results": [
    ".NET Developer",
    "Amazon Junior Software Developer",
    "Data Engineer BI Developer",
    "Full Stack Developer",
    "Java Developer",
    "Java Full Stack Developer",
    "Net Full Stack Developer",
    "Python Full Stack Developer",
    "Senior Software Development Engineer",
    "Software Developer",
    "UI UX Developer"
  ],
  "count": 11
}
```

### Exact Match
```json
{
  "query": "Software Engineer",
  "strategy": "exact_match",
  "match_type": "exact",
  "results": [
    "Software Engineer"
  ],
  "count": 1
}
```

### Fuzzy Match
```json
{
  "query": "Senior Software Developer",
  "strategy": "fuzzy_match",
  "match_type": "fuzzy",
  "results": [
    "Software Developer",
    "Amazon Junior Software Developer",
    "Senior Software Development Engineer",
    "Senior Software Engineer",
    ".NET Developer"
  ],
  "count": 5
}
```

### No Results
```json
{
  "query": "Quantum Computing Specialist",
  "strategy": "token_match",
  "match_type": "token",
  "results": [],
  "count": 0
}
```

## License & Credits

This feature is part of the Resume Parsing ATS system.
Implements intelligent search using PostgreSQL trigram similarity (pg_trgm).
