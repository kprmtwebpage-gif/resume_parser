"""
llm_provider_chain.py
=====================
Multi-provider LLM fallback chain for resume parsing.

Design Goals:
    - Never crash production if an API starts charging / is down
    - Try providers in priority order (HuggingFace → Groq → NLP-only)
    - Circuit breaker: skip a failing provider for LLM_CIRCUIT_RESET_MIN minutes
    - Graceful degradation: always fall back to regex/NLP, never raise
    - Zero-config: works with no API keys (just uses regex)
    - Future-proof: add new providers by adding ONE entry to PROVIDERS list

Environment Variables:
    LLM_PROVIDERS         Comma-separated priority order (default: hf,groq)
                          e.g. "groq,hf" to try Groq first
                          e.g. "hf" to use only HuggingFace
                          e.g. "" or "none" to disable all LLM

    LLM_CIRCUIT_FAILS     Consecutive failures before circuit opens (default: 3)
    LLM_CIRCUIT_RESET_MIN Minutes before retrying a failed provider (default: 30)

    Per-provider keys:
    HF_API_KEY            HuggingFace API key (free tier: 30K req/month)
    HF_MODEL              HuggingFace model (default: Qwen/Qwen2.5-72B-Instruct)
    OPENAI_API_KEY        Groq API key  (free tier: 6K req/day)
    LLM_BASE_URL          Groq base URL (default: https://api.groq.com/openai/v1)
    LLM_MODEL             Groq model    (default: llama-3.1-8b-instant)
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Circuit Breaker State (in-memory, per process)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class _ProviderState:
    name: str
    fail_count: int = 0
    open_until: float = 0.0          # epoch seconds; 0 = closed (healthy)
    total_calls: int = 0
    total_successes: int = 0
    total_failures: int = 0

    def is_open(self) -> bool:
        """True = circuit is open = provider should be skipped."""
        if self.open_until == 0.0:
            return False
        if time.monotonic() >= self.open_until:
            # Auto-reset
            logger.info("llm_chain: circuit reset for provider '%s'", self.name)
            self.open_until = 0.0
            self.fail_count = 0
        return self.open_until > 0

    def record_success(self):
        self.total_calls += 1
        self.total_successes += 1
        self.fail_count = 0

    def record_failure(self, max_fails: int, reset_seconds: float):
        self.total_calls += 1
        self.total_failures += 1
        self.fail_count += 1
        if self.fail_count >= max_fails:
            self.open_until = time.monotonic() + reset_seconds
            logger.warning(
                "llm_chain: circuit OPEN for provider '%s' after %d failures "
                "(will retry in %.0f min)",
                self.name, self.fail_count, reset_seconds / 60,
            )


# Global circuit state (shared across calls in the same process)
_circuit: dict[str, _ProviderState] = {}


def _get_state(name: str) -> _ProviderState:
    if name not in _circuit:
        _circuit[name] = _ProviderState(name=name)
    return _circuit[name]


def get_provider_stats() -> dict[str, dict]:
    """Return current stats for all providers (useful for health checks)."""
    return {
        name: {
            "total_calls": s.total_calls,
            "total_successes": s.total_successes,
            "total_failures": s.total_failures,
            "circuit_open": s.is_open(),
        }
        for name, s in _circuit.items()
    }


# ─────────────────────────────────────────────────────────────────────────────
# Provider Implementations
# ─────────────────────────────────────────────────────────────────────────────

def _call_hf(prompt: str) -> str | None:
    """Call HuggingFace Inference API."""
    api_key = os.getenv("HF_API_KEY", "").strip()
    if not api_key:
        return None             # Not configured — skip silently
    model = os.getenv("HF_MODEL", "Qwen/Qwen2.5-72B-Instruct").strip()
    try:
        from huggingface_hub import InferenceClient
        client = InferenceClient(api_key=api_key)
        response = client.chat_completion(
            messages=[
                {"role": "system", "content": "You are a resume parser. Return ONLY valid JSON."},
                {"role": "user",   "content": prompt},
            ],
            model=model,
            max_tokens=2048,
            temperature=0,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        raise RuntimeError(f"HuggingFace error: {type(e).__name__}: {e}") from e


def _call_groq(prompt: str) -> str | None:
    """Call Groq (or any OpenAI-compatible) API."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None             # Not configured — skip silently
    base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1").strip()
    model = os.getenv("LLM_MODEL", "llama-3.1-8b-instant").strip()
    try:
        import openai
        client = openai.OpenAI(api_key=api_key, base_url=base_url, timeout=30.0)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a resume parser. Return ONLY valid JSON."},
                {"role": "user",   "content": prompt},
            ],
            temperature=0,
            max_tokens=2048,
            timeout=30.0,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        raise RuntimeError(f"Groq error: {type(e).__name__}: {e}") from e


