# StuffTracker

Bestand und Transporte von Kleidung sowie wenigen Haushalts- und Büroartikeln an bis zu fünf Orten.
Progressive Web App (PWA): läuft offline, ist auf Android installierbar und aktualisiert sich über GitHub Pages.
Optik: New-York-Subway-Beschilderung (schwarzes Schild, Helvetica-artige Schrift, Linien-Kreise, abgenutzte Pfeile).

## Funktionen

- **Orte:** 3 voreingestellt, 2 bis 5 möglich. Das Symbol zeigt den Anfangsbuchstaben in passender Linienfarbe.
  Lange drücken ändert Zeichen, Farbe und Form.
- **Artikel in Gruppen** (zwei Ebenen), Foto als kleines Vorschaubild (Kamera oder Galerie).
- **Tags** als Etiketten zum Antippen. Ein Tag zählt **Stückzahlen**: Langarmshirt in „Wohnung“, Bestand 4, davon
  3 sauber und 1 schmutzig – der Artikel steht nur einmal in der Liste. Höchstens 6 verschiedene Tags je Artikel und Ort.
  Standard: sauber (glänzend), schmutzig (ockerfarbenes Pflegeetikett), verloren (indigo), beschädigt (grau). Weitere Tags über „+“.
  In der Bestandsliste zeigen kleine Kreise je Ort nur die dort aktiven Tags mit ihrer Stückzahl (der Kreis wächst mit der
  Stellenzahl); Stücke ohne Tag zeigt ein transparenter Kreis mit dünnem Rand.
  **Die Gesamtmenge ist der Master:** Die Tag-Mengen ergeben nie mehr als die Gesamtmenge, Tag-Änderungen lassen sie unverändert.
  **Tag-Verknüpfungen** (Mehr → Tag-Verknüpfungen, Standard: sauber ⇄ schmutzig): Erhöht man „schmutzig“ um 1, sinkt „sauber“
  um 1 und umgekehrt. Andere Tags nehmen zuerst Stücke ohne Tag, dann vom größten anderen Tag.
  Die Reihenfolge der Verknüpfungen ist die Priorität (mit Pfeilen änderbar): Kommt ein Tag in mehreren Verknüpfungen vor,
  wirken die späteren überwiegend nur in eine Richtung.
- **Startseite** (von oben): Ort-Buttons, Suche über alle Daten (Artikel, Gruppen, Tags, Orte, Kisten), Kopf mit Datum, Datum der
  letzten Änderung und Ortsname, Hinweis zur Datensicherung (nach mehr als 9 Tagen), Kacheln *Stück gesamt · Artikelarten · Gruppen ·
  Warnungen* (Linie in der Ortsfarbe; Artikelarten und Gruppen springen in die Bestandsliste) mit Schnellaktionen (neuer Artikel,
  neue Kiste), Warnungen, Kisten unterwegs/in Vorbereitung, Tag-Übersicht des Ortes, danach das **Wetter** (aktuell, nächste
  3 Stunden, morgen, Sonnenauf-/untergang, Zeitpunkt der Abfrage) und die Widget-Karte.
