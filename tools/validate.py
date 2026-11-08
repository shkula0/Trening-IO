#!/usr/bin/env python3
"""Sprawdza poprawność bazy treningów: python3 tools/validate.py"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLES = {"crossfit", "hyrox", "hybrid"}
FORMATS = {"amrap", "emom", "for_time", "chipper", "intervals", "strength"}
FOCUS = {"full", "engine", "strength", "gymnastics", "legs", "upper"}

mv_data = json.loads((ROOT / "data/movements.json").read_text())
wk_data = json.loads((ROOT / "data/workouts.json").read_text())
moves = {m["id"]: m for m in mv_data["movements"]}
equipment = set(mv_data["equipment"])
errors = []

for m in mv_data["movements"]:
    for e in m["eq"]:
        if e not in equipment:
            errors.append(f"ruch {m['id']}: nieznany sprzęt {e}")

ids = set()
for w in wk_data["workouts"]:
    wid = w.get("id", "?")
    def err(msg):
        errors.append(f"{wid}: {msg}")
    if wid in ids:
        err("powtórzone id")
    ids.add(wid)
    for key in ("name", "style", "format", "duration_min", "level", "focus", "equipment", "parts"):
        if key not in w:
            err(f"brak pola {key}")
    if w.get("style") not in STYLES:
        err(f"styl {w.get('style')} spoza {sorted(STYLES)}")
    if w.get("format") not in FORMATS:
        err(f"format {w.get('format')} spoza {sorted(FORMATS)}")
    if w.get("level") not in (1, 2, 3):
        err("level musi być 1, 2 albo 3")
    for f in w.get("focus", []):
        if f not in FOCUS:
            err(f"fokus {f} spoza {sorted(FOCUS)}")
    for e in w.get("equipment", []):
        if e not in equipment:
            err(f"nieznany sprzęt {e}")
    used_eq = set()
    for p in w.get("parts", []):
        for it in p.get("items", []):
            if "mv" in it:
                m = moves.get(it["mv"])
                if not m:
                    err(f"nieznany ruch {it['mv']} (dodaj do movements.json albo użyj pola text)")
                elif m["eq"] and not set(m["eq"]) & set(w.get("equipment", [])):
                    err(f"ruch {it['mv']} wymaga jednego z {m['eq']}, a nie ma go w equipment")
            elif "text" not in it:
                err("pozycja bez mv i bez text")

print(f"Ruchy: {len(moves)}, treningi: {len(wk_data['workouts'])}")
if errors:
    print("\n".join("BŁĄD " + e for e in errors))
    sys.exit(1)
print("OK")
