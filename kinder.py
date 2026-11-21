"""Module „Kinder-Routinen“ und „Punkte & Belohnungen“.

Daten in .storage/familienzentrale.kinder:
  routinen:    {id: {name, emoji, zeit (morgen|tag|abend), person, aufgaben: [{id, name, emoji, punkte}]}}
  erledigt:    {"JJJJ-MM-TT": {aufgabe_id: true}}      -> jeden Tag automatisch neu
  punkte:      {person_entity_id: int}
  belohnungen: {id: {name, emoji, kosten, sandi_sterne, fuer: [person_entity_id] (leer = alle)}}
  verlauf:     [{zeit, person, text, punkte}]

Eine Belohnung mit sandi_sterne > 0 schreibt beim Einlösen Sterne auf den
Sandi-Zähler gut (Sandi rechnet sie in Fernsehminuten um).
"""

from __future__ import annotations

from datetime import timedelta
import hmac
import logging
from typing import Any
import uuid

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CONF_MODULES, CONF_PIN, CONF_SANDI_COUNTER, DOMAIN, SIGNAL_PUNKTE

_LOGGER = logging.getLogger(__name__)

DATA_KEY = f"{DOMAIN}_kinder"
WS_KEY = f"{DOMAIN}_kinder_ws"
ZEITEN = ["morgen", "tag", "abend"]
VERLAUF_MAX = 300


def _neue_id() -> str:
    return uuid.uuid4().hex[:10]


