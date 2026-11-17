/*
 * Familienzentrale – Panel „Familie“
 * Wochen-Zeitraster, Monat, Liste, Personenfilter, Termine anlegen.
 * Reines JavaScript ohne Build-Schritt. Daten über die normale HA-Anmeldung.
 */

const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WT_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
  "September", "Oktober", "November", "Dezember"];
const NEUTRAL = "#90a4ae";
const STD = 48;            // Pixel pro Stunde im Zeitraster
const MAX_CHIPS = 4;       // Monatsansicht

// Leiste links: Modul-Schlüssel -> Eintrag (nur aktive Module erscheinen)
const LEISTE = [
  { key: "kalender", icon: "mdi:calendar-month", label: "Kalender" },
  { key: "stundenplan", icon: "mdi:school", label: "Schule" },
  { key: "routinen", icon: "mdi:check-decagram", label: "Aufgaben" },
  { key: "punkte", icon: "mdi:treasure-chest", label: "Schätze" },
  { key: "essensplan", icon: "mdi:food-apple", label: "Essen" },
  { key: "listen", icon: "mdi:clipboard-list", label: "Listen" },
];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const tagStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const plusTage = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const tagKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const montag = (d) => plusTage(tagStart(d), -((d.getDay() + 6) % 7));
const wt = (d) => (d.getDay() + 6) % 7;
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ddmm = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
const datumKurz = (d) => `${WT[wt(d)]} ${ddmm(d)}`;
const parseDatum = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const kw = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - tag);
  const j = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - j) / 86400000 + 1) / 7);
};
const textFarbe = (hex) => {
  const h = (hex || NEUTRAL).replace("#", "");
  const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? "#1b1b1b" : "#ffffff";
};
const pastell = (f, anteil = 30) => `color-mix(in srgb, ${f} ${anteil}%, var(--fz-karte))`;
const initial = (n) => (n || "?").trim().charAt(0).toUpperCase();

// Schrift einmal ins Dokument laden (in Shadow-DOM wirkt @font-face nicht)
if (!document.getElementById("fz-schrift")) {
  const l = document.createElement("link");
  l.id = "fz-schrift";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap";
  document.head.appendChild(l);
}

class FamilienzentralePanel extends HTMLElement {
  constructor() {
    super();
    this._ansicht = null;           // woche | arbeitswoche | monat | liste
    this._ref = tagStart(new Date());
    this._events = [];
    this._sig = "";
    this._ladeNr = 0;
    this._detail = null;
    this._neu = null;               // Formular "Termin anlegen"
    this._filter = null;            // entity_id einer Person oder null
    this._menuOffen = false;
    this._fehler = "";
    this._scrollNachJetzt = true;
    this._toast = "";
    // Essensplan
    this._seite = null;             // "kalender" | "essen"
    this._essen = null;             // {rezepte, plan, mahlzeiten, einkaufsliste}
    this._essenRef = montag(new Date());
    this._essenAnsicht = "plan";    // "plan" | "rezepte"
    this._slot = null;              // Dialog: Mahlzeit wählen
    this._rezept = null;            // Dialog: Rezept bearbeiten
  }

  // ---------------- HA-Schnittstelle ----------------
  set hass(hass) {
    const erst = !this._hass;
    this._hass = hass;
    if (this._menu) this._menu.hass = hass;
    if (erst) {
      const mod = this._module();
      this._seite = mod.includes("kalender") || !mod.includes("essensplan") ? "kalender" : "essen";
      this._aufbauen();
      this._sig = this._signatur();
      this._laden();
      return;
    }
    const sig = this._signatur();
    if (sig !== this._sig) { this._sig = sig; this._laden(); }
  }
  get hass() { return this._hass; }
  set narrow(n) {
    this._narrow = n;
    if (this._menu) this._menu.narrow = n;
    if (this._root) this._zeichnen();
  }
  set panel(p) { this._panel = p; }

  connectedCallback() {
    this._timer = setInterval(() => this._laden(), 5 * 60 * 1000);
    this._uhr = setInterval(() => { this._zeichneKopf(); this._zeichneJetztLinie(); }, 30 * 1000);
  }
  disconnectedCallback() {
    clearInterval(this._timer);
    clearInterval(this._uhr);
  }

  // ---------------- Daten ----------------
  _sensor() {
    if (!this._hass) return null;
    return Object.values(this._hass.states).find((s) => s.attributes && s.attributes.familienzentrale === true) || null;
  }
  _signatur() {
    const s = this._sensor();
    return s ? JSON.stringify([s.attributes.personen, s.attributes.kalender, s.attributes.aktive_module]) : "";
  }
  _personen() { return (this._sensor()?.attributes.personen) || []; }
  _kalender() { return (this._sensor()?.attributes.kalender) || []; }
  _module() { return (this._sensor()?.attributes.aktive_module) || []; }
  _modus() { return this._ansicht || (this._narrow ? "liste" : "woche"); }
  _tageProWoche() { return this._modus() === "arbeitswoche" ? 5 : 7; }

  _bereich() {
    const m = this._modus();
    if (m === "monat") {
      const start = montag(new Date(this._ref.getFullYear(), this._ref.getMonth(), 1));
      return { start, ende: plusTage(start, 42) };
    }
    if (m === "liste") {
      const start = tagStart(this._ref);
      return { start, ende: plusTage(start, 14) };
    }
    const start = montag(this._ref);
    return { start, ende: plusTage(start, 7) };
  }

  async _laden() {
    if (!this._hass) return;
    if (this._seite === "essen") { await this._ladeEssen(); return; }
    const nr = ++this._ladeNr;
    const kal = this._kalender();
    const { start, ende } = this._bereich();
    const heute = tagStart(new Date());
    const von = start < heute ? start : heute;
    const bis = ende > plusTage(heute, 30) ? ende : plusTage(heute, 30);
    this._fehler = "";
    const listen = await Promise.all(kal.map((eid) =>
      this._hass.callApi("GET",
        `calendars/${eid}?start=${encodeURIComponent(von.toISOString())}&end=${encodeURIComponent(bis.toISOString())}`)
        .then((evs) => evs.map((e) => this._ev(e, eid)))
        .catch((err) => {
          console.warn("Familienzentrale:", eid, err);
          this._fehler = `Kalender „${eid}“ konnte nicht geladen werden.`;
          return [];
        })));
    if (nr !== this._ladeNr) return;
    this._events = listen.flat().sort((a, b) => (a.start - b.start) || (b.ganz - a.ganz));
    this._zeichnen();
  }

  _ev(e, kal) {
    const ganz = !!(e.start && e.start.date);
    const start = ganz ? parseDatum(e.start.date) : new Date(e.start.dateTime || e.start);
    const ende = ganz ? parseDatum(e.end.date) : new Date(e.end.dateTime || e.end);
    const titel = e.summary || "(ohne Titel)";
    const klein = titel.toLowerCase();
    // Ohne Stichwörter gilt der Name der Person als Stichwort
    const personen = this._personen().filter((p) =>
      ((p.stichwoerter && p.stichwoerter.length) ? p.stichwoerter : [p.name])
        .some((w) => w && klein.includes(String(w).toLowerCase())));
    return { titel, start, ende, ganz, ort: e.location || "", text: e.description || "", kal, personen,
      serie: !!(e.rrule || e.recurrence_id), uid: e.uid || null, rid: e.recurrence_id || null };
  }

  // CalendarEntityFeature: CREATE_EVENT = 1, DELETE_EVENT = 2, UPDATE_EVENT = 4
  _features(eid) { return (this._hass.states[eid]?.attributes.supported_features) || 0; }
  _kannAnlegen(eid) { return !!(this._features(eid) & 1); }
  _kannLoeschen(eid) { return !!(this._features(eid) & 2); }
  _kannAendern(eid) {
    const f = this._features(eid);
    return !!(f & 4) || ((f & 2) && (f & 1));
  }

  _sichtbar(ev) {
    return !this._filter || ev.personen.some((p) => p.entity_id === this._filter);
  }

  _tageVon(ev) {
    const tage = [];
    let d = tagStart(ev.start);
    let letzter;
    if (ev.ganz) letzter = plusTage(ev.ende, -1);
    else letzter = (ev.ende > ev.start && ev.ende.getTime() === tagStart(ev.ende).getTime())
      ? plusTage(ev.ende, -1) : tagStart(ev.ende);
    if (letzter < d) letzter = d;
    for (let i = 0; d <= letzter && i < 62; i++, d = plusTage(d, 1)) tage.push(tagKey(d));
    return tage;
  }

  _proTag() {
    const m = new Map();
    this._events.forEach((ev, i) => {
      if (!this._sichtbar(ev)) return;
      for (const k of this._tageVon(ev)) {
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(i);
      }
    });
    return m;
  }

  _farbe(ev) { return ev.personen[0]?.farbe || NEUTRAL; }

  _badges(ev) {
    return ev.personen.map((p) =>
      `<span class="badge" style="background:${p.farbe};color:${textFarbe(p.farbe)}" title="${esc(p.name)}">${
        p.icon ? `<ha-icon icon="${esc(p.icon)}"></ha-icon>` : esc(initial(p.name))}</span>`).join("");
  }

