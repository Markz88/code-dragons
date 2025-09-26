
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import json
from pathlib import Path
from sandbox import run_safely
from collections import OrderedDict, Counter
import re

BASE = Path(__file__).parent
LEVELS = json.loads((BASE / "levels.json").read_text(encoding="utf-8"))
ACH = json.loads((BASE / "achievements.json").read_text(encoding="utf-8"))
CHARACTERS = {"characters":[{"name":"Ada"}], "fallback_lines":["Rivedi i requisiti e riprova!"]}

DEFAULT_BASE_XP = 10

app = FastAPI(title="Code & Dragons", version=LEVELS["meta"]["version"])
app.mount("/static", StaticFiles(directory=str(BASE.parent / "frontend")), name="static")

class SubmitPayload(BaseModel):
    level_id: str
    code: str
    player_role: str | None = None
    player_name: str | None = None
    # consumabili rimossi
    items_used: list[str] | None = None

# Side quests rimosse

@app.get("/api/meta")
def meta():
    return LEVELS["meta"]

@app.get("/api/levels")
def list_levels(role: str | None = Query(default=None)):
    # Usa l'ordine base e genera ID virtuali per-ruolo (lid__role)
    ordered = LEVELS["meta"]["order"]
    data = []
    for base_id in ordered:
        base = LEVELS["levels"][base_id]
        name = base.get("name")
        if role and isinstance(name, dict):
            name = name.get(role)
        prompt = base.get("prompt")
        if role and isinstance(prompt, dict):
            prompt = prompt.get(role)
        next_intro = base.get("next_intro")
        if role and isinstance(next_intro, dict):
            next_intro = next_intro.get(role)
        vid = f"{base_id}__{role}" if role else base_id
        data.append({
            "id": vid,
            "name": name,
            "prompt": prompt,
            "next_intro": next_intro,
            "signature": base["signature"]
        })
    return data


@app.get("/api/sidequests")
def list_sidequests(player_level: int = Query(default=1), role: str | None = Query(default=None)):
    quests = LEVELS["meta"].get("sidequests", [])
    entries = []
    for item in quests:
        lid = item.get("id")
        if not lid or lid not in LEVELS["levels"]:
            continue
        base = LEVELS["levels"][lid]
        name = base.get("name")
        prompt = base.get("prompt")
        next_intro = base.get("next_intro")
        if role and isinstance(name, dict):
            name = name.get(role)
        if role and isinstance(prompt, dict):
            prompt = prompt.get(role)
        if role and isinstance(next_intro, dict):
            next_intro = next_intro.get(role)
        entries.append({
            "id": lid,
            "name": name,
            "prompt": prompt,
            "next_intro": next_intro,
            "signature": base["signature"],
            "unlock_level": int(item.get("unlock_level", 1))
        })
    return entries

@app.get("/api/roles")
def roles():
    return {
        "roles": ACH["roles"],
        "labels": ACH.get("role_labels", {})
    }

@app.get("/api/intro/{role}")
def intro(role: str):
    return {"intro": ACH["role_intro"].get(role, "")}

## /api/sidequests rimosso

def base_xp_for(level_id: str) -> int:
    """Return base XP scaled by chapter/level ordering."""
    match = re.match(r"c(\d+)_.*_l(\d+)", level_id)
    if not match:
        side_meta = next((sq for sq in LEVELS["meta"].get("sidequests", []) if sq.get("id") == level_id), None)
        if side_meta:
            try:
                unlock = int(side_meta.get("unlock_level", 1))
            except Exception:
                unlock = 1
            return DEFAULT_BASE_XP + max(0, unlock - 1)
        return DEFAULT_BASE_XP
    chapter_idx = int(match.group(1)) if match.group(1) else 1
    stage_idx = int(match.group(2)) if match.group(2) else 1
    if chapter_idx < 1:
        chapter_idx = 1
    if stage_idx < 1:
        stage_idx = 1
    # Later chapters and higher stages grant more XP.
    return DEFAULT_BASE_XP + (chapter_idx - 1) * 2 + (stage_idx - 1)

def narration_for(role: str, level_id: str) -> str:
    return ACH.get("narration_by_level", {}).get(level_id, {}).get(role, "")

## narration_variant rimosso (varianti non utilizzate)

def extra_hint_for(level_id: str) -> str | None:
    # pick first generic extra hint (hint with empty 'if')
    hints = LEVELS["levels"][level_id].get("hints", [])
    for h in hints:
        if h.get("if", "") == "":
            return h.get("say")
    return None

