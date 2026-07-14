from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .paths import PROJECT_ROOT


LOCAL_ENV_PATH = PROJECT_ROOT / ".env.local"
BINDINGS_PATH = PROJECT_ROOT / ".env.llm-bindings.local.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def _provider_defaults(provider: str, model: str = "", base_url: str = "") -> dict[str, str]:
    defaults = {
        "openrouter": {
            "model": "openrouter/free",
            "base_url": "https://openrouter.ai/api/v1/chat/completions",
        },
        "doubao": {
            "model": "doubao-seed-2-0-lite-260428",
            "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        },
        "gemini": {
            "model": "gemini-2.5-flash",
            "base_url": "https://generativelanguage.googleapis.com/v1beta/models",
        },
        "custom": {
            "model": model,
            "base_url": base_url,
        },
    }
    if provider not in defaults:
        raise ValueError("provider 必须是 openrouter、doubao、gemini 或 custom")
    return defaults[provider]


def _normalize_provider(provider: str, api_key: str, base_url: str) -> str:
    provider = provider.strip().lower() or "doubao"
    if provider == "openrouter" and (api_key.startswith("ark-") or "volces.com" in base_url or "ark.cn-" in base_url):
        return "doubao"
    return provider


def _validate_config(provider: str, api_key: str, model: str, base_url: str) -> None:
    _provider_defaults(provider, model, base_url)
    if api_key.lower().startswith(("http://", "https://")):
        raise ValueError("API key 填成了接口地址。请把 https://... 放到“接口地址”，API key 要填对应平台控制台里的 key。")
    if model.lower().startswith(("http://", "https://")):
        raise ValueError("模型栏填成了接口地址。模型应类似 doubao-seed-2-0-lite-260428。")
    if base_url and not base_url.lower().startswith(("http://", "https://")):
        raise ValueError("接口地址必须以 http:// 或 https:// 开头。")


def _mask_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 10:
        return f"{api_key[:2]}***"
    return f"{api_key[:6]}...{api_key[-4:]}"


def _load_store_raw() -> dict[str, object]:
    if not BINDINGS_PATH.exists():
        return {"active_id": "", "bindings": []}
    try:
        payload = json.loads(BINDINGS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"active_id": "", "bindings": []}
    bindings = payload.get("bindings")
    if not isinstance(bindings, list):
        bindings = []
    return {"active_id": str(payload.get("active_id") or ""), "bindings": bindings}


def _write_store(store: dict[str, object]) -> None:
    BINDINGS_PATH.write_text(json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _binding_payload(
    *,
    name: str,
    provider: str,
    api_key: str,
    model: str = "",
    base_url: str = "",
    enabled: bool = True,
    binding_id: str | None = None,
) -> dict[str, object]:
    api_key = api_key.strip()
    model = model.strip()
    base_url = base_url.strip()
    provider = _normalize_provider(provider, api_key, base_url)
    _validate_config(provider, api_key, model, base_url)
    selected = _provider_defaults(provider, model, base_url)
    model = model or selected["model"]
    base_url = base_url or selected["base_url"]
    now = _now()
    return {
        "id": binding_id or uuid.uuid4().hex[:12],
        "name": name.strip() or f"{provider} / {model}",
        "provider": provider,
        "api_key": api_key,
        "model": model,
        "base_url": base_url,
        "enabled": bool(enabled and api_key),
        "created_at": now,
        "updated_at": now,
    }


def _legacy_binding() -> dict[str, object] | None:
    values = _parse_env_file(LOCAL_ENV_PATH)
    api_key = values.get("CALLILENS_LLM_API_KEY", "")
    if not api_key:
        return None
    provider = values.get("CALLILENS_LLM_PROVIDER", "doubao")
    model = values.get("CALLILENS_LLM_MODEL", "")
    base_url = values.get("CALLILENS_LLM_BASE_URL", "")
    enabled = values.get("CALLILENS_LLM_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
    return _binding_payload(
        binding_id="legacy-local",
        name="当前本机配置",
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base_url,
        enabled=enabled,
    )


def _load_store() -> dict[str, object]:
    store = _load_store_raw()
    bindings = store["bindings"]
    if not bindings:
        legacy = _legacy_binding()
        if legacy:
            store = {"active_id": legacy["id"] if legacy.get("enabled") else "", "bindings": [legacy]}
            _write_store(store)
    return store


def _public_binding(binding: dict[str, object], active_id: str) -> dict[str, object]:
    return {
        "id": binding.get("id", ""),
        "name": binding.get("name", ""),
        "provider": binding.get("provider", ""),
        "model": binding.get("model", ""),
        "base_url": binding.get("base_url", ""),
        "enabled": bool(binding.get("enabled")),
        "active": binding.get("id") == active_id,
        "key_masked": _mask_key(str(binding.get("api_key") or "")),
        "created_at": binding.get("created_at", ""),
        "updated_at": binding.get("updated_at", ""),
    }


def _active_binding() -> dict[str, object] | None:
    store = _load_store()
    active_id = str(store.get("active_id") or "")
    for binding in store.get("bindings", []):
        if binding.get("id") == active_id and binding.get("enabled"):
            return binding
    return None


def _sync_env_from_binding(binding: dict[str, object] | None) -> None:
    if not binding:
        text = "\n".join(
            [
                "CALLILENS_LLM_PROVIDER=",
                "CALLILENS_LLM_API_KEY=",
                "CALLILENS_LLM_MODEL=",
                "CALLILENS_LLM_BASE_URL=",
                "CALLILENS_LLM_ENABLED=false",
            ]
        ) + "\n"
    else:
        text = "\n".join(
            [
                f"CALLILENS_LLM_PROVIDER={binding.get('provider', '')}",
                f"CALLILENS_LLM_API_KEY={binding.get('api_key', '')}",
                f"CALLILENS_LLM_MODEL={binding.get('model', '')}",
                f"CALLILENS_LLM_BASE_URL={binding.get('base_url', '')}",
                f"CALLILENS_LLM_ENABLED={'true' if binding.get('enabled') else 'false'}",
            ]
        ) + "\n"
    LOCAL_ENV_PATH.write_text(text, encoding="utf-8")


def llm_config() -> dict[str, str]:
    binding = _active_binding()
    file_values = _parse_env_file(LOCAL_ENV_PATH)
    base = {
        "provider": str(binding.get("provider", "")) if binding else file_values.get("CALLILENS_LLM_PROVIDER", ""),
        "api_key": str(binding.get("api_key", "")) if binding else file_values.get("CALLILENS_LLM_API_KEY", ""),
        "model": str(binding.get("model", "")) if binding else file_values.get("CALLILENS_LLM_MODEL", ""),
        "base_url": str(binding.get("base_url", "")) if binding else file_values.get("CALLILENS_LLM_BASE_URL", ""),
        "enabled": "true" if binding and binding.get("enabled") else file_values.get("CALLILENS_LLM_ENABLED", "false"),
    }
    return {
        "provider": os.getenv("CALLILENS_LLM_PROVIDER") or base["provider"],
        "api_key": os.getenv("CALLILENS_LLM_API_KEY") or base["api_key"],
        "model": os.getenv("CALLILENS_LLM_MODEL") or base["model"],
        "base_url": os.getenv("CALLILENS_LLM_BASE_URL") or base["base_url"],
        "enabled": os.getenv("CALLILENS_LLM_ENABLED") or base["enabled"],
    }


def llm_enabled() -> bool:
    config = llm_config()
    return bool(config["api_key"]) and config["enabled"].lower() in {"1", "true", "yes", "on"}


def llm_status() -> dict[str, object]:
    config = llm_config()
    active = _active_binding()
    provider = config["provider"] or "local"
    model = config["model"] or ("openrouter/free" if provider == "openrouter" else "")
    configured = bool(config["api_key"])
    enabled = llm_enabled()
    return {
        "binding_id": active.get("id") if active else "",
        "binding_name": active.get("name") if active else "",
        "provider": provider,
        "model": model,
        "base_url": config["base_url"],
        "configured": configured,
        "enabled": enabled,
        "mode": "llm_enhanced" if enabled else "local_rag",
    }


def list_llm_bindings() -> dict[str, object]:
    store = _load_store()
    active_id = str(store.get("active_id") or "")
    return {
        "active_id": active_id,
        "bindings": [_public_binding(binding, active_id) for binding in store.get("bindings", [])],
        "status": llm_status(),
    }


def save_llm_config(provider: str, api_key: str, model: str = "", base_url: str = "", enabled: bool = False) -> dict[str, object]:
    binding = add_llm_binding(
        name="当前 AI 配置",
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base_url,
        enabled=enabled,
        activate=enabled,
    )
    return binding["status"]


def add_llm_binding(
    name: str,
    provider: str,
    api_key: str,
    model: str = "",
    base_url: str = "",
    enabled: bool = True,
    activate: bool = True,
) -> dict[str, object]:
    store = _load_store()
    binding = _binding_payload(name=name, provider=provider, api_key=api_key, model=model, base_url=base_url, enabled=enabled)
    bindings = list(store.get("bindings", []))
    bindings.append(binding)
    store["bindings"] = bindings
    if activate and binding.get("enabled"):
        store["active_id"] = binding["id"]
        _sync_env_from_binding(binding)
    _write_store(store)
    return list_llm_bindings()


def activate_llm_binding(binding_id: str) -> dict[str, object]:
    store = _load_store()
    for binding in store.get("bindings", []):
        if binding.get("id") == binding_id:
            if not binding.get("enabled") or not binding.get("api_key"):
                raise ValueError("该绑定没有可用 API key，不能启用。")
            store["active_id"] = binding_id
            binding["updated_at"] = _now()
            _write_store(store)
            _sync_env_from_binding(binding)
            return list_llm_bindings()
    raise ValueError("找不到指定 AI 绑定。")


def delete_llm_binding(binding_id: str) -> dict[str, object]:
    store = _load_store()
    bindings = list(store.get("bindings", []))
    next_bindings = [binding for binding in bindings if binding.get("id") != binding_id]
    if len(next_bindings) == len(bindings):
        raise ValueError("找不到指定 AI 绑定。")
    active_id = str(store.get("active_id") or "")
    store["bindings"] = next_bindings
    if active_id == binding_id:
        replacement = next((binding for binding in next_bindings if binding.get("enabled") and binding.get("api_key")), None)
        store["active_id"] = replacement.get("id") if replacement else ""
        _sync_env_from_binding(replacement)
    _write_store(store)
    return list_llm_bindings()
