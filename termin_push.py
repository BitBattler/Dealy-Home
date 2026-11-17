"""Modul „Push bei neuem Termin“.

Prüft alle 5 Minuten die gewählten Kalender. Taucht ein Termin auf, der vorher
nicht da war, bekommen alle Personen mit hinterlegtem Handy eine Push-Nachricht.

Schutz vor Fehlalarmen:
- Beim ersten Lauf (bzw. für neu gewählte Kalender) wird nur gemerkt, nicht gemeldet.
- Serientermine zählen als EIN Termin (neue Wiederholungen lösen nichts aus).
- Liefert ein Kalender plötzlich gar nichts mehr (Abruffehler), wird nichts vergessen.
- Mehr als 5 neue Termine auf einmal -> eine Sammelnachricht.
"""

from __future__ import annotations

from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    CONF_CALENDARS,
    CONF_NOTIFY,
    CONF_PERSONS,
    CONF_PET_NAME,
    CONF_PETS,
    CONF_PUSH_DAYS,
    DEFAULT_PUSH_DAYS,
    DOMAIN,
    PANEL_URL,
    stichwoerter,
)

_LOGGER = logging.getLogger(__name__)

INTERVALL = timedelta(minutes=5)
MAX_EINZELN = 5
WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


def _kalender_entity(hass: HomeAssistant, entity_id: str) -> Any:
    try:
        from homeassistant.components.calendar import DATA_COMPONENT

        comp = hass.data.get(DATA_COMPONENT)
    except ImportError:  # ältere Versionen
        comp = hass.data.get("calendar")
    return comp.get_entity(entity_id) if comp else None


def _schluessel(eid: str, ev: Any) -> str:
    if getattr(ev, "rrule", None) or getattr(ev, "recurrence_id", None):
        return f"{eid}|serie|{ev.uid or ev.summary}"
    if ev.uid:
        return f"{eid}|{ev.uid}"
    return f"{eid}|{ev.summary}|{ev.start}"


def zeittext(ev: Any) -> str:
    """Kurzer deutscher Zeittext, z. B. 'Mo 24.11. · 07:30–17:30'."""
    start, ende = ev.start, ev.end
    if isinstance(start, datetime):
        s = dt_util.as_local(start)
        e = dt_util.as_local(ende) if isinstance(ende, datetime) else s
        txt = f"{WT[s.weekday()]} {s:%d.%m.} · {s:%H:%M}"
        if e.date() == s.date():
            txt += f"–{e:%H:%M}"
        else:
            txt += f" – {WT[e.weekday()]} {e:%d.%m.} {e:%H:%M}"
        return txt
    letzter = ende - timedelta(days=1) if ende and ende > start else start
    txt = f"{WT[start.weekday()]} {start:%d.%m.}"
    if letzter != start:
        txt += f" – {WT[letzter.weekday()]} {letzter:%d.%m.}"
    return txt + " · ganztägig"


class TerminPush:
    """Erkennt neue Termine und meldet sie."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self._store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.termin_push")
        self._daten: dict[str, Any] = {}

    async def async_start(self) -> CALLBACK_TYPE:
        self._daten = await self._store.async_load() or {}
        await self._pruefen()
        return async_track_time_interval(self.hass, self._intervall, INTERVALL)

    async def _intervall(self, _now: datetime) -> None:
        await self._pruefen()

    async def _pruefen(self) -> None:
        opts = self.entry.options
        kalender: list[str] = opts.get(CONF_CALENDARS, [])
        tage = int(opts.get(CONF_PUSH_DAYS, DEFAULT_PUSH_DAYS))
        jetzt = dt_util.now()
        bis = jetzt + timedelta(days=tage)
        gespeichert: dict[str, list[str]] = self._daten.setdefault("kalender", {})
        neue: list[Any] = []

        for eid in kalender:
            ent = _kalender_entity(self.hass, eid)
            if ent is None:
                continue
            try:
                events = await ent.async_get_events(self.hass, jetzt, bis)
            except Exception as err:  # noqa: BLE001 – ein Kalender darf die anderen nicht stoppen
                _LOGGER.warning("Kalender %s konnte nicht gelesen werden: %s", eid, err)
                continue

            aktuell: dict[str, Any] = {}
            for ev in events:
                aktuell.setdefault(_schluessel(eid, ev), ev)

            if eid not in gespeichert:  # erster Lauf für diesen Kalender: nur merken
                gespeichert[eid] = list(aktuell)
                continue
            bekannt = set(gespeichert[eid])
            if not aktuell and len(bekannt) > 3:  # vermutlich Abruffehler
                continue
            neue.extend(ev for k, ev in aktuell.items() if k not in bekannt)
            gespeichert[eid] = list(aktuell)

        for eid in list(gespeichert):
            if eid not in kalender:
                del gespeichert[eid]

        await self._store.async_save(self._daten)
        if neue:
            await self._melden(neue)

    def _namen_fuer(self, titel: str) -> list[str]:
        titel_klein = (titel or "").lower()
        namen = []
        for eid, cfg in self.entry.options.get(CONF_PERSONS, {}).items():
            state = self.hass.states.get(eid)
            name = state.name if state else eid
            # Ohne Stichwörter gilt der Name der Person als Stichwort
            if any(w.lower() in titel_klein for w in (stichwoerter(cfg) or [name])):
                namen.append(name)
        for tier in self.entry.options.get(CONF_PETS, []):
            name = tier[CONF_PET_NAME]
            if any(w.lower() in titel_klein for w in (stichwoerter(tier) or [name])):
                namen.append(name)
        return namen

    async def _melden(self, neue: list[Any]) -> None:
        ziele = sorted(
            {
                cfg.get(CONF_NOTIFY)
                for cfg in self.entry.options.get(CONF_PERSONS, {}).values()
                if cfg.get(CONF_NOTIFY)
            }
        )
        ziele = [z for z in ziele if self.hass.services.has_service("notify", z)]
        if not ziele:
            return

        daten = {
            "clickAction": f"/{PANEL_URL}",
            "channel": "Familienkalender",
            "notification_icon": "mdi:calendar-plus",
            "group": "familienzentrale_termine",
        }
        nachrichten: list[dict[str, Any]] = []
        if len(neue) > MAX_EINZELN:
            zeilen = [f"• {ev.summary} – {zeittext(ev)}" for ev in neue[:MAX_EINZELN]]
            zeilen.append(f"… und {len(neue) - MAX_EINZELN} weitere")
            nachrichten.append({"title": f"📅 {len(neue)} neue Termine", "message": "\n".join(zeilen)})
        else:
            for ev in neue:
                namen = self._namen_fuer(ev.summary)
                titel = "📅 Neuer Termin" + (f" für {', '.join(namen)}" if namen else "")
                text = f"{ev.summary}\n{zeittext(ev)}"
                if getattr(ev, "rrule", None) or getattr(ev, "recurrence_id", None):
                    text += " (wiederkehrend)"
                if ev.location:
                    text += f"\n📍 {ev.location}"
                nachrichten.append({"title": titel, "message": text})

        for n in nachrichten:
            for ziel in ziele:
                await self.hass.services.async_call(
                    "notify", ziel, {**n, "data": daten}, blocking=False
                )