@app.post("/api/submit")
def submit(payload: SubmitPayload):
    lid = payload.level_id
    role_for_tests = payload.player_role
    used_items = set(payload.items_used or [])
    # supporta ID virtuali "base__role"
    if "__" in lid:
        base_id, role_suffix = lid.split("__", 1)
        lid = base_id
        role_for_tests = role_suffix or role_for_tests
    if lid not in LEVELS["levels"]:
        raise HTTPException(404, "Livello non trovato")
    tests_spec = LEVELS["levels"][lid]["tests"]
    if isinstance(tests_spec, dict):
        # Elimina test differenziati per ruolo: usa solo i default
        role_tests = tests_spec.get("default") or []
        tests = [t["code"] for t in role_tests]
    else:
        tests = [t["code"] for t in tests_spec]
    signature = LEVELS["levels"][lid].get("signature", "")
    signature_trim = signature.strip() if isinstance(signature, str) else ""
    code_trim = (payload.code or "").strip()
    is_stub = code_trim == signature_trim

    result = run_safely(payload.code, tests, timeout_sec=4)

    hints = LEVELS["levels"][lid].get("hints", [])

    def match_hint(err: str):
        for h in hints:
            if h["if"] and h["if"] in err:
                return h["say"]
        return None

    passed = result.get("ok", False) and len(result.get("failures", [])) == 0 and not is_stub

    raw = []
    if is_stub:
        raw.append("Completa la funzione sostituendo '...' con la logica richiesta prima di rieseguire i test.")
    elif not result.get("ok", False):
        if result.get("timeout"):
            raw.append("Esecuzione troppo lenta o loop infinito? Prova ad ottimizzare.")
        if err := result.get("error"):
            raw.append(err)
    else:
        for idx, fail in enumerate(result["failures"], start=1):
            err = fail["error"]
            hint = match_hint(err)
            raw.append(hint or f"Test {idx} fallito: {err}")

    extra_hint_granted = None
    if not passed and 'hint_token' in used_items:
        extra_hint_granted = extra_hint_for(lid)

    counts = Counter(raw)
    unique = list(OrderedDict((m, None) for m in raw).keys())
    feedback_list = [
        (f"{m} (ripetuto {counts[m]}x)" if counts[m] > 1 else m)
        for m in unique
    ]

    achievement = None
    xp_gained = 0
    narration = ""
    next_intro = None

    if payload.player_role:
        narration = narration_for(payload.player_role, lid) or ""

    # consumabili rimossi

    if passed:
        if payload.player_role:
            pools = [ACH.get("by_chapter", {}), ACH.get("sidequests", {})]
            achievement = None
            for pool in pools:
                by_role = pool.get(lid, {}) if isinstance(pool, dict) else {}
                if by_role:
                    achievement = by_role.get(payload.player_role)
                    if achievement:
                        break
            xp_gained = base_xp_for(lid)
            ni = LEVELS["levels"][lid].get("next_intro")
            if isinstance(ni, dict):
                next_intro = ni.get(payload.player_role)
            else:
                next_intro = ni
            # chapter completion celebration message
            msg = ACH.get("chapter_completion_msg", {}).get(lid, {}).get(payload.player_role)
            if msg:
                narration = (narration + (" " if narration else "") + msg).strip()
        else:
            xp_gained = base_xp_for(lid)

    persona = CHARACTERS["characters"][0]
    line = f"{persona['name']}: " + (
        "Ottimo lavoro! Hai superato il livello."
        if passed
        else (" ".join(feedback_list) if feedback_list else CHARACTERS["fallback_lines"][0])
    )
    reveal_details = []
    if not passed:
        reveal_item = None
        if 'reveal_suite' in used_items:
            reveal_item = 'reveal_suite'
        elif 'reveal_test' in used_items:
            reveal_item = 'reveal_test'

        if reveal_item:
            raw_tests = tests_spec if isinstance(tests_spec, list) else tests_spec.get("default", [])
            limit = None if reveal_item == 'reveal_suite' else 3
            for idx, t in enumerate(raw_tests):
                if limit is not None and idx >= limit:
                    break
                code = t.get("code") if isinstance(t, dict) else str(t)
                if code:
                    reveal_details.append(code)


    return {
        "passed": passed,
        "feedback": line,
        "feedback_list": feedback_list,
        "details": result,
        "achievement": achievement,
        "xp_gained": xp_gained,
        "narration": narration,
        "next_intro": next_intro,
        "reveal_details": reveal_details,
        "extra_hint": extra_hint_granted,
        "is_stub": is_stub
    }

## /api/submit_sidequest rimosso

@app.get("/")
def index():
    return FileResponse(str(BASE.parent / "frontend" / "index.html"))
