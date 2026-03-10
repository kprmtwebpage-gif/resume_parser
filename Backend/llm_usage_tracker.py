"""
LLM Usage Tracking Module

Tracks daily LLM API calls to prevent exceeding Groq free tier limits
and provide visibility into hybrid extraction usage patterns.

Groq Free Tier Limits:
    - 30 requests/minute
    - 6,000 requests/day  
    - 7,000 tokens/minute input

Scenario A Target: 5-10% of resumes use LLM
    - 100 resumes → 5-10 LLM calls
    - 1000 resumes → 50-100 LLM calls
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional


class LLMUsageTracker:
    """Track LLM usage to prevent exceeding free tier limits."""
    
    def __init__(self, tracking_file: Optional[str] = None):
        """
        Initialize usage tracker.
        
        Args:
            tracking_file: Path to JSON file for persistent tracking.
                          Defaults to 'llm_usage.json' in Backend directory.
        """
        if tracking_file is None:
            backend_dir = Path(__file__).parent
            tracking_file = str(backend_dir / "llm_usage.json")
        
        self.tracking_file = tracking_file
        self.data = self._load_data()
    
    def _load_data(self) -> Dict:
        """Load tracking data from file."""
        if os.path.exists(self.tracking_file):
            try:
                with open(self.tracking_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return self._init_data()
        return self._init_data()
    
    def _init_data(self) -> Dict:
        """Initialize empty tracking data structure."""
        return {
            "daily_stats": {},
            "total_lifetime_calls": 0,
            "last_reset": datetime.now().isoformat()
        }
    
    def _save_data(self):
        """Persist tracking data to file."""
        try:
            with open(self.tracking_file, 'w') as f:
                json.dump(self.data, f, indent=2)
        except IOError as e:
            print(f"Warning: Could not save LLM usage tracker: {e}")
    
    def _get_today_key(self) -> str:
        """Get date key for today (YYYY-MM-DD format)."""
        return datetime.now().strftime("%Y-%m-%d")
    
    def _ensure_today_entry(self):
        """Ensure today's date exists in daily_stats."""
        today = self._get_today_key()
        if today not in self.data["daily_stats"]:
            self.data["daily_stats"][today] = {
                "llm_calls": 0,
                "high_confidence_skips": 0,
                "total_resumes": 0,
                "extraction_methods": {
                    "regex": 0,
                    "hybrid": 0,
                    "llm": 0
                }
            }
    
    def record_resume(
        self,
        *,
        used_llm: bool,
        extraction_method: str = "regex",
        confidence_score: float = 0.0
    ):
        """
        Record a resume parsing event.
        
        Args:
            used_llm: Whether LLM was called for this resume
            extraction_method: 'regex', 'hybrid', or 'llm'
            confidence_score: Confidence score from regex extraction
        """
        self._ensure_today_entry()
        today = self._get_today_key()
        stats = self.data["daily_stats"][today]
        
        stats["total_resumes"] += 1
        
        if used_llm:
            stats["llm_calls"] += 1
            self.data["total_lifetime_calls"] += 1
        else:
            stats["high_confidence_skips"] += 1
        
        # Track extraction method
        if extraction_method in stats["extraction_methods"]:
            stats["extraction_methods"][extraction_method] += 1
        
        self._save_data()
    
    def get_today_stats(self) -> Dict:
        """Get statistics for today."""
        self._ensure_today_entry()
        today = self._get_today_key()
        return self.data["daily_stats"][today].copy()
    
    def get_llm_usage_rate(self) -> float:
        """
        Calculate LLM usage rate as percentage of total resumes.
        
        Returns:
            float: Percentage (0.0 to 100.0) of resumes using LLM
        """
        stats = self.get_today_stats()
        total = stats["total_resumes"]
        if total == 0:
            return 0.0
        return (stats["llm_calls"] / total) * 100.0
    
    def can_call_llm(
        self,
        *,
        daily_limit: int = 1000,
        warn_threshold: float = 0.80
    ) -> tuple[bool, str]:
        """
        Check if LLM call is within limits.
        
        Args:
            daily_limit: Maximum LLM calls per day (default: 1000, well below 6000 limit)
            warn_threshold: Warn when reaching this fraction of limit (default: 0.80)
            
        Returns:
            tuple: (allowed: bool, message: str)
        """
        stats = self.get_today_stats()
        calls_today = stats["llm_calls"]
        
        if calls_today >= daily_limit:
            return (
                False,
                f"Daily LLM limit reached ({calls_today}/{daily_limit}). "
                "Falling back to regex-only extraction."
            )
        
        remaining = daily_limit - calls_today
        if calls_today >= (daily_limit * warn_threshold):
            return (
                True,
                f"Warning: Approaching daily LLM limit ({calls_today}/{daily_limit}, "
                f"{remaining} remaining)"
            )
        
        return (True, f"OK ({calls_today}/{daily_limit} calls today)")
    
    def get_summary(self) -> str:
        """Get human-readable summary of today's usage."""
        stats = self .get_today_stats()
        usage_rate = self.get_llm_usage_rate()
        
        lines = [
            f"=== LLM Usage Summary ({self._get_today_key()}) ===",
            f"Total resumes parsed: {stats['total_resumes']}",
            f"LLM calls made: {stats['llm_calls']} ({usage_rate:.1f}%)",
            f"High confidence (regex only): {stats['high_confidence_skips']} ({100-usage_rate:.1f}%)",
            f"",
            f"Extraction Methods:",
            f"  - Regex only: {stats['extraction_methods']['regex']}",
            f"  - Hybrid (regex + LLM): {stats['extraction_methods']['hybrid']}",
            f"  - LLM primary: {stats['extraction_methods']['llm']}",
            f"",
            f"Lifetime total LLM calls: {self.data['total_lifetime_calls']}",
        ]
        return "\n".join(lines)
    
    def cleanup_old_entries(self, days_to_keep: int = 30):
        """Remove daily stats older than specified days."""
        from datetime import timedelta
        
        cutoff = datetime.now() - timedelta(days=days_to_keep)
        cutoff_str = cutoff.strftime("%Y-%m-%d")
        
        old_dates = [
            date for date in self.data["daily_stats"].keys()
            if date < cutoff_str
        ]
        
        for date in old_dates:
            del self.data["daily_stats"][date]
        
        if old_dates:
            self._save_data()
            return len(old_dates)
        return 0


