# Familienzentrale für Home Assistant

Ein Familienplaner für die Wand – direkt in Home Assistant.
Kalender, Kinder-Routinen, Punkte & Belohnungen, Essensplan, Listen, Bilderrahmen und mehr –
jedes Modul lässt sich auf einer Setup-Seite einzeln **aktivieren und deaktivieren**.

> 🚧 In Entwicklung – noch nicht installierbar.

## Module (geplant)

| Modul | Beschreibung |
|---|---|
| 📅 Wandkalender | Monats-/Wochenansicht im Vollbild, Farbe pro Person |
| 🔔 Neuer-Termin-Push | Push an die anderen Familienmitglieder, wenn ein Termin dazukommt |
| ⏰ Erinnerungen | Push und/oder Ton vor Terminen und Aufgaben |
| ✅ Kinder-Routinen | Morgen-/Abendroutine als Bildkarten zum Selbst-Abhaken, täglicher Reset |
| ⭐ Punkte & Belohnungen | Punkte für erledigte Aufgaben, Belohnungen einlösen (mit Eltern-PIN) |
| 🍝 Essensplan | Rezepte, Wochenplan, Zutaten per Knopfdruck auf die Einkaufsliste |
| 🛒 Listen | Alle Listen auf einen Blick |
| 🖼 Bilderrahmen | Fotos als Bildschirmschoner auf dem Wanddisplay |
| 🗓 Stundenplan | Wochenraster pro Person |
| 🎁 Geschenkliste | Nur für Eltern sichtbar |
| 🔒 Kindersicherung | Wanddisplay im Nur-Ansehen-Modus, PIN für Änderungen |

## Aufbau

- **Integration** (`custom_components/familienzentrale`): Module, Entitäten, Dienste,
  Einrichtung und Setup über *Einstellungen → Geräte & Dienste → Familienzentrale → Konfigurieren*.
- **Panel** „Familie“ in der Seitenleiste: Wandansicht und Setup-Tab.
- Keine Tokens oder persönlichen Daten im Code – alles wird in Home Assistant eingestellt.

## Installation (später)

HACS → Benutzerdefinierte Repositories → dieses Repository als *Integration* hinzufügen.
