"""Modul „Essensplan“: Rezepte, Wochenplan und Zutaten auf die Einkaufsliste.

Daten liegen in .storage/familienzentrale.essensplan:
  rezepte: {id: {name, emoji, portionen, zutaten: [..], zubereitung, link}}
  plan:    {"JJJJ-MM-TT": {mahlzeit: {"rezept": id} | {"text": "..."}}}

Das Panel spricht über WebSocket-Befehle familienzentrale/essen/* mit diesem Modul.
"""

from __future__ import annotations

from datetime import date, timedelta
import json
import logging
import re
from typing import Any
import uuid

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import (
    CONF_FOOD_NOTES,
    CONF_MEALS,
    CONF_PERSONS,
    CONF_PET_NAME,
    CONF_PETS,
    CONF_SHOPPING_LIST,
    DEFAULT_MEALS,
    DOMAIN,
    MAHLZEIT_NAMEN,
    MAHLZEITEN,
)

_LOGGER = logging.getLogger(__name__)
WT_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

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

    @property
    def portionen(self) -> int:
        return max(2, len(self.entry.options.get(CONF_PERSONS, {})) or 4)

    def familie_text(self) -> str:
        """Kurzbeschreibung der Familie und Hinweise für die KI."""
        namen = []
        for eid in self.entry.options.get(CONF_PERSONS, {}):
            state = self.hass.states.get(eid)
            namen.append(state.name if state else eid)
        tiere = [t[CONF_PET_NAME] for t in self.entry.options.get(CONF_PETS, [])]
        teile = []
        if namen:
            teile.append(f"Familie: {', '.join(namen)} ({len(namen)} Personen)")
        if tiere:
            teile.append(f"Haustiere: {', '.join(tiere)}")
        hinweise = (self.entry.options.get(CONF_FOOD_NOTES) or "").strip()
        teile.append(f"Hinweise der Familie: {hinweise}" if hinweise else "Familienküche, kindertauglich.")
        return "\n".join(teile)

    def rezept_anlegen(self, daten: dict[str, Any]) -> str:
        rid = uuid.uuid4().hex[:10]
        self.rezepte[rid] = _rezept_aus(daten, self.portionen)
        return rid

    def rezept_nach_name(self, name: str) -> str | None:
        n = name.strip().lower()
        return next((rid for rid, r in self.rezepte.items() if r["name"].strip().lower() == n), None)


def _rezept_aus(daten: dict[str, Any], portionen: int) -> dict[str, Any]:
    zutaten = daten.get("zutaten") or []
    if isinstance(zutaten, str):
        zutaten = zutaten.split("\n")
    try:
        port = max(1, min(50, int(daten.get("portionen") or portionen)))
    except (TypeError, ValueError):
        port = portionen
    return {
        "name": str(daten.get("name") or "Rezept").strip()[:120],
        "emoji": str(daten.get("emoji") or "🍽").strip()[:4],
        "portionen": port,
        "zutaten": [str(z).strip().lstrip("-•* ").strip() for z in zutaten if str(z).strip()],
        "zubereitung": str(daten.get("zubereitung") or "").strip(),
        "link": str(daten.get("link") or "").strip(),
    }


def _ki_entity(hass: HomeAssistant) -> str | None:
    ids = [s.entity_id for s in hass.states.async_all("ai_task")]
    bevorzugt = [i for i in ids if re.search("claude|anthropic", i)]
    return (bevorzugt or ids or [None])[0]


def _json_aus(text: str) -> Any:
    """JSON aus einer KI-Antwort holen (auch mit ```json-Zaun oder Text drumherum)."""
    t = re.sub(r"^```(?:json)?|```$", "", (text or "").strip(), flags=re.MULTILINE).strip()
    start = min((i for i in (t.find("{"), t.find("[")) if i >= 0), default=-1)
    if start < 0:
        raise ValueError("Keine JSON-Antwort")
    ende = max(t.rfind("}"), t.rfind("]"))
    return json.loads(t[start : ende + 1])


