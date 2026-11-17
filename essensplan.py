"""Modul „Essensplan“: Rezepte, Wochenplan und Zutaten auf die Einkaufsliste.

Daten liegen in .storage/familienzentrale.essensplan:
  rezepte: {id: {name, emoji, portionen, zutaten: [..], zubereitung, link}}
  plan:    {"JJJJ-MM-TT": {mahlzeit: {"rezept": id} | {"text": "..."}}}

Das Panel spricht über WebSocket-Befehle familienzentrale/essen/* mit diesem Modul.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
import uuid

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import CONF_MEALS, CONF_SHOPPING_LIST, DEFAULT_MEALS, DOMAIN, MAHLZEITEN

DATA_KEY = f"{DOMAIN}_essensplan"
WS_KEY = f"{DOMAIN}_essensplan_ws"
AUFBEWAHREN_TAGE = 180


class Essensplan:
    """Hält Rezepte und Wochenplan."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.essensplan")
        self.rezepte: dict[str, dict[str, Any]] = {}
        self.plan: dict[str, dict[str, dict[str, str]]] = {}

    async def async_laden(self) -> None:
        daten = await self.store.async_load() or {}
        self.rezepte = daten.get("rezepte", {})
        self.plan = daten.get("plan", {})

    @callback
    def speichern(self) -> None:
        grenze = (date.today() - timedelta(days=AUFBEWAHREN_TAGE)).isoformat()
        self.plan = {d: v for d, v in self.plan.items() if d >= grenze and v}
        self.store.async_delay_save(lambda: {"rezepte": self.rezepte, "plan": self.plan}, 1)

    @property
    def mahlzeiten(self) -> list[str]:
        gewaehlt = self.entry.options.get(CONF_MEALS) or DEFAULT_MEALS
        return [m for m in MAHLZEITEN if m in gewaehlt]

    @property
    def einkaufsliste(self) -> str | None:
        return self.entry.options.get(CONF_SHOPPING_LIST) or None


async def async_setup(hass: HomeAssistant, entry: ConfigEntry) -> CALLBACK_TYPE:
    ep = Essensplan(hass, entry)
    await ep.async_laden()
    hass.data[DATA_KEY] = ep

    # WebSocket-Befehle nur einmal pro HA-Lauf registrieren
    if not hass.data.get(WS_KEY):
        for befehl in (ws_laden, ws_rezept_speichern, ws_rezept_loeschen, ws_plan_setzen, ws_einkaufen):
            websocket_api.async_register_command(hass, befehl)
        hass.data[WS_KEY] = True

    @callback
    def _entladen() -> None:
        hass.data.pop(DATA_KEY, None)

    return _entladen