class Kinder:
    """Routinen, Punkte, Belohnungen."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.kinder")
        self.d: dict[str, Any] = {"routinen": {}, "erledigt": {}, "punkte": {}, "belohnungen": {}, "verlauf": []}

    async def async_laden(self) -> None:
        daten = await self.store.async_load() or {}
        for k in self.d:
            if k in daten:
                self.d[k] = daten[k]

    @property
    def module(self) -> list[str]:
        return self.entry.options.get(CONF_MODULES, [])

    @property
    def punkte_aktiv(self) -> bool:
        return "punkte" in self.module

    @property
    def sandi_zaehler(self) -> str | None:
        eid = self.entry.options.get(CONF_SANDI_COUNTER)
        return eid if eid and self.hass.states.get(eid) else None

    @staticmethod
    def heute() -> str:
        return dt_util.now().date().isoformat()

    @callback
    def speichern(self) -> None:
        grenze = (dt_util.now().date() - timedelta(days=14)).isoformat()
        self.d["erledigt"] = {k: v for k, v in self.d["erledigt"].items() if k >= grenze}
        self.d["verlauf"] = self.d["verlauf"][-VERLAUF_MAX:]
        self.store.async_delay_save(lambda: self.d, 1)

    @callback
    def punkte_aendern(self, person: str, delta: int, text: str) -> None:
        if not self.punkte_aktiv or not person or not delta:
            return
        self.d["punkte"][person] = max(0, int(self.d["punkte"].get(person, 0)) + int(delta))
        self.d["verlauf"].append(
            {"zeit": dt_util.now().isoformat(timespec="minutes"), "person": person, "text": text, "punkte": int(delta)}
        )
        async_dispatcher_send(self.hass, SIGNAL_PUNKTE)

    def pin_ok(self, pin: Any) -> bool:
        soll = str(self.entry.options.get(CONF_PIN) or "")
        return not soll or hmac.compare_digest(str(pin or ""), soll)


async def async_setup(hass: HomeAssistant, entry: ConfigEntry) -> CALLBACK_TYPE:
    k = Kinder(hass, entry)
    await k.async_laden()
    hass.data[DATA_KEY] = k
    async_dispatcher_send(hass, SIGNAL_PUNKTE)

    if not hass.data.get(WS_KEY):
        for befehl in (
            ws_laden, ws_pin_pruefen, ws_routine_speichern, ws_routine_loeschen, ws_abhaken,
            ws_belohnung_speichern, ws_belohnung_loeschen, ws_einloesen, ws_korrektur,
        ):
            websocket_api.async_register_command(hass, befehl)
        hass.data[WS_KEY] = True

    @callback
    def _entladen() -> None:
        hass.data.pop(DATA_KEY, None)

    return _entladen


def _k(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict, pin: bool = False) -> Kinder | None:
    k: Kinder | None = hass.data.get(DATA_KEY)
    if k is None:
        connection.send_error(msg["id"], "nicht_aktiv", "Routinen/Punkte sind ausgeschaltet.")
        return None
    if pin and not k.pin_ok(msg.get("pin")):
        connection.send_error(msg["id"], "pin_falsch", "Falsche PIN")
        return None
    return k


def _antwort(k: Kinder) -> dict[str, Any]:
    return {
        "routinen": k.d["routinen"],
        "erledigt": k.d["erledigt"].get(k.heute(), {}),
        "punkte": k.d["punkte"],
        "belohnungen": k.d["belohnungen"],
        "verlauf": k.d["verlauf"][-40:],
        "pin": bool(k.entry.options.get(CONF_PIN)),
        "routinen_aktiv": "routinen" in k.module,
        "punkte_aktiv": k.punkte_aktiv,
        "sandi": k.sandi_zaehler,
    }


# --- WebSocket-Befehle --------------------------------------------------------

@websocket_api.websocket_command({vol.Required("type"): "familienzentrale/kinder/laden"})
@callback
def ws_laden(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if k := _k(hass, connection, msg):
        connection.send_result(msg["id"], _antwort(k))


@websocket_api.websocket_command({vol.Required("type"): "familienzentrale/kinder/pin_pruefen", vol.Optional("pin"): str})
@callback
def ws_pin_pruefen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if k := _k(hass, connection, msg):
        connection.send_result(msg["id"], {"ok": k.pin_ok(msg.get("pin"))})


AUFGABE = vol.Schema(
    {
        vol.Optional("id"): str,
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=60)),
        vol.Optional("emoji", default=""): str,
        vol.Optional("punkte", default=1): vol.All(int, vol.Range(min=0, max=100)),
    }
)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/kinder/routine_speichern",
        vol.Optional("pin"): str,
        vol.Optional("routine_id"): str,
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=60)),
        vol.Optional("emoji", default=""): str,
        vol.Required("zeit"): vol.In(ZEITEN),
        vol.Required("person"): str,
        vol.Required("aufgaben"): [AUFGABE],
    }
)
@callback
def ws_routine_speichern(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (k := _k(hass, connection, msg, pin=True)):
        return
    rid = msg.get("routine_id") or _neue_id()
    alt = {a["name"].lower(): a["id"] for a in k.d["routinen"].get(rid, {}).get("aufgaben", [])}
    k.d["routinen"][rid] = {
        "name": msg["name"].strip(),
        "emoji": msg["emoji"].strip()[:4],
        "zeit": msg["zeit"],
        "person": msg["person"],
        "aufgaben": [
            {
                "id": a.get("id") or alt.get(a["name"].strip().lower()) or _neue_id(),
                "name": a["name"].strip(),
                "emoji": a["emoji"].strip()[:4],
                "punkte": a["punkte"],
            }
            for a in msg["aufgaben"]
        ],
    }
    k.speichern()
    connection.send_result(msg["id"], _antwort(k))


@websocket_api.websocket_command(
    {vol.Required("type"): "familienzentrale/kinder/routine_loeschen", vol.Optional("pin"): str, vol.Required("routine_id"): str}
)
@callback
def ws_routine_loeschen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (k := _k(hass, connection, msg, pin=True)):
        return
    k.d["routinen"].pop(msg["routine_id"], None)
    k.speichern()
    connection.send_result(msg["id"], _antwort(k))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/kinder/abhaken",
        vol.Required("routine"): str,
        vol.Required("aufgabe"): str,
        vol.Required("erledigt"): bool,
    }
)
@callback
def ws_abhaken(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (k := _k(hass, connection, msg)):
        return
    routine = k.d["routinen"].get(msg["routine"])
    aufgabe = next((a for a in (routine or {}).get("aufgaben", []) if a["id"] == msg["aufgabe"]), None)
    if not aufgabe:
        connection.send_error(msg["id"], "unbekannt", "Aufgabe nicht gefunden")
        return
    heute = k.d["erledigt"].setdefault(k.heute(), {})
    war = bool(heute.get(aufgabe["id"]))
    if msg["erledigt"] != war:
        text = f"{aufgabe.get('emoji', '')} {aufgabe['name']}".strip()
        if msg["erledigt"]:
            heute[aufgabe["id"]] = True
            k.punkte_aendern(routine["person"], aufgabe.get("punkte", 1), text)
        else:
            heute.pop(aufgabe["id"], None)
            k.punkte_aendern(routine["person"], -aufgabe.get("punkte", 1), f"↩︎ {text}")
        k.speichern()
    connection.send_result(msg["id"], _antwort(k))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/kinder/belohnung_speichern",
        vol.Optional("pin"): str,
        vol.Optional("belohnung_id"): str,
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=60)),
        vol.Optional("emoji", default=""): str,
        vol.Required("kosten"): vol.All(int, vol.Range(min=0, max=10000)),
        vol.Optional("sandi_sterne", default=0): vol.All(int, vol.Range(min=0, max=50)),
        # Für wen die Belohnung im Laden erscheint (leer = für alle)
        vol.Optional("fuer", default=[]): [str],
    }
)
@callback
def ws_belohnung_speichern(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (k := _k(hass, connection, msg, pin=True)):
        return
    bid = msg.get("belohnung_id") or _neue_id()
    k.d["belohnungen"][bid] = {
        "name": msg["name"].strip(),
        "emoji": msg["emoji"].strip()[:4],
        "kosten": msg["kosten"],
        "sandi_sterne": msg["sandi_sterne"],
        "fuer": [p for p in msg["fuer"] if p.startswith("person.")],
    }
    k.speichern()
    connection.send_result(msg["id"], _antwort(k))


@websocket_api.websocket_command(
    {vol.Required("type"): "familienzentrale/kinder/belohnung_loeschen", vol.Optional("pin"): str, vol.Required("belohnung_id"): str}
)
@callback
def ws_belohnung_loeschen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (k := _k(hass, connection, msg, pin=True)):
        return
    k.d["belohnungen"].pop(msg["belohnung_id"], None)
    k.speichern()
    connection.send_result(msg["id"], _antwort(k))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/kinder/einloesen",
        vol.Optional("pin"): str,
        vol.Required("belohnung"): str,
        vol.Required("person"): str,
    }
)
@websocket_api.async_response
async def ws_einloesen(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (k := _k(hass, connection, msg, pin=True)):
        return
    b = k.d["belohnungen"].get(msg["belohnung"])
    if not b:
        connection.send_error(msg["id"], "unbekannt", "Belohnung nicht gefunden")
        return
    stand = int(k.d["punkte"].get(msg["person"], 0))
    if stand < b["kosten"]:
        connection.send_error(msg["id"], "zu_wenig", f"Noch {b['kosten'] - stand} ⭐ zu wenig")
        return
    k.punkte_aendern(msg["person"], -b["kosten"], f"🎁 {b.get('emoji', '')} {b['name']}".replace("  ", " "))
    k.speichern()
    sterne = int(b.get("sandi_sterne") or 0)
    if sterne and (zaehler := k.sandi_zaehler):
        for _ in range(sterne):
            await hass.services.async_call("counter", "increment", target={"entity_id": zaehler}, blocking=True)
    connection.send_result(msg["id"], _antwort(k))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/kinder/korrektur",
        vol.Optional("pin"): str,
        vol.Required("person"): str,
        vol.Required("delta"): vol.All(int, vol.Range(min=-1000, max=1000)),
        vol.Optional("grund", default=""): str,
    }
)
@callback
def ws_korrektur(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (k := _k(hass, connection, msg, pin=True)):
        return
    grund = msg["grund"].strip() or ("⭐ Bonus" if msg["delta"] > 0 else "Abzug")
    k.punkte_aendern(msg["person"], msg["delta"], grund)
    k.speichern()
    connection.send_result(msg["id"], _antwort(k))