  _zeitText(ev) {
    if (ev.ganz) {
      const letzter = plusTage(ev.ende, -1);
      return letzter > ev.start
        ? `${datumKurz(ev.start)} – ${datumKurz(letzter)} · ganztägig`
        : `${WT_LANG[wt(ev.start)]}, ${ddmm(ev.start)} · ganztägig`;
    }
    return tagKey(ev.start) === tagKey(ev.ende)
      ? `${WT_LANG[wt(ev.start)]}, ${ddmm(ev.start)} · ${hhmm(ev.start)} – ${hhmm(ev.ende)}`
      : `${datumKurz(ev.start)} ${hhmm(ev.start)} – ${datumKurz(ev.ende)} ${hhmm(ev.ende)}`;
  }

  // ---------------- Aufbau ----------------
  _aufbauen() {
    this._root = this.attachShadow({ mode: "open" });
    this._root.innerHTML = `
      <style>${FamilienzentralePanel.css}</style>
      <div class="app">
        <nav id="leiste"></nav>
        <main>
          <header id="kopf"></header>
          <section id="inhalt"></section>
        </main>
      </div>
      <div id="dialog"></div>
      <div id="toast"></div>`;
    this._menu = document.createElement("ha-menu-button");
    this._menu.hass = this._hass;
    this._menu.narrow = this._narrow;
    this._root.addEventListener("click", (e) => this._klick(e));
    this._root.addEventListener("submit", (e) => {
      e.preventDefault();
      if (this._neu) this._speichern();
    });
    // Rezeptsuche im Mahlzeit-Dialog: Liste filtern, ohne neu zu zeichnen
    this._root.addEventListener("input", (e) => {
      if (e.target.id !== "f-suche") return;
      const q = e.target.value.trim().toLowerCase();
      this._root.querySelectorAll(".rwahl").forEach((b) => { b.hidden = !!q && !b.dataset.name.includes(q); });
    });
  }

