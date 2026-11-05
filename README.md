# 🚚 Frachtwerk

**Die kostenlose Speditions- und Abrechnungsplattform für Euro Truck Simulator 2 & American Truck Simulator.**

Ich wollte kein weiteres Tool mit Premium-Abo bauen, sondern eins, zu dem Firmen freiwillig wechseln: Touren werden automatisch erfasst, jede Firma rechnet nach ihrer eigenen Formel ab und das Ganze sieht gut aus.

## Features

| Bereich | Was drin ist |
|---|---|
| **Homepage** | Landingpage mit Live-Statistiken, Feature-Übersicht, Lohnzettel-Vorschau, Vergleich, FAQ und Live-Demo |
| **Konten** | Registrierung und Login, öffentliches Fahrerprofil, Level/XP, 10 Erfolge |
| **Firmen** | Gründen, öffentliches Firmenverzeichnis und Firmenprofil. Beitritt offen, per Bewerbung oder per Einladungscode |
| **Rollen** | Inhaber, Admin, Disponent, Fahrer, dazu frei wählbare Rangbezeichnungen und Firmenübertragung |
| **Touren** | Automatisch über den Client oder manuell eingereicht. Prüfung durch die Disposition (Freigeben/Ablehnen, Bußgelder, Notiz) |
| **Abrechnung** | Lohnformel pro Firma: Kilometergeld, Frachtanteil %, Schadenfrei-Bonus, Abzug pro % Schaden, Kraftstoff (Firma oder Fahrer), Tempolimit-Strafe, Mindeststrecke, Auto-Freigabe. Dazu ein Live-Lohnrechner |
| **Lohnlauf** | Monatsvorschau, CSV-Export, Abschluss mit einem Klick, druckbare Lohnzettel (PDF über Drucken) |
| **Finanzen** | Firmenkonto, Buchungsjournal, Cashflow-Diagramm, Ausgaben, Einzahlungen, Prämien |
| **Live-Karte** | Echtzeitstatus der Fahrer: Tempo, Route, Restkilometer, Tank, Schaden |
| **Ranglisten** | Fahrer und Firmen, nach 7 Tagen, Monat oder gesamt; nach km, Erlös, Lieferungen oder Tonnage |
| **Community** | Konvois/Events mit Zusagen, Firmen-News mit Anpinnen |
| **Fuhrpark** | LKW kaufen und zuweisen, der Kilometerstand läuft automatisch mit |

## Schnellstart (lokal)

Voraussetzung: **Node.js 22.13 oder neuer**. Die Datenbank ist das eingebaute SQLite von Node, es gibt also keine nativen Module und keinen extra Datenbankserver.

```bash
npm run setup      # Abhängigkeiten installieren + Web-App bauen
npm run seed       # optional: Demo-Firma "Nordlicht Logistik" (Login: demo / demo1234)
npm start          # → http://localhost:8080
```

Entwicklung mit Hot-Reload: `npm run dev:server` und `npm run dev:web` (Vite auf :5173, leitet /api weiter).

## Telemetrie-Client (für die Fahrer)

1. [Funbit ETS2 Telemetry Server](https://github.com/Funbit/ets2-telemetry-server) herunterladen, `Ets2Telemetry.exe` starten und auf **Install** klicken (funktioniert für ETS2 und ATS).
2. [Node.js](https://nodejs.org) installieren.
3. `client/frachtwerk-client.js` herunterladen (auch über die App unter *Client & Token*).
4. Starten:
   ```bash
   node frachtwerk-client.js --server https://deine-adresse.de --token fw_…
   ```
   Alternativ `frachtwerk.example.json` in `frachtwerk.json` umbenennen, Server und Token eintragen und dann einfach **`Frachtwerk-Client-starten.bat`** doppelklicken.

Der Client erkennt Auftragsstart und Ablieferung bzw. Abbruch selbst. Er misst Kilometer (Tacho), Verbrauch (ohne Tankstopps), Fracht- und LKW-Schaden sowie Höchst- und Durchschnittstempo und sendet alle 5 Sekunden Live-Daten. Bei einem Absturz wird die laufende Tour wiederhergestellt.
Mit `--demo` simuliert er eine komplette Tour, damit man die Einrichtung ohne Spiel prüfen kann.

## Kostenlos hosten

Frachtwerk ist **ein einziger Node-Prozess mit einer SQLite-Datei**. Gebraucht wird ein Rechner, der durchläuft und die Datei dauerhaft speichert.

### Option A: Eigener PC / Raspberry Pi + Cloudflare Tunnel (0 €)
```bash
npm run setup && npm start
cloudflared tunnel --url http://localhost:8080      # gibt dir sofort eine öffentliche https-Adresse
```
Für eine feste Adresse richtest du einen benannten Tunnel mit eigener Domain ein (kostenlos bei Cloudflare).

### Option B: Oracle Cloud "Always Free" VM (0 €, läuft 24/7)
VM mit Ubuntu anlegen, Docker installieren, dann:
```bash
git clone <dein-repo> frachtwerk && cd frachtwerk
docker compose up -d --build
```
Die Daten liegen in `./data`. Für HTTPS z. B. Caddy davorschalten oder ebenfalls einen Cloudflare Tunnel nutzen.

### Option C: Irgendein Docker-Host
`docker compose up -d --build` → Port 8080, Volume `/data`.

> ⚠️ Plattformen ohne dauerhaften Speicher (z. B. Render Free, Vercel) **eignen sich nicht**, weil die Datenbank bei jedem Neustart gelöscht würde.

### Umgebungsvariablen
| Variable | Standard | Bedeutung |
|---|---|---|
| `PORT` | `8080` | HTTP-Port |
| `DB_PATH` | `server/data/frachtwerk.db` | Pfad zur SQLite-Datei |
| `JWT_SECRET` | wird erzeugt und neben der DB gespeichert | Geheimnis für die Login-Tokens |

**Backup:** einfach die `.db`-Datei (und `.jwt-secret`) kopieren.

## Projektstruktur
```
server/   Express-API, SQLite-Schema, Abrechnungs-Engine (src/logic.js), Demo-Seed
web/      React + Vite + Tailwind + Framer Motion + Recharts
client/   Telemetrie-Client (eine Datei, ohne Abhängigkeiten)
```

---
Nicht mit SCS Software verbunden. Euro Truck Simulator 2 und American Truck Simulator sind Marken von SCS Software.
