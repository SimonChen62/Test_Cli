from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .schemas.ask import AskRequest, AskResponse
from .services import config_service, guide_service, image_service, llm_service, rag_service, user_service, work_service
from .services.paths import DATA_DIR, KNOWLEDGE_DIR


PROJECT_ROOT = Path(__file__).resolve().parents[2]
WEB_DIR = PROJECT_ROOT / "web"
QIVERSE_DIR = PROJECT_ROOT / "qiverse"

app = FastAPI(title="CalliLens API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")
app.mount("/web", StaticFiles(directory=str(WEB_DIR), html=True), name="web_static")
app.mount("/qiverse", StaticFiles(directory=str(QIVERSE_DIR), html=True), name="qiverse")


ADMIN_PASSWORD = "callilens-admin"


class AuthPayload(BaseModel):
    username: str
    password: str


class SessionStartPayload(BaseModel):
    work_id: str


class FirstLookPayload(BaseModel):
    work_id: str
    overall: str
    motion: str
    density: str


class ReflectionPayload(BaseModel):
    work_id: str
    annotation_id: str = "free_reflection"
    reflection_type: str = "reflection"
    content: str


def bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    prefix = "Bearer "
    if authorization.startswith(prefix):
        return authorization[len(prefix) :].strip()
    return authorization.strip() or None


def auth_error(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=401, detail=str(exc))


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/register")
def register_user(payload: AuthPayload) -> dict[str, object]:
    try:
        return user_service.register(payload.username, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/auth/login")
def login_user(payload: AuthPayload) -> dict[str, object]:
    try:
        return user_service.login(payload.username, payload.password)
    except ValueError as exc:
        raise auth_error(exc) from exc


@app.get("/api/auth/me")
def current_user(authorization: str | None = Header(None)) -> dict[str, object]:
    user = user_service.user_from_token(bearer_token(authorization))
    return {"authenticated": bool(user), "user": user}


@app.get("/api/me/records")
def current_user_records(authorization: str | None = Header(None)) -> dict[str, object]:
    try:
        return user_service.my_records(bearer_token(authorization))
    except ValueError as exc:
        raise auth_error(exc) from exc


@app.post("/api/sessions/start")
def start_user_session(
    payload: SessionStartPayload,
    authorization: str | None = Header(None),
    user_agent: str | None = Header(None),
) -> dict[str, object]:
    try:
        return user_service.start_session(bearer_token(authorization), payload.work_id, user_agent or "")
    except ValueError as exc:
        raise auth_error(exc) from exc


@app.post("/api/first-look")
def save_first_look(payload: FirstLookPayload, authorization: str | None = Header(None)) -> dict[str, object]:
    try:
        return user_service.save_first_look(
            bearer_token(authorization),
            payload.work_id,
            payload.overall,
            payload.motion,
            payload.density,
        )
    except ValueError as exc:
        raise auth_error(exc) from exc


@app.post("/api/reflections")
def save_reflection(payload: ReflectionPayload, authorization: str | None = Header(None)) -> dict[str, object]:
    try:
        return user_service.save_reflection(
            bearer_token(authorization),
            payload.work_id,
            payload.annotation_id,
            payload.reflection_type,
            payload.content,
        )
    except ValueError as exc:
        raise auth_error(exc) from exc


@app.get("/api/admin/user-records")
def admin_user_records() -> dict[str, object]:
    return user_service.admin_records()


@app.get("/api/works")
def works() -> dict[str, object]:
    index = work_service.load_works_index()
    public_works = [w for w in index.get("works", []) if w.get("group_id") is None]
    return {
        "defaultWorkId": index.get("defaultWorkId", "work_003"),
        "works": public_works
    }


@app.get("/api/works/{work_id}")
def work_detail(work_id: str) -> dict[str, object]:
    work = work_service.get_work(work_id)
    if not work:
        raise HTTPException(status_code=404, detail="作品不存在")
    return work


@app.get("/api/knowledge")
def knowledge() -> dict[str, object]:
    chunks = rag_service.load_chunks()
    return {
        "count": len(chunks),
        "chunks": [
            {
                "id": chunk.id,
                "work_id": chunk.work_id,
                "title": chunk.title,
                "source": chunk.source,
                "url": chunk.source_url,
                "tags": list(chunk.tags),
            }
            for chunk in chunks
        ],
    }


@app.post("/api/ask", response_model=AskResponse)
def ask(payload: AskRequest) -> dict[str, object]:
    ask_mode = payload.ask_mode or ("ai_rag" if payload.use_llm else "local")
    return rag_service.answer(payload.question, payload.work_id, ask_mode, config_service.llm_enabled())


@app.get("/api/admin/llm-config")
def llm_config_status() -> dict[str, object]:
    return config_service.llm_status()


@app.get("/api/admin/llm-bindings")
def llm_bindings() -> dict[str, object]:
    return config_service.list_llm_bindings()


@app.post("/api/admin/login")
def admin_login(password: str = Form(...)) -> dict[str, object]:
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="管理员口令不正确")
    return {"ok": True, "role": "admin"}


