"""Sensor mit den Familienmitgliedern und ihren Farben (für Panel und Karten)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event

from .const import CONF_COLOR, CONF_MODULES, CONF_PERSONS, MODULES, rgb_to_hex
from .switch import geraet


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    async_add_entities([PersonenSensor(entry)])


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
                    "bild": state.attributes.get("entity_picture") if state else None,
                    "ort": state.state if state else None,
                }
            )
        return {
            "personen": liste,
            "aktive_module": [m for m in self._entry.options.get(CONF_MODULES, []) if m in MODULES],
        }
