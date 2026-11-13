# Lichterkinder-Show 🎆

Weihnachtliche Feuerwerks-Show zum Mitsingen für Krippe, Hort und Jugendgruppe – passend zum Lied
„Lichterkinder (Singen zur Weihnacht)“. Läuft im Browser auf dem Laptop, spielt das Lied selbst über
Spotify ab und bleibt dadurch automatisch synchron.

**Adresse:** https://vanmeegen.github.io/lichterkinder-show/

## Einmalig einrichten (ca. 10 Minuten)

Benötigt wird **Spotify Premium** und ein Desktop-Browser (Chrome, Edge oder Firefox).

1. Mit dem Spotify-Konto, das später abspielt, auf <https://developer.spotify.com/dashboard> anmelden
   und **„Create app“** wählen.
   - App name: `Lichterkinder-Show`, Beschreibung beliebig
   - **Redirect URI:** `https://vanmeegen.github.io/lichterkinder-show/` (genau so, mit Schrägstrich am Ende)
   - Bei „Which API/SDKs are you planning to use?“ **Web API** und **Web Playback SDK** ankreuzen
2. In der App unter **Settings → User Management** die E-Mail-Adresse des Spotify-Kontos eintragen,
   falls ein anderes Konto abspielen soll als das, mit dem die App angelegt wurde.
3. Die **Client ID** kopieren (ein Client Secret wird nicht gebraucht).
4. Die Show öffnen → ⚙️ → Client-ID einfügen → **„Bei Spotify anmelden“**.

## Mitsing-Text und Effekte

Spotify gibt Liedtexte nicht über seine Schnittstelle heraus, deshalb wird der Text einmalig selbst eingegeben.
Er bleibt **nur im Browser** (und optional in einer selbst gesicherten Datei) – bitte nicht ins Repository legen.

1. **✏️ Text & Effekte → 1. Text:** Text einfügen, eine Mitsing-Zeile pro Zeile.
2. **2. Aufnehmen:** „Aufnahme von vorn starten“ und mittippen:
   - `Enter` – nächste Zeile beginnt
   - `R` Refrain (viel Feuerwerk) · `V` Strophe · `P` ganz ruhig · `Y` Rap-Teil (alle tanzen synchron, mit Sonnenbrille)
   - `H` Herz · `L` Lichter · `S` Stern · `N` Schnee · `G` Glocken
   - `M` St. Martin (ein Mantel erscheint und wird geteilt) · `F` Frieren (🥶-Emojis, Kinder zittern)
   - `K` „Lichterkinder“-Höhepunkt (Riesenfeuerwerk mit Schriftzug)
   - `T` im Takt tippen (Tempo für das Wippen der Figuren)
   - `Backspace` – letzten Eintrag zurücknehmen
3. **3. Feinschliff:** Zeiten korrigieren, Effekte ergänzen, Ablauf als Datei sichern.

Wörter wie *Herz*, *Licht*, *Stern*, *Schnee*, *Glocke*, *Mantel*/*Martin*, *frieren*/*kalt* und *Lichterkinder* im Text lösen die passenden Effekte
zusätzlich automatisch aus und leuchten beim Singen auf.

## Während der Show

- `Leertaste` Start/Pause · `F` Vollbild · `←`/`→` 5 Sekunden springen
- ⚙️ **Verzögerung:** Bei Bluetooth-Boxen kommt der Ton später an. Regler verschieben, bis Knall und Musik zusammenpassen.
- **Ohne Spotify** geht es auch: Beim ersten Start fragt die Show, wie die Musik laufen soll
  (umstellbar unter ⚙️ → Abspielquelle):
  - **Eigene Musikdatei** (mp3/m4a vom Laptop) – immer synchron, die Datei wird im Browser gemerkt.
  - **Ohne Ton** – Countdown 3-2-1, bei „Los!“ die Musik auf einem anderen Gerät starten.

## Entwicklung

```bash
bun install
bun run dev      # http://127.0.0.1:5173 (für Spotify-Login als Redirect URI eintragen)
bun run build
```

Bun · TypeScript · Three.js (WebGL, Bloom). Deployment über GitHub Actions nach GitHub Pages.
