"""Sensor mit den Familienmitgliedern und ihren Farben (für Panel und Karten)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event

from homeassistant.util import slugify

from .const import (
    CONF_CALENDARS,
    CONF_COLOR,
    CONF_ICON,
    CONF_MODULES,
    CONF_PERSONS,
    CONF_PET_NAME,
    CONF_PETS,
    CONF_SHOPPING_LIST,
    DOMAIN,
    MODULES,
    SIGNAL_PUNKTE,
    rgb_to_hex,
    stichwoerter,
)
from .switch import geraet


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    entitaeten: list[SensorEntity] = [PersonenSensor(entry)]
    if "punkte" in entry.options.get(CONF_MODULES, []):
        entitaeten += [PunkteSensor(entry, eid) for eid in entry.options.get(CONF_PERSONS, {})]
    async_add_entities(entitaeten)


class PunkteSensor(SensorEntity):
    """Punktestand einer Person (Modul „Punkte & Belohnungen“)."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:star-circle"
    _attr_native_unit_of_measurement = "⭐"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, entry: ConfigEntry, person: str) -> None:
        self._entry = entry
        self._person = person
        self._attr_unique_id = f"{entry.entry_id}_punkte_{person}"
        self._attr_device_info = geraet(entry)

    @property
    def name(self) -> str:
        state = self.hass.states.get(self._person) if self.hass else None
        return f"Punkte {state.name if state else self._person}"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_PUNKTE, self.async_write_ha_state)
        )

    @property
    def native_value(self) -> int:
        kinder = self.hass.data.get(f"{DOMAIN}_kinder")
        return int(kinder.d["punkte"].get(self._person, 0)) if kinder else 0

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"person": self._person}


class PersonenSensor(SensorEntity):
    """Zustand = Anzahl Personen; Attribute = Personen mit Farbe, Bild, Ort + aktive Module."""

    _attr_has_entity_name = True
    _attr_name = "Familie"
    _attr_icon = "mdi:account-group"
    _attr_native_unit_of_measurement = "Personen"

    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_personen"
        self._attr_device_info = geraet(entry)

    @property
    def _personen(self) -> dict[str, dict[str, Any]]:
        return self._entry.options.get(CONF_PERSONS, {})

    async def async_added_to_hass(self) -> None:
        # Name, Bild oder Ort einer Person ändert sich -> Attribute neu schreiben
        if self._personen:
            self.async_on_remove(
                async_track_state_change_event(
                    self.hass, list(self._personen), self._person_geaendert
                )
            )

    @callback
    def _person_geaendert(self, event: Event[EventStateChangedData]) -> None:
        self.async_write_ha_state()

    @property
    def native_value(self) -> int:
        return len(self._personen)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        liste = []
        for eid, cfg in self._personen.items():
            state = self.hass.states.get(eid)
            liste.append(
                {
                    "entity_id": eid,
                    "name": state.name if state else eid,
                    "farbe": rgb_to_hex(cfg.get(CONF_COLOR)),
                    "stichwoerter": stichwoerter(cfg),
                    "bild": state.attributes.get("entity_picture") if state else None,
                    "ort": state.state if state else None,
                }
            )
        # Haustiere: Mitglieder ohne HA-Person, mit Icon statt Foto
        for tier in self._entry.options.get(CONF_PETS, []):
            liste.append(
                {
                    "entity_id": f"haustier.{slugify(tier[CONF_PET_NAME])}",
                    "name": tier[CONF_PET_NAME],
                    "farbe": rgb_to_hex(tier.get(CONF_COLOR)),
                    "stichwoerter": stichwoerter(tier),
                    "bild": None,
                    "icon": tier.get(CONF_ICON) or "mdi:paw",
                    "ort": None,
                }
            )
        return {
            # Erkennungsmerkmal für das Panel
            "familienzentrale": True,
            "personen": liste,
            "kalender": self._entry.options.get(CONF_CALENDARS, []),
            "einkaufsliste": self._entry.options.get(CONF_SHOPPING_LIST) or None,
            "aktive_module": [m for m in self._entry.options.get(CONF_MODULES, []) if m in MODULES],
        }