- **Update-Meldungen:** „Neue Version verfügbar“ und nach der Installation „Update abgeschlossen. Sie arbeiten jetzt in Version x.“
- **Wetter:** DWD über [Bright Sky](https://brightsky.dev); außerhalb Deutschlands automatisch MET Norway (api.met.no).
  Der Standort eines Ortes wird unter *Mehr → Orte → Ort bearbeiten → Standort & Wetter einstellen* per Adresse, Ort,
  Koordinaten oder GPS festgelegt; dort wählt man auch eine Wetterstation (Auswahlliste). Abschalten: *Mehr → Wetter*.
  Zwischenspeicher: höchstens alle 15 Minuten neu, offline wird der letzte Stand gezeigt.
- **Bestand:** Die Suche gilt im aktiven Ort (in „Alle“ über alle Orte). Oben zeigt eine große Anzeige den aktiven Ort (Ortsfarbe als Streifen), die Buchstaben-Kacheln der Artikel
  haben die Farbe des Ortes (in „Alle“ ein dunkles Grau). Der Balken an den Gruppen ist Subway-Grün und wechselt automatisch
  auf eine freie Farbe, sobald ein Ort Grün verwendet.
- **Menge** je Ort per Stepper (− / + / Zahl antippen für Zahlenfeld, gedrückt halten für Wiederholung).
- **Transporte = Kisten:** Artikel direkt vom Artikel oder aus dem Transport-Bereich in eine Kiste legen →
  abschicken (danach gesperrt, Bestand am Start sinkt) → Ankunft bestätigen (Bestand am Ziel steigt, Tags werden übernommen).
  Mehrere Kisten gleichzeitig in alle Richtungen, mit Startdatum. Abbrechen bucht zurück.
- **Aussondern** (defekt / entsorgt / verschlissen) mit Protokoll, **Mindestbestand** je Artikel und Ort mit Warnung,
  optional nur für Stücke mit einem Tag (z. B. mindestens 3 *saubere*; der Gesamtbestand darf höher sein).
- **Start-Dashboard:** In den Einstellungen wählen: automatisch der Ort, an dem sich das Handy befindet (Standort,
  400 m Radius), oder ein fester Ort. Die Ort-Buttons auf der Startseite zeigen standardmäßig das Dashboard des Ortes;
  optional führen sie direkt zur Bestandsliste, dann erscheint oben rechts „Ort wechseln“.
- Suche über Artikel, Gruppe, Tag und Ort. Sprache Deutsch/Englisch. Darstellung: Tageszeit (Sonnenstand), System, Dunkel, Hell.
- Export/Import (JSON-Sicherung inkl. Fotos, CSV), Beispieldaten separat löschbar, Protokoll.

## Lokal starten

```bash
node tools/serve.mjs
```

Dann <http://localhost:5173/> öffnen. Keine Abhängigkeiten, kein Build-Schritt.

## Veröffentlichen (GitHub Pages)

1. Repository auf GitHub anlegen (für Pages im kostenlosen Tarif **öffentlich**) und diesen Ordner hochladen.
2. *Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`*.
3. Die App liegt dann unter `https://<benutzer>.github.io/<repository>/`.

## Auf Android installieren

1. Die Adresse in **Chrome** öffnen.
2. Menü ⋮ → **App installieren** (oder „Zum Startbildschirm hinzufügen“). In *Mehr* gibt es zusätzlich den Button „App installieren“.
3. Beim ersten Start fragt die App nach dem Standort (nur für Ortserkennung und Sonnenstand; kann abgelehnt werden).

## Updates ausliefern

1. Änderungen machen, dann `node tools/bump.mjs` (erhöht die Version in `sw.js` und `js/store.js`).
2. Committen und pushen. GitHub Pages veröffentlicht automatisch.
3. Auf dem Handy erscheint beim nächsten Öffnen oben „Neue Version verfügbar → Aktualisieren“
   (oder *Mehr → Nach Update suchen*). Daten bleiben erhalten (liegen lokal in IndexedDB).

> Ohne Versionserhöhung bleibt der alte Cache aktiv und das Handy bekommt keine neuen Dateien.

## Aufbau

```
index.html            Einstieg, SVG-Filter für abgenutzte Pfeile
css/app.css           Design (Schilder, Badges, Etiketten, Sheets)
js/store.js           Datenmodell, Persistenz (IndexedDB), alle Bestands-/Transportregeln
js/ui.js              Icons, Badge, Tag, Stepper, Sheets (mit Android-Zurück-Taste), Dialoge
js/i18n.js            Texte de/en
js/views/*.js         Start, Bestand, Artikel-Sheets, Transporte, Einstellungen
js/sun.js, photo.js   Sonnenauf-/untergang, Vorschaubild
sw.js, manifest.webmanifest, icons/
```

## Festlegungen im ersten Entwurf

- Tags gehören zum **Artikel am Ort** und tragen eine Stückzahl (höchstens der Bestand). Stücke ohne Tag sind erlaubt.
- Beim Einlegen in eine Kiste legt man fest, wie viele der Stücke welches Tag tragen (Vorgabe: der Reihe nach auffüllen).
  Am Ziel werden die Anzahlen zu den vorhandenen addiert (maximal 6 verschiedene Tags, darüber hinaus gehen Stücke ohne Tag ein).
- Eine Kiste in Vorbereitung **reserviert** Stück und Tag-Anzahlen (der Bestand sinkt erst beim Abschicken).
- Orte lassen sich nur löschen, wenn sie keinen Bestand und keine offenen Transporte haben.

## Geplant

- Synchronisation über einen Docker-Container (Backend, Konten).
- Echte Android-Homescreen-Widgets (klein/groß). Das geht nicht als PWA, sondern braucht einen nativen Rahmen
  (z. B. Capacitor oder Kotlin). In der App gibt es als Vorstufe die konfigurierbare Widget-Karte auf der Startseite.
