# Safe Deployment Strategy

## Overview

This document explains how to safely deploy code from local → dev → uat → production **without impacting running systems** and **keeping resumes in sync**.

## The Challenge

Your application has a unique data flow:
- **Code**: Stored in git (dev, uat, prod branches)
- **Database**: Persistent across deployments (backed up)
- **Resumes**: Continuously uploaded to production, but missing in dev/uat

**Goal**: Deploy safely while keeping test environments with latest production resumes.

---

## Architecture

```
Your Windows PC
    ↓ git push origin dev
Remote Server (89.167.60.41)
    ├── DEV      (port 8002) — isolated Docker project "resume-dev"
    ├── UAT      (port 8001) — isolated Docker project "resume-uat"  
    └── PROD     (port 8000) — isolated Docker project "resume-prod"

Each has its own:
    • postgres_data volume (completely separate databases)
    • resume_cache volume (resume files)
    • Docker containers
```

The magic: **They run simultaneously but independently**. Deploying to PROD doesn't affect DEV/UAT.

---

## Safe Deployment Workflow

### Phase 1: Local Development
```bash
# On Windows PC
git checkout dev
git commit -m "Feature: ..."
git push origin dev
```

### Phase 2: Deploy to Dev
```bash
ssh root@89.167.60.41
cd /root/resume-parser
bash deploy_dev.sh
```

**What it does:**
- Pulls latest from `dev` branch
- Builds new Docker images
- Stops old containers gracefully
- Starts new containers
- Runs health check
- **Takes ~30 seconds, dev is continuously available**

### Phase 3: UAT with Latest Production Data
```bash
bash sync_prod_resumes_to_uat.sh
bash deploy_uat.sh
```

**What happens:**
- Incremental sync copies NEW resumes from production → uat volume
- UAT gets tested with realistic data
- Only new files since last sync are copied
- **Cutoff marker** ensures next sync only gets files uploaded after this moment

Example timeline:
```
Mar 9 10:00 — Sync #1: Copy {resume_A, resume_B, resume_C}
              Cutoff marker set to "Mar 9 10:00"

Mar 9 12:00 — Production: 10 new resumes uploaded
              (A, B, C remain; D-M are new)

Mar 9 13:00 — Sync #2: Only copy {D, E, F, G, H, I, J, K, L, M}
              Cutoff marker updated to "Mar 9 13:00"

Mar 9 15:00 — Sync #3: Check cutoff → no new files
              Exit (no action needed)
```

### Phase 4: Production Deployment (THE SAFE PART)

```bash
bash safe_deploy_to_production.sh
```

**Automated safety checks:**

1. ✅ **Backup database** before touching anything
   ```bash
   pg_dump -U postgres resume_parser > backup_20260309_100000.sql
   ```

2. ✅ **Sync latest production resumes to UAT** (keeps uat fresh)

3. ✅ **Check UAT is healthy** (early warning if code is broken)

4. ✅ **Sync resumes to dev** (next dev cycle has current data)

5. ✅ **Rolling update to production**
   - Old containers stay running while new images build
   - No downtime
   - Containers swap atomically

6. ✅ **Post-deploy health check**
   - If API responds → success
   - If not → rollback instructions shown

---

## Incremental Resume Sync Explained

### Why Incremental?

**Bad approach:** Copy all 5000 production resumes to dev/uat
- Takes forever
- Wastes disk space
- Redundant if nothing new arrived

**Good approach:** Only copy resumes uploaded since last sync
- Fast (usually 5-20 files per day)
- Disk efficient
- Always have latest data

### How It Works

Each environment has a **cutoff marker file**:
- Dev: `/tmp/sync_dev_cutoff`
- UAT: `/tmp/sync_uat_cutoff`

Contains timestamp of last sync. Next sync:
1. Finds all files in production newer than this timestamp
2. Copies only those files
3. Updates timestamp to now

If no new files → exits instantly (0 seconds).

### The Volumes

```
Docker Volumes (persistent across deployments):

resume-prod_resume_cache/  ← receives new uploads continuously
    ├── resume_001.pdf (Mar 1)
    ├── resume_002.pdf (Mar 5)
    ├── resume_003.pdf (Mar 9) ← NEW
    ├── resume_004.pdf (Mar 9) ← NEW
    └── resume_005.pdf (Mar 9) ← NEW

resume-uat_resume_cache/   ← mirrored snapshot
    ├── resume_001.pdf (copied Mar 1)
    ├── resume_002.pdf (copied Mar 5)
    ├── resume_003.pdf (synced Mar 9)
    ├── resume_004.pdf (synced Mar 9)
    └── resume_005.pdf (synced Mar 9)

resume-dev_resume_cache/   ← mirrored snapshot
    └── [similar to uat, updated less frequently]
```

---

## Step-by-Step Deployment Example

### Scenario: You fixed a bug and want to deploy

