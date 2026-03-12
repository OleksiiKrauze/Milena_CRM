"""
MilenaCRM Voice Bot — LiveKit Agent with OpenAI Realtime API.

Flow:
  FreePBX IVR (option 2)
    → SIP trunk → LiveKit SIP service
    → LiveKit room
    → this agent joins, uses OpenAI Realtime API
    → on call end: saves transcript, creates CRM draft case
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime

import httpx
from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins.openai import realtime

from questions import SYSTEM_PROMPT
from crm import create_draft_case, save_transcript

CRM_API_URL = os.getenv("CRM_API_URL", "http://backend:8000")


async def fetch_prompt() -> str:
    """Fetch system prompt from CRM settings. Falls back to default if unavailable."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{CRM_API_URL}/asterisk/bot-prompt")
            if resp.status_code == 200:
                data = resp.json()
                return data.get("prompt") or SYSTEM_PROMPT
    except Exception as e:
        logger.warning(f"Could not fetch bot prompt from CRM: {e}, using default")
    return SYSTEM_PROMPT

logger = logging.getLogger("milena-bot")
logging.basicConfig(level=logging.INFO)


def prewarm(proc: JobProcess):
    """Called once on worker start — preload heavy resources here."""
    pass


async def entrypoint(ctx: JobContext):
    call_id = str(uuid.uuid4())[:8]
    logger.info(f"[{call_id}] New call: room={ctx.room.name}")

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Wait for the SIP participant (the caller)
    participant = await ctx.wait_for_participant()
    # LiveKit SIP sets sip.phoneNumber attribute with the caller's CallerID
    caller_phone: str | None = (participant.attributes or {}).get("sip.phoneNumber") or None
    logger.info(f"[{call_id}] Caller joined: {participant.identity}, phone: {caller_phone}")

    # Conversation transcript accumulator
    transcript: list[dict] = []

    # ── Fetch prompt from CRM settings ───────────────────────────────────────
    prompt = await fetch_prompt()
    logger.info(f"[{call_id}] Using prompt ({len(prompt)} chars)")

    # ── OpenAI Realtime model ────────────────────────────────────────────────
    model = realtime.RealtimeModel(
        instructions=prompt,
        voice="alloy",          # alloy | echo | fable | onyx | nova | shimmer
        temperature=0.7,
        modalities=["text", "audio"],
    )

    # ── Agent ────────────────────────────────────────────────────────────────
    agent = MultimodalAgent(model=model)
    agent.start(ctx.room, participant)

    # Trigger the opening greeting
    session = model.sessions[0]
    session.response.create()

    # ── Transcript collection ─────────────────────────────────────────────────
    @session.on("response_done")
    def on_response_done(response):
        """Capture bot's text output."""
        output_items = response.output if hasattr(response, "output") else (response.get("output") or [])
        for output in output_items:
            # Support both object and dict format depending on SDK version
            out_type = output.get("type") if isinstance(output, dict) else getattr(output, "type", None)
            out_role = output.get("role") if isinstance(output, dict) else getattr(output, "role", None)
            if out_type == "message" and out_role == "assistant":
                content_items = output.get("content") if isinstance(output, dict) else getattr(output, "content", [])
                for content in (content_items or []):
                    text = content.get("transcript") if isinstance(content, dict) else getattr(content, "transcript", None)
                    if text:
                        transcript.append({
                            "role": "assistant",
                            "text": text,
                            "ts": datetime.now().isoformat(),
                        })
                        logger.info(f"[{call_id}] Bot: {text[:60]}...")

    @session.on("input_speech_transcription_completed")
    def on_user_speech(event):
        """Capture caller's speech transcription."""
        text = event.transcript
        if text and text.strip():
            transcript.append({
                "role": "user",
                "text": text,
                "ts": datetime.now().isoformat(),
            })
            logger.info(f"[{call_id}] User: {text[:60]}...")

    # ── Wait for call to end ──────────────────────────────────────────────────
    disconnect_event = asyncio.Event()

    @ctx.room.on("participant_disconnected")
    def on_disconnect(p: rtc.RemoteParticipant):
        if p.identity == participant.identity:
            logger.info(f"[{call_id}] Caller disconnected")
            disconnect_event.set()

    # Timeout: 15 minutes max
    try:
        await asyncio.wait_for(disconnect_event.wait(), timeout=900)
    except asyncio.TimeoutError:
        logger.warning(f"[{call_id}] Call timeout (15 min)")

    # ── Post-call processing ──────────────────────────────────────────────────
    logger.info(f"[{call_id}] Call ended. Transcript items: {len(transcript)}")

    if transcript:
        save_transcript(call_id, transcript)
        await create_draft_case(call_id, transcript, caller_phone=caller_phone)
    else:
        logger.warning(f"[{call_id}] Empty transcript, skipping")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
