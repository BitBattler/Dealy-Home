"""Konstanten der Familienzentrale."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "familienzentrale"

# Optionen (Setup-Seite)
CONF_MODULES: Final = "module"
CONF_PERSONS: Final = "personen"
CONF_PIN: Final = "pin"
CONF_COLOR: Final = "farbe"

# Alle Module: Schlüssel -> (Name, Icon)
# Ein Modul ist aktiv, wenn sein Schlüssel in den Optionen unter CONF_MODULES steht.
MODULES: Final[dict[str, tuple[str, str]]] = {
    "kalender": ("Wandkalender", "mdi:calendar-month"),
    "termin_push": ("Push bei neuem Termin", "mdi:bell-ring"),
    "erinnerungen": ("Erinnerungen", "mdi:alarm"),
    "routinen": ("Kinder-Routinen", "mdi:check-circle-outline"),
    "punkte": ("Punkte & Belohnungen", "mdi:star-circle"),
    "essensplan": ("Essensplan", "mdi:silverware-fork-knife"),
    "listen": ("Listen", "mdi:format-list-checks"),
    "bilderrahmen": ("Bilderrahmen", "mdi:image-frame"),
    "stundenplan": ("Stundenplan", "mdi:timetable"),
    "geschenke": ("Geschenkliste", "mdi:gift"),
    "kindersicherung": ("Kindersicherung", "mdi:lock"),
}

# Standardfarben für Personen (RGB), der Reihe nach vergeben
DEFAULT_COLORS: Final[list[list[int]]] = [
    [229, 57, 53],    # Rot
    [30, 136, 229],   # Blau
    [67, 160, 71],    # Grün
    [251, 140, 0],    # Orange
    [142, 36, 170],   # Lila
    [0, 172, 193],    # Türkis
    [216, 27, 96],    # Pink
    [109, 76, 65],    # Braun
]


def rgb_to_hex(rgb: list[int] | tuple[int, ...] | None) -> str:
    """[r, g, b] -> '#rrggbb'."""
    if not rgb or len(rgb) < 3:
        return "#9e9e9e"
    return "#{:02x}{:02x}{:02x}".format(*(max(0, min(255, int(c))) for c in rgb[:3]))
