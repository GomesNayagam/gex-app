import json
import re
from collections import OrderedDict

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.config import settings
from backend.services import chat as chat_service

router = APIRouter(prefix="/api", tags=["Chat"])

_MODEL_RE = re.compile(r"^[\w./:-]{1,100}$")

# In-memory session counters (resets on restart — best-effort guardrail)
_session_counts: OrderedDict[str, int] = OrderedDict()
_MAX_SESSIONS = 10_000


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    messages: list[ChatMessage]
    model: str | None = None


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _error_stream(message: str):
    yield _sse({"type": "error", "message": message})
    yield _sse({"type": "done"})


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    if not settings.openrouter_api_key:
        return StreamingResponse(
            _error_stream("OpenRouter API key not configured. Set OPENROUTER_API_KEY."),
            media_type="text/event-stream",
            status_code=503,
        )
    if not settings.flash_alpha_api_key:
        return StreamingResponse(
            _error_stream("FlashAlpha API key not configured. Set FLASH_ALPHA_API_KEY."),
            media_type="text/event-stream",
            status_code=503,
        )

    # Per-session message cap
    sid = req.session_id[:128]
    count = _session_counts.get(sid, 0)
    if count >= settings.chat_max_messages_per_session:
        return StreamingResponse(
            _error_stream(f"Session limit of {settings.chat_max_messages_per_session} messages reached. Start a new session."),
            media_type="text/event-stream",
        )
    # Evict oldest entry if dict is getting large
    if len(_session_counts) >= _MAX_SESSIONS and sid not in _session_counts:
        _session_counts.popitem(last=False)
    _session_counts[sid] = count + 1

    # Validate optional model override
    model: str | None = None
    if req.model and req.model.strip():
        candidate = req.model.strip()
        if _MODEL_RE.match(candidate):
            model = candidate

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    return StreamingResponse(
        chat_service.stream_chat(messages, model=model),
        media_type="text/event-stream",
    )
