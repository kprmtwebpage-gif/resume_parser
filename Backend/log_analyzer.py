#!/usr/bin/env python3
"""
Log Analyzer for Resume Parser
===============================

Quick troubleshooting utility for parser debug logs.

Usage:
    # View recent errors
    python log_analyzer.py errors

    # Search for specific file
    python log_analyzer.py search "Resume_John_Doe.pdf"

    # Show extraction stats (success rate, common issues)
    python log_analyzer.py stats

    # Show last 50 parsed candidates
    python log_analyzer.py recent 50

    # Find all candidates with missing names
    python log_analyzer.py filter "name=('', '')"

    # Cleanup old logs (older than 30 days)
    python log_analyzer.py cleanup 30

    # Decompress .gz logs for viewing
    python log_analyzer.py decompress parser_debug_prod.log.1.gz
"""

import gzip
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path


def get_log_dir():
    """Get logs directory path."""
    return Path(__file__).parent / "logs"


def find_log_files(env=None, pattern="parser_debug_*.log"):
    """Find log files for given environment."""
    log_dir = get_log_dir()
    if env:
        pattern = f"parser_debug_{env}.log"
    return sorted(log_dir.glob(pattern))


def read_log_file(path, tail=None):
    """Read log file (handles .gz compression)."""
    if str(path).endswith('.gz'):
        with gzip.open(path, 'rt', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    else:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    
    if tail:
        return lines[-tail:]
    return lines


def show_errors(env=None, last_n=50):
    """Show recent errors from logs."""
    log_files = find_log_files(env, pattern="parser_errors_*.log")
    if not log_files:
        print("No error logs found.")
        return
    
    print(f"Recent errors ({log_files[0].name}):\n")
    lines = read_log_file(log_files[0], tail=last_n)
    for line in lines:
        print(line.rstrip())


def search_file(filename, env=None):
    """Search for all log entries related to a specific resume file."""
    log_files = find_log_files(env)
    if not log_files:
        print("No log files found.")
        return
    
    print(f"Searching for '{filename}'...\n")
    found = False
    for log_file in log_files:
        lines = read_log_file(log_file)
        matches = [line for line in lines if filename in line]
        if matches:
            found = True
            print(f"=== {log_file.name} ===")
            for line in matches:
                print(line.rstrip())
            print()
    
    if not found:
        print("No matches found.")


def show_stats(env=None):
    """Show parsing statistics from logs."""
    log_files = find_log_files(env)
    if not log_files:
        print("No log files found.")
        return
    
    lines = read_log_file(log_files[0])
    
    # Count parse events
    parsed_count = 0
    skipped_count = 0
    name_issues = 0
    title_issues = 0
    email_issues = 0
    
    for line in lines:
        if "PARSED [" in line:
            parsed_count += 1
            # Check for missing data
            if "name=('', '')" in line or "name=(None, None)" in line:
                name_issues += 1
            if "title=None" in line or "title=''" in line:
                title_issues += 1
            if "email=None" in line or "email=''" in line:
                email_issues += 1
        elif "SKIPPED [" in line:
            skipped_count += 1
    
    print(f"Parsing Statistics ({log_files[0].name}):")
    print(f"  Total parsed:     {parsed_count}")
    print(f"  Total skipped:    {skipped_count}")
    print(f"  Name issues:      {name_issues} ({name_issues/parsed_count*100:.1f}%)" if parsed_count else "  Name issues:      0")
    print(f"  Title issues:     {title_issues} ({title_issues/parsed_count*100:.1f}%)" if parsed_count else "  Title issues:     0")
    print(f"  Email issues:     {email_issues} ({email_issues/parsed_count*100:.1f}%)" if parsed_count else "  Email issues:     0")


def show_recent(n=50, env=None):
    """Show N most recent parsed candidates."""
    log_files = find_log_files(env)
    if not log_files:
        print("No log files found.")
        return
    
    lines = read_log_file(log_files[0])
    parsed_lines = [line for line in lines if "PARSED [" in line]
    
    print(f"Last {n} parsed candidates:\n")
    for line in parsed_lines[-n:]:
        print(line.rstrip())


def filter_logs(pattern, env=None):
    """Filter logs by pattern."""
    log_files = find_log_files(env)
    if not log_files:
        print("No log files found.")
        return
    
    lines = read_log_file(log_files[0])
    matches = [line for line in lines if pattern in line]
    
    print(f"Lines matching '{pattern}':\n")
    for line in matches:
        print(line.rstrip())
    
    print(f"\nTotal matches: {len(matches)}")


def cleanup_old_logs(days=30):
    """Delete log files older than N days."""
    log_dir = get_log_dir()
    cutoff = datetime.now() - timedelta(days=days)
    deleted = []
    
    for log_file in log_dir.glob("parser_*.log*"):
        if log_file.stat().st_mtime < cutoff.timestamp():
            log_file.unlink()
            deleted.append(log_file.name)
    
    if deleted:
        print(f"Deleted {len(deleted)} old log files:")
        for name in deleted:
            print(f"  - {name}")
    else:
        print(f"No log files older than {days} days found.")


def decompress_log(filename):
    """Decompress a .gz log file for viewing."""
    log_dir = get_log_dir()
    src = log_dir / filename
    
    if not src.exists():
        print(f"File not found: {src}")
        return
    
    if not str(src).endswith('.gz'):
        print("File is not compressed (.gz)")
        return
    
    dst = src.with_suffix('')  # Remove .gz extension
    
    with gzip.open(src, 'rb') as f_in:
        with open(dst, 'wb') as f_out:
            f_out.write(f_in.read())
    
    print(f"Decompressed: {dst}")


def show_help():
    """Show usage help."""
    print(__doc__)


def main():
    if len(sys.argv) < 2:
        show_help()
        return
    
    command = sys.argv[1].lower()
    
    if command == "errors":
        env = sys.argv[2] if len(sys.argv) > 2 else None
        show_errors(env)
    
    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: log_analyzer.py search <filename>")
            return
        filename = sys.argv[2]
        env = sys.argv[3] if len(sys.argv) > 3 else None
        search_file(filename, env)
    
    elif command == "stats":
        env = sys.argv[2] if len(sys.argv) > 2 else None
        show_stats(env)
    
    elif command == "recent":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 50
        env = sys.argv[3] if len(sys.argv) > 3 else None
        show_recent(n, env)
    
    elif command == "filter":
        if len(sys.argv) < 3:
            print("Usage: log_analyzer.py filter <pattern>")
            return
        pattern = sys.argv[2]
        env = sys.argv[3] if len(sys.argv) > 3 else None
        filter_logs(pattern, env)
    
    elif command == "cleanup":
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
        cleanup_old_logs(days)
    
    elif command == "decompress":
        if len(sys.argv) < 3:
            print("Usage: log_analyzer.py decompress <filename.gz>")
            return
        decompress_log(sys.argv[2])
    
    else:
        print(f"Unknown command: {command}\n")
        show_help()


if __name__ == "__main__":
    main()
