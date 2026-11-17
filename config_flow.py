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
    BooleanSelector,
    ColorRGBSelector,
    IconSelector,
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .const import (
    CONF_CALENDARS,
    CONF_COLOR,
    CONF_ICON,
    CONF_KEYWORDS,
    CONF_MEALS,
    CONF_MODULES,
    CONF_SHOPPING_LIST,
    DEFAULT_MEALS,
    MAHLZEIT_NAMEN,
    MAHLZEITEN,
    CONF_NOTIFY,
    CONF_PERSONS,
    CONF_PET_NAME,
    CONF_PETS,
    CONF_PIN,
    CONF_PUSH_DAYS,
    DEFAULT_COLORS,
    DEFAULT_PUSH_DAYS,
    DOMAIN,
    MODULES,
)

PIN_MUSTER = re.compile(r"^\d{4,8}$")
KEINE = "-"


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
    """Setup-Seite: Module, Personen, Kalender, Kindersicherung."""

    def __init__(self) -> None:
        self._personen: list[str] = []
        self._index = 0
        self._neu: dict[str, dict[str, Any]] = {}
        self._tiere: list[dict[str, Any]] = []

    def _speichern(self, **aenderungen: Any) -> ConfigFlowResult:
        return self.async_create_entry(data={**self.config_entry.options, **aenderungen})

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return self.async_show_menu(
            step_id="init",
            menu_options=["module", "personen", "haustiere", "kalender", "essensplan", "kindersicherung"],
        )

    # --- Essensplan ---------------------------------------------------------
    async def async_step_essensplan(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self._speichern(
                **{
                    CONF_SHOPPING_LIST: user_input.get(CONF_SHOPPING_LIST) or "",
                    CONF_MEALS: user_input.get(CONF_MEALS) or DEFAULT_MEALS,
                }
            )

        opts = self.config_entry.options
        schema: dict[Any, Any] = {}
        liste = opts.get(CONF_SHOPPING_LIST)
        schema[
            vol.Optional(CONF_SHOPPING_LIST, description={"suggested_value": liste} if liste else None)
        ] = EntitySelector(EntitySelectorConfig(domain="todo"))
        schema[vol.Optional(CONF_MEALS, default=opts.get(CONF_MEALS, DEFAULT_MEALS))] = SelectSelector(
            SelectSelectorConfig(
                options=[SelectOptionDict(value=m, label=MAHLZEIT_NAMEN[m]) for m in MAHLZEITEN],
                multiple=True,
                mode=SelectSelectorMode.LIST,
            )
        )
        return self.async_show_form(step_id="essensplan", data_schema=vol.Schema(schema))

    # --- Haustiere (Mitglieder ohne HA-Person, z. B. der Hund) -------------
    async def async_step_haustiere(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        alt: list[dict[str, Any]] = self.config_entry.options.get(CONF_PETS, [])
        namen = [t[CONF_PET_NAME] for t in alt]

        if user_input is not None:
            behalten = user_input.get("behalten", namen)
            self._tiere = [t for t in alt if t[CONF_PET_NAME] in behalten]
            if user_input.get("neu"):
                return await self.async_step_haustier()
            return self._speichern(**{CONF_PETS: self._tiere})

        schema: dict[Any, Any] = {}
        if alt:
            schema[vol.Optional("behalten", default=namen)] = SelectSelector(
                SelectSelectorConfig(options=namen, multiple=True, mode=SelectSelectorMode.LIST)
            )
        schema[vol.Optional("neu", default=not alt)] = BooleanSelector()
        return self.async_show_form(step_id="haustiere", data_schema=vol.Schema(schema))

    async def async_step_haustier(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            name = (user_input.get(CONF_PET_NAME) or "").strip()
            if name and name not in [t[CONF_PET_NAME] for t in self._tiere]:
                self._tiere.append(
                    {
                        CONF_PET_NAME: name,
                        CONF_ICON: user_input.get(CONF_ICON) or "mdi:paw",
                        CONF_COLOR: list(user_input.get(CONF_COLOR) or [141, 110, 99]),
                        CONF_KEYWORDS: (user_input.get(CONF_KEYWORDS) or "").strip(),
                    }
                )
            if user_input.get("weiteres"):
                return await self.async_step_haustier()
            return self._speichern(**{CONF_PETS: self._tiere})

        return self.async_show_form(
            step_id="haustier",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_PET_NAME): TextSelector(),
                    vol.Optional(CONF_ICON, default="mdi:dog"): IconSelector(),
                    vol.Required(CONF_COLOR, default=[141, 110, 99]): ColorRGBSelector(),
                    vol.Optional(CONF_KEYWORDS, default=""): TextSelector(),
                    vol.Optional("weiteres", default=False): BooleanSelector(),
                }
            ),
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

    # --- Personen: Auswahl, dann pro Person Farbe / Stichwörter / Handy ----
    async def async_step_personen(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            self._personen = user_input.get(CONF_PERSONS, [])
            self._index = 0
            self._neu = {}
            if not self._personen:
                return self._speichern(**{CONF_PERSONS: {}})
            return await self.async_step_person()

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

    def _handys(self) -> list[SelectOptionDict]:
        dienste = sorted(
            s for s in self.hass.services.async_services_for_domain("notify")
            if s.startswith("mobile_app_")
        )
        return [SelectOptionDict(value=KEINE, label="— keins —")] + [
            SelectOptionDict(value=s, label=s.removeprefix("mobile_app_").replace("_", " ").title())
            for s in dienste
        ]

    async def async_step_person(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        eid = self._personen[self._index]
        alt: dict[str, Any] = self.config_entry.options.get(CONF_PERSONS, {}).get(eid, {})

        if user_input is not None:
            handy = user_input.get(CONF_NOTIFY) or KEINE
            self._neu[eid] = {
                CONF_COLOR: list(user_input.get(CONF_COLOR) or DEFAULT_COLORS[self._index % len(DEFAULT_COLORS)]),
                CONF_KEYWORDS: (user_input.get(CONF_KEYWORDS) or "").strip(),
                CONF_NOTIFY: "" if handy == KEINE else handy,
            }
            self._index += 1
            if self._index >= len(self._personen):
                return self._speichern(**{CONF_PERSONS: self._neu})
            return await self.async_step_person()

        state = self.hass.states.get(eid)
        name = state.name if state else eid
        farbe = alt.get(CONF_COLOR) or DEFAULT_COLORS[self._index % len(DEFAULT_COLORS)]
        woerter = alt.get(CONF_KEYWORDS) or (name.split()[0] if name else "")
        handys = self._handys()
        handy = alt.get(CONF_NOTIFY) or KEINE
        if handy not in {h["value"] for h in handys}:  # Handy gibt es nicht mehr
            handy = KEINE

        return self.async_show_form(
            step_id="person",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_COLOR, default=farbe): ColorRGBSelector(),
                    vol.Optional(CONF_KEYWORDS, default=woerter): TextSelector(),
                    vol.Optional(CONF_NOTIFY, default=handy): SelectSelector(
                        SelectSelectorConfig(options=handys, mode=SelectSelectorMode.DROPDOWN)
                    ),
                }
            ),
            description_placeholders={
                "name": name,
                "nr": str(self._index + 1),
                "anzahl": str(len(self._personen)),
            },
        )

    # --- Kalender & Push ----------------------------------------------------
    async def async_step_kalender(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self._speichern(
                **{
                    CONF_CALENDARS: user_input.get(CONF_CALENDARS, []),
                    CONF_PUSH_DAYS: int(user_input.get(CONF_PUSH_DAYS) or DEFAULT_PUSH_DAYS),
                }
            )

        opts = self.config_entry.options
        return self.async_show_form(
            step_id="kalender",
            data_schema=vol.Schema(
                {
                    vol.Optional(CONF_CALENDARS, default=opts.get(CONF_CALENDARS, [])): EntitySelector(
                        EntitySelectorConfig(domain="calendar", multiple=True)
                    ),
                    vol.Optional(
                        CONF_PUSH_DAYS, default=opts.get(CONF_PUSH_DAYS, DEFAULT_PUSH_DAYS)
                    ): NumberSelector(
                        NumberSelectorConfig(min=7, max=365, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="Tage")
                    ),
                }
            ),
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
