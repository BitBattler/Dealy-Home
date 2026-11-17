/*
 * Familienzentrale – Panel „Familie“ (Wandkalender)
 * Reines JavaScript ohne Build-Schritt. Daten kommen über die normale
 * HA-Anmeldung (hass.callApi) – keine Tokens.
 */

const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WT_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
  "September", "Oktober", "November", "Dezember"];
const NEUTRAL = "#78909c";
const MAX_CHIPS = 4;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const tagStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const plusTage = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const tagKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const montag = (d) => plusTage(tagStart(d), -((d.getDay() + 6) % 7));
const wt = (d) => (d.getDay() + 6) % 7;
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const datumKurz = (d) => `${WT[wt(d)]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
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

class FamilienzentralePanel extends HTMLElement {
  constructor() {
    super();
    this._ansicht = null;          // "monat" | "woche" | "liste"
    this._ref = tagStart(new Date());
    this._events = [];
    this._sig = "";
    this._ladeNr = 0;
    this._detail = null;
    this._fehler = "";
  }

  // ---------------- HA-Schnittstelle ----------------
  set hass(hass) {
    const erst = !this._hass;
    this._hass = hass;
    if (this._menu) this._menu.hass = hass;
    if (erst) {
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
    this._uhr = setInterval(() => this._zeichnen(), 60 * 1000);
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
    return s ? JSON.stringify([s.attributes.personen, s.attributes.kalender]) : "";
  }
  _personen() { return (this._sensor()?.attributes.personen) || []; }
  _kalender() { return (this._sensor()?.attributes.kalender) || []; }

  _modus() { return this._ansicht || (this._narrow ? "liste" : "monat"); }

  _bereich() {
    const m = this._modus();
    if (m === "monat") {
      const start = montag(new Date(this._ref.getFullYear(), this._ref.getMonth(), 1));
      return { start, ende: plusTage(start, 42) };
    }
    if (m === "woche") {
      const start = montag(this._ref);
      return { start, ende: plusTage(start, 7) };
    }
    const start = tagStart(this._ref);
    return { start, ende: plusTage(start, 14) };
  }

  async _laden() {
    if (!this._hass) return;
    const nr = ++this._ladeNr;
    const kal = this._kalender();
    const { start, ende } = this._bereich();
    const heute = tagStart(new Date());
    // zusätzlich die nächsten 30 Tage für „Als Nächstes“
    const von = start < heute ? start : heute;
    const bis = ende > plusTage(heute, 30) ? ende : plusTage(heute, 30);
    this._fehler = "";
    try {
      const listen = await Promise.all(kal.map((eid) =>
        this._hass.callApi("GET",
          `calendars/${eid}?start=${encodeURIComponent(von.toISOString())}&end=${encodeURIComponent(bis.toISOString())}`)
          .then((evs) => evs.map((e) => this._ev(e, eid)))
          .catch((err) => { console.warn("Familienzentrale:", eid, err); this._fehler = `Kalender ${eid} konnte nicht geladen werden.`; return []; })));
      if (nr !== this._ladeNr) return;
      this._events = listen.flat().sort((a, b) => (a.start - b.start) || (b.ganz - a.ganz));
    } catch (err) {
      this._fehler = String(err);
    }
    this._zeichnen();
  }

  _ev(e, kal) {
    const ganz = !!(e.start && e.start.date);
    const start = ganz ? parseDatum(e.start.date) : new Date(e.start.dateTime || e.start);
    const ende = ganz ? parseDatum(e.end.date) : new Date(e.end.dateTime || e.end);
    const titel = e.summary || "(ohne Titel)";
    const klein = titel.toLowerCase();
    const personen = this._personen().filter((p) =>
      (p.stichwoerter || []).some((w) => w && klein.includes(String(w).toLowerCase())));
    return { titel, start, ende, ganz, ort: e.location || "", text: e.description || "", kal, personen,
      serie: !!(e.rrule || e.recurrence_id) };
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
      for (const k of this._tageVon(ev)) {
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(i);
      }
    });
    return m;
  }

  _farbe(ev) { return ev.personen[0]?.farbe || NEUTRAL; }

  _chip(ev, i, mitZeit = true) {
    const f = this._farbe(ev);
    const zweit = ev.personen[1]?.farbe;
    const stil = `background:${f};color:${textFarbe(f)};${zweit ? `box-shadow:inset 5px 0 0 ${zweit};padding-left:9px;` : ""}`;
    const zeit = !ev.ganz && mitZeit ? `<b>${hhmm(ev.start)}</b> ` : "";
    return `<div class="chip" data-ev="${i}" style="${stil}" title="${esc(ev.titel)}">${zeit}${esc(ev.titel)}</div>`;
  }

  _zeitText(ev) {
    if (ev.ganz) {
      const letzter = plusTage(ev.ende, -1);
      return letzter > ev.start
        ? `${datumKurz(ev.start)} – ${datumKurz(letzter)} · ganztägig`
        : `${WT_LANG[wt(ev.start)]}, ${pad(ev.start.getDate())}.${pad(ev.start.getMonth() + 1)}. · ganztägig`;
    }
    const gleich = tagKey(ev.start) === tagKey(ev.ende);
    return gleich
      ? `${WT_LANG[wt(ev.start)]}, ${pad(ev.start.getDate())}.${pad(ev.start.getMonth() + 1)}. · ${hhmm(ev.start)}–${hhmm(ev.ende)}`
      : `${datumKurz(ev.start)} ${hhmm(ev.start)} – ${datumKurz(ev.ende)} ${hhmm(ev.ende)}`;
  }

  _countdown(ev) {
    const jetzt = new Date();
    if (ev.start <= jetzt && ev.ende > jetzt) return "läuft gerade";
    const heute = tagStart(jetzt);
    const tageDiff = Math.round((tagStart(ev.start) - heute) / 86400000);
    if (ev.ganz) return tageDiff === 0 ? "heute" : tageDiff === 1 ? "morgen" : `in ${tageDiff} Tagen`;
    const min = Math.round((ev.start - jetzt) / 60000);
    if (min < 60) return `in ${min} Min.`;
    if (tageDiff === 0) return `heute ${hhmm(ev.start)} (in ${Math.round(min / 60)} Std.)`;
    if (tageDiff === 1) return `morgen ${hhmm(ev.start)}`;
    return `${datumKurz(ev.start)} ${hhmm(ev.start)} (in ${tageDiff} Tagen)`;
  }

  // ---------------- Aufbau & Zeichnen ----------------
  _aufbauen() {
    this._root = this.attachShadow({ mode: "open" });
    this._root.innerHTML = `
      <style>${FamilienzentralePanel.css}</style>
      <div class="wurzel">
        <div class="leiste"><span id="menu"></span><div id="kopf"></div></div>
        <div id="inhalt"></div>
      </div>
      <div id="dialog"></div>`;
    this._menu = document.createElement("ha-menu-button");
    this._menu.hass = this._hass;
    this._menu.narrow = this._narrow;
    this._root.getElementById("menu").appendChild(this._menu);
    this._root.addEventListener("click", (e) => this._klick(e));
  }

  _klick(e) {
    const el = e.target.closest("[data-a],[data-ev]");
    if (!el) return;
    if (el.dataset.ev !== undefined) {
      this._detail = this._events[Number(el.dataset.ev)];
      this._zeichneDialog();
      return;
    }
    const a = el.dataset.a;
    const m = this._modus();
    if (a === "zu") { if (e.target === el) { this._detail = null; this._zeichneDialog(); } return; }
    if (a === "schliessen") { this._detail = null; this._zeichneDialog(); return; }
    if (a === "heute") this._ref = tagStart(new Date());
    else if (a === "zurueck" || a === "vor") {
      const r = a === "vor" ? 1 : -1;
      if (m === "monat") this._ref = new Date(this._ref.getFullYear(), this._ref.getMonth() + r, 1);
      else this._ref = plusTage(this._ref, r * (m === "woche" ? 7 : 14));
    } else if (["monat", "woche", "liste"].includes(a)) this._ansicht = a;
    else if (a.startsWith("woche-")) { this._ref = parseDatum(a.slice(6)); this._ansicht = "woche"; }
    else if (a === "bearbeiten") {
      history.pushState(null, "", "/calendar");
      window.dispatchEvent(new CustomEvent("location-changed"));
      return;
    } else return;
    this._zeichnen();
    this._laden();
  }

  _zeichnen() {
    if (!this._root) return;
    this._zeichneKopf();
    this._zeichneInhalt();
    this._zeichneDialog();
  }

  _label() {
    const m = this._modus();
    if (m === "monat") return `${MON[this._ref.getMonth()]} ${this._ref.getFullYear()}`;
    const { start, ende } = this._bereich();
    const letzter = plusTage(ende, -1);
    const spanne = `${pad(start.getDate())}.${pad(start.getMonth() + 1)}. – ${pad(letzter.getDate())}.${pad(letzter.getMonth() + 1)}.`;
    return m === "woche" ? `KW ${kw(start)} · ${spanne}` : spanne;
  }

  _zeichneKopf() {
    const m = this._modus();
    const titel = this._panel?.config?.titel || "Familie";
    const btn = (a, txt, aktiv = false, extra = "") =>
      `<button data-a="${a}" class="${aktiv ? "aktiv" : ""}" ${extra}>${txt}</button>`;
    this._root.getElementById("kopf").innerHTML = `
      <h1>${esc(titel)}</h1>
      <div class="nav">
        ${btn("zurueck", "‹", false, 'aria-label="zurück"')}
        ${btn("heute", "Heute")}
        ${btn("vor", "›", false, 'aria-label="vor"')}
        <span class="label">${esc(this._label())}</span>
      </div>
      <div class="ansichten">
        ${btn("monat", "Monat", m === "monat")}
        ${btn("woche", "Woche", m === "woche")}
        ${btn("liste", "Liste", m === "liste")}
        ${btn("bearbeiten", "✏️", false, 'title="Termine im Kalender bearbeiten"')}
      </div>`;
  }

  _legende() {
    const p = this._personen();
    if (!p.length) return "";
    return `<div class="legende">${p.map((x) => `
      <span class="person" style="border-color:${x.farbe}">
        ${x.bild ? `<img src="${esc(x.bild)}" alt="">` : `<span class="initial" style="background:${x.farbe};color:${textFarbe(x.farbe)}">${esc((x.name || "?")[0])}</span>`}
        ${esc(x.name)}
      </span>`).join("")}</div>`;
  }

  _naechster() {
    const jetzt = new Date();
    const heute = tagStart(jetzt);
    const ev = this._events.find((e) => (e.ganz ? e.ende > heute && e.start >= heute : e.ende > jetzt));
    if (!ev) return "";
    const i = this._events.indexOf(ev);
    const f = this._farbe(ev);
    const namen = ev.personen.map((p) => p.name).join(", ");
    return `<div class="naechster" data-ev="${i}" style="border-left-color:${f}">
      <span class="klein">Als Nächstes</span>
      <b>${esc(ev.titel)}</b>
      <span>${esc(this._countdown(ev))}${namen ? ` · ${esc(namen)}` : ""}</span>
    </div>`;
  }

  _zeichneInhalt() {
    const inhalt = this._root.getElementById("inhalt");
    if (!this._sensor()) {
      inhalt.innerHTML = `<div class="hinweis">Die Familienzentrale ist noch nicht eingerichtet.</div>`;
      return;
    }
    if (!this._kalender().length) {
      inhalt.innerHTML = `<div class="hinweis">Noch kein Kalender gewählt.<br>
        Einstellungen → Geräte &amp; Dienste → Familienzentrale → Konfigurieren → „📅 Kalender &amp; Push“.</div>`;
      return;
    }
    const m = this._modus();
    const fehler = this._fehler ? `<div class="fehler">${esc(this._fehler)}</div>` : "";
    const kopf = fehler + this._legende() + this._naechster();
    if (m === "monat") inhalt.innerHTML = kopf + this._monat();
    else if (m === "woche") inhalt.innerHTML = kopf + this._woche();
    else inhalt.innerHTML = kopf + this._liste();
  }

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
      const chips = ids.slice(0, MAX_CHIPS).map((id) => this._chip(this._events[id], id)).join("");
      const mehr = ids.length > MAX_CHIPS
        ? `<div class="mehr" data-a="woche-${k}">+${ids.length - MAX_CHIPS} weitere</div>` : "";
      html += `<div class="zelle ${d.getMonth() !== monat ? "aus" : ""} ${k === heute ? "heute" : ""} ${wt(d) >= 5 ? "we" : ""}">
        <div class="nr">${d.getDate()}</div>${chips}${mehr}</div>`;
    }
    return html + "</div>";
  }

  _woche() {
    const pt = this._proTag();
    const { start } = this._bereich();
    const heute = tagKey(new Date());
    let html = `<div class="woche">`;
    for (let i = 0; i < 7; i++) {
      const d = plusTage(start, i);
      const k = tagKey(d);
      const ids = pt.get(k) || [];
      html += `<div class="spalte ${k === heute ? "heute" : ""}">
        <div class="skopf"><span>${WT[i]}</span><b>${d.getDate()}.</b></div>
        ${ids.map((id) => {
          const ev = this._events[id];
          return `${this._chip(ev, id, false)}<div class="zeit">${ev.ganz ? "ganztägig" : `${hhmm(ev.start)}–${hhmm(ev.ende)}`}</div>`;
        }).join("") || `<div class="leer">–</div>`}
      </div>`;
    }
    return html + "</div>";
  }

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
      html += `<div class="tag ${diff === 0 ? "heute" : ""}"><h3>${name} <span>${pad(d.getDate())}.${pad(d.getMonth() + 1)}.</span></h3>
        ${ids.map((id) => {
          const ev = this._events[id];
          const f = this._farbe(ev);
          return `<div class="zeile" data-ev="${id}">
            <span class="punkt" style="background:${f}"></span>
            <span class="zeit">${ev.ganz ? "ganztägig" : `${hhmm(ev.start)}–${hhmm(ev.ende)}`}</span>
            <span class="titel">${esc(ev.titel)}${ev.personen.length ? `<small>${esc(ev.personen.map((p) => p.name).join(", "))}</small>` : ""}</span>
          </div>`;
        }).join("")}</div>`;
    }
    if (leer) html += `<div class="hinweis">Keine Termine in diesem Zeitraum.</div>`;
    return html + "</div>";
  }

  _zeichneDialog() {
    const dlg = this._root.getElementById("dialog");
    const ev = this._detail;
    if (!ev) { dlg.innerHTML = ""; return; }
    const f = this._farbe(ev);
    const kal = this._hass.states[ev.kal]?.attributes.friendly_name || ev.kal;
    dlg.innerHTML = `
      <div class="overlay" data-a="zu">
        <div class="karte" style="border-top:8px solid ${f}">
          <h2>${esc(ev.titel)}</h2>
          <p class="zeitlang">🕒 ${esc(this._zeitText(ev))}${ev.serie ? " · 🔁 wiederkehrend" : ""}</p>
          ${ev.personen.length ? `<p>${ev.personen.map((p) => `<span class="tag-person" style="background:${p.farbe};color:${textFarbe(p.farbe)}">${esc(p.name)}</span>`).join(" ")}</p>` : ""}
          ${ev.ort ? `<p>📍 ${esc(ev.ort)}</p>` : ""}
          ${ev.text ? `<p class="beschreibung">${esc(ev.text)}</p>` : ""}
          <p class="klein">📅 ${esc(kal)}</p>
          <div class="knoepfe"><button data-a="bearbeiten">✏️ Bearbeiten</button><button data-a="schliessen">Schließen</button></div>
        </div>
      </div>`;
  }
}

FamilienzentralePanel.css = `
  :host { display:block; height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
    font-family: var(--ha-font-family-body, Roboto, "Noto Sans", sans-serif); font-size:16px; }
  * { box-sizing:border-box; }
  .wurzel { display:flex; flex-direction:column; height:100%; }
  .leiste { display:flex; align-items:center; gap:4px; padding:4px 12px; min-height:56px;
    background:var(--app-header-background-color, var(--primary-color)); color:var(--app-header-text-color, #fff); }
  #kopf { flex:1; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  h1 { font-size:1.3em; font-weight:500; margin:0 8px 0 0; }
  .nav, .ansichten { display:flex; align-items:center; gap:4px; }
  .ansichten { margin-left:auto; }
  .label { font-size:1.1em; font-weight:500; margin-left:8px; }
  button { font:inherit; border:0; border-radius:999px; padding:6px 14px; cursor:pointer;
    background:rgba(255,255,255,.18); color:inherit; }
  button:hover { background:rgba(255,255,255,.3); }
  button.aktiv { background:var(--card-background-color); color:var(--primary-text-color); }
  #inhalt { flex:1; overflow:auto; padding:12px; }
  .hinweis { padding:32px; text-align:center; color:var(--secondary-text-color); line-height:1.6; }
  .fehler { background:var(--error-color, #db4437); color:#fff; padding:8px 12px; border-radius:8px; margin-bottom:8px; }

  .legende { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
  .person { display:inline-flex; align-items:center; gap:6px; padding:2px 12px 2px 2px; border-radius:999px;
    background:var(--card-background-color); border:2px solid; font-size:.9em; }
  .person img, .initial { width:26px; height:26px; border-radius:50%; object-fit:cover; display:inline-flex;
    align-items:center; justify-content:center; font-weight:700; font-size:.8em; }

  .naechster { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 12px; background:var(--card-background-color);
    border-radius:12px; padding:10px 14px; margin-bottom:12px; border-left:6px solid; cursor:pointer;
    box-shadow:var(--ha-card-box-shadow, none); }
  .klein { font-size:.8em; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.04em; }

  .monat { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:4px; }
  .wt { text-align:center; font-size:.8em; font-weight:600; color:var(--secondary-text-color); padding:2px 0; }
  .zelle { background:var(--card-background-color); border-radius:8px; padding:4px;
    min-height:max(90px, calc((100vh - 260px) / 6)); overflow:hidden; }
  .zelle.we { background:color-mix(in srgb, var(--card-background-color) 90%, var(--primary-color)); }
  .zelle.aus { opacity:.4; }
  .zelle.heute { outline:2px solid var(--primary-color); }
  .nr { font-size:.85em; font-weight:600; margin:0 0 2px 2px; }
  .heute .nr { background:var(--primary-color); color:var(--text-primary-color, #fff); border-radius:50%;
    width:1.8em; height:1.8em; display:inline-flex; align-items:center; justify-content:center; margin:0; }
  .chip { font-size:.75em; border-radius:4px; padding:2px 5px; margin:2px 0; white-space:nowrap; overflow:hidden;
    text-overflow:ellipsis; cursor:pointer; line-height:1.35; }
  .mehr { font-size:.72em; color:var(--secondary-text-color); padding-left:4px; }

  .woche { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:6px; }
  .spalte { background:var(--card-background-color); border-radius:10px; padding:6px; min-height:60vh; }
  .spalte.heute { outline:2px solid var(--primary-color); }
  .skopf { display:flex; justify-content:space-between; font-size:.9em; margin-bottom:6px; color:var(--secondary-text-color); }
  .spalte .chip { font-size:.85em; white-space:normal; }
  .zeit { font-size:.75em; color:var(--secondary-text-color); margin:-1px 0 6px 2px; }
  .leer { color:var(--disabled-text-color, #aaa); text-align:center; }

  .liste .tag { background:var(--card-background-color); border-radius:12px; padding:8px 12px; margin-bottom:10px; }
  .liste .tag.heute { outline:2px solid var(--primary-color); }
  .liste h3 { margin:2px 0 6px; font-size:1em; }
  .liste h3 span { color:var(--secondary-text-color); font-weight:400; }
  .zeile { display:flex; align-items:center; gap:10px; padding:6px 0; border-top:1px solid var(--divider-color); cursor:pointer; }
  .zeile:first-of-type { border-top:0; }
  .punkt { width:12px; height:12px; border-radius:50%; flex:none; }
  .zeile .zeit { margin:0; width:92px; flex:none; font-size:.85em; }
  .titel small { display:block; color:var(--secondary-text-color); font-size:.8em; }

  .overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center;
    justify-content:center; z-index:10; padding:16px; }
  .karte { background:var(--card-background-color); color:var(--primary-text-color); border-radius:16px; padding:20px;
    width:100%; max-width:480px; max-height:85vh; overflow:auto; box-shadow:0 10px 40px rgba(0,0,0,.35); }
  .karte h2 { margin:0 0 8px; font-size:1.3em; }
  .karte p { margin:6px 0; line-height:1.45; }
  .beschreibung { white-space:pre-wrap; background:var(--secondary-background-color); padding:8px 10px; border-radius:8px; }
  .tag-person { display:inline-block; padding:2px 10px; border-radius:999px; font-size:.85em; }
  .knoepfe { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; }
  .knoepfe button { background:var(--primary-color); color:var(--text-primary-color, #fff); }

  @media (max-width: 700px) {
    #kopf { gap:6px; }
    .ansichten { margin-left:0; }
    .zelle { min-height:64px; }
    .chip { font-size:.65em; }
    .woche { grid-template-columns:1fr; }
    .spalte { min-height:0; }
  }
`;

if (!customElements.get("familienzentrale-panel")) {
  customElements.define("familienzentrale-panel", FamilienzentralePanel);
}
