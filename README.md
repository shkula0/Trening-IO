# Trening IO

Aplikacja na telefon (PWA) do dobierania i generowania treningów w stylu **CrossFit**, **Hyrox** i hybrydowym.

- **Dobierz**: wybierasz styl, format (AMRAP, EMOM, For Time, Chipper, Interwały, Siła + metcon), czas, poziom, fokus i dostępny sprzęt. Dostajesz:
  - **nowy trening** złożony przez generator z biblioteki ruchów (liczby powtórzeń, obciążenia M/K i dystanse dopasowane do poziomu i czasu; brakujący sprzęt zastępowany innym, np. SkiErg → wiosło, sanie → wykroki),
  - **treningi z Twojej bazy** posortowane według dopasowania.
- **Baza**: wszystkie treningi z wyszukiwarką.
- **Zapisane**: ulubione treningi (zapisane w telefonie).
- **Udostępnij**: trening jako tekst do wysłania podopiecznemu (WhatsApp, Messenger…).
- Działa bez internetu i instaluje się z przeglądarki na ekranie głównym telefonu.

## Jak rośnie baza treningów

1. Wysyłasz Claude'owi pliki z treningami (PDF, zdjęcia tablicy, Excel, tekst).
2. Claude przepisuje je do [`data/workouts.json`](data/workouts.json) w formacie z [`docs/FORMAT.md`](docs/FORMAT.md): styl, format, czas, poziom, fokus, sprzęt. Nowe ruchy trafiają do [`data/movements.json`](data/movements.json), więc generator też zaczyna ich używać.
3. `python3 tools/validate.py` sprawdza poprawność bazy.

Wpisy oznaczone `"source": "przykład startowy"` to przykłady, które można usunąć, gdy pojawią się Twoje treningi.

## Uruchomienie

```bash
python3 -m http.server 8000
# otwórz http://localhost:8000
```

Publikacja: GitHub → Settings → Pages → Deploy from branch → `main` / root. Aplikacja będzie pod `https://<login>.github.io/Trening-IO/`. Na telefonie: otwórz adres → „Dodaj do ekranu głównego”.

Po zmianie plików JS/CSS podbij wersję `CACHE` w [`sw.js`](sw.js). Zmiany w `data/*.json` docierają bez tego.
