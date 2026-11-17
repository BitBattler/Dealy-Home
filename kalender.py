"""Modul „Wandkalender“: registriert das Panel „Familie“ in der Seitenleiste."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback

from .const import DOMAIN, PANEL_COMPONENT, PANEL_URL, STATIC_URL, VERSION

_STATIC_KEY = f"{DOMAIN}_static_registriert"


async def async_setup(hass: HomeAssistant, entry: ConfigEntry) -> CALLBACK_TYPE:
    # Statische Dateien nur einmal pro HA-Lauf registrieren (lässt sich nicht entfernen)
    if not hass.data.get(_STATIC_KEY):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "frontend"), False)]
        )
        hass.data[_STATIC_KEY] = True

    # Cache-Bremse: Version + Änderungszeit der JS-Datei -> jede Änderung lädt neu
    js = Path(__file__).parent / "frontend" / "familienzentrale-panel.js"
    stand = int(await hass.async_add_executor_job(lambda: js.stat().st_mtime))

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_COMPONENT,
        sidebar_title="Familie",
        sidebar_icon="mdi:home-heart",
        module_url=f"{STATIC_URL}/familienzentrale-panel.js?v={VERSION}-{stand}",
        embed_iframe=False,
        require_admin=False,
        config={"titel": entry.title},
    )

    @callback
    def _entfernen() -> None:
        frontend.async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)

    return _entfernen