def _ep(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> Essensplan | None:
    ep: Essensplan | None = hass.data.get(DATA_KEY)
    if ep is None:
        connection.send_error(msg["id"], "nicht_aktiv", "Das Modul Essensplan ist ausgeschaltet.")
    return ep


def _tage(start: str, anzahl: int) -> list[str]:
    s = date.fromisoformat(start)
    return [(s + timedelta(days=i)).isoformat() for i in range(max(1, min(anzahl, 42)))]


# --- WebSocket-Befehle --------------------------------------------------------

@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/essen/laden",
        vol.Required("start"): str,
        vol.Optional("tage", default=7): int,
    }
)
@callback
def ws_laden(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (ep := _ep(hass, connection, msg)):
        return
    connection.send_result(
        msg["id"],
        {
            "rezepte": ep.rezepte,
            "plan": {d: ep.plan.get(d, {}) for d in _tage(msg["start"], msg["tage"])},
            "mahlzeiten": ep.mahlzeiten,
            "einkaufsliste": ep.einkaufsliste,
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/essen/rezept_speichern",
        vol.Optional("id"): str,
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=120)),
        vol.Optional("emoji", default=""): str,
        vol.Optional("portionen", default=4): vol.All(int, vol.Range(min=1, max=50)),
        vol.Optional("zutaten", default=[]): [str],
        vol.Optional("zubereitung", default=""): str,
        vol.Optional("link", default=""): str,
    }
)
@callback
def ws_rezept_speichern(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (ep := _ep(hass, connection, msg)):
        return
    rid = msg.get("id") or uuid.uuid4().hex[:10]
    ep.rezepte[rid] = {
        "name": msg["name"].strip(),
        "emoji": msg["emoji"].strip()[:4],
        "portionen": msg["portionen"],
        "zutaten": [z.strip() for z in msg["zutaten"] if z.strip()],
        "zubereitung": msg["zubereitung"].strip(),
        "link": msg["link"].strip(),
    }
    ep.speichern()
    connection.send_result(msg["id"], {"id": rid})


@websocket_api.websocket_command(
    {vol.Required("type"): "familienzentrale/essen/rezept_loeschen", vol.Required("id"): str}
)
@callback
def ws_rezept_loeschen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (ep := _ep(hass, connection, msg)):
        return
    rezept = ep.rezepte.pop(msg["id"], None)
    if rezept:
        # Geplante Mahlzeiten behalten – als freier Text mit dem Rezeptnamen
        for slots in ep.plan.values():
            for m, eintrag in slots.items():
                if eintrag.get("rezept") == msg["id"]:
                    slots[m] = {"text": f"{rezept.get('emoji', '')} {rezept['name']}".strip()}
        ep.speichern()
    connection.send_result(msg["id"], {})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/essen/plan_setzen",
        vol.Required("datum"): str,
        vol.Required("mahlzeit"): vol.In(MAHLZEITEN),
        vol.Optional("rezept"): str,
        vol.Optional("text"): str,
    }
)
@callback
def ws_plan_setzen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (ep := _ep(hass, connection, msg)):
        return
    date.fromisoformat(msg["datum"])  # prüft das Format
    slots = ep.plan.setdefault(msg["datum"], {})
    if msg.get("rezept") and msg["rezept"] in ep.rezepte:
        slots[msg["mahlzeit"]] = {"rezept": msg["rezept"]}
    elif (msg.get("text") or "").strip():
        slots[msg["mahlzeit"]] = {"text": msg["text"].strip()[:120]}
    else:
        slots.pop(msg["mahlzeit"], None)
    ep.speichern()
    connection.send_result(msg["id"], {})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/essen/einkaufen",
        vol.Required("start"): str,
        vol.Optional("tage", default=7): int,
    }
)
@websocket_api.async_response
async def ws_einkaufen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (ep := _ep(hass, connection, msg)):
        return
    liste = ep.einkaufsliste
    if not liste or not hass.states.get(liste):
        connection.send_error(msg["id"], "keine_liste", "Keine Einkaufsliste gewählt (Setup → Essensplan).")
        return

    # Zutaten der geplanten Rezepte sammeln (gleiche Zeilen nur einmal)
    gesehen: dict[str, str] = {}
    for d in _tage(msg["start"], msg["tage"]):
        if d < date.today().isoformat():
            continue  # Vergangenes nicht mehr einkaufen
        for eintrag in ep.plan.get(d, {}).values():
            rezept = ep.rezepte.get(eintrag.get("rezept", ""))
            for z in (rezept or {}).get("zutaten", []):
                gesehen.setdefault(z.lower(), z)

    antwort = await hass.services.async_call(
        "todo", "get_items", {"status": "needs_action"},
        target={"entity_id": liste}, blocking=True, return_response=True,
    )
    offen = {i["summary"].strip().lower() for i in (antwort or {}).get(liste, {}).get("items", [])}

    neu = [z for k, z in gesehen.items() if k not in offen]
    for z in neu:
        await hass.services.async_call("todo", "add_item", {"item": z}, target={"entity_id": liste}, blocking=True)

    state = hass.states.get(liste)
    connection.send_result(
        msg["id"],
        {"hinzugefuegt": len(neu), "schon_da": len(gesehen) - len(neu), "liste": state.name if state else liste},
    )
