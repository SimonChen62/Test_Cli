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


def enhance_answer(question: str, context: str, fallback_answer: str) -> tuple[str, str]:
    config = llm_config()
    if not config["api_key"]:
        return fallback_answer, "local_rag"
    provider = (config["provider"] or "openrouter").lower()
    if provider == "gemini":
        return _call_gemini(config, question, context, fallback_answer), "gemini"
    return _call_openai_compatible(config, question, context, fallback_answer), provider


def _call_openai_compatible(config: dict[str, str], question: str, context: str, fallback_answer: str) -> str:
    url = config["base_url"] or "https://openrouter.ai/api/v1/chat/completions"
    model = config["model"] or "openrouter/free"
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"问题：{question}\n\n检索资料：\n{context}\n\n请基于资料回答。",
            },
        ],
        "temperature": 0.2,
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
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload["choices"][0]["message"]["content"].strip()
    except (KeyError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return fallback_answer + "\n\n（AI 润色服务暂时不可用，已返回本地 RAG 答案。）"


def _call_gemini(config: dict[str, str], question: str, context: str, fallback_answer: str) -> str:
    model = config["model"] or "gemini-2.5-flash"
    base = (config["base_url"] or "https://generativelanguage.googleapis.com/v1beta/models").rstrip("/")
    url = f"{base}/{model}:generateContent?key={config['api_key']}"
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"问题：{question}\n\n检索资料：\n{context}\n\n请基于资料回答。"}],
            }
        ],
        "generationConfig": {"temperature": 0.2},
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return fallback_answer + "\n\n（Gemini 润色服务暂时不可用，已返回本地 RAG 答案。）"
