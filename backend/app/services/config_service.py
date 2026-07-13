from __future__ import annotations

import os
from pathlib import Path

from .paths import PROJECT_ROOT


LOCAL_ENV_PATH = PROJECT_ROOT / ".env.local"


def _parse_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def llm_config() -> dict[str, str]:
    file_values = _parse_env_file(LOCAL_ENV_PATH)
    return {
        "provider": os.getenv("CALLILENS_LLM_PROVIDER") or file_values.get("CALLILENS_LLM_PROVIDER", ""),
        "api_key": os.getenv("CALLILENS_LLM_API_KEY") or file_values.get("CALLILENS_LLM_API_KEY", ""),
        "model": os.getenv("CALLILENS_LLM_MODEL") or file_values.get("CALLILENS_LLM_MODEL", ""),
        "base_url": os.getenv("CALLILENS_LLM_BASE_URL") or file_values.get("CALLILENS_LLM_BASE_URL", ""),
    }


def llm_status() -> dict[str, object]:
    config = llm_config()
    provider = config["provider"] or "local"
    model = config["model"] or ("openrouter/free" if provider == "openrouter" else "")
    return {
        "provider": provider,
        "model": model,
        "configured": bool(config["api_key"]),
        "mode": "llm_enhanced" if config["api_key"] else "local_rag",
    }


def save_llm_config(provider: str, api_key: str, model: str = "", base_url: str = "") -> dict[str, object]:
    provider = provider.strip().lower()
    defaults = {
        "openrouter": {
            "model": "openrouter/free",
            "base_url": "https://openrouter.ai/api/v1/chat/completions",
        },
        "gemini": {
            "model": "gemini-2.5-flash",
            "base_url": "https://generativelanguage.googleapis.com/v1beta/models",
        },
        "custom": {
            "model": model.strip(),
            "base_url": base_url.strip(),
        },
    }
    if provider not in defaults:
        raise ValueError("provider 必须是 openrouter、gemini 或 custom")
    selected = defaults[provider]
    payload = {
        "CALLILENS_LLM_PROVIDER": provider,
        "CALLILENS_LLM_API_KEY": api_key.strip(),
        "CALLILENS_LLM_MODEL": model.strip() or selected["model"],
        "CALLILENS_LLM_BASE_URL": base_url.strip() or selected["base_url"],
    }
    text = "\n".join(f"{key}={value}" for key, value in payload.items()) + "\n"
    LOCAL_ENV_PATH.write_text(text, encoding="utf-8")
    return llm_status()

