"""
Run once after LiveKit + SIP service starts to configure:
  1. Inbound SIP trunk (accepts calls from FreePBX)
  2. Dispatch rule (routes incoming SIP calls to voice-bot agent)

Usage:
  python setup_sip.py

Environment:
  LIVEKIT_URL         e.g. http://localhost:7880
  LIVEKIT_API_KEY
  LIVEKIT_API_SECRET
  FREEPBX_IP          Your FreePBX server public IP (for trunk whitelist)
"""
import asyncio
import os
from livekit import api

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "http://localhost:7880")
API_KEY = os.getenv("LIVEKIT_API_KEY", "")
API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
FREEPBX_IP = os.getenv("FREEPBX_IP", "")  # e.g. "203.0.113.10"


async def setup():
    lk = api.LiveKitAPI(LIVEKIT_URL, API_KEY, API_SECRET)

    # ── 1. Inbound SIP trunk ─────────────────────────────────────────────────
    # This tells LiveKit SIP service to accept calls from FreePBX
    trunk = await lk.sip.create_sip_inbound_trunk(
        api.CreateSIPInboundTrunkRequest(
            trunk=api.SIPInboundTrunkInfo(
                name="FreePBX Trunk",
                allowed_addresses=[FREEPBX_IP] if FREEPBX_IP else [],
            )
        )
    )
    print(f"✅ Inbound trunk created: {trunk.sip_trunk_id}")

    # ── 2. Dispatch rule ─────────────────────────────────────────────────────
    rule = await lk.sip.create_sip_dispatch_rule(
        api.CreateSIPDispatchRuleRequest(
            rule=api.SIPDispatchRule(
                dispatch_rule_individual=api.SIPDispatchRuleIndividual(
                    room_prefix="milena-call-",
                ),
            ),
            metadata="voice-bot",
        )
    )
    print(f"✅ Dispatch rule created: {rule.sip_dispatch_rule_id}")
    print()
    print("Done! Now configure FreePBX SIP trunk:")
    print(f"  SIP Server: <your-aws-ip>:5060")
    print(f"  Transport: UDP")
    print(f"  No authentication needed (IP whitelist)")


if __name__ == "__main__":
    asyncio.run(setup())
