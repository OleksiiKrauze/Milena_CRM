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
    existing_trunks = await lk.sip.list_sip_inbound_trunk(api.ListSIPInboundTrunkRequest())
    if existing_trunks.items:
        trunk_id = existing_trunks.items[0].sip_trunk_id
        print(f"✅ Inbound trunk already exists: {trunk_id}")
    else:
        trunk = await lk.sip.create_sip_inbound_trunk(
            api.CreateSIPInboundTrunkRequest(
                trunk=api.SIPInboundTrunkInfo(
                    name="FreePBX Trunk",
                    allowed_addresses=[FREEPBX_IP] if FREEPBX_IP else [],
                )
            )
        )
        trunk_id = trunk.sip_trunk_id
        print(f"✅ Inbound trunk created: {trunk_id}")

    # ── 2. Dispatch rule ─────────────────────────────────────────────────────
    existing_rules = await lk.sip.list_sip_dispatch_rule(api.ListSIPDispatchRuleRequest())
    if existing_rules.items:
        rule_id = existing_rules.items[0].sip_dispatch_rule_id
        print(f"✅ Dispatch rule already exists: {rule_id}")
    else:
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
        rule_id = rule.sip_dispatch_rule_id
        print(f"✅ Dispatch rule created: {rule_id}")

    print()
    print("Done! Now configure FreePBX SIP trunk:")
    print(f"  SIP Server: <your-aws-ip>:5060")
    print(f"  Transport: UDP")
    print(f"  No authentication needed (IP whitelist)")


if __name__ == "__main__":
    asyncio.run(setup())