def _call_ollama(prompt: str) -> str | None:
    """Call Ollama (OpenAI-compatible API)."""
    base_url = os.getenv("OLLAMA_BASE_URL", "").strip()
    if not base_url:
        return None             # Not configured — skip silently
    model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b").strip()
    try:
        import openai
        client = openai.OpenAI(api_key="ollama", base_url=base_url, timeout=60.0)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a resume parser. Return ONLY valid JSON."},
                {"role": "user",   "content": prompt},
            ],
            temperature=0,
            max_tokens=2048,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        raise RuntimeError(f"Ollama error: {type(e).__name__}: {e}") from e


def _call_cerebras(prompt: str) -> str | None:
    """Call Cerebras API (OpenAI-compatible)."""
    api_key = os.getenv("CEREBRAS_API_KEY", "").strip()
    if not api_key:
        return None             # Not configured — skip silently
    model = os.getenv("CEREBRAS_MODEL", "llama3.1-8b").strip()
    try:
        import openai
        client = openai.OpenAI(api_key=api_key, base_url="https://api.cerebras.ai/v1", timeout=30.0)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a resume parser. Return ONLY valid JSON."},
                {"role": "user",   "content": prompt},
            ],
            temperature=0,
            max_tokens=2048,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        raise RuntimeError(f"Cerebras error: {type(e).__name__}: {e}") from e


# Registry: name → callable
_PROVIDER_REGISTRY: dict[str, Any] = {
    "hf":       _call_hf,
    "groq":     _call_groq,
    "ollama":   _call_ollama,
    "cerebras": _call_cerebras,
}


# ─────────────────────────────────────────────────────────────────────────────
# JSON Response Parser
# ─────────────────────────────────────────────────────────────────────────────

def _parse_json_response(raw: str) -> dict | None:
    text = raw.strip()
    for fence in ("```json", "```"):
        if text.startswith(fence):
            text = text[len(fence):]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Main Chain Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def call_llm_chain(prompt: str, source_file: str = "") -> dict | None:
    """
    Try LLM providers in priority order. Returns parsed JSON dict or None.

    Never raises — any uncaught error returns None (graceful degradation).

    Priority is read from LLM_PROVIDERS env var (default: "hf,groq").
    If all providers fail or none are configured, returns None so the caller
    falls back to pure regex/NLP results.
    """
    # ── PARSE_MODE gate ────────────────────────────────────────────────
    parse_mode = os.getenv("PARSE_MODE", "nlp").strip().casefold()
    if parse_mode == "nlp":
        logger.debug("llm_chain: PARSE_MODE=nlp, skipping LLM")
        return None

    # ── Provider priority list ────────────────────────────────────────────
    providers_raw = os.getenv("LLM_PROVIDERS", "hf,groq").strip().casefold()
    if not providers_raw or providers_raw in {"none", "off", "false", "0", ""}:
        logger.debug("llm_chain: LLM_PROVIDERS disabled")
        return None

    provider_list = [p.strip() for p in providers_raw.split(",") if p.strip()]

    # ── Circuit breaker settings ──────────────────────────────────────────
    try:
        max_fails = int(os.getenv("LLM_CIRCUIT_FAILS", "3"))
    except ValueError:
        max_fails = 3
    try:
        reset_secs = float(os.getenv("LLM_CIRCUIT_RESET_MIN", "30")) * 60
    except ValueError:
        reset_secs = 1800.0

    # ── Try each provider in order ────────────────────────────────────────
    for provider_name in provider_list:
        fn = _PROVIDER_REGISTRY.get(provider_name)
        if fn is None:
            logger.warning("llm_chain: unknown provider '%s', skipping", provider_name)
            continue

        state = _get_state(provider_name)

        if state.is_open():
            logger.info("llm_chain [%s]: circuit open, skipping provider '%s'",
                        source_file, provider_name)
            continue

        try:
            raw = fn(prompt)
            if raw is None:
                # Provider not configured (no API key) — skip without counting as failure
                logger.debug("llm_chain: provider '%s' not configured (no API key)", provider_name)
                continue

            result = _parse_json_response(raw)
            if result:
                state.record_success()
                logger.info("llm_chain [%s]: success via provider '%s'",
                            source_file, provider_name)
                return result
            else:
                # Got a response but couldn't parse JSON — treat as soft failure
                state.record_failure(max_fails, reset_secs)
                logger.warning("llm_chain [%s]: provider '%s' returned unparsable response",
                               source_file, provider_name)

        except Exception as e:
            state.record_failure(max_fails, reset_secs)
            logger.warning(
                "llm_chain [%s]: provider '%s' failed (%s), trying next provider",
                source_file, provider_name, e,
            )
            continue

    # All providers failed or unavailable — return None (caller uses regex results)
    logger.info("llm_chain [%s]: all providers exhausted, using regex/NLP only", source_file)
    return None
