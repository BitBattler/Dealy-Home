"""Familienzentrale – Familienplaner für Home Assistant.

Jedes Modul lässt sich über die Setup-Seite (Optionen der Integration)
oder über seinen Schalter ein- und ausschalten.
"""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import CONF_MODULES, MODULES

PLATFORMS: list[Platform] = [Platform.SWITCH, Platform.SENSOR]

type FamilienzentraleConfigEntry = ConfigEntry


def aktive_module(entry: ConfigEntry) -> list[str]:
    """Liste der eingeschalteten Module (nur bekannte Schlüssel)."""
    return [m for m in entry.options.get(CONF_MODULES, []) if m in MODULES]


async def async_setup_entry(hass: HomeAssistant, entry: FamilienzentraleConfigEntry) -> bool:
    """Familienzentrale einrichten."""
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    # Jede Änderung auf der Setup-Seite lädt die Integration neu,
    # damit Module sauber starten bzw. stoppen.
    entry.async_on_unload(entry.add_update_listener(_async_options_geaendert))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: FamilienzentraleConfigEntry) -> bool:
    """Familienzentrale entladen."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_options_geaendert(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
