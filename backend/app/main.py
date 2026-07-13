from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .schemas.ask import AskRequest, AskResponse
from .services import config_service, image_service, rag_service, work_service
from .services.paths import DATA_DIR, KNOWLEDGE_DIR


app = FastAPI(title="CalliLens API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/works")
def works() -> dict[str, object]:
    return work_service.load_works_index()


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
    return rag_service.answer(payload.question, payload.work_id, payload.use_llm)


@app.get("/api/admin/llm-config")
def llm_config_status() -> dict[str, object]:
    return config_service.llm_status()


@app.post("/api/admin/llm-config")
def save_llm_config(
    provider: str = Form("openrouter"),
    api_key: str = Form(""),
    model: str = Form(""),
    base_url: str = Form(""),
) -> dict[str, object]:
    try:
        return config_service.save_llm_config(provider, api_key, model, base_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
) -> dict[str, object]:
    work_id = work_service.next_work_id()
    target = work_service.work_dir(work_id)
    target.mkdir(parents=True, exist_ok=True)

    image_path = target / "original.png"
    with image_path.open("wb") as handle:
        shutil.copyfileobj(image.file, handle)

    work = {
        "id": work_id,
        "title": title,
        "artist": artist,
        "dynasty": dynasty,
        "date": date,
        "script_type": script_type,
        "museum": museum,
        "description": description,
        "thumbnail": "thumbnail.png",
        "status": "ready",
        "source": "管理员上传",
        "source_url": source_url,
        "tags": [item.strip() for item in tags.split(",") if item.strip()],
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

    work_service.upsert_work(work)
    return {
        "work_id": work_id,
        "message": "作品已上传并加入知识库",
        "generated": report["outputs"] + ["floating_3d_data.json", "knowledge.json"],
    }


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "CalliLens API is running", "docs": "/docs"}
