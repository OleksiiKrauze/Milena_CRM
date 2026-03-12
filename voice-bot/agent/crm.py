"""
Post-call: saves transcript to file and creates a draft case in MilenaCRM
via the autofill endpoint (GPT extracts fields from the conversation text).

A case is created if the caller answered at least 2 questions (name + phone).
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

# Minimum number of user responses to consider the call worth saving as a case.
# Q1 = name, Q2 = phone — if both answered we have enough to create a case.
MIN_USER_RESPONSES = 2


def format_transcript(items: list[dict]) -> str:
    """Format conversation items as readable dialogue."""
    lines = []
    for item in items:
        role = "Бот" if item["role"] == "assistant" else "Заявник"
        text = item.get("text", "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


def count_user_responses(items: list[dict]) -> int:
    return sum(1 for x in items if x["role"] == "user" and x.get("text", "").strip())


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

    Only creates a case if the caller gave at least MIN_USER_RESPONSES answers.
    """
    user_count = count_user_responses(items)
    if user_count < MIN_USER_RESPONSES:
        logger.warning(
            f"[{call_id}] Only {user_count} user response(s), need {MIN_USER_RESPONSES} — skipping case creation"
        )
        return

    # Full dialogue is used both for autofill and stored as call_transcript
    transcript = format_transcript(items)

    headers = {"X-API-Key": CRM_API_KEY} if CRM_API_KEY else {}

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            # Step 1: autofill — GPT extracts structured fields from the full dialogue
            resp = await client.post(
                f"{CRM_API_URL}/api/cases/autofill",
                json={"initial_info": transcript},
                headers=headers,
            )
            resp.raise_for_status()
            autofill_data: dict = resp.json()

            # Step 2: create the case
            case_payload = {
                **autofill_data,
                # initial_info stores the full dialogue so operators can read it
                "initial_info": transcript,
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
            logger.info(f"[{call_id}] Case created: #{case['id']} ({user_count} user responses)")

        except Exception as e:
            logger.error(f"[{call_id}] Failed to create case: {e}")
