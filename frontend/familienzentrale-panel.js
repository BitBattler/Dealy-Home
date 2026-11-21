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
// key = Modul, seite = Seite im Panel (null = kommt noch)
const LEISTE = [
  { key: "kalender", seite: "kalender", icon: "mdi:calendar-month", label: "Kalender" },
  { key: "stundenplan", seite: null, icon: "mdi:school", label: "Schule" },
  { key: "routinen", seite: "aufgaben", icon: "mdi:check-decagram", label: "Aufgaben" },
  { key: "punkte", seite: "glaeser", icon: "mdi:star-shooting", label: "Sterne" },
  { key: "punkte", seite: "schaetze", icon: "mdi:treasure-chest", label: "Schätze" },
  { key: "essensplan", seite: "essen", icon: "mdi:food-apple", label: "Essen" },
  { key: "listen", seite: null, icon: "mdi:clipboard-list", label: "Listen" },
];
const KINDER_SEITEN = ["aufgaben", "glaeser", "schaetze"];

// Modul-Schlüssel -> Seite im Panel
const SEITEN = { kalender: "kalender", essensplan: "essen", routinen: "aufgaben", punkte: "schaetze" };
const ZEIT_NAME = { morgen: "🌅 Morgen", tag: "☀️ Tag", abend: "🌙 Abend" };
const ZEIT_ROUTINE = {
  morgen: { emoji: "🌅", name: "Morgenroutine", wort: "Morgen" },
  tag: { emoji: "☀️", name: "Tagesaufgaben", wort: "Tag" },
  abend: { emoji: "🌙", name: "Abendroutine", wort: "Abend" },
};

// Aufgaben-Vorschläge (antippen = hinzufügen); zeit = wann sie typischerweise passen
const VORSCHLAEGE = [
  { emoji: "🚽", name: "Aufs Töpfchen", zeit: ["morgen", "abend"] },
  { emoji: "🪥", name: "Zähne putzen", zeit: ["morgen", "abend"] },
  { emoji: "👕", name: "Anziehen", zeit: ["morgen"] },
  { emoji: "🥣", name: "Frühstücken", zeit: ["morgen"] },
  { emoji: "💇", name: "Haare kämmen", zeit: ["morgen"] },
  { emoji: "👟", name: "Schuhe anziehen", zeit: ["morgen"] },
  { emoji: "🧥", name: "Jacke anziehen", zeit: ["morgen"] },
  { emoji: "🎒", name: "Rucksack nehmen", zeit: ["morgen"] },
  { emoji: "🧼", name: "Hände waschen", zeit: ["tag", "abend"] },
  { emoji: "🧸", name: "Spielzeug aufräumen", zeit: ["tag", "abend"] },
  { emoji: "🍽️", name: "Tisch decken", zeit: ["tag"] },
  { emoji: "💧", name: "Wasser trinken", zeit: ["tag"] },
  { emoji: "🐕", name: "Ameo füttern", zeit: ["tag"] },
  { emoji: "🌱", name: "Blumen giessen", zeit: ["tag"] },
  { emoji: "🍎", name: "Obst essen", zeit: ["tag"] },
  { emoji: "🧺", name: "Wäsche helfen", zeit: ["tag"] },
  { emoji: "🛁", name: "Baden", zeit: ["abend"] },
  { emoji: "👚", name: "Pyjama anziehen", zeit: ["abend"] },
  { emoji: "📖", name: "Geschichte lesen", zeit: ["abend"] },
  { emoji: "🛏️", name: "Ins Bett gehen", zeit: ["abend"] },
  { emoji: "🤗", name: "Gute-Nacht-Kuss", zeit: ["abend"] },
].map((v) => ({ ...v, gruppe: "kind" })).concat([
  // Mami & Papi
  { emoji: "🛏️", name: "Bett machen", zeit: ["morgen"] },
  { emoji: "🥪", name: "Znüni vorbereiten", zeit: ["morgen"] },
  { emoji: "🎒", name: "Kita-Tasche packen", zeit: ["morgen", "abend"] },
  { emoji: "🐕", name: "Gassi mit Ameo", zeit: ["morgen", "tag", "abend"] },
  { emoji: "🍽️", name: "Geschirrspüler ausräumen", zeit: ["morgen", "abend"] },
  { emoji: "💊", name: "Vitamine nehmen", zeit: ["morgen"] },
  { emoji: "🧘", name: "Sport / Yoga", zeit: ["morgen", "tag"] },
  { emoji: "🧺", name: "Wäsche waschen", zeit: ["tag"] },
  { emoji: "👕", name: "Wäsche zusammenlegen", zeit: ["tag", "abend"] },
  { emoji: "🧹", name: "Staubsaugen", zeit: ["tag"] },
  { emoji: "🛒", name: "Einkaufen", zeit: ["tag"] },
  { emoji: "🍳", name: "Kochen", zeit: ["tag", "abend"] },
  { emoji: "🌱", name: "Pflanzen giessen", zeit: ["tag"] },
  { emoji: "🗑️", name: "Müll rausbringen", zeit: ["tag", "abend"] },
  { emoji: "🦴", name: "Ameo füttern", zeit: ["morgen", "abend"] },
  { emoji: "📬", name: "Post & Rechnungen", zeit: ["tag"] },
  { emoji: "💧", name: "2 Liter trinken", zeit: ["tag"] },
  { emoji: "🚶", name: "Spazieren gehen", zeit: ["tag"] },
  { emoji: "🧽", name: "Küche aufräumen", zeit: ["abend"] },
  { emoji: "🛋️", name: "Wohnzimmer aufräumen", zeit: ["abend"] },
  { emoji: "📖", name: "Niilo vorlesen", zeit: ["abend"] },
  { emoji: "📅", name: "Morgen planen", zeit: ["abend"] },
  { emoji: "📵", name: "Handy weglegen", zeit: ["abend"] },
  { emoji: "💑", name: "Paarzeit", zeit: ["abend"] },
].map((v) => ({ ...v, gruppe: "eltern" })));
// Startaufgaben einer neuen Routine je Tageszeit und Gruppe
const VORLAGE = {
  kind: {
    morgen: ["Aufs Töpfchen", "Zähne putzen", "Anziehen", "Frühstücken"],
    tag: ["Hände waschen", "Spielzeug aufräumen", "Wasser trinken"],
    abend: ["Baden", "Pyjama anziehen", "Zähne putzen", "Geschichte lesen"],
  },
  eltern: {
    morgen: ["Bett machen", "Gassi mit Ameo", "Kita-Tasche packen", "Vitamine nehmen"],
    tag: ["Wäsche waschen", "Einkaufen", "Kochen", "Pflanzen giessen"],
    abend: ["Küche aufräumen", "Niilo vorlesen", "Morgen planen", "Handy weglegen"],
  },
};
// Erwachsene am Namen erkennen (Mami, Papi …); alle anderen gelten als Kind
const ERWACHSEN = /^(mami|mama|mum|mutti|mutter|papi|papa|daddy|dad|vati|vater)\b/i;

// Vorlagen für den Belohnungsladen (sandi = Sandi-Sterne, 1 Stern = 5 Min. TV)
const SCHATZ_VORLAGEN = [
  { gruppe: "kind", emoji: "📺", name: "15 Min. Fernsehen", kosten: 5, sandi: 3 },
  { gruppe: "kind", emoji: "📺", name: "30 Min. Fernsehen", kosten: 9, sandi: 6 },
  { gruppe: "kind", emoji: "📖", name: "Extra-Geschichte", kosten: 3 },
  { gruppe: "kind", emoji: "🎈", name: "Ballon", kosten: 4 },
  { gruppe: "kind", emoji: "🛝", name: "Spielplatz", kosten: 6 },
  { gruppe: "kind", emoji: "🌙", name: "10 Min. länger wach", kosten: 6 },
  { gruppe: "kind", emoji: "🍪", name: "Guetzli backen", kosten: 8 },
  { gruppe: "kind", emoji: "🍦", name: "Glace essen", kosten: 10 },
  { gruppe: "kind", emoji: "🍕", name: "Znacht aussuchen", kosten: 12 },
  { gruppe: "kind", emoji: "🚂", name: "Zugfahrt", kosten: 20 },
  { gruppe: "kind", emoji: "🏊", name: "Schwimmbad", kosten: 25 },
  { gruppe: "kind", emoji: "🎁", name: "Kleines Spielzeug", kosten: 30 },
  { gruppe: "kind", emoji: "🦁", name: "Zoo-Ausflug", kosten: 40 },
  { gruppe: "eltern", emoji: "☕", name: "Kaffee ans Bett", kosten: 5 },
  { gruppe: "eltern", emoji: "📚", name: "1 Std. ungestört lesen", kosten: 8 },
  { gruppe: "eltern", emoji: "🎮", name: "1 Std. Gamen", kosten: 10 },
  { gruppe: "eltern", emoji: "🧹", name: "Ein Ämtli abgeben", kosten: 10 },
  { gruppe: "eltern", emoji: "🍷", name: "Weinabend", kosten: 10 },
  { gruppe: "eltern", emoji: "💆", name: "Massage", kosten: 12 },
  { gruppe: "eltern", emoji: "😴", name: "Ausschlafen", kosten: 15 },
  { gruppe: "eltern", emoji: "🏃", name: "Freier Nachmittag", kosten: 20 },
  { gruppe: "eltern", emoji: "🛁", name: "Wellness-Abend", kosten: 20 },
  { gruppe: "eltern", emoji: "🎬", name: "Kino-Abend", kosten: 25 },
  { gruppe: "eltern", emoji: "🍽️", name: "Essen gehen zu zweit", kosten: 40 },
  { gruppe: "alle", emoji: "🍿", name: "Familien-Filmabend", kosten: 15, sandi: 0 },
  { gruppe: "alle", emoji: "🥐", name: "Sonntags-Zmorge im Bett", kosten: 15 },
  { gruppe: "alle", emoji: "🏕️", name: "Familienausflug aussuchen", kosten: 30 },
];
const SCHATZ_EMOJIS = ["🎁", "🍦", "📺", "📖", "🛝", "🎈", "🍪", "🍕", "🚂", "🏊", "🦁", "☕", "😴", "💆", "🛁",
  "🍷", "🎬", "🍽️", "📚", "🎮", "🏃", "🍿", "🥐", "🏕️", "🧸", "🎨", "⚽", "🚲", "🎡"];
// Stichwort im Aufgabennamen -> passendes Emoji (erstes Treffer gewinnt)
const EMOJI_REGELN = [
  [/z(ä|ae)hn|zahn/, "🪥"], [/t(ö|oe)pf|toilette|klo|pipi|wc/, "🚽"], [/socke/, "🧦"], [/schuh/, "👟"],
  [/jacke|mantel/, "🧥"], [/m(ü|ue)tze|kappe/, "🧢"], [/pyjama|schlafanzug/, "👚"], [/anzieh|kleid|hose|pulli/, "👕"],
  [/fr(ü|ue)hst/, "🥣"], [/obst|apfel/, "🍎"], [/gem(ü|ue)se/, "🥦"], [/trink|wasser/, "💧"],
  [/tisch|essen|mittag|abendessen/, "🍽️"], [/h(ä|ae)nde|waschen|seife/, "🧼"], [/bad|dusch/, "🛁"],
  [/haar|k(ä|ae)mm|b(ü|ue)rst/, "💇"], [/creme|eincrem/, "🧴"], [/nase|schnäuz|schneuz/, "🤧"],
  [/bett|schlaf|nickerchen/, "🛏️"], [/buch|lesen|geschicht/, "📖"], [/aufr(ä|ae)um|spielzeug|zimmer/, "🧸"],
  [/ameo|hund|gassi/, "🐕"], [/katze/, "🐈"], [/f(ü|ue)tter/, "🥕"], [/blume|gie(ss|ß)|pflanze/, "🌱"],
  [/w(ä|ae)sche/, "🧺"], [/m(ü|ue)ll|abfall/, "🗑️"], [/rucksack|tasche/, "🎒"], [/kita|kindergarten|schule/, "🏫"],
  [/mal(en)?\b|zeichn|bastel/, "🎨"], [/musik|sing|lied/, "🎵"], [/turn|sport|bewegen|hüpf/, "🤸"],
  [/kuss|kuschel|umarm|gute.?nacht/, "🤗"], [/danke|bitte/, "🙏"], [/licht|lampe/, "💡"], [/vitamin|medizin/, "💊"],
  [/hausaufgab|(ü|ue)ben|schreib/, "✏️"], [/drau(ss|ß)en|spazier|garten/, "🌳"], [/helfen|hilf/, "🤝"],
];
const EMOJI_AUSWAHL = ["⭐", "🪥", "🚽", "👕", "🧦", "👟", "🧥", "🥣", "🍎", "💧", "🍽️", "🧼", "🛁", "💇", "🧴",
  "🛏️", "📖", "🧸", "🐕", "🌱", "🧺", "🎒", "🏫", "🎨", "🎵", "🤸", "🤗", "🙏", "💡", "✏️", "🌳", "🤝", "🗑️", "🦷", "👚"];