@app.post("/api/admin/llm-config")
def save_llm_config(
    provider: str = Form("doubao"),
    api_key: str = Form(""),
    model: str = Form(""),
    base_url: str = Form(""),
    enabled: bool = Form(False),
) -> dict[str, object]:
    try:
        return config_service.save_llm_config(provider, api_key, model, base_url, enabled)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/admin/llm-bindings")
def add_llm_binding(
    name: str = Form(""),
    provider: str = Form("doubao"),
    api_key: str = Form(""),
    model: str = Form(""),
    base_url: str = Form(""),
    enabled: bool = Form(True),
    activate: bool = Form(True),
) -> dict[str, object]:
    try:
        return config_service.add_llm_binding(name, provider, api_key, model, base_url, enabled, activate)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/admin/llm-bindings/{binding_id}/activate")
def activate_llm_binding(binding_id: str) -> dict[str, object]:
    try:
        return config_service.activate_llm_binding(binding_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/admin/llm-bindings/{binding_id}")
def delete_llm_binding(binding_id: str) -> dict[str, object]:
    try:
        return config_service.delete_llm_binding(binding_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/admin/test-llm")
def test_llm_config() -> dict[str, object]:
    status = config_service.llm_status()
    if not status.get("configured"):
        raise HTTPException(status_code=400, detail="尚未配置 API key。")
    if not status.get("enabled"):
        raise HTTPException(status_code=400, detail="AI 润色未启用，请先在管理员后台勾选启用。")
    answer, provider = llm_service.enhance_answer(
        "请用一句话回复：CalliLens AI 配置测试成功。",
        "资料标题：CalliLens 测试\n来源：系统自检\n正文：这是管理员后台的 AI 配置连通性测试。",
        "本地 RAG 正常，但 AI 未返回测试结果。",
    )
    return {
        "ok": "不可用" not in answer and "未返回测试结果" not in answer,
        "provider": provider,
        "answer": answer,
    }


@app.post("/api/process/{work_id}")
def process(work_id: str) -> dict[str, object]:
    target = work_service.work_dir(work_id)
    if not target.exists():
        raise HTTPException(status_code=404, detail="作品目录不存在")
    try:
        report = image_service.process_work_dir(target)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"work_id": work_id, "report": report}


@app.post("/api/admin/upload-work")
async def upload_work(
    image: UploadFile = File(...),
    title: str = Form(...),
    artist: str = Form(""),
    dynasty: str = Form(""),
    date: str = Form(""),
    script_type: str = Form(""),
    museum: str = Form(""),
    description: str = Form(""),
    background: str = Form(""),
    source_url: str = Form(""),
    tags: str = Form(""),
    quick_questions: str = Form(""),
    generate_ai_guide: bool = Form(False),
) -> dict[str, object]:
    work_id = work_service.next_work_id()
    target = work_service.work_dir(work_id)
    target.mkdir(parents=True, exist_ok=True)

    image_path = target / "original.png"
    with image_path.open("wb") as handle:
        shutil.copyfileobj(image.file, handle)

    # Parse quick questions
    qq_list = []
    if quick_questions.strip():
        normalized = quick_questions.replace("，", ",")
        qq_list = [q.strip() for q in normalized.split(",") if q.strip()]

    work = {
        "id": work_id,
        "title": title,
        "artist": artist,
        "dynasty": dynasty,
        "date": date,
        "script_type": script_type,
        "museum": museum,
        "description": description,
        "background": background,
        "thumbnail": "thumbnail.png",
        "status": "ready",
        "source": "管理员上传",
        "source_url": source_url,
        "tags": [item.strip() for item in tags.split(",") if item.strip()],
        "quick_questions": qq_list,
        "guide_status": "ai_draft" if generate_ai_guide else "none",
    }
    work_service.write_json(target / "work-info.json", work)

    knowledge = {
        "chunks": [
            {
                "id": f"{work_id}_intro",
                "work_id": work_id,
                "title": f"{title}作品说明",
                "text": description or f"{title}是管理员上传的书法作品。",
                "source": "管理员上传资料",
                "source_url": source_url,
                "tags": work["tags"],
            },
            {
                "id": f"{work_id}_background",
                "work_id": work_id,
                "title": f"{title}背景资料",
                "text": background or "管理员尚未补充背景资料。",
                "source": "管理员上传资料",
                "source_url": source_url,
                "tags": work["tags"],
            },
        ]
    }
    work_service.write_json(target / "knowledge.json", knowledge)

    try:
        report = image_service.process_work_dir(target)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"上传成功，但图像处理失败：{exc}") from exc

    generated = report["outputs"] + ["floating_3d_data.json", "knowledge.json"]
    if generate_ai_guide:
        guide_service.create_ai_guide_draft(target, work, report)
        generated.append("ai-guide-draft.json")

    work_service.upsert_work(work)
    return {
        "work_id": work_id,
        "message": "作品已上传并加入知识库",
        "generated": generated,
    }


