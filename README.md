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
| **Live-Map** | Europa- (ETS2) und USA-Karte (ATS) in der Spielprojektion. Echtzeit per Server-Push: Spuren, Route zum Ziel, Tempo, Tank, Fracht. **Speditionsansicht** (nur eigene Fahrer + Offline-Liste) und **globale Ansicht**, Verfolgen-Modus, Lieferungs-Ticker, Vollbild. Öffentliche Karte unter `/map` |
| **Discord** | Login & Registrierung mit Discord, Konto verknüpfen, Discord-Avatar |
| **Bedienung** | Befehlspalette (⌘K / Strg+K), installierbar als App (PWA), komplett mobil nutzbar |
| **Ranglisten** | Fahrer und Firmen, nach 7 Tagen, Monat oder gesamt; nach km, Erlös, Lieferungen oder Tonnage |
| **Community** | Konvois/Events mit Zusagen, Firmen-News mit Anpinnen |
| **Fuhrpark** | LKW kaufen und zuweisen, der Kilometerstand läuft automatisch mit |

## Frachtwerk-App für Windows (`Frachtwerk.exe`)

Eine Datei für alle – ohne Konsolenfenster, mit eigenem Symbol:

- **Installiert sich beim ersten Doppelklick selbst** (Startmenü, Desktop, „Apps“-Liste zum Deinstallieren, Autostart). An die Taskleiste anheften: Rechtsklick → „An Taskleiste anheften“.
- **Läuft im Hintergrund** mit Symbol neben der Uhr (Status, Live-Map, Autostart, Beenden) und meldet Tourstart & Ablieferung als Windows-Benachrichtigung.
- **Öffnet Frachtwerk als eigenes App-Fenster** (Edge-App-Modus). Ein erneuter Klick auf das Symbol holt nur das Fenster nach vorn.
- **Fahrer müssen nichts eintippen:** Lädt ein Fahrer die App über *App herunterladen* auf eurer Frachtwerk-Seite, steckt die Server-Adresse schon in der Datei. Doppelklick → „Verbinden“ → fertig.
- **Spieldaten automatisch:** Der Funbit Telemetry Server wird heruntergeladen und gestartet – nur beim ersten Mal „Install“ klicken.
- **Aktualisiert sich selbst**, sobald auf dem Server eine neuere `Frachtwerk.exe` liegt.
- **Eigene Spedition auf diesem PC:** Im Startfenster „Eigene Spedition auf diesem PC starten“ – startet die komplette Plattform lokal (optional mit Demo-Daten und Live-Simulation).

**Für Betreiber:** `Frachtwerk.exe` in den Ordner `downloads/` des Servers legen (bei `Frachtwerk-Server.exe`: einfach daneben). Dann bieten die Seite *App herunterladen* und das Auto-Update sie an.

Startoptionen: `--portable` (nicht installieren), `--background` (ohne Fenster starten), `--uninstall`.
Protokoll bei Problemen: `%LOCALAPPDATA%\Frachtwerk\frachtwerk.log`.
Windows SmartScreen meldet die App evtl. als unbekannt („Weitere Informationen“ → „Trotzdem ausführen“), weil sie nicht kostenpflichtig signiert ist.

`Frachtwerk-Server.exe` ist der reine Server mit Konsolenfenster (z. B. für einen Server-PC). Startoptionen: `--demo`, `--simulate`, `--no-simulate`, `--no-browser`.

## Schnellstart (lokal)

Voraussetzung: **Node.js 22.13 oder neuer**. Die Datenbank ist das eingebaute SQLite von Node, es gibt also keine nativen Module und keinen extra Datenbankserver.

```bash
npm run setup      # Abhängigkeiten installieren + Web-App bauen
npm run seed       # optional: Demo-Firma "Nordlicht Logistik" (Login: demo / demo1234)
npm start          # → http://localhost:8080
```

Entwicklung mit Hot-Reload: `npm run dev:server` und `npm run dev:web` (Vite auf :5173, leitet /api weiter).

**Live-Map ausprobieren ohne Spiel:** `npm run simulate` lässt die Demo-Fahrer im Zeitraffer durch Europa fahren (Touren starten, Live-Daten, Ablieferungen).

## Discord-Login einrichten (optional, kostenlos)

1. Im [Discord Developer Portal](https://discord.com/developers/applications) eine Anwendung anlegen.
2. Unter **OAuth2 → Redirects** eintragen: `https://DEINE-ADRESSE/api/auth/discord/callback`
3. Server mit diesen Umgebungsvariablen starten:
   ```bash
   PUBLIC_URL=https://deine-adresse.de DISCORD_CLIENT_ID=… DISCORD_CLIENT_SECRET=… npm start
   ```
Ohne diese Variablen wird der Discord-Button einfach ausgeblendet. Ist die Discord-E-Mail bestätigt und existiert schon ein Konto damit, wird es automatisch verknüpft.

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

## Verwaltung

- **Plattform-Admin** (`/app/admin`): Der erste registrierte Benutzer ist Admin (bei Demo-Daten: `demo`). Benutzer sperren, Admins ernennen, Reset-Links erstellen, Speditionen löschen, Backups herunterladen.
- **Passwort vergessen**: Mit SMTP-Zugang (z. B. kostenlos über Brevo oder ein Gmail-App-Passwort) bekommen Fahrer den Link per Mail. Ohne Mail erstellt ein Admin den Reset-Link (1 Stunde gültig, einmalig).
- **Discord-Benachrichtigungen**: In den Firmeneinstellungen eine Webhook-URL eintragen und auswählen, was gepostet wird: Lieferungen, Lohnläufe, Bewerbungen, neue Mitglieder, Events, News.
- **Backups**: täglich automatisch nach `…/backups` (die letzten 14), zusätzlich per Knopfdruck im Admin-Bereich.

## Windows-Programme selbst bauen

```bash
npm run setup                      # Web-App bauen
cd packaging && npm ci && node build.mjs     # → dist-exe/Frachtwerk.exe, Frachtwerk-Server.exe
```
Benötigt Node 22.23.4 (muss zur eingebetteten `node.exe` passen). Auf GitHub baut `.github/workflows/release.yml` die Programme bei jedem Tag `v*` automatisch und hängt sie an das Release.

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
| `PUBLIC_URL` | aus der Anfrage abgeleitet | Öffentliche Adresse (für Discord-Redirect) |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | – | Aktiviert den Discord-Login |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | – | E-Mail-Versand für „Passwort vergessen“ |
| `BACKUP_KEEP` / `BACKUP_DIR` / `BACKUP_DISABLED` | 14 / neben der DB / – | Automatische Backups |

In der `Frachtwerk-Server.exe` stehen diese Werte in `Frachtwerk-Daten/einstellungen.env`.

**Backup:** einfach die `.db`-Datei (und `.jwt-secret`) kopieren.

## Projektstruktur
```
server/   Express-API, SQLite-Schema, Abrechnungs-Engine (src/logic.js), Demo-Seed
web/      React + Vite + Tailwind + Framer Motion + Recharts + d3 (Live-Map)
web/scripts/build-geo.mjs   erzeugt die Kartendaten (public/geo) aus Natural Earth
client/   Telemetrie-Client (eine Datei, ohne Abhängigkeiten)
```

---
Kartendaten: [Natural Earth](https://www.naturalearthdata.com) (gemeinfrei). Die Umrechnung der Spielkoordinaten nutzt die Lambert-Projektion der SCS-Spielwelt; Positionen sind auf Stadtebene genau.

Nicht mit SCS Software verbunden. Euro Truck Simulator 2 und American Truck Simulator sind Marken von SCS Software.