const ROUTINE_EMOJIS = ["🌅", "☀️", "🌙", "⭐", "🏫", "🛁", "🍽️", "🧸", "🎒", "🐕", "🌈", "🚀"];
const emojiFuer = (name) => {
  const n = String(name || "").toLowerCase();
  for (const [re, e] of EMOJI_REGELN) if (re.test(n)) return e;
  return "";
};
// Passende Emojis zu einem Namen zuerst, danach die übrige Auswahl
const emojiVorschlaege = (name) => {
  const n = String(name || "").toLowerCase();
  return [...new Set(EMOJI_REGELN.filter(([re]) => re.test(n)).map(([, e]) => e))];
};

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
    this._ki = null;                // Dialog: KI (Rezept / Woche)
    // Aufgaben & Schätze
    this._kinder = null;            // Daten vom Backend
    this._kind = null;              // gewählte Person (entity_id)
    this._bearbeiten = false;       // Eltern-Bearbeitungsmodus
    this._pin = null;               // {wert, bis} – gemerkte PIN (5 Minuten)
    this._kdlg = null;              // Dialog (pin | routine | belohnung | einloesen | korrektur)
  }

  // ---------------- HA-Schnittstelle ----------------
  set hass(hass) {
    const erst = !this._hass;
    this._hass = hass;
    if (this._menu) this._menu.hass = hass;
    if (erst) {
      const mod = this._module();
      const erstes = Object.keys(SEITEN).find((k) => mod.includes(k));
      this._seite = SEITEN[erstes] || "kalender";
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
    if (KINDER_SEITEN.includes(this._seite)) { await this._ladeKinder(); return; }
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
    document.addEventListener("fullscreenchange", () => this._zeichneKopf());
    this._root.addEventListener("submit", (e) => {
      e.preventDefault();
      if (this._neu) this._speichern();
    });
    // Rezeptsuche im Mahlzeit-Dialog: Liste filtern, ohne neu zu zeichnen
    this._root.addEventListener("input", (e) => {
      if (this._kdlg?.typ === "routine") { this._routineEingabe(e.target); return; }
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

  // Vollbild fürs Wanddisplay (blendet HA-Seitenleiste und Browserleisten aus)
  _vollbildKnopf() {
    if (!document.fullscreenEnabled) return "";
    const an = !!document.fullscreenElement;
    return `<button class="zahnrad" data-a="vollbild" title="${an ? "Vollbild beenden" : "Vollbild"}">
      <ha-icon icon="${an ? "mdi:fullscreen-exit" : "mdi:fullscreen"}"></ha-icon></button>`;
  }

  async _vollbild() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.requestFullscreen({ navigationUI: "hide" });
    } catch (err) {
      this._zeigeToast("Vollbild ist hier nicht möglich.");
    }
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

    const zu = () => {
      if (this._ki?.laeuft) return;   // während die KI schreibt, offen lassen
      this._detail = null; this._neu = null; this._slot = null; this._rezept = null; this._ki = null; this._kdlg = null;
      this._zeichneDialog();
    };
    if (a === "zu") { if (e.target === el) zu(); return; }
    if (a === "schliessen") { zu(); return; }
    if (this._klickEssen(a)) return;
    if (this._klickKinder(a)) return;
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
    if (a === "vollbild") { this._vollbild(); return; }
    if (a === "einstellungen") {
      if (document.fullscreenElement) document.exitFullscreen();
      this._navigiere("/config/integrations/integration/familienzentrale");
      return;
    }
    if (a === "bearbeiten") { this._navigiere("/calendar"); return; }
    if (a.startsWith("seite-")) {
      const s = a.slice(6);
      if (s !== "bald") {
        this._seite = s;
        this._bearbeiten = false;
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
    if (a === "ki-rezept") {
      this._ki = { modus: "rezept", eingabe: "", laeuft: false };
      this._zeichneDialog();
      setTimeout(() => this._root.querySelector("#k-eingabe")?.focus(), 50);
      return true;
    }
    if (a === "ki-woche") {
      this._ki = { modus: "woche", eingabe: "", nurLeere: true, laeuft: false };
      this._zeichneDialog();
      return true;
    }
    if (a === "ki-los") { this._kiLos(); return true; }
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
    if (r.id) daten.rezept_id = r.id;
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
    await this._ws({ type: "familienzentrale/essen/rezept_loeschen", rezept_id: r.id }, "Rezept gelöscht");
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

  async _kiLos() {
    const k = this._ki;
    if (!k || k.laeuft) return;
    k.eingabe = (this._root.querySelector("#k-eingabe")?.value || "").trim();
    if (k.modus === "woche") k.nurLeere = !!this._root.querySelector("#k-leer")?.checked;
    if (k.modus === "rezept" && k.eingabe.length < 2) { this._zeigeToast("Bitte eine Idee, einen Text oder Link eingeben."); return; }
    k.laeuft = true;
    this._zeichneDialog();
    try {
      if (k.modus === "rezept") {
        const r = await this._hass.callWS({ type: "familienzentrale/essen/ki_rezept", eingabe: k.eingabe });
        this._ki = null;
        await this._ladeEssen();
        this._essenAnsicht = "rezepte";
        this._zeichnen();
        this._oeffneRezept(r.id);
        this._zeigeToast("✨ Rezept erstellt und gespeichert – hier kannst du es anpassen");
      } else {
        const r = await this._hass.callWS({
          type: "familienzentrale/essen/ki_woche", start: tagKey(this._essenRef),
          wuensche: k.eingabe, nur_leere: k.nurLeere,
        });
        this._ki = null;
        this._essenAnsicht = "plan";
        await this._ladeEssen();
        this._zeigeToast(r.geplant
          ? `✨ ${r.geplant} Mahlzeiten geplant${r.neue_rezepte ? `, ${r.neue_rezepte} neue Rezepte` : ""}`
          : "Es gab nichts zu planen (alles schon belegt oder vorbei).");
      }
    } catch (err) {
      k.laeuft = false;
      this._zeichneDialog();
      this._zeigeToast(`Fehler: ${err.message || err}`);
    }
  }

  _kiDialog() {
    const k = this._ki;
    const rezept = k.modus === "rezept";
    const laeuft = k.laeuft
      ? `<div class="ki-laeuft"><span class="ki-funken">✨</span> Claude ${rezept ? "schreibt das Rezept" : "plant eure Woche"} … das dauert ${rezept ? "ein paar Sekunden" : "bis zu einer Minute"}.</div>` : "";
    return `
      <div class="overlay" data-a="zu">
        <form class="karte formular breit">
          <h2>${rezept ? "✨ Rezept mit KI" : "✨ Woche vorschlagen"}</h2>
          <p class="grau">${rezept
            ? "Gib eine Idee ein („schnelle Gemüse-Lasagne“), füge einen Rezepttext ein oder einen Link. Claude macht daraus ein Rezept mit Zutaten und Schritten."
            : `Claude plant die Mahlzeiten für KW ${kw(this._essenRef)} – mit Zutaten für die Einkaufsliste. Tage, die schon vorbei sind, werden übersprungen.`}</p>
          <label>${rezept ? "Idee, Rezepttext oder Link" : "Wünsche für diese Woche (freiwillig)"}
            <textarea id="k-eingabe" rows="${rezept ? 6 : 3}" ${k.laeuft ? "disabled" : ""}
              placeholder="${rezept ? "z. B. Kürbissuppe mit Kokosmilch, die Niilo mag" : "z. B. zweimal Fisch, etwas mit Kürbis, Freitag Pizza"}">${esc(k.eingabe)}</textarea></label>
          ${rezept ? "" : `<label class="check"><input id="k-leer" type="checkbox" ${k.nurLeere ? "checked" : ""} ${k.laeuft ? "disabled" : ""}> Nur leere Felder füllen</label>`}
          ${laeuft}
          <div class="knoepfe">
            <span class="platz"></span>
            <button type="button" class="zweit" data-a="schliessen" ${k.laeuft ? "disabled" : ""}>Abbrechen</button>
            <button type="button" data-a="ki-los" ${k.laeuft ? "disabled" : ""}>✨ Los</button>
          </div>
        </form>
      </div>`;
  }

  // ======================= Aufgaben & Schätze =======================
  _kinderListe() { return this._personen().filter((p) => p.entity_id.startsWith("person.")); }

  // Sterne als Bilder statt Zahlen (für Kinder, die noch nicht zählen)
  _sternPlaetze(haben, kosten) {
    return Array.from({ length: kosten }, (_, i) =>
      `<span class="splatz ${i < haben ? "voll" : ""}">${i < haben ? "⭐" : "☆"}</span>`).join("");
  }

  // Großer Stern / Konfetti als Rückmeldung beim Abhaken
  _feiern(zeichen, gross = false) {
    const ebene = this._root.getElementById("toast");
    const el = document.createElement("div");
    el.className = `feier ${gross ? "gross" : ""}`;
    el.textContent = zeichen;
    ebene.appendChild(el);
    if (gross) {
      for (let i = 0; i < 14; i++) {
        const f = document.createElement("div");
        f.className = "funke";
        f.textContent = ["⭐", "🌟", "✨", "🎉"][i % 4];
        f.style.setProperty("--x", `${Math.cos(i / 14 * 2 * Math.PI) * 38}vw`);
        f.style.setProperty("--y", `${Math.sin(i / 14 * 2 * Math.PI) * 32}vh`);
        ebene.appendChild(f);
        setTimeout(() => f.remove(), 1600);
      }
    }
    setTimeout(() => el.remove(), gross ? 1800 : 1100);
  }
  _kindName(eid) { return this._personen().find((p) => p.entity_id === eid)?.name || eid; }
  _punkteVon(eid) { return Number(this._kinder?.punkte?.[eid] || 0); }

  async _ladeKinder() {
    try {
      this._kinder = await this._hass.callWS({ type: "familienzentrale/kinder/laden" });
      this._fehler = "";
    } catch (err) {
      this._kinder = null;
      this._fehler = err.message || String(err);
    }
    if (!this._kind || !this._kinderListe().some((p) => p.entity_id === this._kind)) {
      const r = Object.values(this._kinder?.routinen || {});
      this._kind = r[0]?.person || this._kinderListe()[0]?.entity_id || null;
    }
    this._zeichnen();
  }

  async _kws(daten, meldung) {
    try {
      this._kinder = await this._hass.callWS(daten);
      if (meldung) this._zeigeToast(meldung);
      this._zeichnen();
      return true;
    } catch (err) {
      if (err.code === "pin_falsch") this._pin = null;
      this._zeigeToast(`Fehler: ${err.message || err}`);
      return false;
    }
  }

  // Aktion mit Eltern-PIN ausführen (PIN wird 5 Minuten gemerkt)
  _mitPin(aktion) {
    if (!this._kinder?.pin) { aktion(""); return; }
    if (this._pin && Date.now() < this._pin.bis) { aktion(this._pin.wert); return; }
    this._kdlgZurueck = this._kdlg;
    this._kdlg = { typ: "pin", eingabe: "", fehler: "", weiter: aktion };
    this._zeichneDialog();
  }

  async _pinPruefen() {
    const d = this._kdlg;
    try {
      const r = await this._hass.callWS({ type: "familienzentrale/kinder/pin_pruefen", pin: d.eingabe });
      if (!r.ok) { d.eingabe = ""; d.fehler = "Falsche PIN"; this._zeichneDialog(); return; }
      this._pin = { wert: d.eingabe, bis: Date.now() + 5 * 60 * 1000 };
      this._kdlg = this._kdlgZurueck || null;
      this._kdlgZurueck = null;
      this._zeichneDialog();
      d.weiter(this._pin.wert);
    } catch (err) {
      this._zeigeToast(`Fehler: ${err.message || err}`);
    }
  }

  _klickKinder(a) {
    if (!KINDER_SEITEN.includes(this._seite)) return false;
    // Tipp auf ein Sternenglas -> Belohnungsladen dieser Person
    if (a.startsWith("glas-")) { this._kind = a.slice(5); this._seite = "schaetze"; this._zeichnen(); return true; }
    const d = this._kdlg;
    // PIN-Tastatur
    if (d?.typ === "pin") {
      if (a.startsWith("pin-") && /^\d$/.test(a.slice(4))) {
        if (d.eingabe.length < 8) d.eingabe += a.slice(4);
        d.fehler = "";
        this._zeichneDialog();
        return true;
      }
      if (a === "pin-del") { d.eingabe = d.eingabe.slice(0, -1); this._zeichneDialog(); return true; }
      if (a === "pin-ok") { this._pinPruefen(); return true; }
    }
    if (["heute", "zurueck", "vor"].includes(a)) return true;
    if (a.startsWith("kind-")) { this._kind = a.slice(5); this._zeichnen(); return true; }
    if (a === "bearbeiten-an") { this._mitPin(() => { this._bearbeiten = true; this._zeichnen(); }); return true; }
    if (a === "bearbeiten-aus") { this._bearbeiten = false; this._zeichnen(); return true; }

    if (a.startsWith("aufgabe-")) { this._abhaken(...a.slice(8).split("|")); return true; }

    if (a === "routine-neu" || (a === "neu" && this._seite === "aufgaben")) {
      this._mitPin(() => this._routineOeffnen(null));
      return true;
    }
    if (a.startsWith("routine-edit-")) { const id = a.slice(13); this._mitPin(() => this._routineOeffnen(id)); return true; }
    if (a.startsWith("routine-plus-")) { const id = a.slice(13); this._mitPin(() => this._routineOeffnen(id, true)); return true; }
    if (a.startsWith("ro-") && d?.typ === "routine") { this._routineKlick(a.slice(3)); return true; }
    if (a === "routine-speichern") { this._routineSpeichern(); return true; }
    if (a === "routine-loeschen") {
      if (!d.loeschen) { this._formMerken(); d.loeschen = true; this._zeichneDialog(); return true; }
      this._mitPin(async (pin) => {
        this._kdlg = null;
        this._zeichneDialog();
        await this._kws({ type: "familienzentrale/kinder/routine_loeschen", pin, routine_id: d.id }, "Routine gelöscht");
      });
      return true;
    }

    if (a === "belohnung-neu" || (a === "neu" && this._seite === "schaetze")) {
      this._mitPin(() => {
        this._kdlg = { typ: "belohnung", id: null, name: "", emoji: "🎁", kosten: 10, sandi_sterne: 0,
          fuer: this._kind ? [this._kind] : [], picker: false };
        this._zeichneDialog();
      });
      return true;
    }
    if (a.startsWith("belohnung-edit-")) {
      const id = a.slice(15);
      const b = this._kinder.belohnungen[id];
      this._mitPin(() => {
        this._kdlg = { typ: "belohnung", id, ...b, emoji: b.emoji || "🎁", fuer: [...(b.fuer || [])], picker: false };
        this._zeichneDialog();
      });
      return true;
    }
    if (a.startsWith("be-") && d?.typ === "belohnung") { this._belohnungKlick(a.slice(3)); return true; }
    // Schatz entfernen: ✕ auf der Karte -> Sicherheitsfrage -> löschen
    if (a === "schatz-weg-ok" && d?.typ === "schatz-weg") {
      this._mitPin(async (pin) => {
        const b = this._kinder.belohnungen[d.id];
        this._kdlg = null;
        this._zeichneDialog();
        await this._kws({ type: "familienzentrale/kinder/belohnung_loeschen", pin, belohnung_id: d.id },
          `${b?.emoji || "🎁"} ${b?.name || "Schatz"} entfernt`);
      });
      return true;
    }
    if (a.startsWith("schatz-weg-")) { this._kdlg = { typ: "schatz-weg", id: a.slice(11) }; this._zeichneDialog(); return true; }
    if (a === "belohnung-speichern") { this._belohnungSpeichern(); return true; }
    if (a === "belohnung-loeschen") {
      if (!d.loeschen) { this._formMerken(); d.loeschen = true; this._zeichneDialog(); return true; }
      this._mitPin(async (pin) => {
        this._kdlg = null;
        this._zeichneDialog();
        await this._kws({ type: "familienzentrale/kinder/belohnung_loeschen", pin, belohnung_id: d.id }, "Belohnung gelöscht");
      });
      return true;
    }

    if (a === "einloesen-ok") {
      this._mitPin(async (pin) => {
        const b = this._kinder.belohnungen[d.id];
        this._kdlg = null;
        this._zeichneDialog();
        await this._kws({ type: "familienzentrale/kinder/einloesen", pin, belohnung: d.id, person: this._kind },
          `🎉 ${b.emoji || "🎁"} ${b.name} eingelöst!`);
      });
      return true;
    }
    if (a.startsWith("einloesen-")) { this._kdlg = { typ: "einloesen", id: a.slice(10) }; this._zeichneDialog(); return true; }

    if (a === "korrektur") { this._kdlg = { typ: "korrektur", delta: 1, grund: "" }; this._zeichneDialog(); return true; }
    if ((a === "korr-plus" || a === "korr-minus") && d?.typ === "korrektur") {
      d.grund = this._root.querySelector("#ko-grund")?.value || "";
      d.delta += a === "korr-plus" ? 1 : -1;
      if (d.delta === 0) d.delta = a === "korr-plus" ? 1 : -1;
      this._zeichneDialog();
      return true;
    }
    if (a === "korrektur-ok" && d?.typ === "korrektur") {
      d.grund = this._root.querySelector("#ko-grund")?.value || "";
      this._mitPin(async (pin) => {
        this._kdlg = null;
        this._zeichneDialog();
        await this._kws({ type: "familienzentrale/kinder/korrektur", pin, person: this._kind, delta: d.delta, grund: d.grund },
          d.delta > 0 ? `⭐ +${d.delta} für ${this._kindName(this._kind)}` : `${d.delta} ⭐`);
      });
      return true;
    }
    return false;
  }

  async _abhaken(rid, aid) {
    const r = this._kinder?.routinen?.[rid];
    const aufgabe = r?.aufgaben.find((x) => x.id === aid);
    if (!aufgabe) return;
    const erledigt = !this._kinder.erledigt[aid];
    // sofort anzeigen, Backend bestätigt
    if (erledigt) this._kinder.erledigt[aid] = true; else delete this._kinder.erledigt[aid];
    this._zeichneInhalt();
    const alle = r.aufgaben.every((x) => this._kinder.erledigt[x.id]);
    if (erledigt) this._feiern(alle ? "🎉" : "⭐", alle);
    await this._kws({ type: "familienzentrale/kinder/abhaken", routine: rid, aufgabe: aid, erledigt });
  }

  _formMerken() {
    const d = this._kdlg;
    const f = (id) => this._root.querySelector(id);
    // Routine: Eingaben landen schon beim Tippen im Zustand (_routineEingabe)
    if (d?.typ === "belohnung" && f("#be-name")) {
      Object.assign(d, { name: f("#be-name").value,
        kosten: Math.max(0, Number(f("#be-kosten").value) || 0),
        sandi_sterne: Math.max(0, Math.min(50, Number(f("#be-sandi")?.value) || 0)) });
    }
  }

  _belohnungKlick(a) {
    const d = this._kdlg;
    this._formMerken();
    if (a.startsWith("vorlage-")) {
      const v = SCHATZ_VORLAGEN[Number(a.slice(8))];
      const leute = this._kinderListe().map((p) => p.entity_id);
      Object.assign(d, { name: v.name, emoji: v.emoji, kosten: v.kosten, sandi_sterne: v.sandi || 0, picker: false,
        fuer: v.gruppe === "alle" ? [] : leute.filter((eid) => this._gruppe(eid) === v.gruppe) });
    } else if (a === "fuer-alle") d.fuer = [];
    else if (a.startsWith("fuer-")) {
      const eid = a.slice(5);
      const s = new Set(d.fuer);
      s.has(eid) ? s.delete(eid) : s.add(eid);
      d.fuer = [...s];
    } else if (a === "emoji") d.picker = !d.picker;
    else if (a.startsWith("wahl-")) { d.emoji = a.slice(5); d.picker = false; }
    else if (a === "k-plus") d.kosten += 1;
    else if (a === "k-minus") d.kosten = Math.max(0, d.kosten - 1);
    else if (a === "s-plus") d.sandi_sterne = Math.min(50, d.sandi_sterne + 1);
    else if (a === "s-minus") d.sandi_sterne = Math.max(0, d.sandi_sterne - 1);
    this._zeichneDialog();
  }

  _belohnungDialog() {
    const d = this._kdlg;
    const k = this._kinder;
    const leute = this._kinderListe();
    const fuerAlle = !d.fuer.length;
    const gruppen = [
      ["kind", "👦 Für Kinder"], ["eltern", "💑 Für Mami & Papi"], ["alle", "👨‍👩‍👦 Für die ganze Familie"],
    ];
    const vorlagen = gruppen.map(([g, titel]) => {
      const liste = SCHATZ_VORLAGEN.map((v, i) => ({ v, i })).filter(({ v }) => v.gruppe === g);
      return `<div class="be-gruppe"><span class="titel">${titel}</span>${liste.map(({ v, i }) => `
        <button type="button" class="ro-chip ${v.name === d.name ? "drin" : ""}" data-a="be-vorlage-${i}">
          <span>${v.emoji}</span>${esc(v.name)} <small>${v.kosten}⭐</small></button>`).join("")}</div>`;
    }).join("");
    return `<div class="overlay" data-a="zu"><form class="karte formular breit ro">
      <h2>${d.id ? "Schatz bearbeiten" : "Neuer Schatz"}</h2>

      ${d.id ? "" : `<div class="ro-schritt klein">💡 Vorlage antippen <span class="grau">– füllt alles aus, danach anpassen</span></div>
      <div class="ro-vorschlaege be-vorlagen">${vorlagen}</div>`}

      <div class="ro-schritt"><span class="ro-nr">1</span> Was gibt es?</div>
      <div class="ro-namezeile">
        <button type="button" class="ro-ebtn ${d.picker ? "offen" : ""}" data-a="be-emoji" title="Bild wählen">${esc(d.emoji || "🎁")}</button>
        <input id="be-name" value="${esc(d.name)}" placeholder="z. B. Glace essen gehen" autocomplete="off" maxlength="60">
      </div>
      ${d.picker ? `<div class="ro-picker">${SCHATZ_EMOJIS.map((e) =>
        `<button type="button" class="${e === d.emoji ? "an" : ""}" data-a="be-wahl-${esc(e)}">${e}</button>`).join("")}</div>` : ""}

      <div class="ro-schritt"><span class="ro-nr">2</span> Für wen?</div>
      <div class="ro-personen">
        <button type="button" class="ro-person ${fuerAlle ? "an" : ""}" data-a="be-fuer-alle" style="--ring:var(--fz-akzent)">
          <span class="avatar klein familie"><ha-icon icon="mdi:account-group"></ha-icon></span>Alle</button>
        ${leute.map((p) => `
        <button type="button" class="ro-person ${d.fuer.includes(p.entity_id) ? "an" : ""}" data-a="be-fuer-${p.entity_id}" style="--ring:${p.farbe}">
          <span class="avatar klein" style="--ring:${p.farbe}">${p.bild ? `<img src="${esc(p.bild)}" alt="">`
            : `<span style="background:${pastell(p.farbe, 45)}">${esc(initial(p.name))}</span>`}</span>${esc(p.name)}</button>`).join("")}
      </div>

      <div class="ro-schritt"><span class="ro-nr">3</span> Wie viele Sterne kostet es?</div>
      <div class="be-zaehler">
        <button type="button" data-a="be-k-minus">−</button>
        <input id="be-kosten" type="number" min="0" max="10000" value="${d.kosten}">
        <span>⭐</span>
        <button type="button" data-a="be-k-plus">＋</button>
      </div>
      ${d.kosten <= 30 ? `<div class="splaetze">${"⭐".repeat(d.kosten)}</div>` : ""}

      <div class="ro-schritt klein">📺 Fernsehzeit dazu? <span class="grau">– 1 Sandi-Stern = 5 Minuten</span></div>
      <div class="be-zaehler">
        <button type="button" data-a="be-s-minus">−</button>
        <input id="be-sandi" type="number" min="0" max="50" value="${d.sandi_sterne || 0}">
        <span>${d.sandi_sterne ? `= ${d.sandi_sterne * 5} Min.` : "keine"}</span>
        <button type="button" data-a="be-s-plus">＋</button>
      </div>
      ${k?.sandi ? "" : `<p class="grau">⚠️ Noch kein Sandi-Zähler gewählt (⚙️ → Konfigurieren → ⭐ Punkte &amp; Belohnungen).</p>`}

      <div class="knoepfe">
        ${d.id ? `<button type="button" class="gefahr" data-a="belohnung-loeschen">${d.loeschen ? "Wirklich löschen?" : "🗑 Löschen"}</button>` : ""}
        <span class="platz"></span>
        <button type="button" class="zweit" data-a="schliessen">Abbrechen</button>
        <button type="button" data-a="belohnung-speichern">✔ Speichern</button>
      </div>
    </form></div>`;
  }

  // ---------- Routine-Formular ----------
  _neueZeile(v = null) {
    return v ? { emoji: v.emoji, name: v.name, punkte: 1, auto: false }
      : { emoji: "⭐", name: "", punkte: 1, auto: true };
  }

  _routineOeffnen(id, neueZeile = false) {
    const r = id ? this._kinder.routinen[id] : null;
    if (r) {
      this._kdlg = { typ: "routine", id, name: r.name, emoji: r.emoji || "", zeit: r.zeit, person: r.person,
        nameAuto: false, vorlage: false, picker: null,
        aufgaben: r.aufgaben.map((x) => ({ id: x.id, emoji: x.emoji || "⭐", name: x.name, punkte: x.punkte ?? 1, auto: false })) };
    } else {
      const h = new Date().getHours();
      const zeit = h < 11 ? "morgen" : h >= 16 ? "abend" : "tag";
      // Gibt es die Tageszeit für das Kind schon, die nächste freie nehmen
      const belegt = Object.values(this._kinder?.routinen || {}).filter((x) => x.person === this._kind).map((x) => x.zeit);
      const frei = [zeit, "morgen", "abend", "tag"].find((z) => !belegt.includes(z)) || zeit;
      this._kdlg = { typ: "routine", id: null, person: this._kind || this._kinderListe()[0]?.entity_id,
        nameAuto: true, vorlage: true, picker: null, aufgaben: [] };
      this._routineZeit(frei);
    }
    if (neueZeile) this._kdlg.aufgaben.push(this._neueZeile());
    this._zeichneDialog();
    if (neueZeile) this._fokusZeile(this._kdlg.aufgaben.length - 1);
  }

  _routineZeit(z) {
    const d = this._kdlg;
    d.zeit = z;
    if (d.nameAuto) { d.name = ZEIT_ROUTINE[z].name; d.emoji = ZEIT_ROUTINE[z].emoji; }
    if (d.vorlage) {
      const g = this._gruppe(d.person);
      d.aufgaben = VORLAGE[g][z].map((n) => VORSCHLAEGE.find((v) => v.name === n && v.gruppe === g))
        .filter(Boolean).map((v) => this._neueZeile(v));
    }
  }

  // "kind" oder "eltern" – bestimmt, welche Vorlagen passen
  _gruppe(eid) { return ERWACHSEN.test(this._kindName(eid) || "") ? "eltern" : "kind"; }

  _fokusZeile(i) {
    setTimeout(() => this._root.querySelector(`.ro-aname[data-i="${i}"]`)?.focus(), 50);
  }

  // Tippen im Formular: Zustand mitschreiben, Emoji live vorschlagen (ohne neu zu zeichnen)
  _routineEingabe(el) {
    const d = this._kdlg;
    if (el.id === "ro-name") { d.name = el.value; d.nameAuto = false; return; }
    if (!el.classList.contains("ro-aname")) return;
    const i = Number(el.dataset.i);
    const z = d.aufgaben[i];
    if (!z) return;
    z.name = el.value;
    d.vorlage = false;
    if (z.auto) {
      z.emoji = emojiFuer(z.name) || "⭐";
      const knopf = this._root.querySelector(`[data-a="ro-emoji-${i}"]`);
      if (knopf) knopf.textContent = z.emoji;
    }
  }

  _routineKlick(a) {
    const d = this._kdlg;
    const zeichne = () => this._zeichneDialog();
    if (a.startsWith("zeit-")) { this._routineZeit(a.slice(5)); d.picker = null; zeichne(); return; }
    if (a.startsWith("person-")) { d.person = a.slice(7); this._routineZeit(d.zeit); zeichne(); return; }
    if (a === "mehr") { d.mehr = !(d.mehr || d.picker === "r"); if (!d.mehr) d.picker = null; return; }
    if (a === "remoji") { d.picker = d.picker === "r" ? null : "r"; d.mehr = true; zeichne(); return; }
    if (a.startsWith("emoji-")) { const i = Number(a.slice(6)); d.picker = d.picker === i ? null : i; zeichne(); return; }
    if (a.startsWith("wahl-")) {
      const e = a.slice(5);
      if (d.picker === "r") d.emoji = e;
      else if (d.aufgaben[d.picker]) Object.assign(d.aufgaben[d.picker], { emoji: e, auto: false });
      d.picker = null;
      d.vorlage = false;
      zeichne();
      return;
    }
    if (a.startsWith("plus-") || a.startsWith("minus-")) {
      const [art, i] = a.split("-");
      const z = d.aufgaben[Number(i)];
      if (z) z.punkte = Math.max(1, Math.min(5, z.punkte + (art === "plus" ? 1 : -1)));
      d.vorlage = false;
      zeichne();
      return;
    }
    if (a.startsWith("hoch-")) {
      const i = Number(a.slice(5));
      if (i > 0) [d.aufgaben[i - 1], d.aufgaben[i]] = [d.aufgaben[i], d.aufgaben[i - 1]];
      d.picker = null;
      d.vorlage = false;
      zeichne();
      return;
    }
    if (a.startsWith("weg-")) {
      d.aufgaben.splice(Number(a.slice(4)), 1);
      d.picker = null;
      d.vorlage = false;
      zeichne();
      return;
    }
    if (a.startsWith("vorschlag-")) {
      const v = VORSCHLAEGE[Number(a.slice(10))];
      const idx = d.aufgaben.findIndex((x) => x.name.trim().toLowerCase() === v.name.toLowerCase());
      if (idx >= 0) d.aufgaben.splice(idx, 1);
      else d.aufgaben.push(this._neueZeile(v));
      d.picker = null;
      d.vorlage = false;
      zeichne();
      return;
    }
    if (a === "eigene") {
      d.aufgaben.push(this._neueZeile());
      d.picker = null;
      d.vorlage = false;
      zeichne();
      this._fokusZeile(d.aufgaben.length - 1);
    }
  }

  _routineSpeichern() {
    const d = this._kdlg;
    const aufgaben = d.aufgaben.filter((x) => x.name.trim()).map((x) => ({
      ...(x.id ? { id: x.id } : {}), emoji: x.emoji === "⭐" && x.auto ? "" : x.emoji,
      name: x.name.trim().slice(0, 60), punkte: x.punkte,
    }));
    if (!aufgaben.length) { this._zeigeToast("Bitte mindestens eine Aufgabe hinzufügen."); return; }
    if (!d.person) { this._zeigeToast("Bitte wählen, für wen die Routine ist."); return; }
    const name = (d.name || "").trim() || ZEIT_ROUTINE[d.zeit].name;
    this._mitPin(async (pin) => {
      this._kdlg = null;
      this._zeichneDialog();
      await this._kws({
        type: "familienzentrale/kinder/routine_speichern", pin, ...(d.id ? { routine_id: d.id } : {}),
        name, emoji: (d.emoji || "").trim(), zeit: d.zeit, person: d.person, aufgaben,
      }, "Routine gespeichert ✔");
    });
  }

  _routineDialog() {
    const d = this._kdlg;
    const kinder = this._kinderListe();
    const picker = (aktuell, name, liste) => {
      const passend = emojiVorschlaege(name).filter((e) => e !== aktuell);
      const rest = liste.filter((e) => !passend.includes(e));
      return `<div class="ro-picker">
        ${passend.length ? `<span class="titel">✨ Passt zu „${esc(name)}“</span>${passend.map((e) =>
          `<button type="button" class="vor" data-a="ro-wahl-${esc(e)}">${e}</button>`).join("")}
          <span class="titel">Alle</span>` : ""}
        ${rest.map((e) => `<button type="button" class="${e === aktuell ? "an" : ""}" data-a="ro-wahl-${esc(e)}">${e}</button>`).join("")}
      </div>`;
    };
    const zeilen = d.aufgaben.map((z, i) => `
      <div class="ro-zeile">
        <button type="button" class="ro-ebtn ${d.picker === i ? "offen" : ""}" data-a="ro-emoji-${i}" title="Bild wählen">${esc(z.emoji || "⭐")}</button>
        <input class="ro-aname" data-i="${i}" value="${esc(z.name)}" placeholder="Was soll gemacht werden?" autocomplete="off" maxlength="60">
        <div class="ro-sterne" title="Wie viele Sterne gibt es?">
          <button type="button" data-a="ro-minus-${i}" ${z.punkte <= 1 ? "disabled" : ""}>−</button>
          <b>${"⭐".repeat(z.punkte)}</b>
          <button type="button" data-a="ro-plus-${i}" ${z.punkte >= 5 ? "disabled" : ""}>＋</button>
        </div>
        ${i > 0 ? `<button type="button" class="ro-klein" data-a="ro-hoch-${i}" title="Nach oben"><ha-icon icon="mdi:arrow-up"></ha-icon></button>`
          : `<span class="ro-klein"></span>`}
        <button type="button" class="ro-klein ro-weg" data-a="ro-weg-${i}" title="Entfernen"><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      ${d.picker === i ? picker(z.emoji, z.name, EMOJI_AUSWAHL) : ""}`).join("");
    const namen = new Set(d.aufgaben.map((x) => x.name.trim().toLowerCase()));
    const gruppe = this._gruppe(d.person);
    const vorschlaege = VORSCHLAEGE.map((v, i) => ({ v, i })).filter(({ v }) => v.gruppe === gruppe)
      .sort((a, b) => (b.v.zeit.includes(d.zeit) - a.v.zeit.includes(d.zeit)));
    return `<div class="overlay" data-a="zu"><form class="karte formular breit ro">
      <h2>${d.id ? "Routine bearbeiten" : "Neue Routine"}</h2>

      <div class="ro-schritt"><span class="ro-nr">1</span> Wann?</div>
      <div class="ro-zeiten">${Object.entries(ZEIT_ROUTINE).map(([z, x]) => `
        <button type="button" class="ro-wahl ${z === d.zeit ? "an" : ""}" data-a="ro-zeit-${z}">
          <span class="gross">${x.emoji}</span>${x.wort}</button>`).join("")}</div>

      ${kinder.length > 1 || !d.person ? `
      <div class="ro-schritt"><span class="ro-nr">2</span> Für wen?</div>
      <div class="ro-personen">${kinder.map((p) => `
        <button type="button" class="ro-person ${p.entity_id === d.person ? "an" : ""}" data-a="ro-person-${p.entity_id}" style="--ring:${p.farbe}">
          <span class="avatar klein" style="--ring:${p.farbe}">${p.bild ? `<img src="${esc(p.bild)}" alt="">`
            : `<span style="background:${pastell(p.farbe, 45)}">${esc(initial(p.name))}</span>`}</span>${esc(p.name)}</button>`).join("")}</div>` : ""}

      <div class="ro-schritt"><span class="ro-nr">${kinder.length > 1 || !d.person ? 3 : 2}</span> Aufgaben
        <span class="grau">– Bild antippen zum Ändern, ⭐ = wie viele Sterne es gibt</span></div>
      <div class="ro-liste">${zeilen || `<p class="grau ro-leer">Noch keine Aufgaben – unten einen Vorschlag antippen.</p>`}</div>
      <button type="button" class="ro-eigene" data-a="ro-eigene">＋ Eigene Aufgabe</button>

      <div class="ro-schritt klein">💡 Vorschläge für ${esc(this._kindName(d.person))} <span class="grau">– antippen zum Hinzufügen</span></div>
      <div class="ro-vorschlaege">${vorschlaege.map(({ v, i }) => {
        const drin = namen.has(v.name.toLowerCase());
        return `<button type="button" class="ro-chip ${drin ? "drin" : ""} ${v.zeit.includes(d.zeit) ? "" : "andere"}" data-a="ro-vorschlag-${i}">
          <span>${v.emoji}</span>${esc(v.name)}${drin ? " ✓" : ""}</button>`;
      }).join("")}</div>

      <details class="ro-mehr" ${d.mehr || d.picker === "r" ? "open" : ""}>
        <summary data-a="ro-mehr">Name &amp; Bild der Routine: <b>${esc(d.emoji || "📋")} ${esc(d.name || ZEIT_ROUTINE[d.zeit].name)}</b></summary>
        <div class="ro-namezeile">
          <button type="button" class="ro-ebtn" data-a="ro-remoji" title="Bild wählen">${esc(d.emoji || "📋")}</button>
          <input id="ro-name" value="${esc(d.name)}" placeholder="${esc(ZEIT_ROUTINE[d.zeit].name)}" autocomplete="off" maxlength="60">
        </div>
        ${d.picker === "r" ? picker(d.emoji, d.name, ROUTINE_EMOJIS) : ""}
      </details>

      <div class="knoepfe">
        ${d.id ? `<button type="button" class="gefahr" data-a="routine-loeschen">${d.loeschen ? "Wirklich löschen?" : "🗑 Löschen"}</button>` : ""}
        <span class="platz"></span>
        <button type="button" class="zweit" data-a="schliessen">Abbrechen</button>
        <button type="button" data-a="routine-speichern">✔ Speichern</button>
      </div>
    </form></div>`;
  }

  _belohnungSpeichern() {
    this._formMerken();
    const d = this._kdlg;
    if (!d.name.trim()) { this._zeigeToast("Bitte einen Namen eingeben."); return; }
    this._mitPin(async (pin) => {
      this._kdlg = null;
      this._zeichneDialog();
      await this._kws({
        type: "familienzentrale/kinder/belohnung_speichern", pin, ...(d.id ? { belohnung_id: d.id } : {}),
        name: d.name.trim(), emoji: (d.emoji || "").trim(), kosten: Math.max(0, Math.round(d.kosten)),
        sandi_sterne: Math.max(0, Math.round(d.sandi_sterne)), fuer: d.fuer || [],
      }, "Belohnung gespeichert ✔");
    });
  }

  _kinderKopf() {
    const titel = this._panel?.config?.titel || "Familie";
    const kinder = this._kinderListe();
    const schaetze = this._seite === "schaetze";
    this._root.getElementById("kopf").innerHTML = `
      <div class="kopf-links">
        <div class="titelzeile">${this._narrow ? '<span id="menuplatz"></span>' : ""}
          <h1>${hhmm(new Date())} <span class="strich">|</span> ${
            { aufgaben: "✅ Aufgaben", glaeser: "⭐ Sterne", schaetze: "💎 Schätze" }[this._seite]}</h1></div>
        <div class="tabs"><span class="grau">${esc(titel)} · ${WT_LANG[wt(new Date())]}, ${ddmm(new Date())}</span></div>
      </div>
      <div class="kopf-rechts">
        ${this._seite === "glaeser" ? "" : kinder.map((p) => `
          <button class="kindwahl ${p.entity_id === this._kind ? "aktiv" : ""}" data-a="kind-${p.entity_id}" style="--ring:${p.farbe}">
            <span class="avatar klein" style="--ring:${p.farbe}">${p.bild ? `<img src="${esc(p.bild)}" alt="">`
              : `<span style="background:${pastell(p.farbe, 45)}">${esc(initial(p.name))}</span>`}</span>
            <span class="kname">${esc(p.name)}${this._bearbeiten ? `<b>⭐ ${this._punkteVon(p.entity_id)}</b>` : ""}</span>
          </button>`).join("")}
        ${schaetze ? `<button class="rund" data-a="korrektur" title="Bonus / Abzug"><ha-icon icon="mdi:plus-minus-variant"></ha-icon></button>` : ""}
        <button class="rund ${this._bearbeiten ? "an" : ""}" data-a="${this._bearbeiten ? "bearbeiten-aus" : "bearbeiten-an"}"
          title="${this._bearbeiten ? "Bearbeiten beenden" : "Bearbeiten (Eltern)"}">
          <ha-icon icon="${this._bearbeiten ? "mdi:check" : "mdi:pencil"}"></ha-icon></button>
        ${this._vollbildKnopf()}<button class="zahnrad" data-a="einstellungen" title="Einstellungen"><ha-icon icon="mdi:cog"></ha-icon></button>
      </div>`;
    if (this._narrow) this._root.getElementById("menuplatz").appendChild(this._menu);
  }

  _aufgabenInhalt() {
    const k = this._kinder;
    if (!k) return `<div class="hinweis">${this._fehler ? esc(this._fehler) : "Lädt …"}</div>`;
    if (!k.routinen_aktiv) return `<div class="hinweis">Das Modul „Kinder-Routinen“ ist ausgeschaltet.</div>`;
    const ordnung = { morgen: 0, tag: 1, abend: 2 };
    const h = new Date().getHours();
    const jetzt = h < 11 ? "morgen" : h >= 17 ? "abend" : "tag";
    const routinen = Object.entries(k.routinen).filter(([, r]) => r.person === this._kind)
      .sort((a, b) => ordnung[a[1].zeit] - ordnung[b[1].zeit]);
    let html = `<div class="kinder routinen-spalten">`;
    if (!routinen.length) {
      html += `<div class="hinweis">Für ${esc(this._kindName(this._kind))} gibt es noch keine Routinen.<br>
        <button class="knopf-gross" data-a="routine-neu">＋ Routine anlegen</button></div>`;
    }
    for (const [rid, r] of routinen) {
      const fertig = r.aufgaben.filter((x) => k.erledigt[x.id]).length;
      const prozent = r.aufgaben.length ? Math.round(fertig / r.aufgaben.length * 100) : 0;
      html += `<section class="routine ${r.zeit === jetzt ? "aktuell" : ""} ${fertig === r.aufgaben.length ? "fertig" : ""}">
        <div class="rkopf">
          <span class="remoji">${esc(r.emoji || "📋")}</span>
          <div class="rtitel"><b>${esc(r.name)}</b><span class="grau">${ZEIT_NAME[r.zeit]}</span></div>
          <span class="rstand">${fertig === r.aufgaben.length ? "🎉"
            : r.aufgaben.map((x) => (k.erledigt[x.id] ? "✅" : "⚪")).join("")}</span>
          ${this._bearbeiten ? `<button class="rund" data-a="routine-edit-${rid}"><ha-icon icon="mdi:pencil"></ha-icon></button>` : ""}
        </div>
        <div class="balken-fort"><span style="width:${prozent}%"></span></div>
        <div class="kacheln">${r.aufgaben.map((x) => `
          <button class="kachel ${k.erledigt[x.id] ? "erledigt" : ""}" data-a="aufgabe-${rid}|${x.id}">
            <span class="kemoji">${esc(x.emoji || "⭐")}</span>
            <span class="ktext">${esc(x.name)}</span>
            <span class="kpunkte">${k.erledigt[x.id] ? "✓" : "⭐".repeat(Math.min(x.punkte, 5))}</span>
          </button>`).join("")}
          ${this._bearbeiten ? `<button class="kachel-neu" data-a="routine-plus-${rid}">＋ Aufgabe hinzufügen</button>` : ""}</div>
      </section>`;
    }
    if (this._bearbeiten && routinen.length) {
      html += `<button class="rkarte neu" data-a="routine-neu"><span class="eemoji">＋</span><b>Neue Routine</b></button>`;
    }
    return html + `</div>`;
  }

  _schaetzeInhalt() {
    const k = this._kinder;
    if (!k) return `<div class="hinweis">${this._fehler ? esc(this._fehler) : "Lädt …"}</div>`;
    if (!k.punkte_aktiv) return `<div class="hinweis">Das Modul „Punkte & Belohnungen“ ist ausgeschaltet.</div>`;
    const p = this._punkteVon(this._kind);
    const person = this._personen().find((x) => x.entity_id === this._kind);
    // Nur Schätze für diese Person (ohne Auswahl = für alle)
    const belohnungen = Object.entries(k.belohnungen)
      .filter(([, b]) => !b.fuer?.length || b.fuer.includes(this._kind))
      .sort((a, b) => a[1].kosten - b[1].kosten);
    // Sternenglas: jeder Punkt ein Stern (ab 60 Sternen wird nur noch das Glas voller)
    const sichtbar = Math.min(p, 60);
    let html = `<div class="kinder">
      <div class="glas-zeile" style="--ring:${person?.farbe || NEUTRAL}">
        <div class="glas">
          <div class="deckel"></div>
          <div class="glas-innen">${"<span>⭐</span>".repeat(sichtbar) || `<span class="leer-glas">Noch leer –<br>sammle Sterne!</span>`}</div>
        </div>
        <div class="glas-text"><b>${esc(person?.name || "")}s Sternenglas</b>
          ${this._bearbeiten ? `<span class="grau">${p} ⭐ (nur für Eltern sichtbar)</span>` : ""}</div>
      </div>
      <div class="rgitter belohnungen">`;
    for (const [id, b] of belohnungen) {
      const leistbar = p >= b.kosten;
      const anteil = b.kosten ? Math.min(1, p / b.kosten) : 1;
      // Bis 12 Sterne: einzelne Sternplätze; darüber ein Weg zum Ziel
      const fortschritt = b.kosten <= 12
        ? `<div class="splaetze">${this._sternPlaetze(p, b.kosten)}</div>`
        : `<div class="weg"><span class="weg-voll" style="width:${Math.round(anteil * 100)}%"></span>
             <span class="weg-stern" style="left:${Math.round(anteil * 100)}%">⭐</span>
             <span class="weg-ziel">${esc(b.emoji || "🎁")}</span></div>`;
      html += `<button class="belohnung ${leistbar ? "leistbar" : ""}" data-a="${this._bearbeiten ? `belohnung-edit-${id}` : `einloesen-${id}`}">
        ${this._bearbeiten ? `<span class="schatz-weg" data-a="schatz-weg-${id}" title="Entfernen"><ha-icon icon="mdi:close"></ha-icon></span>` : ""}
        <span class="eemoji">${esc(b.emoji || "🎁")}</span>
        <b>${esc(b.name)}</b>
        ${fortschritt}
        ${leistbar ? `<span class="jetzt-da">🎉 Geschafft!</span>` : ""}
        ${b.sandi_sterne ? `<span class="tv">📺</span>` : ""}
        ${this._bearbeiten ? `<span class="grau">${b.kosten} ⭐${b.sandi_sterne ? ` · +${b.sandi_sterne} Sandi-Stern${b.sandi_sterne > 1 ? "e" : ""}` : ""}</span>` : ""}
      </button>`;
    }
    if (this._bearbeiten || !belohnungen.length) {
      html += `<button class="rkarte neu" data-a="belohnung-neu"><span class="eemoji">＋</span><b>Neue Belohnung</b></button>`;
    }
    html += `</div>`;
    const verlauf = (k.verlauf || []).filter((v) => v.person === this._kind).slice(-20).reverse();
    if (verlauf.length && this._bearbeiten) {
      html += `<h3 class="vtitel">Verlauf</h3><div class="verlauf">${verlauf.map((v) => {
        const z = new Date(v.zeit);
        return `<div class="vzeile"><span class="grau">${ddmm(z)} ${hhmm(z)}</span><span>${esc(v.text)}</span>
          <b class="${v.punkte > 0 ? "pos" : "neg"}">${v.punkte > 0 ? "+" : ""}${v.punkte} ⭐</b></div>`;
      }).join("")}</div>`;
    }
    return html + `</div>`;
  }

  // Seite „Sterne“: ein Sternenglas für jede Person, Foto darüber
  _glaeserInhalt() {
    const k = this._kinder;
    if (!k) return `<div class="hinweis">${this._fehler ? esc(this._fehler) : "Lädt …"}</div>`;
    if (!k.punkte_aktiv) return `<div class="hinweis">Das Modul „Punkte & Belohnungen“ ist ausgeschaltet.</div>`;
    const personen = this._kinderListe();
    if (!personen.length) return `<div class="hinweis">Noch keine Personen eingerichtet (⚙️ → Personen).</div>`;
    return `<div class="glaeser" style="--anzahl:${personen.length}">${personen.map((p) => {
      const n = this._punkteVon(p.entity_id);
      const sterne = Math.min(n, 80);
      return `<div class="glaskarte" role="button" tabindex="0" data-a="glas-${p.entity_id}" style="--ring:${p.farbe}">
        <span class="gfoto">${p.bild ? `<img src="${esc(p.bild)}" alt="">`
          : `<span style="background:${pastell(p.farbe, 45)}">${esc(initial(p.name))}</span>`}</span>
        <b class="gname">${esc(p.name)}</b>
        <span class="glas gross">
          <span class="deckel"></span>
          <span class="glas-innen">${"<span>⭐</span>".repeat(sterne)
            || `<span class="leer-glas">Noch leer</span>`}</span>
        </span>
        ${this._bearbeiten ? `<span class="grau">${n} ⭐</span>` : ""}
      </div>`;
    }).join("")}</div>`;
  }

  _kinderDialog() {
    const d = this._kdlg;
    const k = this._kinder;
    const huelle = (inhalt, klasse = "") => `<div class="overlay" data-a="zu"><form class="karte formular ${klasse}">${inhalt}</form></div>`;
    if (d.typ === "pin") {
      const tasten = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];
      return huelle(`
        <h2>🔒 Eltern-PIN</h2>
        <div class="pinpunkte">${d.eingabe ? "●".repeat(d.eingabe.length) : "<span class='grau'>PIN eingeben</span>"}</div>
        ${d.fehler ? `<p class="pinfehler">${esc(d.fehler)}</p>` : ""}
        <div class="pinfeld">${tasten.map((t) => t === "del"
          ? `<button type="button" data-a="pin-del">⌫</button>`
          : t === "ok" ? `<button type="button" class="ok" data-a="pin-ok">OK</button>`
          : `<button type="button" data-a="pin-${t}">${t}</button>`).join("")}</div>
        <div class="knoepfe"><span class="platz"></span><button type="button" class="zweit" data-a="schliessen">Abbrechen</button></div>`, "pin");
    }
    if (d.typ === "routine") return this._routineDialog();
    if (d.typ === "belohnung") return this._belohnungDialog();
    if (d.typ === "schatz-weg") {
      const b = k.belohnungen[d.id] || {};
      return huelle(`
        <div class="einloesen-gross">${esc(b.emoji || "🎁")}</div>
        <h2 style="text-align:center">„${esc(b.name || "")}“ entfernen?</h2>
        <p class="grau" style="text-align:center">Der Schatz verschwindet aus dem Laden${b.fuer?.length
          ? ` von ${esc(b.fuer.map((e) => this._kindName(e)).join(", "))}` : " für alle"}. Gesammelte Sterne bleiben erhalten.</p>
        <div class="knoepfe"><span class="platz"></span>
          <button type="button" class="zweit" data-a="schliessen">Behalten</button>
          <button type="button" class="gefahr" data-a="schatz-weg-ok">🗑 Entfernen</button>
        </div>`, "pin");
    }
    if (d.typ === "einloesen") {
      const b = k.belohnungen[d.id];
      const p = this._punkteVon(this._kind);
      const ok = p >= b.kosten;
      return huelle(`
        <div class="einloesen-gross">${esc(b.emoji || "🎁")}</div>
        <h2 style="text-align:center">${esc(b.name)}</h2>
        ${b.kosten <= 30 ? `<div class="splaetze mitte">${this._sternPlaetze(p, b.kosten)}</div>` : ""}
        <p style="text-align:center">${esc(this._kindName(this._kind))} hat <b>${p} ⭐</b> · kostet <b>${b.kosten} ⭐</b>
          ${ok ? `<br>danach noch <b>${p - b.kosten} ⭐</b>` : `<br>Es fehlen noch <b>${b.kosten - p} ⭐</b> – weiter so!`}</p>
        ${b.sandi_sterne ? `<p class="grau" style="text-align:center">📺 Dazu gibt es ${b.sandi_sterne} Sandi-Stern${b.sandi_sterne > 1 ? "e" : ""} = Fernsehzeit.</p>` : ""}
        <div class="knoepfe"><span class="platz"></span>
          <button type="button" class="zweit" data-a="schliessen">Abbrechen</button>
          <button type="button" data-a="einloesen-ok" ${ok ? "" : "disabled"}>🎁 Einlösen</button>
        </div>`);
    }
    if (d.typ === "korrektur") {
      return huelle(`
        <h2>Bonus / Abzug für ${esc(this._kindName(this._kind))}</h2>
        <div class="korr"><button type="button" class="rund gross" data-a="korr-minus">−</button>
          <b class="${d.delta > 0 ? "pos" : "neg"}">${d.delta > 0 ? "+" : ""}${d.delta} ⭐</b>
          <button type="button" class="rund gross" data-a="korr-plus">+</button></div>
        <label>Grund (freiwillig)<input id="ko-grund" value="${esc(d.grund)}" placeholder="z. B. beim Tischdecken geholfen"></label>
        <div class="knoepfe"><span class="platz"></span>
          <button type="button" class="zweit" data-a="schliessen">Abbrechen</button>
          <button type="button" data-a="korrektur-ok">Übernehmen</button>
        </div>`);
    }
    return "";
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
        <button class="knopf-gross ki" data-a="ki-woche" title="Claude plant die Woche">
          <ha-icon icon="mdi:creation"></ha-icon><span>Woche vorschlagen</span></button>
        <button class="knopf-gross" data-a="einkaufen" title="Zutaten dieser Woche auf die Einkaufsliste">
          <ha-icon icon="mdi:cart-plus"></ha-icon><span>Auf die Einkaufsliste</span></button>
        ${this._vollbildKnopf()}<button class="zahnrad" data-a="einstellungen" title="Einstellungen"><ha-icon icon="mdi:cog"></ha-icon></button>
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
    let html = `<div class="essen"><div class="eplan" style="grid-template-columns:110px repeat(${m.length}, minmax(0,1fr)); --mz:${m.length}">
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
      <button class="rkarte neu ki" data-a="ki-rezept"><span class="eemoji">✨</span><b>Rezept mit KI</b>
        <span class="grau">Idee, Text oder Link</span></button>
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
        <button class="rail ${x.seite && x.seite === this._seite ? "aktiv" : ""}" data-a="seite-${x.seite || "bald"}">
          <ha-icon icon="${x.icon}"></ha-icon><span>${x.label}</span>
        </button>`).join("")}
      <div class="platz"></div>
      <button class="rail klein" data-a="aktualisieren" title="Aktualisieren"><ha-icon icon="mdi:sync"></ha-icon></button>
      <button class="fab" data-a="neu" title="Termin anlegen"><ha-icon icon="mdi:plus"></ha-icon></button>`;
  }

  _zeichneKopf() {
    if (!this._root) return;
    if (this._seite === "essen") { this._essenKopf(); return; }
    if (KINDER_SEITEN.includes(this._seite)) { this._kinderKopf(); return; }
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
        ${this._vollbildKnopf()}<button class="zahnrad" data-a="einstellungen" title="Einstellungen"><ha-icon icon="mdi:cog"></ha-icon></button>
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
    if (this._seite === "aufgaben") { inhalt.innerHTML = this._aufgabenInhalt(); return; }
    if (this._seite === "schaetze") { inhalt.innerHTML = this._schaetzeInhalt(); return; }
    if (this._seite === "glaeser") { inhalt.innerHTML = this._glaeserInhalt(); return; }
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
    if (this._kdlg) { dlg.innerHTML = this._kinderDialog(); return; }
    if (this._ki) { dlg.innerHTML = this._kiDialog(); return; }
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
    display:block; height:100vh; height:100dvh; width:100%; overflow:hidden; background:var(--fz-grund); color:var(--fz-text);
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
  .knopf-gross.ki, .rkarte.ki { background:linear-gradient(135deg, #a18cd1, #fbc2eb); color:#3b2a55; border:0; }
  .rkarte.ki .grau { color:#5b4a75; }
  .ki-laeuft { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; margin-top:8px;
    background:color-mix(in srgb, #a18cd1 18%, var(--fz-karte)); font-weight:700; }
  .ki-funken { display:inline-block; animation:fz-dreh 1.4s linear infinite; font-size:1.3em; }
  @keyframes fz-dreh { from { transform:rotate(0deg) scale(1); } 50% { transform:rotate(180deg) scale(1.25); } to { transform:rotate(360deg) scale(1); } }
  button[disabled] { opacity:.5; cursor:default; }

  /* Aufgaben & Schätze */
  .kindwahl { display:flex; align-items:center; gap:8px; padding:4px 12px 4px 4px; border-radius:999px;
    border:2px solid transparent; }
  .kindwahl.aktiv { border-color:var(--ring); background:color-mix(in srgb, var(--ring) 12%, var(--fz-karte)); }
  .avatar.klein { width:40px; height:40px; padding:2px; border-width:2px; }
  .kname { display:flex; flex-direction:column; align-items:flex-start; font-weight:700; line-height:1.15; }
  .kname b { font-size:.85em; color:var(--fz-grau); }
  .rund.an { background:var(--fz-akzent); color:#fff; }
  .rund.gross { width:56px; height:56px; border-radius:28px; font-size:1.6em; }
  .kinder { flex:1; overflow:auto; padding:14px 18px; display:flex; flex-direction:column; gap:14px; }
  .routine { background:var(--fz-karte); border-radius:18px; padding:14px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  .routine.aktuell { outline:3px solid var(--fz-akzent); }
  .routine.fertig { background:color-mix(in srgb, #43a047 12%, var(--fz-karte)); outline-color:#43a047; }
  .rkopf { display:flex; align-items:center; gap:12px; }
  .remoji { font-size:2.2em; }
  .rtitel { flex:1; display:flex; flex-direction:column; }
  .rtitel b { font-size:1.3em; }
  .rstand { font-size:1.4em; font-weight:800; }
  .balken-fort { height:10px; border-radius:5px; background:var(--fz-grund); margin:10px 0 12px; overflow:hidden; }
  .balken-fort span { display:block; height:100%; background:linear-gradient(90deg, #ffb86c, #7ee081); border-radius:5px; transition:width .4s; }
  .kacheln { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:12px; }
  .kachel { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height:150px;
    border-radius:18px; background:var(--fz-grund); border:3px solid transparent; padding:10px; transition:transform .15s; }
  .kachel:active { transform:scale(.95); }
  .kemoji { font-size:3.4em; line-height:1; }
  .ktext { font-weight:800; font-size:1.05em; text-align:center; }
  .kpunkte { font-size:.85em; color:var(--fz-grau); font-weight:700; }
  .kachel.erledigt { background:color-mix(in srgb, #43a047 18%, var(--fz-karte)); border-color:#43a047; }
  .kachel.erledigt .kemoji { opacity:.55; }
  .kachel.erledigt .kpunkte { color:#2e7d32; font-size:1.4em; }
  .schatz { display:flex; align-items:center; gap:16px; padding:16px 20px; border-radius:18px; background:var(--fz-karte);
    border-left:8px solid var(--ring); }
  .schatz-emoji { font-size:2.6em; }
  .schatz div { display:flex; flex-direction:column; }
  .schatz b { font-size:2.2em; font-weight:800; }
  .belohnung { display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:14px; border-radius:16px;
    background:var(--fz-karte); text-align:left; min-height:130px; opacity:.6; border:3px solid transparent; }
  .belohnung.leistbar { opacity:1; border-color:#ffb300; box-shadow:0 4px 14px rgba(255,179,0,.25); }
  .belohnung .eemoji { font-size:2.3em; }
  .preis { font-weight:800; color:#e65100; }
  .tv { font-size:.8em; background:var(--fz-grund); border-radius:999px; padding:2px 8px; }
  .vtitel { margin:4px 0 0; }
  .verlauf { background:var(--fz-karte); border-radius:14px; padding:4px 14px; }
  .vzeile { display:flex; gap:12px; align-items:center; padding:8px 0; border-top:1px solid var(--fz-linie); }
  .vzeile:first-child { border-top:0; }
  .vzeile span:nth-child(2) { flex:1; }
  .pos { color:#2e7d32; } .neg { color:#c62828; }
  /* Sternenglas & Sternplätze (Bilder statt Zahlen) */
  .glas-zeile { display:flex; align-items:center; gap:24px; background:var(--fz-karte); border-radius:22px; padding:16px 22px;
    border-left:8px solid var(--ring); }
  .glas { position:relative; width:190px; flex:none; }
  .deckel { height:16px; margin:0 22px; border-radius:6px 6px 2px 2px; background:linear-gradient(#c8a46a, #a07a40); }
  .glas-innen { min-height:170px; border:5px solid color-mix(in srgb, #90caf9 70%, white); border-top-width:3px;
    border-radius:18px 18px 40px 40px; background:color-mix(in srgb, #e3f2fd 55%, var(--fz-karte));
    display:flex; flex-wrap:wrap-reverse; align-content:flex-start; justify-content:center; gap:1px; padding:8px; }
  .glas-innen span { font-size:1.35em; line-height:1.1; animation:fz-plopp .35s ease-out; }
  .glas-innen .leer-glas { font-size:.9em; color:var(--fz-grau); text-align:center; align-self:center; animation:none; }
  .glas-text b { font-size:1.5em; display:block; }
  .belohnungen .belohnung { min-height:170px; align-items:center; text-align:center; }
  .belohnung .eemoji { font-size:3em; }
  .splaetze { display:flex; flex-wrap:wrap; justify-content:center; gap:2px; font-size:1.3em; }
  .splaetze.mitte { margin:6px 0 10px; font-size:1.6em; }
  .splatz { color:#bdbdbd; }
  .splatz.voll { animation:fz-plopp .35s ease-out; }
  .weg { position:relative; width:100%; height:14px; border-radius:7px; background:var(--fz-grund); margin:14px 0 6px; }
  .weg-voll { position:absolute; left:0; top:0; bottom:0; border-radius:7px; background:linear-gradient(90deg, #ffe082, #ffb300); }
  .weg-stern { position:absolute; top:50%; transform:translate(-50%, -50%); font-size:1.5em; }
  .weg-ziel { position:absolute; right:-8px; top:50%; transform:translateY(-50%); font-size:1.6em; }
  .jetzt-da { font-weight:800; color:#e65100; font-size:1.1em; }
  .belohnung.leistbar { animation:fz-huepf 1.6s ease-in-out infinite; }
  @keyframes fz-huepf { 0%, 100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
  @keyframes fz-plopp { from { transform:scale(0); } 70% { transform:scale(1.3); } to { transform:scale(1); } }
  .feier { position:fixed; left:50%; top:45%; z-index:30; font-size:7em; pointer-events:none;
    animation:fz-flug 1.1s ease-out forwards; }
  .feier.gross { font-size:10em; animation:fz-flug 1.8s ease-out forwards; }
  @keyframes fz-flug {
    0% { transform:translate(-50%, -50%) scale(.2) rotate(-30deg); opacity:0; }
    25% { transform:translate(-50%, -50%) scale(1.15) rotate(10deg); opacity:1; }
    70% { transform:translate(-50%, -60%) scale(1) rotate(0); opacity:1; }
    100% { transform:translate(-50%, -160%) scale(.4); opacity:0; }
  }
  .funke { position:fixed; left:50%; top:45%; z-index:29; font-size:2.6em; pointer-events:none;
    animation:fz-funke 1.5s ease-out forwards; }
  @keyframes fz-funke {
    from { transform:translate(-50%, -50%) scale(.3); opacity:1; }
    to { transform:translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(1.2) rotate(180deg); opacity:0; }
  }
  /* Seite „Sterne“ */
  /* Gläser füllen den ganzen Inhaltsbereich: eine Spalte pro Person, volle Höhe */
  .glaeser { flex:1 1 0; height:100%; min-height:0; padding:16px; display:grid; gap:16px;
    grid-template-columns:repeat(var(--anzahl, 3), minmax(0, 1fr)); grid-template-rows:minmax(0, 1fr); }
  .glaskarte { display:flex; flex-direction:column; align-items:center; gap:10px; padding:16px 14px;
    height:100%; min-height:0; cursor:pointer; box-sizing:border-box;
    border-radius:24px; background:var(--fz-karte); border-top:8px solid var(--ring); box-shadow:0 2px 8px rgba(0,0,0,.06); }
  .glaskarte:active { transform:scale(.99); }
  .gfoto { flex:none; width:clamp(72px, 12cqi, 150px); aspect-ratio:1; border-radius:50%; padding:5px;
    border:5px solid var(--ring); background:var(--fz-karte); }
  .gfoto img, .gfoto span { width:100%; height:100%; border-radius:50%; object-fit:cover; display:flex;
    align-items:center; justify-content:center; font-size:2.6em; font-weight:800; }
  .gname { flex:none; font-size:clamp(1.1em, 2.4cqi, 1.9em); font-weight:800; }
  .glas.gross { flex:1 1 0; min-height:0; width:100%; display:flex; flex-direction:column; }
  .glas.gross .deckel { flex:none; display:block; height:clamp(14px, 2cqi, 26px); margin:0 12%; }
  .glas.gross .glas-innen { flex:1 1 0; min-height:0; overflow:hidden; border-width:6px; border-radius:22px 22px 60px 60px;
    padding:12px; gap:4px; align-content:flex-start; }
  .glas.gross .glas-innen span { font-size:clamp(1.3em, 3.2cqi, 2.6em); }
  .glas.gross .leer-glas { font-size:clamp(1em, 2cqi, 1.4em) !important; }
  /* Schmal: zwei Spalten, dafür scrollen; jedes Glas bleibt groß */
  @container fz (max-width: 760px) {
    .glaeser { height:auto; grid-template-columns:repeat(min(var(--anzahl, 3), 2), minmax(0, 1fr)); grid-template-rows:none;
      grid-auto-rows:minmax(70vh, auto); overflow:auto; padding:10px; gap:10px; }
    .glas.gross .glas-innen span { font-size:1.4em; }
  }
  .karte.pin { max-width:340px; }
  .pinpunkte { text-align:center; font-size:2em; letter-spacing:.3em; min-height:1.6em; margin:6px 0; }
  .pinfehler { color:var(--error-color, #db4437); text-align:center; font-weight:700; }
  .pinfeld { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
  .pinfeld button { height:60px; border-radius:16px; background:var(--fz-grund); font-size:1.5em; font-weight:700; }
  .pinfeld button.ok { background:var(--primary-color, #3f7fe0); color:#fff; font-size:1.1em; }
  .einloesen-gross { font-size:4em; text-align:center; }
  .korr { display:flex; align-items:center; justify-content:center; gap:24px; margin:12px 0; }
  .korr b { font-size:2em; min-width:110px; text-align:center; }

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

  /* =========================================================
     Große Navigation fürs Touch-Wanddisplay
     ========================================================= */
  #leiste { width:116px; gap:6px; padding:16px 0; }
  .logo { width:64px; height:64px; border-radius:18px; margin-bottom:16px; }
  .logo ha-icon { --mdc-icon-size:36px; }
  .rail { width:100px; min-height:88px; padding:12px 0; border-radius:18px; gap:6px; font-size:.95em; justify-content:center; }
  .rail ha-icon { --mdc-icon-size:38px; }
  .rail span { max-width:96px; }
  .rail.aktiv { background:color-mix(in srgb, var(--fz-akzent) 14%, var(--fz-karte)); color:var(--fz-text);
    box-shadow:inset 4px 0 0 var(--fz-akzent); }
  .rail.klein { min-height:64px; }  .fab { width:76px; height:76px; margin-top:8px; }
  .fab ha-icon { --mdc-icon-size:42px; }

  /* Touch-Geräte: alle Knöpfe im Kopf mit großer Trefferfläche */
  @media (pointer: coarse), (min-width: 1600px) {
    .rund { height:52px; min-width:52px; border-radius:26px; }
    .rund ha-icon { --mdc-icon-size:28px; }
    .tab { padding:12px 18px; font-size:1.1em; }
    .zahnrad { padding:10px; }
    .zahnrad ha-icon { --mdc-icon-size:34px; }
    .knopf-gross { padding:13px 20px; font-size:1.05em; }
    .knopf-gross ha-icon { --mdc-icon-size:28px; }
    .avatar { width:62px; height:62px; }
    .kindwahl { padding:6px 16px 6px 6px; }
    .avatar.klein { width:52px; height:52px; }
    .plus { font-size:1.6em; padding:0 8px; }
    .knoepfe button { padding:14px 22px; font-size:1.05em; }
    .formular input, .formular select, .formular textarea { padding:14px; }
  }

  /* =========================================================
     Layout-Korrekturen gegen Überlappungen.
     Container-Abfragen richten sich nach dem Platz des Panels selbst
     (HA-Seitenleiste und Modul-Leiste sind schon abgezogen).
     ========================================================= */
  main { container-type:inline-size; container-name:fz; }
  #leiste { overflow-y:auto; overflow-x:hidden; scrollbar-width:none; }
  #leiste::-webkit-scrollbar { display:none; }
  .rail span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:96px; }

  /* Kopf: darf umbrechen, rechte Seite rückt dann unter den Titel */
  #kopf { flex-wrap:wrap; row-gap:8px; }
  .kopf-links { min-width:min(100%, 300px); }
  .kopf-rechts { flex-wrap:wrap; justify-content:flex-end; row-gap:6px; min-width:0; }
  .tabs { row-gap:6px; }
  .tab { white-space:nowrap; }
  .knopf-gross { white-space:nowrap; }
  .kindwahl { min-width:0; }
  .kname { white-space:nowrap; }

  /* Wochenraster: Kopf, Ganztags-Zeile und Raster reservieren gleich viel Platz
     für die Scrollleiste, damit die Spalten exakt übereinander liegen */
  .raster, .wkopf, .ganzzeile { scrollbar-gutter:stable; }
  .wkopf, .ganzzeile { overflow-y:hidden; }
  .ganzzeile { max-height:30%; overflow-y:auto; }
  .tagkopf { min-width:0; gap:4px; }
  .tagname { overflow:hidden; text-overflow:ellipsis; }
  .plus { flex:none; }
  .block { padding-right:6px; }
  .block .btitel { overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; word-break:break-word; }
  .block.kurz .bbadges { display:none; }
  .block:not(.kurz) { padding-bottom:22px; }   /* Platz für die Kürzel unten */
  .ganzzelle { min-width:0; }
  .balken { min-width:0; }

  /* Monat */
  .zelle { min-width:0; }
  .chip { max-width:100%; }

  /* Essen */
  .eslot { min-width:0; }
  .ename { min-width:0; overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; word-break:break-word; }

  /* Kinder */
  .rkopf { flex-wrap:wrap; }
  .rtitel { min-width:120px; }
  .rstand { white-space:nowrap; font-size:1.1em; }
  .belohnung { overflow:hidden; min-width:0; }
  .belohnung b { word-break:break-word; }
  .weg { width:calc(100% - 26px); margin-right:26px; }
  .weg-ziel { right:-30px; }
  .glas-zeile { flex-wrap:wrap; }

  /* Dialoge: Felder umbrechen statt überlaufen */
  .formular .reihe { flex-wrap:wrap; }
  .formular .reihe > label { min-width:140px; }
  .knoepfe { flex-wrap:wrap; row-gap:8px; }
  .karte { overflow-x:hidden; }

  /* Mittel (z. B. Tablet hochkant, Laptop mit Seitenleiste) */
  @container fz (max-width: 1100px) {
    h1 { font-size:1.45em; }
    .knopf-gross span { display:none; }          /* nur Icons */
    .knopf-gross { padding:9px 12px; }
    .tagkopf { font-size:1em; padding:6px 4px 6px 8px; }
    .plus { font-size:1.1em; padding:0 2px; }
    .avatar { width:44px; height:44px; border-width:3px; padding:2px; }
    .avatar.familie ha-icon, .zahnrad ha-icon { --mdc-icon-size:24px; }
    .stunde { right:6px; font-size:.78em; }
    .balken { font-size:.82em; padding:3px 6px; }
    .balken .badge { display:none; }
  }

  /* Schmal */
  @container fz (max-width: 760px) {
    #kopf { padding:8px 10px; gap:8px; }
    h1 { font-size:1.25em; }
    .kopf-rechts { width:100%; justify-content:flex-start; overflow-x:auto; flex-wrap:nowrap; padding-bottom:2px; }
    .kname b { display:none; }
    .tab { padding:6px 10px; font-size:.9em; }
    .trenner { display:none; }
    .tagkopf { font-size:.85em; }
    .tagkopf .plus { display:none; }
    .block { padding:3px 4px; border-left-width:3px; }
    .block .btitel { font-size:.75em; -webkit-line-clamp:4; }
    .bzeit, .bbadges { display:none; }
    .block:not(.kurz) { padding-bottom:3px; }
    .eplan { grid-template-columns:72px repeat(var(--mz, 2), minmax(0, 1fr)) !important; gap:6px; }
    .etag { padding:4px 6px; min-height:48px; font-size:.85em; }
    .eslot { padding:6px 8px; gap:6px; min-height:48px; }
    .eemoji { font-size:1.3em; }
    .kacheln { grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:8px; }
    .kachel { min-height:120px; }
    .kemoji { font-size:2.6em; }
    .glas { width:150px; }
    .glas-innen { min-height:130px; }
    .rgitter { grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); }
    .liste, .essen, .kinder { padding:10px; }
  }

  /* Aufgaben untereinander (vertikal); Routinen als Spalten nebeneinander */
  .kinder.routinen-spalten { display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));
    align-items:start; align-content:start; }
  .kacheln { display:flex !important; flex-direction:column; gap:10px; }
  .kachel { flex-direction:row; justify-content:flex-start; align-items:center; gap:16px;
    min-height:84px !important; padding:10px 18px; text-align:left; border-radius:16px; }
  .kemoji { font-size:2.8em !important; flex:none; width:1.2em; text-align:center; }
  .ktext { flex:1; text-align:left; font-size:1.3em; }
  .kpunkte { flex:none; font-size:1.2em; }
  .kachel.erledigt .ktext { text-decoration:line-through; text-decoration-thickness:3px; opacity:.6; }
  .kachel-neu { min-height:64px; border-radius:16px; border:3px dashed var(--fz-linie); color:var(--fz-grau);
    font-weight:800; font-size:1.1em; }
  .kachel-neu:hover { border-color:var(--fz-grau); }

  /* Routine-Formular: Schritte, große Knöpfe, Aufgaben-Zeilen, Vorschläge */
  .karte.ro { max-width:760px; }
  .ro-schritt { display:flex; align-items:center; flex-wrap:wrap; gap:8px; font-weight:800; font-size:1.15em; margin:18px 0 8px; }
  .ro-schritt.klein { font-size:1em; margin-top:16px; }
  .ro-schritt .grau { font-weight:600; font-size:.8em; }
  .ro-nr { width:28px; height:28px; border-radius:50%; background:var(--fz-akzent); color:#fff; font-size:.85em;
    display:inline-flex; align-items:center; justify-content:center; flex:none; }
  .ro-zeiten { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
  .ro-wahl { display:flex; flex-direction:column; align-items:center; gap:4px; padding:12px 6px; border-radius:18px;
    background:var(--fz-grund); border:3px solid transparent; font-weight:800; font-size:1.1em; }
  .ro-wahl .gross { font-size:2.2em; line-height:1; }
  .ro-wahl.an { border-color:var(--fz-akzent); background:color-mix(in srgb, var(--fz-akzent) 14%, var(--fz-karte)); }
  .ro-personen { display:flex; flex-wrap:wrap; gap:10px; }
  .ro-person { display:flex; align-items:center; gap:8px; padding:5px 16px 5px 5px; border-radius:999px; font-weight:800;
    background:var(--fz-grund); border:3px solid transparent; }
  .ro-person.an { border-color:var(--ring); background:color-mix(in srgb, var(--ring) 14%, var(--fz-karte)); }
  .ro-liste { display:flex; flex-direction:column; gap:8px; }
  .ro-leer { margin:4px 0; }
  .ro-zeile { display:flex; align-items:center; gap:8px; padding:6px; border-radius:16px; background:var(--fz-grund); }
  .ro-ebtn { width:56px; height:56px; flex:none; border-radius:14px; background:var(--fz-karte); font-size:2em; line-height:1;
    display:flex; align-items:center; justify-content:center; border:2px dashed var(--fz-linie); }
  .ro-ebtn.offen { border:2px solid var(--fz-akzent); }
  .formular .ro-zeile input { flex:1; min-width:0; background:var(--fz-karte); font-weight:700; }
  .ro-sterne { display:flex; align-items:center; gap:2px; flex:none; }
  .ro-sterne button { width:36px; height:36px; border-radius:50%; background:var(--fz-karte); font-size:1.2em; font-weight:800; }
  .ro-sterne b { min-width:4.6em; text-align:center; font-size:.85em; letter-spacing:-.15em; white-space:nowrap; }
  .ro-klein { width:36px; height:36px; flex:none; border-radius:50%; display:inline-flex; align-items:center; justify-content:center;
    color:var(--fz-grau); }
  .ro-klein ha-icon { --mdc-icon-size:20px; }
  .ro-weg { color:var(--error-color, #db4437); }
  .ro-picker { display:flex; flex-wrap:wrap; gap:4px; padding:10px; border-radius:14px; background:var(--fz-karte);
    border:2px solid var(--fz-akzent); }
  .ro-picker button { width:50px; height:50px; border-radius:12px; font-size:1.8em; line-height:1; }
  .ro-picker button:hover, .ro-picker button.an { background:var(--fz-grund); }
  .ro-picker button.vor { background:color-mix(in srgb, var(--fz-akzent) 16%, var(--fz-karte)); }
  .ro-picker .titel { width:100%; font-size:.85em; font-weight:800; color:var(--fz-grau); margin-top:2px; }
  .ro-eigene { width:100%; margin-top:8px; padding:12px; border-radius:14px; border:2px dashed var(--fz-linie);
    color:var(--fz-grau); font-weight:800; font-size:1.05em; }
  .ro-vorschlaege { display:flex; flex-wrap:wrap; gap:8px; }
  .ro-chip { display:inline-flex; align-items:center; gap:6px; padding:7px 14px 7px 10px; border-radius:999px;
    background:var(--fz-grund); border:2px solid transparent; font-weight:700; }
  .ro-chip span { font-size:1.4em; line-height:1; }
  .ro-chip.andere { opacity:.6; }
  .ro-chip.drin { opacity:1; background:color-mix(in srgb, #43a047 16%, var(--fz-karte)); border-color:#43a047; }
  .belohnung { position:relative; }
  .schatz-weg { position:absolute; top:8px; right:8px; width:44px; height:44px; border-radius:50%; z-index:1;
    display:flex; align-items:center; justify-content:center; color:#fff; background:var(--error-color, #db4437);
    box-shadow:0 2px 6px rgba(0,0,0,.2); }
  .schatz-weg ha-icon { --mdc-icon-size:24px; }
  .be-vorlagen { flex-direction:column; gap:10px; max-height:34vh; overflow:auto; padding:2px; }
  .be-gruppe { display:flex; flex-wrap:wrap; gap:8px; }
  .be-gruppe .titel { width:100%; font-weight:800; color:var(--fz-grau); font-size:.9em; }
  .ro-chip small { color:var(--fz-grau); font-weight:700; }
  .avatar.klein.familie { color:var(--fz-grau); }
  .avatar.klein.familie ha-icon { --mdc-icon-size:24px; }
  .be-zaehler { display:flex; align-items:center; gap:10px; }
  .be-zaehler button { width:52px; height:52px; border-radius:50%; background:var(--fz-grund); font-size:1.5em; font-weight:800; }
  .formular .be-zaehler input { width:90px; text-align:center; font-size:1.4em; font-weight:800; }
  .be-zaehler span { font-weight:800; font-size:1.1em; min-width:3em; }
  .ro-mehr { margin-top:16px; padding:10px 12px; border-radius:14px; background:var(--fz-grund); }
  .ro-mehr summary { cursor:pointer; font-weight:700; color:var(--fz-grau); }
  .ro-mehr summary b { color:var(--fz-text); }
  .ro-namezeile { display:flex; align-items:center; gap:10px; margin:10px 0 6px; }
  .formular .ro-namezeile input { flex:1; min-width:0; }
  @media (max-width: 600px) {
    .ro-zeile { flex-wrap:wrap; }
    .formular .ro-zeile input { flex:1 1 calc(100% - 70px); }
    .ro-sterne { margin-left:auto; }
  }
  @media (pointer: coarse), (min-width: 1600px) {
    .ro-sterne button, .ro-klein { width:44px; height:44px; }
    .ro-ebtn { width:62px; height:62px; }
    .ro-chip { padding:10px 16px 10px 12px; font-size:1.05em; }
  }

  @container fz (max-width: 760px) {
    .kinder.routinen-spalten { grid-template-columns:1fr; }
    .kachel { min-height:68px !important; padding:8px 12px; gap:12px; }
    .kemoji { font-size:2.2em !important; }
    .ktext { font-size:1.1em; }
  }
`;

if (!customElements.get("familienzentrale-panel")) {
  customElements.define("familienzentrale-panel", FamilienzentralePanel);
}