@app.post("/api/admin/works/{work_id}")
async def update_work(
    work_id: str,
    image: UploadFile | None = File(None),
    title: str = Form(...),
    artist: str = Form(""),
    dynasty: str = Form(""),
    date: str = Form(""),
    script_type: str = Form(""),
    museum: str = Form(""),
    description: str = Form(""),
    background: str = Form(""),
    source_url: str = Form(""),
    tags: str = Form(""),
    quick_questions: str = Form(""),
    generate_ai_guide: bool = Form(False),
) -> dict[str, object]:
    import json
    target = work_service.work_dir(work_id)
    if not target.exists():
        raise HTTPException(status_code=404, detail="作品不存在")

    image_updated = False
    if image and image.filename:
        image_path = target / "original.png"
        with image_path.open("wb") as handle:
            shutil.copyfileobj(image.file, handle)
        image_updated = True

    # Parse quick questions
    qq_list = []
    if quick_questions.strip():
        normalized = quick_questions.replace("，", ",")
        qq_list = [q.strip() for q in normalized.split(",") if q.strip()]

    # Read existing work info
    existing = work_service.read_json(target / "work-info.json", {})

    work = {
        **existing,
        "id": work_id,
        "title": title,
        "artist": artist,
        "dynasty": dynasty,
        "date": date,
        "script_type": script_type,
        "museum": museum,
        "description": description,
        "background": background,
        "source_url": source_url,
        "tags": [item.strip() for item in tags.split(",") if item.strip()],
        "quick_questions": qq_list,
    }
    
    if generate_ai_guide:
        work["guide_status"] = "ai_draft"
        
    work_service.write_json(target / "work-info.json", work)

    # Re-write knowledge.json
    knowledge = {
        "chunks": [
            {
                "id": f"{work_id}_intro",
                "work_id": work_id,
                "title": f"{title}作品说明",
                "text": description or f"{title}是管理员上传的书法作品。",
                "source": "管理员上传资料",
                "source_url": source_url,
                "tags": work["tags"],
            },
            {
                "id": f"{work_id}_background",
                "work_id": work_id,
                "title": f"{title}背景资料",
                "text": background or "管理员尚未补充背景资料。",
                "source": "管理员上传资料",
                "source_url": source_url,
                "tags": work["tags"],
            },
        ]
    }
    work_service.write_json(target / "knowledge.json", knowledge)

    generated = ["work-info.json", "knowledge.json"]

    if image_updated:
        try:
            report = image_service.process_work_dir(target)
            generated += report["outputs"] + ["floating_3d_data.json"]
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"保存修改成功，但新图片 OpenCV 处理失败：{exc}") from exc
            
    if generate_ai_guide:
        report_file = target / "processing-report.json"
        report = {}
        if report_file.exists():
            try:
                report = json.loads(report_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        guide_service.create_ai_guide_draft(target, work, report)
        generated.append("ai-guide-draft.json")

    work_service.upsert_work(work)

    return {
        "work_id": work_id,
        "message": "作品已更新",
        "image_updated": image_updated,
        "generated": generated,
    }



@app.delete("/api/admin/works/{work_id}")
def delete_admin_work(work_id: str) -> dict[str, object]:
    try:
        result = work_service.delete_work(work_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "作品已删除", **result}


@app.get("/")
def root() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.get("/web/")
def web_index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
