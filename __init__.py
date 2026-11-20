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


def aktive_module(entry: ConfigEntry) -> list[str]:
    """Liste der eingeschalteten Module (nur bekannte Schlüssel)."""
    return [m for m in entry.options.get(CONF_MODULES, []) if m in MODULES]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Familienzentrale einrichten und aktive Module starten."""
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    module = aktive_module(entry)
    # Das Panel „Familie“ braucht es, sobald ein Modul mit Oberfläche aktiv ist
    if {"kalender", "essensplan", "routinen", "punkte"} & set(module):
        from .kalender import async_setup as kalender_setup

        entry.async_on_unload(await kalender_setup(hass, entry))
    if {"routinen", "punkte"} & set(module):
        from .kinder import async_setup as kinder_setup

        entry.async_on_unload(await kinder_setup(hass, entry))
    if "essensplan" in module:
        from .essensplan import async_setup as essensplan_setup

        entry.async_on_unload(await essensplan_setup(hass, entry))
    if "termin_push" in module:
        from .termin_push import TerminPush

        entry.async_on_unload(await TerminPush(hass, entry).async_start())

    # Jede Änderung auf der Setup-Seite lädt die Integration neu,
    # damit Module sauber starten bzw. stoppen.
    entry.async_on_unload(entry.add_update_listener(_async_options_geaendert))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Familienzentrale entladen."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_options_geaendert(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