async def _ki(hass: HomeAssistant, aufgabe: str, anweisung: str) -> Any:
    ent = _ki_entity(hass)
    if not ent:
        raise ValueError("Keine KI gefunden (AI-Task-Entität fehlt).")
    antwort = await hass.services.async_call(
        "ai_task", "generate_data",
        {"entity_id": ent, "task_name": aufgabe, "instructions": anweisung},
        blocking=True, return_response=True,
    )
    return _json_aus(str((antwort or {}).get("data") or ""))


async def async_setup(hass: HomeAssistant, entry: ConfigEntry) -> CALLBACK_TYPE:
    ep = Essensplan(hass, entry)
    await ep.async_laden()
    hass.data[DATA_KEY] = ep

    # WebSocket-Befehle nur einmal pro HA-Lauf registrieren
    if not hass.data.get(WS_KEY):
        for befehl in (
            ws_laden, ws_rezept_speichern, ws_rezept_loeschen, ws_plan_setzen, ws_einkaufen,
            ws_ki_rezept, ws_ki_woche,
        ):
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


# --- KI ----------------------------------------------------------------------

REZEPT_JSON = (
    '{"name": "Spaghetti Bolognese", "emoji": "🍝", "portionen": 4, '
    '"zutaten": ["500 g Spaghetti", "400 g Rinderhackfleisch", "1 Zwiebel"], '
    '"zubereitung": "1. Zwiebel fein hacken …\\n2. …"}'
)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/essen/ki_rezept",
        vol.Required("eingabe"): vol.All(str, vol.Length(min=2, max=8000)),
        vol.Optional("portionen"): vol.All(int, vol.Range(min=1, max=50)),
    }
)
@websocket_api.async_response
async def ws_ki_rezept(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (ep := _ep(hass, connection, msg)):
        return
    eingabe = msg["eingabe"].strip()
    portionen = msg.get("portionen") or ep.portionen
    link = eingabe if re.match(r"^https?://\S+$", eingabe) else ""
    anweisung = f"""Du bist eine erfahrene Familienköchin. Erstelle aus der Eingabe ein gut nachkochbares Rezept.

EINGABE:
{eingabe}

{ep.familie_text()}

Regeln:
- Die Eingabe kann eine Idee, ein eingefügter Rezepttext oder ein Link sein. Links kannst du nicht öffnen –
  leite das Gericht aus den Wörtern im Link ab. Ein eingefügtes Rezept übernimmst du inhaltlich treu.
- Mengen für {portionen} Portionen, metrische Einheiten, deutsche Zutatennamen, eine Zutat pro Eintrag
  (Menge zuerst, z. B. „200 g Mehl“). Salz/Pfeffer/Öl nur aufführen, wenn wirklich nötig.
- Zubereitung in kurzen, nummerierten Schritten (Zeilen mit \\n getrennt).
- Ein passendes Emoji.

Antworte NUR mit JSON in genau diesem Format, ohne weiteren Text:
{REZEPT_JSON}"""
    try:
        daten = await _ki(hass, "Familienzentrale – Rezept", anweisung)
        if isinstance(daten, list):
            daten = daten[0]
        daten["link"] = link
        rid = ep.rezept_anlegen(daten)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("KI-Rezept fehlgeschlagen: %s", err)
        connection.send_error(msg["id"], "ki_fehler", f"Die KI konnte kein Rezept erstellen: {err}")
        return
    ep.speichern()
    connection.send_result(msg["id"], {"id": rid, "rezept": ep.rezepte[rid]})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "familienzentrale/essen/ki_woche",
        vol.Required("start"): str,
        vol.Optional("wuensche", default=""): str,
        vol.Optional("nur_leere", default=True): bool,
    }
)
@websocket_api.async_response
async def ws_ki_woche(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (ep := _ep(hass, connection, msg)):
        return
    heute = date.today().isoformat()
    tage = [d for d in _tage(msg["start"], 7) if d >= heute]
    felder = [
        (d, m) for d in tage for m in ep.mahlzeiten
        if not msg["nur_leere"] or not ep.plan.get(d, {}).get(m)
    ]
    if not felder:
        connection.send_result(msg["id"], {"geplant": 0, "neue_rezepte": 0})
        return

    def anzeige(d: str) -> str:
        return f"{d} ({WT_LANG[date.fromisoformat(d).weekday()]})"

    belegt = []
    for d in tage:
        for m, e in ep.plan.get(d, {}).items():
            name = ep.rezepte.get(e.get("rezept", ""), {}).get("name") or e.get("text")
            if name:
                belegt.append(f"- {anzeige(d)} {MAHLZEIT_NAMEN[m]}: {name}")
    vorhandene = sorted(r["name"] for r in ep.rezepte.values())

    anweisung = f"""Du planst die Mahlzeiten einer Familie für die Woche.

{ep.familie_text()}
Wünsche für diese Woche: {msg["wuensche"].strip() or "keine besonderen"}

ZU PLANEN (genau diese Felder):
{chr(10).join(f"- {anzeige(d)} | {m} ({MAHLZEIT_NAMEN[m]})" for d, m in felder)}

SCHON GEPLANT (nicht ändern, aber für Abwechslung beachten):
{chr(10).join(belegt) or "- nichts"}

VORHANDENE REZEPTE (gerne wiederverwenden, dann exakt gleicher Name und leere Zutatenliste):
{", ".join(vorhandene) or "keine"}

Regeln:
- Abwechslungsreich, ausgewogen, familien- und kindertauglich, saisonal.
- Unter der Woche schnell (max. 30 Minuten), am Wochenende darf es aufwändiger sein.
- Frühstück einfach halten. Abends gern leichter.
- Reste clever nutzen ist erlaubt (z. B. gleiches Gericht am nächsten Mittag).
- Für NEUE Gerichte: Zutaten mit Mengen für {ep.portionen} Portionen (eine pro Eintrag, Menge zuerst)
  und eine kurze Zubereitung (2–4 nummerierte Schritte, mit \\n getrennt).

Antworte NUR mit JSON, ohne weiteren Text:
{{"plan": [{{"datum": "JJJJ-MM-TT", "mahlzeit": "mittag", "name": "...", "emoji": "🍲",
  "zutaten": ["..."], "zubereitung": "1. …\\n2. …"}}]}}
Erlaubte Werte für "mahlzeit": {", ".join(sorted({m for _, m in felder}))}."""
    try:
        daten = await _ki(hass, "Familienzentrale – Wochenplan", anweisung)
        eintraege = daten.get("plan", []) if isinstance(daten, dict) else daten
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("KI-Wochenplan fehlgeschlagen: %s", err)
        connection.send_error(msg["id"], "ki_fehler", f"Die KI konnte keinen Plan erstellen: {err}")
        return

    erlaubt = set(felder)
    geplant = neue = 0
    for e in eintraege if isinstance(eintraege, list) else []:
        if not isinstance(e, dict):
            continue
        feld = (str(e.get("datum", "")), str(e.get("mahlzeit", "")))
        name = str(e.get("name") or "").strip()
        if feld not in erlaubt or not name:
            continue
        rid = ep.rezept_nach_name(name)
        if not rid and e.get("zutaten"):
            rid = ep.rezept_anlegen(e)
            neue += 1
        ep.plan.setdefault(feld[0], {})[feld[1]] = (
            {"rezept": rid} if rid else {"text": f"{e.get('emoji', '')} {name}".strip()}
        )
        erlaubt.discard(feld)
        geplant += 1
    ep.speichern()
    connection.send_result(msg["id"], {"geplant": geplant, "neue_rezepte": neue})
