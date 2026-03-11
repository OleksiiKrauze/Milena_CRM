"""
Post-call: saves transcript to file and creates a draft case in MilenaCRM
via the autofill endpoint (GPT extracts fields from the conversation text).
"""
import logging
import os
import httpx
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("milena-bot.crm")

CRM_API_URL = os.getenv("CRM_API_URL", "http://backend:8000")
CRM_API_KEY = os.getenv("CRM_API_KEY", "")
TRANSCRIPTS_DIR = Path("/recordings/transcripts")
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


def format_transcript(items: list[dict]) -> str:
    """Format conversation items as readable dialogue."""
    lines = []
    for item in items:
        role = "Бот" if item["role"] == "assistant" else "Заявник"
        text = item.get("text", "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


def save_transcript(call_id: str, items: list[dict]) -> Path:
    """Save transcript to a text file, return path."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = TRANSCRIPTS_DIR / f"call_{call_id}_{ts}.txt"
    text = format_transcript(items)
    path.write_text(text, encoding="utf-8")
    logger.info(f"Transcript saved: {path}")
    return path


async def create_draft_case(call_id: str, items: list[dict]) -> None:
    """
    Send the conversation to MilenaCRM.
    Uses POST /api/cases/autofill to extract fields via GPT,
    then POST /api/cases to create the draft case.
    """
    transcript = format_transcript(items)
    # Extract only user answers as initial_info for autofill
    user_answers = "\n".join(
        item["text"] for item in items
        if item["role"] == "user" and item.get("text", "").strip()
    )

    if not user_answers:
        logger.warning(f"No user answers for call {call_id}, skipping case creation")
        return

    headers = {"X-API-Key": CRM_API_KEY} if CRM_API_KEY else {}

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            # Step 1: autofill — extract structured fields from raw text
            resp = await client.post(
                f"{CRM_API_URL}/api/cases/autofill",
                json={"initial_info": user_answers},
                headers=headers,
            )
            resp.raise_for_status()
            autofill_data: dict = resp.json()

            # Step 2: create the case with autofill data + full transcript
            case_payload = {
                **autofill_data,
                "initial_info": user_answers,
                "call_transcript": transcript,
                "basis": "Дзвінок на гарячу лінію (голосовий бот)",
                # Fallback names if autofill didn't extract them
                "applicant_last_name": autofill_data.get("applicant_last_name") or "Невідомо",
                "applicant_first_name": autofill_data.get("applicant_first_name") or "—",
                "missing_last_name": autofill_data.get("missing_last_name") or "Невідомо",
                "missing_first_name": autofill_data.get("missing_first_name") or "—",
            }

            resp2 = await client.post(
                f"{CRM_API_URL}/api/cases/",
                json=case_payload,
                headers=headers,
            )
            resp2.raise_for_status()
            case = resp2.json()
            logger.info(f"Case created: #{case['id']} for call {call_id}")

        except Exception as e:
            logger.error(f"Failed to create case for call {call_id}: {e}")
