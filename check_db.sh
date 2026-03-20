#!/bin/bash
# Check if the "missing" files' SHAs actually exist in DB under different filenames
echo "--- check specific missing SHA ---"
SHA=$(sha256sum /var/lib/docker/volumes/resume-dev_resume_cache/_data/ChetanNag_Resume.pdf | awk '{print $1}')
echo "ChetanNag SHA: $SHA"
docker exec resume-db-dev psql -U postgres -d resume_dev -t -c \
  "SELECT id, resume_filename FROM candidate_profile WHERE resume_sha256='$SHA';"

SHA2=$(sha256sum "/var/lib/docker/volumes/resume-dev_resume_cache/_data/BATTULA DRUVANA- Senior AI-ML Engineer.docx" | awk '{print $1}')
echo "BATTULA SHA: $SHA2"
docker exec resume-db-dev psql -U postgres -d resume_dev -t -c \
  "SELECT id, resume_filename FROM candidate_profile WHERE resume_sha256='$SHA2';"

SHA3=$(sha256sum "/var/lib/docker/volumes/resume-dev_resume_cache/_data/Vijay Gollapalli Resume.docx" | awk '{print $1}')
echo "Vijay SHA: $SHA3"
docker exec resume-db-dev psql -U postgres -d resume_dev -t -c \
  "SELECT id, resume_filename FROM candidate_profile WHERE resume_sha256='$SHA3';"

