"""Einrichtung und Setup-Seite der Familienzentrale."""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    ColorRGBSelector,
    EntitySelector,
    EntitySelectorConfig,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .const import (
    CONF_COLOR,
    CONF_MODULES,
    CONF_PERSONS,
    CONF_PIN,
    DEFAULT_COLORS,
    DOMAIN,
    MODULES,
)

PIN_MUSTER = re.compile(r"^\d{4,8}$")


class FamilienzentraleConfigFlow(ConfigFlow, domain=DOMAIN):
    """Erste Einrichtung."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(
                title=user_input[CONF_NAME],
                data={},
                options={CONF_MODULES: [], CONF_PERSONS: {}, CONF_PIN: ""},
            )
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {vol.Required(CONF_NAME, default="Familienzentrale"): TextSelector()}
            ),
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return FamilienzentraleOptionsFlow()


class FamilienzentraleOptionsFlow(OptionsFlow):
    """Setup-Seite: Module, Personen & Farben, Kindersicherung."""

    def __init__(self) -> None:
        self._personen: list[str] = []

    def _speichern(self, **aenderungen: Any) -> ConfigFlowResult:
        return self.async_create_entry(data={**self.config_entry.options, **aenderungen})

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return self.async_show_menu(
            step_id="init",
            menu_options=["module", "personen", "kindersicherung"],
        )

    # --- Module an/aus ------------------------------------------------------
    async def async_step_module(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self._speichern(**{CONF_MODULES: user_input.get(CONF_MODULES, [])})

        aktuell = [m for m in self.config_entry.options.get(CONF_MODULES, []) if m in MODULES]
        return self.async_show_form(
            step_id="module",
            data_schema=vol.Schema(
                {
                    vol.Optional(CONF_MODULES, default=aktuell): SelectSelector(
                        SelectSelectorConfig(
                            options=[
                                SelectOptionDict(value=key, label=name)
                                for key, (name, _icon) in MODULES.items()
                            ],
                            multiple=True,
                            mode=SelectSelectorMode.LIST,
                        )
                    )
                }
            ),
        )

    # --- Personen & Farben --------------------------------------------------
    async def async_step_personen(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            self._personen = user_input.get(CONF_PERSONS, [])
            if not self._personen:
                return self._speichern(**{CONF_PERSONS: {}})
            return await self.async_step_farben()

        aktuell = list(self.config_entry.options.get(CONF_PERSONS, {}))
        return self.async_show_form(
            step_id="personen",
            data_schema=vol.Schema(
                {
                    vol.Optional(CONF_PERSONS, default=aktuell): EntitySelector(
                        EntitySelectorConfig(domain="person", multiple=True)
                    )
                }
            ),
        )

    async def async_step_farben(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        alt: dict[str, dict[str, Any]] = self.config_entry.options.get(CONF_PERSONS, {})

        if user_input is not None:
            personen = {
                eid: {CONF_COLOR: list(user_input.get(eid) or DEFAULT_COLORS[i % len(DEFAULT_COLORS)])}
                for i, eid in enumerate(self._personen)
            }
            return self._speichern(**{CONF_PERSONS: personen})

        schema: dict[Any, Any] = {}
        for i, eid in enumerate(self._personen):
            farbe = alt.get(eid, {}).get(CONF_COLOR) or DEFAULT_COLORS[i % len(DEFAULT_COLORS)]
            schema[vol.Required(eid, default=farbe)] = ColorRGBSelector()

        namen = ", ".join(
            (state.name if (state := self.hass.states.get(eid)) else eid) for eid in self._personen
        )
        return self.async_show_form(
            step_id="farben",
            data_schema=vol.Schema(schema),
            description_placeholders={"personen": namen},
        )

    # --- Kindersicherung ----------------------------------------------------
    async def async_step_kindersicherung(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            pin = (user_input.get(CONF_PIN) or "").strip()
            if pin and not PIN_MUSTER.match(pin):
                errors[CONF_PIN] = "pin_ungueltig"
            else:
                return self._speichern(**{CONF_PIN: pin})

        return self.async_show_form(
            step_id="kindersicherung",
            data_schema=vol.Schema(
                {
                    vol.Optional(CONF_PIN, default=""): TextSelector(
                        TextSelectorConfig(type=TextSelectorType.PASSWORD)
                    )
                }
            ),
            errors=errors,
        )
