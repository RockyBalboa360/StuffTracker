# StuffTracker als Android-App – Arbeitsplan

Stand: 23.10.2026. Schätzungen mit dem Wissensstand bis etwa Mitte 2026. Die Regeln von Google ändern sich oft;
mit „prüfen“ markierte Punkte vor dem Start nachlesen.

## 1. Technische Wege

| Weg | Was es ist | Aufwand Entwicklung | Widgets | Bemerkung |
|---|---|---|---|---|
| **A: TWA** (PWABuilder oder Bubblewrap) | Die bestehende PWA in einer Hülle. Im Play Store eine App, technisch kein nativer Code. | 1–2 Tage | nein | Inhalte aktualisieren sich über GitHub Pages sofort, ohne neuen Store-Review. |
| **B: Capacitor** | Die PWA im WebView plus native Plugins (Kamera, Standort, Dateiexport). | 3–5 Tage | ja, mit zusätzlichem Kotlin-Code (+5–10 Tage) | Jedes Update braucht ein neues App-Paket. |
| **C: Native Neuentwicklung** (Kotlin/Compose) | Komplette Neuschreibung von ca. 8.000 Zeilen JS. | 8–14 Wochen | ja, erstklassig | Nur sinnvoll, wenn die PWA an Grenzen stößt. |

Empfehlung, falls überhaupt: Weg B, wenn Widgets wichtig sind, sonst Weg A.
Ein späterer Wechsel von A zu B verschiebt die Nutzerdaten in einen anderen Speicher (Umzug über die JSON-Sicherung).

Stolperstein bei A: Die TWA braucht `assetlinks.json` im Wurzelverzeichnis der Domain. Mit
`rockybalboa360.github.io/StuffTracker/` geht das nicht; nötig wäre ein Repository `rockybalboa360.github.io`
oder eine eigene Domain (ca. 10 €/Jahr). Sonst zeigt die App eine Adressleiste.

## 2. Die drei Szenarien

### Szenario 1: Nur für mich, Download über die eigene Cloud
- Signierte APK bauen, in die Cloud legen, mit „Unbekannte Quellen“ installieren.
- Aufwand: A 1–2 Tage, B ca. 1 Woche, Widgets zusätzlich 1–2 Wochen. Kosten: 0 €.
- Updates manuell; bei A kommen die Inhalte trotzdem automatisch.
- Prüfen: Google führt eine Entwickler-Verifizierung auch für Apps außerhalb des Stores ein (zuerst einzelne Länder,
  später weltweit). Für private Nutzung soll es eine Ausnahme geben – vorher nachlesen.

### Szenario 2: Play Store, kostenlos
- Entwicklerkonto: einmalig ca. 25 $, Identitätsprüfung (Ausweis, Adresse, Telefon), 1–7 Tage.
- Geschlossener Test: bei privaten Konten mindestens 12 Tester, 14 Tage am Stück, vor der Veröffentlichung.
- Weitere Bausteine: Datenschutzerklärung (kann auf GitHub Pages liegen), Fragebogen „Datensicherheit“, Altersfreigabe,
  Store-Texte de/en, Icon, Titelgrafik, Screenshots, Review durch Google (1–7 Tage).
- Standortdaten gehen an die Wetterdienste und gehören in Datenschutzerklärung und Datensicherheitsangaben.
- Aufwand: A ca. 1 Woche, B 2–3 Wochen; Kalenderzeit 3–4 Wochen. Laufend: jährlich Ziel-Android-Version anheben (1–3 Tage), Support.

### Szenario 3: Play Store, kostenpflichtig
Alles aus Szenario 2, plus:
- Händlerprofil, Zahlungsprofil, Bankkonto, Steuerangaben (1–2 Wochen Kalenderzeit).
- In der EU erscheinen Name, Adresse und E-Mail als Anbieter öffentlich im Store.
- Regelmäßige Einnahmen: voraussichtlich Gewerbeanmeldung und Meldung beim Finanzamt (Kleinunternehmerregelung möglich) –
  mit Steuerberater klären.
- Gebühr: 15 % bis 1 Mio. $ Jahresumsatz.
- Preismodell: Kostenlos → kostenpflichtig lässt sich nicht umstellen. Besser: kostenlose App mit einmaligem
  Freischalt-Kauf (Play Billing, 3–7 Tage Entwicklung).
- Optional Lizenzprüfung / Play Integrity gegen Raubkopien.
- Wetterdienste prüfen: Open-Meteo (kostenlos) ist vermutlich nur für nicht-kommerzielle Nutzung erlaubt; bei Nominatim und
  MET Norway gelten Nutzungs- und Kennzeichnungsregeln.
- Aufwand: Szenario 2 plus 1–2 Wochen Arbeit und 1–2 Wochen Kalenderzeit. Kosten: 25 $ + 15 % + Steuern.

## 3. Voraussetzungen auf deiner Seite
1. Entscheidung: Weg und Modell (kostenlos, bezahlt, kostenlos mit Freischaltung).
2. Google-Konto für die Entwickler-Console, Identitätsprüfung.
3. 12 Tester (Android + Google-Konto), die 14 Tage mitmachen (nur Szenario 2 und 3, private Konten).
4. Bei Weg A: Domain oder Repository `rockybalboa360.github.io`.
5. Für Szenario 3: Bankverbindung, Steuernummer, Gewerbefrage, Support-E-Mail.
6. Keystore sichern (ohne ihn keine signierten Updates).
7. Mindestens ein echtes Android-Gerät zum Testen.

Auf meiner Seite: Java und Android-Werkzeuge installieren (Android Studio nicht zwingend), bauen, signieren, testen.

## 4. Überblick

| | Arbeit (Weg A / B) | Kalenderzeit | Kosten |
|---|---|---|---|
| Nur für mich | 1–2 Tage / ca. 1 Woche | wenige Tage | 0 € |
| Play Store kostenlos | ca. 1 Woche / 2–3 Wochen | 3–4 Wochen | ca. 25 $ |
| Play Store bezahlt | ca. 2–3 Wochen / 3–5 Wochen | 5–6 Wochen | ca. 25 $ + 15 % + Steuern |

Widgets sind nur mit Weg B oder C möglich (+1–2 Wochen).

## 5. Aufwand und Nutzen (Einschätzung)

- Die PWA lässt sich schon heute auf Android installieren und aktualisiert sich selbst. Eine native Hülle bringt vor allem
  Widgets, Auffindbarkeit im Store und Bezahlfunktion.
- Für den Eigengebrauch ist der Zusatznutzen klein, solange keine Widgets gebraucht werden.
- Bei einem bezahlten Angebot stehen feste Kosten und Pflichten (Konto, Tester-Phase, Steuern, öffentliche Adresse,
  jährliche Pflege, Support) einem unsicheren Absatz einer Nischen-App gegenüber. Eine Umsatzprognose gibt es nicht.
- Günstigste sinnvolle Stufen:
  1. PWA unverändert weiter nutzen (0 Aufwand).
  2. Nur wenn Widgets gewünscht: Szenario 1 mit Weg B (ca. 2–3 Wochen, 0 € Fremdkosten).
  3. Store-Veröffentlichung erst, wenn echter Bedarf bei anderen Nutzern erkennbar ist.
