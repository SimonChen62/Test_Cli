from __future__ import annotations

import json
import urllib.error
import urllib.request

from .config_service import llm_config


SYSTEM_PROMPT = """你是书法展览导览助手。
只能根据提供的资料回答。
如果资料中没有答案，请说明“当前资料中没有明确说明”。
不要评价作品好坏，不要编造作者、年代或史实。
回答要面向普通观众，简洁、准确、有来源意识。"""

GENERAL_PROMPT = """你是书法展览导览助手。
优先使用提供的本地资料；如果资料不足，可以基于你的通用知识补充回答。
补充内容必须谨慎表述，不要虚构具体馆藏、年代、作者、尺寸、来源链接。
不要评价书法好坏，不要判断真伪，不要声称恢复真实笔顺。
回答要面向普通观众，简洁、清楚，并说明哪些内容属于 AI 补充。"""


def enhance_answer(question: str, context: str, fallback_answer: str) -> tuple[str, str]:
    config = llm_config()
    if not config["api_key"]:
        return fallback_answer, "local_rag"
    provider = (config["provider"] or "openrouter").lower()
    if provider == "gemini":
        return _call_gemini(config, question, context, fallback_answer), "gemini"
    return _call_openai_compatible(config, question, context, fallback_answer), provider


def general_answer(question: str, context: str = "") -> tuple[str, str]:
    config = llm_config()
    fallback_answer = "当前 AI 未返回可用回答。"
    if not config["api_key"]:
        return fallback_answer, "local_rag"
    provider = (config["provider"] or "openrouter").lower()
    if provider == "gemini":
        return _call_gemini(config, question, context, fallback_answer, GENERAL_PROMPT, True, "AI 补充服务"), "gemini"
    return _call_openai_compatible(config, question, context, fallback_answer, GENERAL_PROMPT, True, "AI 补充服务"), provider


def _fallback_with_error(label: str, fallback_answer: str, error: object) -> str:
    return f"{fallback_answer}\n\n（{label} 暂时不可用，已返回本地 RAG 答案。错误信息：{error}）"


def _chat_url(config: dict[str, str]) -> str:
    provider = (config.get("provider") or "").lower()
    url = (config.get("base_url") or "").strip().rstrip("/")
    if not url:
        return "https://openrouter.ai/api/v1/chat/completions"
    if url.endswith("/responses") or url.endswith("/chat/completions"):
        return url
    if provider == "doubao" and url.endswith("/api/v3"):
        return f"{url}/chat/completions"
    return url


def _call_openai_compatible(
    config: dict[str, str],
    question: str,
    context: str,
    fallback_answer: str,
    system_prompt: str = SYSTEM_PROMPT,
    allow_general: bool = False,
    service_label: str = "AI 润色服务",
) -> str:
    url = _chat_url(config)
    if url.endswith("/responses"):
        return _call_responses_compatible(config, question, context, fallback_answer, url, system_prompt, allow_general, service_label)
    model = config["model"] or "openrouter/free"
    instruction = (
        f"问题：{question}\n\n本地检索资料：\n{context or '（没有匹配到本地资料）'}\n\n"
        "请优先参考本地资料；资料不足时可以做谨慎的 AI 补充，并明确标注补充内容。"
        if allow_general
        else f"问题：{question}\n\n检索资料：\n{context}\n\n请基于资料回答。"
    )
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": instruction,
            },
        ],
        "temperature": 0.35 if allow_general else 0.2,
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config['api_key']}",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "CalliLens",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        return _fallback_with_error(service_label, fallback_answer, f"HTTP {exc.code}: {detail}")
    except (KeyError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return _fallback_with_error(service_label, fallback_answer, exc)


def _call_responses_compatible(
    config: dict[str, str],
    question: str,
    context: str,
    fallback_answer: str,
    url: str,
    system_prompt: str = SYSTEM_PROMPT,
    allow_general: bool = False,
    service_label: str = "Responses API",
) -> str:
    model = config["model"] or "doubao-seed-2-0-lite-260428"
    instruction = (
        f"问题：{question}\n\n本地检索资料：\n{context or '（没有匹配到本地资料）'}\n\n"
        "请优先参考本地资料；资料不足时可以做谨慎的 AI 补充，并明确标注补充内容。"
        if allow_general
        else f"问题：{question}\n\n检索资料：\n{context}\n\n请基于资料回答。"
    )
    body = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": instruction,
                    }
                ],
            },
        ],
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config['api_key']}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("output_text"):
            return str(payload["output_text"]).strip()
        for output in payload.get("output", []):
            for content in output.get("content", []):
                if content.get("text"):
                    return str(content["text"]).strip()
        raise KeyError("responses output text not found")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        return _fallback_with_error(service_label, fallback_answer, f"HTTP {exc.code}: {detail}")
    except (KeyError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return _fallback_with_error(service_label, fallback_answer, exc)


def _call_gemini(
    config: dict[str, str],
    question: str,
    context: str,
    fallback_answer: str,
    system_prompt: str = SYSTEM_PROMPT,
    allow_general: bool = False,
    service_label: str = "Gemini 润色服务",
) -> str:
    model = config["model"] or "gemini-2.5-flash"
    base = (config["base_url"] or "https://generativelanguage.googleapis.com/v1beta/models").rstrip("/")
    url = f"{base}/{model}:generateContent?key={config['api_key']}"
    instruction = (
        f"问题：{question}\n\n本地检索资料：\n{context or '（没有匹配到本地资料）'}\n\n"
        "请优先参考本地资料；资料不足时可以做谨慎的 AI 补充，并明确标注补充内容。"
        if allow_general
        else f"问题：{question}\n\n检索资料：\n{context}\n\n请基于资料回答。"
    )
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [
            {
                "role": "user",
                "parts": [{"text": instruction}],
            }
        ],
        "generationConfig": {"temperature": 0.35 if allow_general else 0.2},
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        return _fallback_with_error(service_label, fallback_answer, f"HTTP {exc.code}: {detail}")
    except (KeyError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return _fallback_with_error(service_label, fallback_answer, exc)