  _zeigeToast(text) {
    this._toast = text;
    const t = this._root.getElementById("toast");
    t.innerHTML = `<div class="toast">${esc(text)}</div>`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.innerHTML = ""; }, 2500);
  }

  _navigiere(pfad) {
    history.pushState(null, "", pfad);
    window.dispatchEvent(new CustomEvent("location-changed"));
  }

  _klick(e) {
    const el = e.target.closest("[data-a],[data-ev]");
    if (!el) { if (this._menuOffen) { this._menuOffen = false; this._zeichneKopf(); } return; }
    if (el.dataset.ev !== undefined) {
      const ev = this._events[Number(el.dataset.ev)];
      // Bearbeitbar? Dann direkt das Formular, sonst nur die Ansicht
      if (ev.uid && this._kannAendern(ev.kal)) this._oeffneBearbeiten(ev);
      else { this._detail = ev; this._zeichneDialog(); }
      return;
    }
    const a = el.dataset.a;
    const m = this._modus();
    const neuLaden = () => { this._zeichnen(); this._laden(); };

    const zu = () => { this._detail = null; this._neu = null; this._slot = null; this._rezept = null; this._zeichneDialog(); };
    if (a === "zu") { if (e.target === el) zu(); return; }
    if (a === "schliessen") { zu(); return; }
    if (this._klickEssen(a)) return;
    if (a === "speichern") { this._speichern(); return; }
    if (a === "loeschen") { this._loeschen(); return; }
    if (a === "ansehen" && this._neu?.ev) { this._detail = this._neu.ev; this._neu = null; this._zeichneDialog(); return; }
    if (a === "aendern" && this._detail) { this._oeffneBearbeiten(this._detail); return; }
    if (a === "menu") { this._menuOffen = !this._menuOffen; this._zeichneKopf(); return; }
    if (a === "heute") { this._ref = tagStart(new Date()); this._scrollNachJetzt = true; neuLaden(); return; }
    if (a === "zurueck" || a === "vor") {
      const r = a === "vor" ? 1 : -1;
      if (m === "monat") this._ref = new Date(this._ref.getFullYear(), this._ref.getMonth() + r, 1);
      else this._ref = plusTage(this._ref, r * (m === "liste" ? 14 : 7));
      neuLaden();
      return;
    }
    if (a.startsWith("tab-")) { this._ref = parseDatum(a.slice(4)); neuLaden(); return; }
    if (a.startsWith("ansicht-")) {
      this._ansicht = a.slice(8);
      this._menuOffen = false;
      this._scrollNachJetzt = true;
      neuLaden();
      return;
    }
    if (a.startsWith("tag-")) { this._ref = parseDatum(a.slice(4)); this._ansicht = "woche"; neuLaden(); return; }
    if (a === "alle") { this._filter = null; this._zeichnen(); return; }
    if (a.startsWith("person-")) {
      const eid = a.slice(7);
      this._filter = this._filter === eid ? null : eid;
      this._zeichnen();
      return;
    }
    if (a === "neu" || a.startsWith("neu-")) { this._oeffneNeu(a.startsWith("neu-") ? a.slice(4) : null); return; }
    if (a.startsWith("wer-") && this._neu) {
      const eid = a.slice(4);
      const s = new Set(this._neu.personen);
      s.has(eid) ? s.delete(eid) : s.add(eid);
      this._neu.personen = [...s];
      this._formularMerken();
      this._zeichneDialog();
      return;
    }
    if (a === "ganztag" && this._neu) { this._formularMerken(); this._zeichneDialog(); return; }
    if (a === "aktualisieren") { this._laden(); this._zeigeToast("Aktualisiert"); return; }
    if (a === "einstellungen") { this._navigiere("/config/integrations/integration/familienzentrale"); return; }
    if (a === "bearbeiten") { this._navigiere("/calendar"); return; }
    if (a.startsWith("modul-")) {
      const k = a.slice(6);
      if (k === "kalender" || k === "essensplan") {
        this._seite = k === "kalender" ? "kalender" : "essen";
        this._menuOffen = false;
        this._scrollNachJetzt = true;
        this._zeichnen();
        this._laden();
      } else this._zeigeToast("Dieses Modul kommt bald ✨");
      return;
    }
  }

  // ======================= Essensplan =======================
  async _ladeEssen() {
    try {
      this._essen = await this._hass.callWS({
        type: "familienzentrale/essen/laden", start: tagKey(this._essenRef), tage: 7,
      });
      this._fehler = "";
    } catch (err) {
      this._essen = null;
      this._fehler = err.message || String(err);
    }
    this._zeichnen();
  }

  async _ws(daten, meldung) {
    try {
      const r = await this._hass.callWS(daten);
      if (meldung) this._zeigeToast(meldung);
      await this._ladeEssen();
      return r;
    } catch (err) {
      this._zeigeToast(`Fehler: ${err.message || err}`);
      return null;
    }
  }

  _klickEssen(a) {
    if (this._seite !== "essen") return false;
    if (a === "heute") { this._essenRef = montag(new Date()); this._ladeEssen(); return true; }
    if (a === "zurueck" || a === "vor") {
      this._essenRef = plusTage(this._essenRef, a === "vor" ? 7 : -7);
      this._ladeEssen();
      return true;
    }
    if (a === "essen-plan" || a === "essen-rezepte") {
      this._essenAnsicht = a.slice(6);
      this._zeichnen();
      return true;
    }
    if (a.startsWith("plan-")) {
      const [datum, mahlzeit] = a.slice(5).split("|");
      const e = this._essen?.plan?.[datum]?.[mahlzeit] || {};
      this._slot = { datum, mahlzeit, rezept: e.rezept || null, text: e.text || "" };
      this._zeichneDialog();
      setTimeout(() => this._root.querySelector("#f-suche")?.focus(), 50);
      return true;
    }
    if (a.startsWith("wahl-") && this._slot) {
      const s = this._slot;
      this._slot = null;
      this._ws({ type: "familienzentrale/essen/plan_setzen", datum: s.datum, mahlzeit: s.mahlzeit, rezept: a.slice(5) });
      return true;
    }
    if (a === "slot-text" && this._slot) {
      const text = this._root.querySelector("#f-suche")?.value.trim();
      if (!text) { this._zeigeToast("Bitte etwas eingeben."); return true; }
      const s = this._slot;
      this._slot = null;
      this._ws({ type: "familienzentrale/essen/plan_setzen", datum: s.datum, mahlzeit: s.mahlzeit, text });
      return true;
    }
    if (a === "slot-weg" && this._slot) {
      const s = this._slot;
      this._slot = null;
      this._ws({ type: "familienzentrale/essen/plan_setzen", datum: s.datum, mahlzeit: s.mahlzeit });
      return true;
    }
    if (a === "slot-rezept" && this._slot?.rezept) { this._oeffneRezept(this._slot.rezept); return true; }
    if (a === "rezept-neu") { this._oeffneRezept(null); return true; }
    if (a.startsWith("rezept-oeffnen-")) { this._oeffneRezept(a.slice(15)); return true; }
    if (a === "rezept-speichern") { this._rezeptSpeichern(); return true; }
    if (a === "rezept-loeschen") { this._rezeptLoeschen(); return true; }
    if (a === "einkaufen") { this._einkaufen(); return true; }
    if (a === "neu") { this._oeffneRezept(null); return true; }
    return false;
  }

  _oeffneRezept(id) {
    const r = id ? this._essen?.rezepte?.[id] : null;
    this._slot = null;
    this._rezept = {
      id: id || null, name: r?.name || "", emoji: r?.emoji || "", portionen: r?.portionen || 4,
      zutaten: (r?.zutaten || []).join("\n"), zubereitung: r?.zubereitung || "", link: r?.link || "",
      loeschenBestaetigen: false,
    };
    this._zeichneDialog();
    if (!id) setTimeout(() => this._root.querySelector("#r-name")?.focus(), 50);
  }

  _rezeptMerken() {
    const f = (id) => this._root.querySelector(id);
    if (!this._rezept || !f("#r-name")) return;
    Object.assign(this._rezept, {
      name: f("#r-name").value, emoji: f("#r-emoji").value, portionen: Number(f("#r-portionen").value) || 4,
      zutaten: f("#r-zutaten").value, zubereitung: f("#r-zubereitung").value, link: f("#r-link").value,
    });
  }

  async _rezeptSpeichern() {
    this._rezeptMerken();
    const r = this._rezept;
    if (!r.name.trim()) { this._zeigeToast("Bitte einen Namen eingeben."); return; }
    const daten = {
      type: "familienzentrale/essen/rezept_speichern", name: r.name.trim(), emoji: r.emoji.trim(),
      portionen: Math.max(1, Math.min(50, r.portionen)),
      zutaten: r.zutaten.split("\n").map((z) => z.trim()).filter(Boolean),
      zubereitung: r.zubereitung, link: r.link.trim(),
    };
    if (r.id) daten.id = r.id;
    this._rezept = null;
    this._zeichneDialog();
    await this._ws(daten, "Rezept gespeichert ✔");
  }

  async _rezeptLoeschen() {
    const r = this._rezept;
    if (!r?.id) return;
    if (!r.loeschenBestaetigen) { this._rezeptMerken(); r.loeschenBestaetigen = true; this._zeichneDialog(); return; }
    this._rezept = null;
    this._zeichneDialog();
    await this._ws({ type: "familienzentrale/essen/rezept_loeschen", id: r.id }, "Rezept gelöscht");
  }

  async _einkaufen() {
    if (!this._essen?.einkaufsliste) {
      this._zeigeToast("Keine Einkaufsliste gewählt – ⚙️ → Konfigurieren → „🍝 Essensplan“.");
      return;
    }
    try {
      const r = await this._hass.callWS({ type: "familienzentrale/essen/einkaufen", start: tagKey(this._essenRef), tage: 7 });
      if (!r.hinzugefuegt && !r.schon_da) this._zeigeToast("Diese Woche sind keine Rezepte mit Zutaten geplant.");
      else this._zeigeToast(`🛒 ${r.hinzugefuegt} Zutaten auf „${r.liste}“${r.schon_da ? ` (${r.schon_da} waren schon drauf)` : ""}`);
    } catch (err) {
      this._zeigeToast(`Fehler: ${err.message || err}`);
    }
  }

  _mahlzeitName(m) { return { fruehstueck: "🥣 Frühstück", mittag: "🍝 Mittag", abend: "🌙 Abend" }[m] || m; }

  _eintragAnzeige(e) {
    if (!e) return null;
    if (e.rezept) {
      const r = this._essen?.rezepte?.[e.rezept];
      if (r) return { emoji: r.emoji || "🍽", name: r.name, rezept: true };
    }
    return e.text ? { emoji: "", name: e.text, rezept: false } : null;
  }

  _essenKopf() {
    const s = this._essenRef;
    const e = plusTage(s, 6);
    const titel = this._panel?.config?.titel || "Familie";
    const a = this._essenAnsicht;
    this._root.getElementById("kopf").innerHTML = `
      <div class="kopf-links">
        <div class="titelzeile">${this._narrow ? '<span id="menuplatz"></span>' : ""}
          <h1>${hhmm(new Date())} <span class="strich">|</span> ${esc(titel)}</h1></div>
        <div class="tabs">
          <button class="rund" data-a="heute" title="Diese Woche"><ha-icon icon="mdi:calendar-today"></ha-icon></button>
          <button class="tab" data-a="zurueck">‹</button>
          <span class="tab aktiv">KW ${kw(s)} · ${ddmm(s)} – ${ddmm(e)}</span>
          <button class="tab" data-a="vor">›</button>
          <span class="trenner"></span>
          <button class="tab ${a === "plan" ? "aktiv" : ""}" data-a="essen-plan">🗓 Wochenplan</button>
          <button class="tab ${a === "rezepte" ? "aktiv" : ""}" data-a="essen-rezepte">📖 Rezepte</button>
        </div>
      </div>
      <div class="kopf-rechts">
        <button class="knopf-gross" data-a="einkaufen" title="Zutaten dieser Woche auf die Einkaufsliste">
          <ha-icon icon="mdi:cart-plus"></ha-icon><span>Auf die Einkaufsliste</span></button>
        <button class="zahnrad" data-a="einstellungen" title="Einstellungen"><ha-icon icon="mdi:cog"></ha-icon></button>
      </div>`;
    if (this._narrow) this._root.getElementById("menuplatz").appendChild(this._menu);
  }

  _essenInhalt() {
    if (!this._essen) {
      return `<div class="hinweis">${this._fehler ? esc(this._fehler) : "Lädt …"}</div>`;
    }
    return this._essenAnsicht === "rezepte" ? this._rezeptListe() : this._wochenplan();
  }

  _wochenplan() {
    const m = this._essen.mahlzeiten || ["mittag", "abend"];
    const heute = tagKey(new Date());
    let html = `<div class="essen"><div class="eplan" style="grid-template-columns:110px repeat(${m.length}, minmax(0,1fr))">
      <div></div>${m.map((x) => `<div class="ekopf">${this._mahlzeitName(x)}</div>`).join("")}`;
    for (let i = 0; i < 7; i++) {
      const d = plusTage(this._essenRef, i);
      const k = tagKey(d);
      html += `<div class="etag ${k === heute ? "heute" : ""}"><b>${WT[i]}</b><span>${ddmm(d)}</span></div>`;
      for (const x of m) {
        const anz = this._eintragAnzeige(this._essen.plan?.[k]?.[x]);
        html += anz
          ? `<button class="eslot voll ${k === heute ? "heute" : ""}" data-a="plan-${k}|${x}">
               <span class="eemoji">${esc(anz.emoji)}</span><span class="ename">${esc(anz.name)}</span>
               ${anz.rezept ? `<ha-icon class="erez" icon="mdi:book-open-variant"></ha-icon>` : ""}</button>`
          : `<button class="eslot leer" data-a="plan-${k}|${x}">＋</button>`;
      }
    }
    html += `</div>`;
    if (!Object.keys(this._essen.rezepte || {}).length) {
      html += `<div class="hinweis klein">Tipp: Lege unter <b>📖 Rezepte</b> eure Lieblingsgerichte mit Zutaten an –
        dann landen die Zutaten per Knopfdruck auf der Einkaufsliste.</div>`;
    }
    return html + `</div>`;
  }

  _rezeptListe() {
    const r = Object.entries(this._essen.rezepte || {}).sort((a, b) => a[1].name.localeCompare(b[1].name, "de"));
    return `<div class="essen"><div class="rgitter">
      <button class="rkarte neu" data-a="rezept-neu"><span class="eemoji">＋</span><b>Neues Rezept</b></button>
      ${r.map(([id, x]) => `
        <button class="rkarte" data-a="rezept-oeffnen-${id}">
          <span class="eemoji">${esc(x.emoji || "🍽")}</span>
          <b>${esc(x.name)}</b>
          <span class="grau">${x.zutaten.length} Zutaten · ${x.portionen} Portionen</span>
        </button>`).join("")}
    </div></div>`;
  }

  _slotDialog() {
    const s = this._slot;
    const d = parseDatum(s.datum);
    const r = Object.entries(this._essen?.rezepte || {}).sort((a, b) => a[1].name.localeCompare(b[1].name, "de"));
    const aktuell = this._eintragAnzeige(s.rezept ? { rezept: s.rezept } : (s.text ? { text: s.text } : null));
    return `
      <div class="overlay" data-a="zu">
        <div class="karte">
          <h2>${this._mahlzeitName(s.mahlzeit)} · ${WT_LANG[wt(d)]} ${ddmm(d)}</h2>
          ${aktuell ? `<p class="grau">Geplant: <b>${esc(aktuell.emoji)} ${esc(aktuell.name)}</b></p>` : ""}
          <div class="formular"><label>Rezept suchen oder freien Text eingeben
            <input id="f-suche" value="${esc(s.rezept ? "" : s.text)}" placeholder="z. B. Spaghetti, Pizza, Reste …" autocomplete="off"></label></div>
          <div class="rwahl-liste">${r.map(([id, x]) => `
            <button class="rwahl ${id === s.rezept ? "an" : ""}" data-a="wahl-${id}" data-name="${esc(x.name.toLowerCase())}">
              <span>${esc(x.emoji || "🍽")}</span>${esc(x.name)}</button>`).join("")
            || `<p class="grau">Noch keine Rezepte – einfach Text eingeben.</p>`}</div>
          <div class="knoepfe">
            ${aktuell ? `<button class="gefahr" data-a="slot-weg">Entfernen</button>` : ""}
            ${s.rezept ? `<button class="zweit" data-a="slot-rezept">📖 Rezept</button>` : ""}
            <span class="platz"></span>
            <button class="zweit" data-a="schliessen">Abbrechen</button>
            <button data-a="slot-text">Als Text übernehmen</button>
          </div>
        </div>
      </div>`;
  }

  _rezeptDialog() {
    const r = this._rezept;
    return `
      <div class="overlay" data-a="zu">
        <form class="karte formular breit">
          <h2>${r.id ? "Rezept bearbeiten" : "Neues Rezept"}</h2>
          <div class="reihe">
            <label style="flex:0 0 76px">Emoji<input id="r-emoji" value="${esc(r.emoji)}" placeholder="🍝" maxlength="4"></label>
            <label>Name<input id="r-name" value="${esc(r.name)}" placeholder="z. B. Spaghetti Bolognese" autocomplete="off"></label>
            <label style="flex:0 0 100px">Portionen<input id="r-portionen" type="number" min="1" max="50" value="${r.portionen}"></label>
          </div>
          <label>Zutaten (eine pro Zeile)<textarea id="r-zutaten" rows="7" placeholder="500 g Spaghetti&#10;400 g Hackfleisch&#10;1 Dose Tomaten">${esc(r.zutaten)}</textarea></label>
          <label>Zubereitung<textarea id="r-zubereitung" rows="5">${esc(r.zubereitung)}</textarea></label>
          <label>Link (freiwillig)<input id="r-link" value="${esc(r.link)}" placeholder="https://…" autocomplete="off"></label>
          ${r.link ? `<p><a href="${esc(r.link)}" target="_blank" rel="noopener">🔗 Rezept öffnen</a></p>` : ""}
          <div class="knoepfe">
            ${r.id ? `<button type="button" class="gefahr" data-a="rezept-loeschen">${r.loeschenBestaetigen ? "Wirklich löschen?" : "🗑 Löschen"}</button>` : ""}
            <span class="platz"></span>
            <button type="button" class="zweit" data-a="schliessen">Abbrechen</button>
            <button type="button" data-a="rezept-speichern">Speichern</button>
          </div>
        </form>
      </div>`;
  }

  // ---------------- Termin anlegen ----------------
  _schreibbareKalender() {
    return this._kalender().filter((eid) => this._kannAnlegen(eid));
  }

  _oeffneNeu(datum) {
    const kal = this._schreibbareKalender();
    if (!kal.length) {
      this._zeigeToast("Keiner der gewählten Kalender erlaubt neue Termine (nur lesbar).");
      return;
    }
    const d = datum ? parseDatum(datum) : tagStart(new Date());
    const jetzt = new Date();
    const h = Math.min(Math.max(jetzt.getHours() + 1, 7), 20);
    this._neu = {
      titel: "", datum: tagKey(d), datumBis: tagKey(d), von: `${pad(h)}:00`, bis: `${pad(h + 1)}:00`, ganz: false,
      kal: kal[0], personen: this._filter ? [this._filter] : [], ort: "", text: "",
    };
    this._detail = null;
    this._zeichneDialog();
    setTimeout(() => this._root.querySelector("#f-titel")?.focus(), 50);
  }

  _oeffneBearbeiten(ev) {
    const letzterTag = ev.ganz ? plusTage(ev.ende, -1) : ev.ende;
    this._neu = {
      ev, titel: ev.titel, datum: tagKey(ev.start),
      datumBis: tagKey(letzterTag < ev.start ? ev.start : letzterTag),
      von: ev.ganz ? "08:00" : hhmm(ev.start), bis: ev.ganz ? "09:00" : hhmm(ev.ende), ganz: ev.ganz,
      kal: ev.kal, personen: [], ort: ev.ort, text: ev.text, loeschenBestaetigen: false,
    };
    this._detail = null;
    this._zeichneDialog();
  }

  _formularMerken() {
    const f = (id) => this._root.querySelector(id);
    if (!this._neu || !f("#f-titel")) return;
    this._neu.titel = f("#f-titel").value;
    this._neu.datum = f("#f-datum").value;
    this._neu.datumBis = f("#f-datum-bis").value || this._neu.datum;
    this._neu.von = f("#f-von").value;
    this._neu.bis = f("#f-bis").value;
    this._neu.ganz = f("#f-ganz").checked;
    if (f("#f-kal")) this._neu.kal = f("#f-kal").value;
    this._neu.ort = f("#f-ort").value;
    this._neu.text = f("#f-text").value;
  }

  // Datum + Uhrzeit (Browser-Zeitzone) als ISO mit Offset
  _iso(datum, zeit) {
    const [y, m, d] = datum.split("-").map(Number);
    const [hh, mm] = zeit.split(":").map(Number);
    const dt = new Date(y, m - 1, d, hh, mm);
    const off = -dt.getTimezoneOffset();
    const v = off >= 0 ? "+" : "-";
    return `${datum}T${pad(hh)}:${pad(mm)}:00${v}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
  }

  async _loeschen() {
    const n = this._neu;
    if (!n?.ev) return;
    if (!n.loeschenBestaetigen) {
      this._formularMerken();
      n.loeschenBestaetigen = true;
      this._zeichneDialog();
      return;
    }
    try {
      await this._hass.callWS({
        type: "calendar/event/delete", entity_id: n.ev.kal, uid: n.ev.uid,
        ...(n.ev.rid ? { recurrence_id: n.ev.rid } : {}),
      });
      this._neu = null;
      this._zeichneDialog();
      this._zeigeToast("Termin gelöscht");
      setTimeout(() => this._laden(), 800);
    } catch (err) {
      this._zeigeToast(`Fehler: ${err.message || err}`);
    }
  }

  async _speichern() {
    this._formularMerken();
    const n = this._neu;
    if (!n) return;
    if (n.ev) { await this._aendern(); return; }
    let titel = (n.titel || "").trim();
    if (!titel) { this._zeigeToast("Bitte einen Titel eingeben."); return; }
    // Gewählte Personen in den Titel, falls ihr Stichwort/Name noch fehlt
    const klein = titel.toLowerCase();
    const fehlend = this._personen().filter((p) => n.personen.includes(p.entity_id))
      .filter((p) => !((p.stichwoerter && p.stichwoerter.length) ? p.stichwoerter : [p.name])
        .some((w) => klein.includes(String(w).toLowerCase())))
      .map((p) => (p.stichwoerter && p.stichwoerter[0]) || p.name);
    if (fehlend.length) titel += ` – ${fehlend.join(", ")}`;

    const zeit = this._zeitspanne(n);
    if (!zeit) return;
    const daten = { summary: titel };
    if (n.ort) daten.location = n.ort;
    if (n.text) daten.description = n.text;
    if (n.ganz) { daten.start_date = zeit.start; daten.end_date = zeit.ende; }
    else { daten.start_date_time = zeit.start; daten.end_date_time = zeit.ende; }
    try {
      await this._hass.callService("calendar", "create_event", daten, { entity_id: n.kal });
      this._neu = null;
      this._zeichneDialog();
      this._zeigeToast("Termin gespeichert ✔");
      setTimeout(() => this._laden(), 1500);
    } catch (err) {
      this._zeigeToast(`Fehler: ${err.message || err}`);
    }
  }

  // Start/Ende aus dem Formular (ganztägig: Datum, Ende exklusiv; sonst ISO mit Offset)
  _zeitspanne(n) {
    if (!n.datum) { this._zeigeToast("Bitte ein Datum wählen."); return null; }
    const bisDatum = n.datumBis && n.datumBis >= n.datum ? n.datumBis : n.datum;
    if (n.ganz) return { start: n.datum, ende: tagKey(plusTage(parseDatum(bisDatum), 1)) };
    const start = this._iso(n.datum, n.von || "08:00");
    const ende = this._iso(bisDatum, n.bis || "09:00");
    if (new Date(ende) <= new Date(start)) { this._zeigeToast("Das Ende muss nach dem Beginn liegen."); return null; }
    return { start, ende };
  }

  async _aendern() {
    const n = this._neu;
    const ev = n.ev;
    const titel = (n.titel || "").trim();
    if (!titel) { this._zeigeToast("Bitte einen Titel eingeben."); return; }
    const zeit = this._zeitspanne(n);
    if (!zeit) return;
    try {
      if (this._features(ev.kal) & 4) {
        await this._hass.callWS({
          type: "calendar/event/update", entity_id: ev.kal, uid: ev.uid,
          ...(ev.rid ? { recurrence_id: ev.rid } : {}),
          event: { summary: titel, dtstart: zeit.start, dtend: zeit.ende, description: n.text || "", location: n.ort || "" },
        });
      } else {
        // Kalender kann nur anlegen + löschen (z. B. Google): ersetzen
        const daten = { summary: titel };
        if (n.ort) daten.location = n.ort;
        if (n.text) daten.description = n.text;
        if (n.ganz) { daten.start_date = zeit.start; daten.end_date = zeit.ende; }
        else { daten.start_date_time = zeit.start; daten.end_date_time = zeit.ende; }
        await this._hass.callService("calendar", "create_event", daten, { entity_id: ev.kal });
        await this._hass.callWS({
          type: "calendar/event/delete", entity_id: ev.kal, uid: ev.uid,
          ...(ev.rid ? { recurrence_id: ev.rid } : {}),
        });
      }
      this._neu = null;
      this._zeichneDialog();
      this._zeigeToast("Termin geändert ✔");
      setTimeout(() => this._laden(), 800);
    } catch (err) {
      this._zeigeToast(`Fehler: ${err.message || err}`);
    }
  }

  // ---------------- Zeichnen ----------------
  _zeichnen() {
    if (!this._root) return;
    this._zeichneLeiste();
    this._zeichneKopf();
    this._zeichneInhalt();
    this._zeichneDialog();
  }

  _zeichneLeiste() {
    const leiste = this._root.getElementById("leiste");
    const aktiv = this._module();
    const eintraege = LEISTE.filter((x) => x.key === "kalender" || aktiv.includes(x.key));
    leiste.innerHTML = `
      <div class="logo" data-a="einstellungen" title="Familienzentrale"><ha-icon icon="mdi:home-heart"></ha-icon></div>
      ${eintraege.map((x) => `
        <button class="rail ${(x.key === "kalender" && this._seite === "kalender") || (x.key === "essensplan" && this._seite === "essen") ? "aktiv" : ""}" data-a="modul-${x.key}">
          <ha-icon icon="${x.icon}"></ha-icon><span>${x.label}</span>
        </button>`).join("")}
      <div class="platz"></div>
      <button class="rail klein" data-a="aktualisieren" title="Aktualisieren"><ha-icon icon="mdi:sync"></ha-icon></button>
      <button class="fab" data-a="neu" title="Termin anlegen"><ha-icon icon="mdi:plus"></ha-icon></button>`;
  }

  _zeichneKopf() {
    if (!this._root) return;
    if (this._seite === "essen") { this._essenKopf(); return; }
    const kopf = this._root.getElementById("kopf");
    const m = this._modus();
    const titel = this._panel?.config?.titel || "Familie";
    const jetzt = new Date();
    const tage = this._tageProWoche();

    let tabs = "";
    if (m === "woche" || m === "arbeitswoche") {
      const basis = montag(this._ref);
      tabs = [0, 1, 2].map((i) => {
        const s = plusTage(basis, i * 7);
        const e = plusTage(s, tage - 1);
        return `<button class="tab ${i === 0 ? "aktiv" : ""}" data-a="tab-${tagKey(s)}">${ddmm(s)} – ${ddmm(e)}</button>`;
      }).join("");
    } else if (m === "monat") {
      tabs = `<button class="tab" data-a="zurueck">‹</button>
        <span class="tab aktiv">${MON[this._ref.getMonth()]} ${this._ref.getFullYear()}</span>
        <button class="tab" data-a="vor">›</button>`;
    } else {
      const { start, ende } = this._bereich();
      tabs = `<button class="tab" data-a="zurueck">‹</button>
        <span class="tab aktiv">${ddmm(start)} – ${ddmm(plusTage(ende, -1))}</span>
        <button class="tab" data-a="vor">›</button>`;
    }
    const wahl = [["woche", "Woche"], ["arbeitswoche", "Mo–Fr"], ["monat", "Monat"], ["liste", "Liste"]];
    const avatare = this._personen().map((p) => {
      const aktiv = this._filter === p.entity_id;
      const gedimmt = this._filter && !aktiv;
      return `<button class="avatar ${aktiv ? "aktiv" : ""} ${gedimmt ? "dimm" : ""}" data-a="person-${p.entity_id}"
          style="--ring:${p.farbe}" title="${esc(p.name)}">
        ${p.bild ? `<img src="${esc(p.bild)}" alt="">`
          : p.icon ? `<span style="background:${pastell(p.farbe, 45)}"><ha-icon icon="${esc(p.icon)}"></ha-icon></span>`
          : `<span style="background:${pastell(p.farbe, 45)}">${esc(initial(p.name))}</span>`}
      </button>`;
    }).join("");

    kopf.innerHTML = `
      <div class="kopf-links">
        <div class="titelzeile">${this._narrow ? '<span id="menuplatz"></span>' : ""}
          <h1>${hhmm(jetzt)} <span class="strich">|</span> ${esc(titel)}</h1></div>
        <div class="tabs">
          <button class="rund" data-a="heute" title="Heute"><ha-icon icon="mdi:calendar-today"></ha-icon></button>
          <div class="dropdown">
            <button class="rund breit" data-a="menu" title="Ansicht"><ha-icon icon="mdi:calendar-week"></ha-icon><ha-icon icon="mdi:chevron-down" class="mini"></ha-icon></button>
            ${this._menuOffen ? `<div class="menue">${wahl.map(([k, t]) =>
              `<button data-a="ansicht-${k}" class="${m === k ? "aktiv" : ""}">${t}</button>`).join("")}</div>` : ""}
          </div>
          ${tabs}
        </div>
      </div>
      <div class="kopf-rechts">
        <button class="avatar familie ${this._filter ? "" : "aktiv"}" data-a="alle" title="Alle"><ha-icon icon="mdi:account-group"></ha-icon></button>
        ${avatare}
        <button class="zahnrad" data-a="einstellungen" title="Einstellungen"><ha-icon icon="mdi:cog"></ha-icon></button>
      </div>`;
    if (this._narrow) this._root.getElementById("menuplatz").appendChild(this._menu);
  }

  _zeichneInhalt() {
    const inhalt = this._root.getElementById("inhalt");
    if (!this._sensor()) {
      inhalt.innerHTML = `<div class="hinweis">Die Familienzentrale ist noch nicht eingerichtet.</div>`;
      return;
    }
    if (this._seite === "essen") { inhalt.innerHTML = this._essenInhalt(); return; }
    if (!this._kalender().length) {
      inhalt.innerHTML = `<div class="hinweis">Noch kein Kalender gewählt.<br>
        ⚙️ → Konfigurieren → „📅 Kalender &amp; Push“.</div>`;
      return;
    }
    const fehler = this._fehler ? `<div class="fehler">${esc(this._fehler)}</div>` : "";
    const m = this._modus();
    const alterScroll = this._root.getElementById("raster")?.scrollTop;
    if (m === "monat") inhalt.innerHTML = fehler + this._monat();
    else if (m === "liste") inhalt.innerHTML = fehler + this._liste();
    else {
      inhalt.innerHTML = fehler + this._wochenraster();
      const r = this._root.getElementById("raster");
      if (r) {
        if (this._scrollNachJetzt) {
          const h = new Date().getHours();
          r.scrollTop = Math.max(0, (h - this._vonStunde - 1) * STD);
          this._scrollNachJetzt = false;
        } else if (alterScroll !== undefined) r.scrollTop = alterScroll;
      }
      this._zeichneJetztLinie();
    }
  }

  // ---------- Wochen-Zeitraster ----------
  _wochenraster() {
    const tage = this._tageProWoche();
    const start = montag(this._ref);
    const pt = this._proTag();
    const heute = tagKey(new Date());
    const spalten = `56px repeat(${tage}, minmax(0, 1fr))`;

    // Stundenbereich: mindestens 6–22 Uhr, erweitert durch frühe/späte Termine
    let von = 6, bis = 22;
    for (let i = 0; i < tage; i++) {
      for (const id of pt.get(tagKey(plusTage(start, i))) || []) {
        const ev = this._events[id];
        if (ev.ganz) continue;
        if (tagKey(ev.start) === tagKey(plusTage(start, i))) von = Math.min(von, ev.start.getHours());
        if (tagKey(ev.ende) === tagKey(plusTage(start, i))) bis = Math.max(bis, Math.ceil(ev.ende.getHours() + ev.ende.getMinutes() / 60));
      }
    }
    bis = Math.min(24, bis);
    this._vonStunde = von;
    this._bisStunde = bis;
    this._rasterStart = start;
    this._rasterTage = tage;

    // Kopfzeile
    let kopf = `<div class="wkopf" style="grid-template-columns:${spalten}"><div></div>`;
    for (let i = 0; i < tage; i++) {
      const d = plusTage(start, i);
      const k = tagKey(d);
      kopf += `<div class="tagkopf">
        <span class="tagname">${WT[i]}, ${k === heute ? `<span class="heute-kreis">${d.getDate()}.</span>` : `${d.getDate()}.`}</span>
        <button class="plus" data-a="neu-${k}" title="Termin am ${ddmm(d)}">+</button>
      </div>`;
    }
    kopf += "</div>";

    // Ganztägige Zeile
    let ganz = `<div class="ganzzeile" style="grid-template-columns:${spalten}"><div class="achse-klein"></div>`;
    for (let i = 0; i < tage; i++) {
      const ids = (pt.get(tagKey(plusTage(start, i))) || []).filter((id) => this._events[id].ganz);
      ganz += `<div class="ganzzelle">${ids.map((id) => {
        const ev = this._events[id];
        const f = this._farbe(ev);
        return `<div class="balken" data-ev="${id}" style="background:${pastell(f)};border-left-color:${f}">
          <span class="btitel">${esc(ev.titel)}</span>${this._badges(ev)}</div>`;
      }).join("")}</div>`;
    }
    ganz += "</div>";

    // Zeitraster
    const hoehe = (bis - von) * STD;
    let achse = "";
    for (let h = von; h <= bis; h++) achse += `<div class="stunde" style="top:${(h - von) * STD}px">${h}</div>`;
    let koerper = `<div class="raster" id="raster"><div class="rinnen" style="grid-template-columns:${spalten};height:${hoehe}px">
      <div class="achse">${achse}</div>`;
    for (let i = 0; i < tage; i++) {
      const d = plusTage(start, i);
      const k = tagKey(d);
      const tagAnf = d.getTime() + von * 3600000;
      const tagEnd = d.getTime() + bis * 3600000;
      const evs = (pt.get(k) || []).filter((id) => !this._events[id].ganz).map((id) => {
        const ev = this._events[id];
        const s = Math.max(ev.start.getTime(), tagAnf);
        const e = Math.min(Math.max(ev.ende.getTime(), ev.start.getTime() + 20 * 60000), tagEnd);
        return { id, s, e };
      }).filter((x) => x.e > x.s);
      this._spuren(evs);
      const bloecke = evs.map((x) => {
        const ev = this._events[x.id];
        const f = this._farbe(ev);
        const top = (x.s - tagAnf) / 3600000 * STD;
        const h = Math.max(24, (x.e - x.s) / 3600000 * STD - 3);
        const breite = 100 / x.n;
        const kurz = h < 36;
        return `<div class="block ${kurz ? "kurz" : ""}" data-ev="${x.id}"
            style="top:${top}px;height:${h}px;left:calc(${x.spur * breite}% + 2px);width:calc(${breite}% - 4px);
                   background:${pastell(f)};border-left-color:${f}">
          <div class="btitel">${esc(ev.titel)}</div>
          ${kurz ? "" : `<div class="bzeit">${hhmm(ev.start)} – ${hhmm(ev.ende)}</div>`}
          <div class="bbadges">${this._badges(ev)}</div>
        </div>`;
      }).join("");
      koerper += `<div class="tagspalte ${k === heute ? "heute" : ""}" data-tag="${k}">${bloecke}</div>`;
    }
    koerper += `<div class="jetzt" id="jetzt" hidden></div></div></div>`;

    return `<div class="woche">${kopf}${ganz}${koerper}</div>`;
  }

  // Überlappende Termine nebeneinander legen
  _spuren(evs) {
    evs.sort((a, b) => a.s - b.s || b.e - a.e);
    let gruppe = [], gruppenEnde = 0, spuren = [];
    const abschliessen = () => { gruppe.forEach((x) => { x.n = spuren.length; }); gruppe = []; spuren = []; };
    for (const x of evs) {
      if (gruppe.length && x.s >= gruppenEnde) abschliessen();
      let spur = spuren.findIndex((ende) => ende <= x.s);
      if (spur === -1) { spur = spuren.length; spuren.push(x.e); } else spuren[spur] = x.e;
      x.spur = spur;
      gruppe.push(x);
      gruppenEnde = Math.max(gruppenEnde, x.e);
    }
    abschliessen();
  }

  _zeichneJetztLinie() {
    const linie = this._root?.getElementById("jetzt");
    if (!linie || !this._rasterStart) return;
    const jetzt = new Date();
    const idx = Math.round((tagStart(jetzt) - this._rasterStart) / 86400000);
    const std = jetzt.getHours() + jetzt.getMinutes() / 60;
    if (idx < 0 || idx >= this._rasterTage || std < this._vonStunde || std > this._bisStunde) { linie.hidden = true; return; }
    linie.hidden = false;
    linie.style.top = `${(std - this._vonStunde) * STD}px`;
    linie.style.left = `calc(56px + (100% - 56px) * ${idx} / ${this._rasterTage})`;
    linie.style.width = `calc((100% - 56px) / ${this._rasterTage})`;
  }

  // ---------- Monat ----------
  _monat() {
    const pt = this._proTag();
    const { start } = this._bereich();
    const heute = tagKey(new Date());
    const monat = this._ref.getMonth();
    let html = `<div class="monat">${WT.map((w) => `<div class="wt">${w}</div>`).join("")}`;
    for (let i = 0; i < 42; i++) {
      const d = plusTage(start, i);
      const k = tagKey(d);
      const ids = pt.get(k) || [];
      const chips = ids.slice(0, MAX_CHIPS).map((id) => {
        const ev = this._events[id];
        const f = this._farbe(ev);
        return `<div class="chip" data-ev="${id}" style="background:${pastell(f)};border-left-color:${f}">
          ${ev.ganz ? "" : `<b>${hhmm(ev.start)}</b> `}${esc(ev.titel)}</div>`;
      }).join("");
      const mehr = ids.length > MAX_CHIPS ? `<div class="mehr" data-a="tag-${k}">+${ids.length - MAX_CHIPS} weitere</div>` : "";
      html += `<div class="zelle ${d.getMonth() !== monat ? "aus" : ""} ${k === heute ? "heute" : ""}">
        <div class="nr" data-a="tag-${k}">${k === heute ? `<span class="heute-kreis">${d.getDate()}</span>` : d.getDate()}</div>${chips}${mehr}</div>`;
    }
    return html + "</div>";
  }

  // ---------- Liste ----------
  _liste() {
    const pt = this._proTag();
    const { start } = this._bereich();
    const heute = tagStart(new Date());
    let html = `<div class="liste">`;
    let leer = true;
    for (let i = 0; i < 14; i++) {
      const d = plusTage(start, i);
      const ids = pt.get(tagKey(d)) || [];
      if (!ids.length) continue;
      leer = false;
      const diff = Math.round((d - heute) / 86400000);
      const name = diff === 0 ? "Heute" : diff === 1 ? "Morgen" : WT_LANG[wt(d)];
      html += `<div class="ltag"><h3>${name} <span>${ddmm(d)}</span><button class="plus" data-a="neu-${tagKey(d)}">+</button></h3>
        ${ids.map((id) => {
          const ev = this._events[id];
          const f = this._farbe(ev);
          return `<div class="lkarte" data-ev="${id}" style="background:${pastell(f)};border-left-color:${f}">
            <div><div class="btitel">${esc(ev.titel)}</div>
            <div class="bzeit">${ev.ganz ? "ganztägig" : `${hhmm(ev.start)} – ${hhmm(ev.ende)}`}${ev.ort ? ` · ${esc(ev.ort)}` : ""}</div></div>
            <div class="bbadges statisch">${this._badges(ev)}</div>
          </div>`;
        }).join("")}</div>`;
    }
    if (leer) html += `<div class="hinweis">Keine Termine in diesem Zeitraum.</div>`;
    return html + "</div>";
  }

  // ---------- Dialoge ----------
  _zeichneDialog() {
    const dlg = this._root.getElementById("dialog");
    if (this._rezept) { dlg.innerHTML = this._rezeptDialog(); return; }
    if (this._slot) { dlg.innerHTML = this._slotDialog(); return; }
    if (this._neu) { dlg.innerHTML = this._formular(); return; }
    const ev = this._detail;
    if (!ev) { dlg.innerHTML = ""; return; }
    const f = this._farbe(ev);
    const kal = this._hass.states[ev.kal]?.attributes.friendly_name || ev.kal;
    dlg.innerHTML = `
      <div class="overlay" data-a="zu">
        <div class="karte" style="border-top:8px solid ${f}">
          <h2>${esc(ev.titel)}</h2>
          <p>🕒 ${esc(this._zeitText(ev))}${ev.serie ? " · 🔁 wiederkehrend" : ""}</p>
          ${ev.personen.length ? `<p>${ev.personen.map((p) => `<span class="pille" style="background:${p.farbe};color:${textFarbe(p.farbe)}">${esc(p.name)}</span>`).join(" ")}</p>` : ""}
          ${ev.ort ? `<p>📍 ${esc(ev.ort)}</p>` : ""}
          ${ev.text ? `<p class="beschreibung">${esc(ev.text)}</p>` : ""}
          <p class="grau">📅 ${esc(kal)}${this._kannAendern(ev.kal) ? "" : " · 🔒 nur lesbar (Kalender-Abo)"}</p>
          <div class="knoepfe">
            ${ev.uid && this._kannAendern(ev.kal) ? `<button class="zweit" data-a="aendern">✏️ Bearbeiten</button>` : ""}
            <button data-a="schliessen">Schließen</button>
          </div>
        </div>
      </div>`;
  }

  _formular() {
    const n = this._neu;
    const bearbeiten = !!n.ev;
    const kal = bearbeiten ? [n.kal] : this._schreibbareKalender();
    const kalName = (k) => esc(this._hass.states[k]?.attributes.friendly_name || k);
    const farbe = bearbeiten ? this._farbe(n.ev) : NEUTRAL;
    const personenWahl = bearbeiten ? "" : `<div class="wer">${this._personen().map((p) => {
      const an = n.personen.includes(p.entity_id);
      return `<button type="button" class="pille wahl ${an ? "an" : ""}" data-a="wer-${p.entity_id}"
        style="${an ? `background:${p.farbe};color:${textFarbe(p.farbe)}` : `border-color:${p.farbe}`}">${esc(p.name)}</button>`;
    }).join("")}</div>`;
    const loeschen = bearbeiten && this._kannLoeschen(n.kal)
      ? `<button type="button" class="gefahr" data-a="loeschen">${n.loeschenBestaetigen ? "Wirklich löschen?" : "🗑 Löschen"}</button>` : "";
    return `
      <div class="overlay" data-a="zu">
        <form class="karte formular" style="border-top:8px solid ${farbe}">
          <h2>${bearbeiten ? "Termin bearbeiten" : "Neuer Termin"}</h2>
          ${bearbeiten && n.ev.serie ? `<p class="grau">🔁 Serientermin – Änderungen gelten nur für diesen einen Termin.</p>` : ""}
          <label>Titel<input id="f-titel" value="${esc(n.titel)}" placeholder="z. B. Kinderarzt Niilo" autocomplete="off"></label>
          ${personenWahl}
          <div class="reihe">
            <label>Von (Datum)<input id="f-datum" type="date" value="${n.datum}"></label>
            <label>Bis (Datum)<input id="f-datum-bis" type="date" value="${n.datumBis || n.datum}"></label>
            <label class="check"><input id="f-ganz" type="checkbox" data-a="ganztag" ${n.ganz ? "checked" : ""}> ganztägig</label>
          </div>
          <div class="reihe ${n.ganz ? "aus" : ""}">
            <label>Beginn<input id="f-von" type="time" value="${n.von}" ${n.ganz ? "disabled" : ""}></label>
            <label>Ende<input id="f-bis" type="time" value="${n.bis}" ${n.ganz ? "disabled" : ""}></label>
          </div>
          <label>Ort<input id="f-ort" value="${esc(n.ort)}" autocomplete="off"></label>
          <label>Notiz<textarea id="f-text" rows="3">${esc(n.text)}</textarea></label>
          <label>Kalender<select id="f-kal" ${bearbeiten ? "disabled" : ""}>${kal.map((k) =>
            `<option value="${k}" ${k === n.kal ? "selected" : ""}>${kalName(k)}</option>`).join("")}</select></label>
          <div class="knoepfe">
            ${loeschen}<span class="platz"></span>
            <button type="button" class="zweit" data-a="schliessen">Abbrechen</button>
            <button type="button" data-a="speichern">Speichern</button>
          </div>
        </form>
      </div>`;
  }
}

FamilienzentralePanel.css = `
  :host {
    --fz-karte: var(--card-background-color, #fff);
    --fz-grund: var(--primary-background-color, #f6f7fb);
    --fz-linie: var(--divider-color, rgba(0,0,0,.08));
    --fz-text: var(--primary-text-color, #2b2f38);
    --fz-grau: var(--secondary-text-color, #7b8191);
    --fz-akzent: #f26b3a;
    --fz-blau: color-mix(in srgb, var(--primary-color, #3f7fe0) 18%, var(--fz-karte));
    display:block; height:100%; background:var(--fz-grund); color:var(--fz-text);
    font-family: Nunito, var(--ha-font-family-body, Roboto), sans-serif; font-size:14px;
  }
  * { box-sizing:border-box; }
  button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; }
  ha-icon { --mdc-icon-size:24px; }
  .app { display:flex; height:100%; }

  /* Leiste links */
  #leiste { width:76px; flex:none; display:flex; flex-direction:column; align-items:center; gap:4px;
    padding:12px 0; background:var(--fz-karte); border-right:1px solid var(--fz-linie); }
  .logo { width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg, #ff9a8b, #a18cd1 55%, #6fd3c7); color:#fff; margin-bottom:14px; cursor:pointer; }
  .logo ha-icon { --mdc-icon-size:26px; }
  .rail { width:66px; padding:8px 0; border-radius:12px; display:flex; flex-direction:column; align-items:center; gap:3px;
    color:var(--fz-grau); font-size:.72em; font-weight:700; }
  .rail ha-icon { --mdc-icon-size:24px; }
  .rail.aktiv { color:var(--fz-text); background:var(--fz-grund); }
  .rail:hover { background:var(--fz-grund); }
  .platz { flex:1; }
  .fab { width:50px; height:50px; border-radius:50%; color:#fff; margin-top:6px;
    background:conic-gradient(from 200deg, #ff6a88, #ffb86c, #ffe66d, #7ee081, #6ec6ff, #b388ff, #ff6a88);
    box-shadow:0 6px 18px rgba(0,0,0,.18); display:flex; align-items:center; justify-content:center; }
  .fab ha-icon { --mdc-icon-size:28px; }

  main { flex:1; min-width:0; display:flex; flex-direction:column; }

  /* Kopf */
  #kopf { display:flex; align-items:center; gap:14px; padding:10px 18px 8px; background:var(--fz-karte);
    border-bottom:1px solid var(--fz-linie); }
  .kopf-links { flex:1; min-width:0; }
  .titelzeile { display:flex; align-items:center; gap:6px; }
  h1 { margin:0; font-size:1.75em; font-weight:800; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .strich { font-weight:400; color:var(--fz-grau); }
  .tabs { display:flex; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap; }
  .rund { height:36px; min-width:36px; border-radius:18px; background:var(--fz-grund); color:var(--fz-grau);
    display:inline-flex; align-items:center; justify-content:center; padding:0 9px; }
  .rund.breit { padding:0 6px 0 12px; }
  .mini { --mdc-icon-size:18px; }
  .tab { padding:7px 14px; border-radius:18px; color:var(--fz-grau); font-size:1em; font-weight:600; }
  .tab.aktiv { background:var(--fz-blau); color:var(--primary-color, #3f7fe0); }
  .dropdown { position:relative; }
  .menue { position:absolute; top:48px; left:0; z-index:5; background:var(--fz-karte); border-radius:14px; padding:6px;
    box-shadow:0 10px 30px rgba(0,0,0,.18); display:flex; flex-direction:column; min-width:140px; }
  .menue button { text-align:left; padding:10px 14px; border-radius:10px; font-weight:600; }
  .menue button.aktiv, .menue button:hover { background:var(--fz-grund); }
  .kopf-rechts { display:flex; align-items:center; gap:10px; }
  .avatar { width:52px; height:52px; border-radius:50%; padding:3px; border:3px solid var(--ring, var(--fz-linie));
    display:flex; align-items:center; justify-content:center; transition:transform .15s, opacity .15s; background:var(--fz-karte); }
  .avatar img, .avatar span { width:100%; height:100%; border-radius:50%; object-fit:cover; display:flex;
    align-items:center; justify-content:center; font-weight:800; font-size:1.15em; }
  .avatar span ha-icon { --mdc-icon-size:26px; }
  .avatar.aktiv { transform:scale(1.08); box-shadow:0 4px 14px rgba(0,0,0,.15); }
  .avatar.dimm { opacity:.4; }
  .avatar.familie { --ring:var(--fz-linie); color:var(--fz-grau); }
  .avatar.familie ha-icon { --mdc-icon-size:28px; }
  .avatar.familie.aktiv { --ring:var(--fz-grau); color:var(--fz-text); }
  .zahnrad { color:var(--fz-grau); padding:8px; }
  .zahnrad ha-icon { --mdc-icon-size:28px; }

  #inhalt { flex:1; min-height:0; display:flex; flex-direction:column; }
  .hinweis { padding:40px; text-align:center; color:var(--fz-grau); line-height:1.7; }
  .fehler { background:var(--error-color, #db4437); color:#fff; padding:8px 14px; margin:8px 16px 0; border-radius:10px; }

  /* Woche */
  .woche { flex:1; min-height:0; display:flex; flex-direction:column; background:var(--fz-karte); }
  .wkopf, .ganzzeile, .rinnen { display:grid; }
  .wkopf { border-bottom:1px solid var(--fz-linie); }
  .tagkopf { display:flex; align-items:center; justify-content:space-between; padding:8px 8px 7px 12px;
    font-size:1.2em; color:var(--fz-grau); }
  .tagname { white-space:nowrap; }
  .heute-kreis { display:inline-flex; align-items:center; justify-content:center; min-width:1.6em; height:1.6em;
    padding:0 .2em; border-radius:999px; background:var(--fz-akzent); color:#fff; font-weight:700; }
  .plus { font-size:1.3em; color:var(--fz-grau); opacity:.55; padding:0 6px; }
  .plus:hover { opacity:1; }
  .ganzzeile { border-bottom:1px solid var(--fz-linie); }
  .ganzzelle { padding:6px 4px; display:flex; flex-direction:column; gap:4px; border-left:1px solid var(--fz-linie); min-height:12px; }
  .balken { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:6px; border-left:4px solid;
    font-size:.9em; font-weight:600; cursor:pointer; }
  .balken .btitel { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .raster { flex:1; min-height:0; overflow-y:auto; position:relative; }
  .rinnen { position:relative; }
  .achse { position:relative; }
  .stunde { position:absolute; right:10px; transform:translateY(-50%); font-size:.85em; color:var(--fz-grau); }
  .stunde:first-child { transform:none; }
  .tagspalte { position:relative; border-left:1px solid var(--fz-linie);
    background-image:repeating-linear-gradient(to bottom, var(--fz-linie) 0 1px, transparent 1px ${STD}px); }
  .block { position:absolute; border-radius:6px; border-left:4px solid; padding:4px 8px; overflow:hidden; cursor:pointer;
    box-shadow:0 1px 2px rgba(0,0,0,.05); }
  .block .btitel { font-size:.9em; font-weight:700; line-height:1.2; }
  .block.kurz .btitel { font-size:.85em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bzeit { font-size:.75em; color:var(--fz-grau); margin-top:1px; }
  .bbadges { position:absolute; right:5px; bottom:4px; display:flex; gap:3px; }
  .bbadges.statisch { position:static; }
  .badge { width:17px; height:17px; border-radius:4px; font-size:.65em; font-weight:800; display:inline-flex;
    align-items:center; justify-content:center; flex:none; }
  .badge ha-icon { --mdc-icon-size:13px; }
  .jetzt { position:absolute; height:2px; background:var(--fz-akzent); pointer-events:none; z-index:2; }
  .jetzt::before { content:""; position:absolute; left:-6px; top:-5px; width:12px; height:12px; border-radius:50%; background:var(--fz-akzent); }

  /* Monat */
  .monat { flex:1; overflow:auto; display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); grid-auto-rows:auto;
    gap:1px; background:var(--fz-linie); }
  .wt { background:var(--fz-karte); text-align:center; padding:8px 0; font-weight:700; color:var(--fz-grau); }
  .zelle { background:var(--fz-karte); padding:6px; min-height:max(110px, calc((100vh - 230px) / 6)); overflow:hidden; }
  .zelle.aus { opacity:.45; }
  .nr { font-weight:700; color:var(--fz-grau); margin-bottom:4px; cursor:pointer; }
  .chip { font-size:.78em; border-left:4px solid; border-radius:5px; padding:3px 6px; margin:3px 0; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; cursor:pointer; font-weight:600; }
  .mehr { font-size:.8em; color:var(--fz-grau); cursor:pointer; padding-left:4px; }

  /* Liste */
  .liste { flex:1; overflow:auto; padding:14px 18px; }
  .ltag { margin-bottom:16px; }
  .ltag h3 { display:flex; align-items:center; gap:8px; margin:0 0 8px; font-size:1.2em; }
  .ltag h3 span { color:var(--fz-grau); font-weight:600; }
  .ltag h3 .plus { margin-left:auto; }
  .lkarte { display:flex; align-items:center; gap:10px; border-left:5px solid; border-radius:8px; padding:10px 12px;
    margin-bottom:8px; cursor:pointer; }
  .lkarte > div:first-child { flex:1; min-width:0; }
  .lkarte .btitel { font-weight:700; font-size:.95em; }

  /* Essensplan */
  .trenner { width:1px; height:24px; background:var(--fz-linie); margin:0 4px; }
  .knopf-gross { display:inline-flex; align-items:center; gap:8px; padding:9px 16px; border-radius:999px; font-weight:700;
    background:var(--primary-color, #3f7fe0); color:var(--text-primary-color, #fff); }
  .essen { flex:1; overflow:auto; padding:14px 18px; }
  .eplan { display:grid; gap:8px; align-items:stretch; }
  .ekopf { font-weight:800; color:var(--fz-grau); padding:2px 4px; }
  .etag { display:flex; flex-direction:column; justify-content:center; padding:6px 10px; border-radius:10px;
    background:var(--fz-karte); min-height:58px; }
  .etag span { color:var(--fz-grau); font-size:.85em; }
  .etag.heute { background:var(--fz-akzent); color:#fff; }
  .etag.heute span { color:rgba(255,255,255,.85); }
  .eslot { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:10px; text-align:left;
    background:var(--fz-karte); min-height:58px; position:relative; }
  .eslot.voll { border-left:4px solid var(--fz-akzent); background:color-mix(in srgb, var(--fz-akzent) 10%, var(--fz-karte)); }
  .eslot.leer { justify-content:center; color:var(--fz-grau); border:2px dashed var(--fz-linie); background:transparent; font-size:1.3em; }
  .eslot.leer:hover { border-color:var(--fz-grau); }
  .eemoji { font-size:1.6em; line-height:1; }
  .ename { flex:1; font-weight:700; }
  .erez { --mdc-icon-size:16px; color:var(--fz-grau); }
  .hinweis.klein { padding:16px; font-size:.9em; }
  .rgitter { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px; }
  .rkarte { display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:14px; border-radius:14px;
    background:var(--fz-karte); text-align:left; box-shadow:0 1px 3px rgba(0,0,0,.06); min-height:110px; }
  .rkarte .eemoji { font-size:2em; }
  .rkarte.neu { border:2px dashed var(--fz-linie); background:transparent; justify-content:center; align-items:center; color:var(--fz-grau); }
  .rwahl-liste { display:flex; flex-wrap:wrap; gap:6px; max-height:38vh; overflow:auto; margin:6px 0; }
  .rwahl { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; background:var(--fz-grund); font-weight:600; }
  .rwahl.an { background:var(--fz-akzent); color:#fff; }
  .rwahl[hidden] { display:none; }
  .karte.breit { max-width:620px; }

  /* Dialoge */
  .overlay { position:fixed; inset:0; background:rgba(20,24,35,.45); display:flex; align-items:center;
    justify-content:center; z-index:10; padding:16px; }
  .karte { background:var(--fz-karte); color:var(--fz-text); border-radius:20px; padding:22px; width:100%; max-width:480px;
    max-height:88vh; overflow:auto; box-shadow:0 20px 50px rgba(0,0,0,.3); }
  .karte h2 { margin:0 0 10px; font-size:1.5em; font-weight:800; }
  .karte p { margin:6px 0; line-height:1.5; }
  .grau { color:var(--fz-grau); font-size:.9em; }
  .beschreibung { white-space:pre-wrap; background:var(--fz-grund); padding:10px 12px; border-radius:10px; }
  .pille { display:inline-block; padding:4px 12px; border-radius:999px; font-size:.9em; font-weight:700; }
  .knoepfe { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
  .knoepfe button { padding:10px 18px; border-radius:999px; background:var(--primary-color, #3f7fe0); color:#fff; font-weight:700; }
  .knoepfe button.zweit { background:var(--fz-grund); color:var(--fz-text); }
  .formular label { display:flex; flex-direction:column; gap:4px; font-size:.85em; font-weight:700; color:var(--fz-grau); margin:10px 0; }
  .knoepfe .platz { flex:1; }
  .knoepfe button.gefahr { background:color-mix(in srgb, var(--error-color, #db4437) 14%, var(--fz-karte)); color:var(--error-color, #db4437); }
  .formular textarea { resize:vertical; }
  .formular input, .formular select, .formular textarea { font:inherit; font-size:1.1em; color:var(--fz-text); background:var(--fz-grund);
    border:1px solid var(--fz-linie); border-radius:10px; padding:10px 12px; }
  .formular .reihe { display:flex; gap:12px; align-items:flex-end; }
  .formular .reihe > label { flex:1; }
  .formular .reihe.aus { opacity:.4; }
  .formular label.check { flex-direction:row; align-items:center; gap:8px; flex:none; margin-bottom:18px; }
  .wer { display:flex; flex-wrap:wrap; gap:8px; }
  .pille.wahl { border:2px solid transparent; background:var(--fz-grund); }
  .pille.wahl.an { border-color:transparent; }

  .toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); background:#323232; color:#fff;
    padding:12px 20px; border-radius:12px; z-index:20; box-shadow:0 8px 24px rgba(0,0,0,.25); }

  /* Handy / schmal */
  @media (max-width: 800px) {
    #leiste { display:none; }
    #kopf { padding:10px 12px 8px; flex-wrap:wrap; }
    h1 { font-size:1.4em; }
    .kopf-rechts { width:100%; overflow-x:auto; }
    .avatar { width:46px; height:46px; border-width:3px; padding:2px; }
    .zahnrad ha-icon, .avatar.familie ha-icon { --mdc-icon-size:26px; }
    .tagkopf { font-size:1em; padding:8px 4px; }
    .block { padding:4px 6px; }
    .block .btitel { font-size:.9em; }
    .bbadges { display:none; }
    .zelle { min-height:70px; padding:3px; }
    .chip { font-size:.7em; }
  }
`;

if (!customElements.get("familienzentrale-panel")) {
  customElements.define("familienzentrale-panel", FamilienzentralePanel);
}
