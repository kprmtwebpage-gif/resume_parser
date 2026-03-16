# Jobs Table - Database Schema Documentation

## Overview

This document describes the production-ready PostgreSQL `jobs` table for the Job Creation and Management UI.

## Table Structure

### Primary Key
- **id** (UUID): Auto-generated unique identifier for each job posting

### Basic Information
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| job_title | VARCHAR(255) | NOT NULL | Title of the job position |
| company | VARCHAR(255) | NOT NULL | Company name |
| priority | VARCHAR(50) | NULL | Priority level (High, Medium, Low) |
| status | VARCHAR(50) | NULL | Job status (Open, Closed, On Hold) |
| location | VARCHAR(255) | NOT NULL | Job location |
| department | VARCHAR(255) | NULL | Department or team name |

### Hiring Details
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| open_positions | INTEGER | NULL | Number of open positions (default: 1) |
| reason | TEXT | NULL | Reason for hiring |

### Salary Details
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| currency | VARCHAR(10) | NULL | Currency code (default: USD) |
| salary_start | NUMERIC(12,2) | NULL | Starting salary |
| salary_end | NUMERIC(12,2) | NULL | Ending salary |

### Classification
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| category | VARCHAR(100) | NULL | Job category |
| employment_type | VARCHAR(50) | NULL | Employment type (Full-time, Part-time, Contract) |

### Skills & Qualifications
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| skills | TEXT | NULL | Required skills |
| required_qualification | TEXT | NULL | Required qualifications |

### Rich Content
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| job_description | TEXT | NULL | Detailed job description |
| comments | TEXT | NULL | Additional comments |

### File Upload
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| photo_url | TEXT | NULL | URL to job/company photo |

### System Columns
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | Auto-generated creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | Auto-updated modification timestamp |

## Features

### 1. UUID Primary Key
- Uses `uuid-ossp` extension
- Auto-generated using `gen_random_uuid()`
- Globally unique identifiers

### 2. Automatic Timestamps
- **created_at**: Automatically set when job is created
- **updated_at**: Automatically updated on any modification
- Uses trigger function for reliable updates

### 3. Data Validation
- Salary constraint: `salary_start <= salary_end`
- NOT NULL constraints on required fields

### 4. Performance Indexes
- `idx_jobs_job_title`: Fast job title searches
- `idx_jobs_company`: Company filtering
- `idx_jobs_status`: Status-based queries
- `idx_jobs_location`: Location searches
- `idx_jobs_employment_type`: Employment type filtering
- `idx_jobs_created_at`: Date sorting
- `idx_jobs_status_created_at`: Composite index for common queries

### 5. Auto-Update Trigger
- Function: `update_jobs_updated_at()`
- Trigger: `trigger_update_jobs_updated_at`
- Automatically updates `updated_at` before any UPDATE operation

## Installation

### Prerequisites
- PostgreSQL 12+ installed
- Database created
- Appropriate user permissions

### Execute the Script

#### Method 1: Using psql command line
```bash
psql -U your_username -d your_database -f create_jobs_table.sql
```

#### Method 2: Using pgAdmin
1. Open pgAdmin
2. Connect to your database
3. Open Query Tool
4. Load `create_jobs_table.sql`
5. Execute (F5)

#### Method 3: Using Python (recommended for this project)
```python
import psycopg2

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    database="your_database",
    user="your_username",
    password="your_password"
)

# Read and execute SQL script
with open('create_jobs_table.sql', 'r') as f:
    sql_script = f.read()
    
with conn.cursor() as cur:
    cur.execute(sql_script)
    conn.commit()

print("Jobs table created successfully!")
conn.close()
```

## Usage Examples

### Insert a New Job
```sql
INSERT INTO jobs (
    job_title,
    company,
    priority,
    status,
    location,
    department,
    open_positions,
    currency,
    salary_start,
    salary_end,
    employment_type,
    skills,
    job_description
) VALUES (
    'Senior Software Engineer',
    'Tech Corp',
    'High',
    'Open',
    'New York, NY',
    'Engineering',
    3,
    'USD',
    140000.00,
    180000.00,
    'Full-time',
    'Python, PostgreSQL, React, AWS',
    'We are seeking an experienced software engineer...'
);
```

