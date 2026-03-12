"""
Post-call: saves transcript to file and creates a draft case in MilenaCRM
via the internal /asterisk/voice-bot/create-case endpoint.

A case is created if the caller answered at least MIN_USER_RESPONSES questions.
"""
import logging
import os
import httpx
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("milena-bot.crm")

CRM_API_URL = os.getenv("CRM_API_URL", "http://backend:8000")
TRANSCRIPTS_DIR = Path("/recordings/transcripts")
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

# Minimum user responses required to create a case (Q1=name, Q2=phone)
MIN_USER_RESPONSES = 2


def format_transcript(items: list[dict]) -> str:
    lines = []
    for item in items:
        role = "Питання" if item["role"] == "assistant" else "Відповідь"
        text = item.get("text", "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


def count_user_responses(items: list[dict]) -> int:
    return sum(1 for x in items if x["role"] == "user" and x.get("text", "").strip())


def save_transcript(call_id: str, items: list[dict]) -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = TRANSCRIPTS_DIR / f"call_{call_id}_{ts}.txt"
    path.write_text(format_transcript(items), encoding="utf-8")
    logger.info(f"Transcript saved: {path}")
    return path


async def create_draft_case(
    call_id: str,
    items: list[dict],
    caller_phone: str | None = None,
) -> None:
    user_count = count_user_responses(items)
    if user_count < MIN_USER_RESPONSES:
        logger.warning(
            f"[{call_id}] Only {user_count} user response(s), need {MIN_USER_RESPONSES} — skipping"
        )
        return

    transcript = format_transcript(items)

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(
                f"{CRM_API_URL}/asterisk/voice-bot/create-case",
                json={"transcript": transcript, "caller_phone": caller_phone},
            )
            resp.raise_for_status()
            result = resp.json()
            logger.info(f"[{call_id}] Case created: #{result.get('case_id')} ({user_count} user responses)")
        except Exception as e:
            logger.error(f"[{call_id}] Failed to create case: {e}")
