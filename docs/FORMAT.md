# Format bazy treningów

Treningi są w pliku [`data/workouts.json`](../data/workouts.json), a ruchy w [`data/movements.json`](../data/movements.json).
Po każdej zmianie: `python3 tools/validate.py`.

Treningi z płatnych programów trzymamy w `data/workouts-private.json` (ten sam format). Plik jest w `.gitignore`, więc nie trafia do publicznego repozytorium. Aplikacja wczytuje go, jeśli istnieje.

## Trening

```json
{
  "id": "cf-2026-0001",
  "name": "Nazwa treningu",
  "source": "skąd pochodzi, np. nazwa pliku",
  "style": "crossfit | hyrox | hybrid",
  "format": "amrap | emom | for_time | chipper | intervals | strength",
  "duration_min": 20,
  "level": 2,
  "focus": ["engine", "legs"],
  "equipment": ["rower", "kettlebell"],
  "description": "Krótki opis / cel bodźca",
  "parts": [
    {
      "title": "AMRAP 20 min",
      "format": "amrap",
      "minutes": 20,
      "rounds": 5,
      "scheme": "21-15-9",
      "notes": "dodatkowe wskazówki",
      "items": [
        { "mv": "row", "cal": "15/12" },
        { "mv": "kb_swing", "reps": 20, "load": "24/16 kg" },
        { "mv": "run", "m": 400 },
        { "text": "Ruch spoza biblioteki", "reps": 10 }
      ]
    }
  ],
  "scaling": "jak skalować",
  "tags": ["pary", "bez sprzętu"]
}
```

| Pole | Znaczenie |
|---|---|
| `level` | 1 = początkujący, 2 = średni, 3 = zaawansowany |
| `focus` | `full` całe ciało, `engine` kondycja, `strength` siła, `gymnastics` gimnastyka, `legs` nogi, `upper` góra |
| `equipment` | sprzęt **wymagany** – trening pokaże się tylko, gdy użytkownik go ma (lista w `movements.json`) |
| `items` | `mv` = id ruchu z biblioteki; ilość jako `reps`, `cal`, `m` albo `sec`; `load` = obciążenie M/K |
| `equipment` z `\|` | zamienniki, np. `"rower\|skierg\|bike"` = wystarczy jedna z maszyn |
| `parts[].kind` | `warmup`, `strength`, `gymnastics`, `wod`, `accessory`, `comp` (Comp+ dla zaawansowanych) |
| `items[].h` | śródtytuł w części, np. `{"h": "Min 0–12"}` |
| `rounds`, `scheme`, `notes` | opcjonalne |

Ruch spoza biblioteki można wpisać przez `text`, ale lepiej dodać go do `movements.json` – wtedy generator też może go używać.