# Global tracker instance
_tracker: Optional[LLMUsageTracker] = None


def get_tracker() -> LLMUsageTracker:
    """Get or create global tracker instance."""
    global _tracker
    if _tracker is None:
        _tracker = LLMUsageTracker()
    return _tracker


def record_llm_call(
    *,
    used_llm: bool,
    extraction_method: str = "regex",
    confidence_score: float = 0.0
):
    """
    Convenience function to record LLM usage.
    
    Args:
        used_llm: Whether LLM was called
        extraction_method: 'regex', 'hybrid', or 'llm'
        confidence_score: Confidence score from regex extraction
    """
    tracker = get_tracker()
    tracker.record_resume(
        used_llm=used_llm,
        extraction_method=extraction_method,
        confidence_score=confidence_score
    )


def check_llm_limit(daily_limit: Optional[int] = None) -> tuple[bool, str]:
    """
    Check if we can call LLM within daily limits.
    
    Args:
        daily_limit: Override default daily limit
        
    Returns:
        tuple: (allowed: bool, message: str)
    """
    tracker = get_tracker()
    if daily_limit is None:
        # Get from environment or use conservative default
        daily_limit = int(os.getenv("LLM_DAILY_LIMIT", "1000"))
    
    return tracker.can_call_llm(daily_limit=daily_limit)


def print_usage_summary():
    """Print usage summary to console."""
    tracker = get_tracker()
    print(tracker.get_summary())


# Example usage
if __name__ == "__main__":
    # Simulate scenario A usage pattern
    tracker = LLMUsageTracker()
    
    print("Simulating Scenario A: 100 resumes, 10% LLM usage\n")
    
    # Simulate 100 resume parses
    for i in range(100):
        # 90% high confidence (regex only)
        if i < 90:
            tracker.record_resume(
                used_llm=False,
                extraction_method="regex",
                confidence_score=0.85
            )
        # 10% low confidence (hybrid with LLM)
        else:
            tracker.record_resume(
                used_llm=True,
                extraction_method="hybrid",
                confidence_score=0.60
            )
    
    print(tracker.get_summary())
    print()
    
    # Check limits
    allowed, msg = tracker.can_call_llm(daily_limit=1000)
    print(f"Can call LLM: {allowed}")
    print(f"Status: {msg}")