```bash
# ========================================
# On Windows PC
# ========================================
git add Backend/parser.py
git commit -m "Fix: Handle edge case in job title parsing"
git push origin dev

# ========================================
# On Server: Deploy to Dev for testing
# ========================================
ssh root@89.167.60.41
cd /root/resume-parser
bash deploy_dev.sh
# Test at http://localhost:8002/

# Everything works locally? Merge to uat branch and test with real data

git checkout uat
git merge dev --ff
cd /root/resume-parser
bash sync_prod_resumes_to_uat.sh  # Get 10 new resumes uploaded recently
bash deploy_uat.sh
# Test at http://localhost:8001/
# Specifically test with the new production-like resumes

# Ready for production? Get approval, then:
git checkout prod
git merge uat --ff
bash safe_deploy_to_production.sh

# This script will:
# 1. Backup the database (in case you need to rollback)
# 2. Sync 75 new resumes to uat (for next batch of uat testing)
# 3. Sync 50 new resumes to dev (for dev team next cycle)
# 4. Deploy the code to production
# 5. Verify health
# 6. Show you exactly what to do if rollback needed
```

---

## Emergency Rollback

If something goes wrong immediately after deploy:

```bash
# The deployment script saved the backup file location
# Look at the output, it says something like:
# "Backup saved: /root/resume-parser/database_backups/production_backup_20260309_100000.sql"

cd /root/resume-parser

# Option 1: Revert code
git log --oneline  # see recent commits
git reset --hard <previous-commit-hash>
bash deploy_prod.sh

# Option 2: Restore database from backup
BACKUP="/root/resume-parser/database_backups/production_backup_20260309_100000.sql"
docker exec resume-db-prod psql -U postgres -d resume_parser < $BACKUP

# Both if needed:
git reset --hard <hash>
docker exec resume-db-prod psql -U postgres -d resume_parser < $BACKUP
bash deploy_prod.sh
```

---

## Key Differences: Dev vs UAT vs Prod

| | Dev | UAT | Prod |
|---|---|---|---|
| **Port** | 8002 | 8001 | 8000 |
| **Database** | Separate (resume_db-dev) | Separate (resume_db-uat) | Separate (resume_db-prod) |
| **Resumes** | 50 latest | 75 latest | All (continuous upload) |
| **Users** | Developers | Clients for acceptance | End users |
| **Branches** | `dev` | `uat` or `dev` | `prod` |
| **Sync frequency** | Manual, rarely | Before each uat test | Before deployment |

---

## Monitoring Post-Deployment

```bash
# Watch logs
docker compose -p resume-prod logs -f api

# Check service status
docker compose -p resume-prod ps

# Verify database
docker exec resume-db-prod psql -U postgres -d resume_parser -c "SELECT COUNT(*) FROM parsed_resumes;"

# Test API
curl https://kprmtglobalsolutions.duckdns.org/health
```

---

## Common Scenarios

### New resumes arrived in production yesterday, UAT needs them for testing
```bash
bash sync_prod_resumes_to_uat.sh
# Only copies resumes uploaded since last sync (fast!)
# Then deploy uat to test with fresh data
bash deploy_uat.sh
```

### You committed code but production isn't deploying
```bash
# Debug what happened
bash safe_deploy_to_production.sh

# If it fails at DB backup step:
docker exec resume-db-prod pg_dump -U postgres resume_parser > /tmp/test.sql
# Should return a file. If not, DB is unhealthy

# If it fails at deploy step:
docker compose logs
  # Look for OOM kills, network issues, port conflicts, etc.

# If new code is broken but you're in prod:
git log --oneline  # find last good commit
git reset --hard <hash>
bash safe_deploy_to_production.sh
# Re-deploy the known-good version
```

### You need the latest 100 resumes in dev (not just 50)
Edit `sync_prod_resumes_to_dev.sh`, change:
```bash
SAMPLE_COUNT=50   # Change to
SAMPLE_COUNT=100  # More samples
```

---

## File Reference

| File | Purpose |
|---|---|
| `deploy_dev.sh` | Deploy to dev environment |
| `deploy_uat.sh` | Deploy to uat environment |
| `deploy_prod.sh` | Deploy to production (no backup, use safe_deploy instead) |
| `sync_prod_resumes_to_dev.sh` | Incremental sync latest 50 production resumes → dev |
| `sync_prod_resumes_to_uat.sh` | Incremental sync latest 75 production resumes → uat |
| `safe_deploy_to_production.sh` | **USE THIS FOR PROD** — full orchestration with backup + uat test + sync |
| `cleanup_dev.sh` | Remove stale Docker images/cache |

---

## Summary

✅ **Zero downtime** — rolling Docker updates
✅ **Data safety** — automatic backups before production changes
✅ **Test realism** — dev/uat always have fresh production resumes
✅ **Easy rollback** — scripts show you exactly how
✅ **Incremental** — sync only new files, not everything

**The key insight**: Dev/UAT/Prod are **completely isolated**. You can deploy to dev/uat without touching production. When you're confident, one command (`safe_deploy_to_production.sh`) coordinates the safe transition.
