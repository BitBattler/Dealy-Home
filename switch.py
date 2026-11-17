"""Ein Schalter pro Modul – dieselbe Einstellung wie auf der Setup-Seite."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import CONF_MODULES, DOMAIN, MODULES


def geraet(entry: ConfigEntry) -> DeviceInfo:
    """Gemeinsames Gerät für alle Entitäten."""
    return DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=entry.title,
        manufacturer="Familienzentrale",
        entry_type=DeviceEntryType.SERVICE,
    )


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    async_add_entities(ModulSchalter(entry, key) for key in MODULES)


class ModulSchalter(SwitchEntity):
    """Schaltet ein Modul ein oder aus."""

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, entry: ConfigEntry, key: str) -> None:
        self._entry = entry
        self._key = key
        name, icon = MODULES[key]
        self._attr_name = name
        self._attr_icon = icon
        self._attr_unique_id = f"{entry.entry_id}_modul_{key}"
        self._attr_device_info = geraet(entry)

    @property
    def is_on(self) -> bool:
        return self._key in self._entry.options.get(CONF_MODULES, [])

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._setzen(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._setzen(False)

    async def _setzen(self, an: bool) -> None:
        module = [m for m in self._entry.options.get(CONF_MODULES, []) if m in MODULES]
        if an and self._key not in module:
            module.append(self._key)
        elif not an and self._key in module:
            module.remove(self._key)
        else:
            return
        # Reihenfolge wie in MODULES halten
        module = [m for m in MODULES if m in module]
        # Löst den Update-Listener aus -> Integration lädt neu
        self.hass.config_entries.async_update_entry(
            self._entry, options={**self._entry.options, CONF_MODULES: module}
        )