### Retrieve All Open Jobs
```sql
SELECT 
    id,
    job_title,
    company,
    location,
    salary_start,
    salary_end,
    created_at
FROM jobs
WHERE status = 'Open'
ORDER BY created_at DESC;
```

### Update Job Status
```sql
UPDATE jobs
SET status = 'Closed'
WHERE id = 'your-job-uuid-here';

-- updated_at will automatically be set to current timestamp
```

### Search Jobs by Title
```sql
SELECT 
    id,
    job_title,
    company,
    location,
    employment_type
FROM jobs
WHERE job_title ILIKE '%developer%'
ORDER BY created_at DESC;
```

### Get Jobs by Salary Range
```sql
SELECT 
    id,
    job_title,
    company,
    salary_start,
    salary_end
FROM jobs
WHERE salary_start >= 100000
  AND salary_end <= 150000
ORDER BY salary_start DESC;
```

## Verification Queries

### Check Table Structure
```sql
SELECT 
    column_name, 
    data_type, 
    character_maximum_length, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
ORDER BY ordinal_position;
```

### Verify Indexes
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'jobs';
```

### Verify Trigger
```sql
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'jobs';
```

### Test Auto-Update Trigger
```sql
-- Insert a test job
INSERT INTO jobs (job_title, company, location, status)
VALUES ('Test Job', 'Test Company', 'Test Location', 'Open')
RETURNING id, created_at, updated_at;

-- Note the timestamps (they should be the same)

-- Update the job
UPDATE jobs
SET status = 'Closed'
WHERE job_title = 'Test Job'
RETURNING id, status, created_at, updated_at;

-- Note that updated_at is now different (more recent)
```

## Recommended Status Values
- `Open` - Job is actively accepting applications
- `Closed` - Job is no longer accepting applications
- `On Hold` - Job posting temporarily paused
- `Draft` - Job not yet published
- `Filled` - Position has been filled

## Recommended Priority Values
- `High` - Urgent hiring need
- `Medium` - Standard priority
- `Low` - Non-urgent, opportunistic hiring

## Recommended Employment Types
- `Full-time` - Regular full-time position
- `Part-time` - Part-time position
- `Contract` - Contract/temporary position
- `Internship` - Internship position
- `Freelance` - Freelance/project-based

## Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Validate data on the backend** before inserting
3. **Use transactions** for bulk operations
4. **Regular backups** of the jobs table
5. **Monitor query performance** and adjust indexes as needed
6. **Archive old jobs** periodically to maintain performance

## Migration and Rollback

### If You Need to Drop the Table
```sql
-- Drop in correct order to avoid dependency issues
DROP TRIGGER IF EXISTS trigger_update_jobs_updated_at ON jobs;
DROP FUNCTION IF EXISTS update_jobs_updated_at();
DROP TABLE IF EXISTS jobs CASCADE;
```

### Backup Before Major Changes
```bash
pg_dump -U your_username -d your_database -t jobs > jobs_backup.sql
```

### Restore from Backup
```bash
psql -U your_username -d your_database < jobs_backup.sql
```

## Integration with Application

### Python Example (using psycopg2)
```python
def create_job(job_data):
    """Create a new job posting"""
    query = """
        INSERT INTO jobs (
            job_title, company, location, status, priority,
            department, open_positions, currency, salary_start,
            salary_end, employment_type, skills, job_description
        ) VALUES (
            %(job_title)s, %(company)s, %(location)s, %(status)s,
            %(priority)s, %(department)s, %(open_positions)s,
            %(currency)s, %(salary_start)s, %(salary_end)s,
            %(employment_type)s, %(skills)s, %(job_description)s
        )
        RETURNING id, created_at;
    """
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, job_data)
            result = cur.fetchone()
            conn.commit()
            return result
```

## Support and Maintenance

- Table created: 2026-03-03
- Version: 1.0
- Contact: Database Administrator

## License
Internal use only - Tech Innovations Inc.
