// Timer Fast Forward — script exécuté dans le contexte de la page (world MAIN).
// Il remplace setTimeout / setInterval / Date / performance.now / requestAnimationFrame
// par des versions pilotées par une horloge virtuelle dont la vitesse est réglable.
// Par défaut le facteur vaut 1 : la page se comporte exactement comme sans l'extension.
// Quand le facteur change, tous les timers déjà programmés sont reprogrammés,
// ce qui permet d'accélérer un compte à rebours déjà en cours.
(() => {
  'use strict';

  const GUARD = Symbol.for('timer-fast-forward.installed');
  if (window[GUARD]) return;
  Object.defineProperty(window, GUARD, { value: true });

  const w = window;
  const nSetTimeout = w.setTimeout;
  const nClearTimeout = w.clearTimeout;
  const nRAF = w.requestAnimationFrame;
  const NDate = w.Date;
  const nDateNow = NDate.now;
  const nPerfNow = Performance.prototype.now;
  const perf = w.performance;

  const realNow = nPerfNow.bind(perf);
  const realDateNow = nDateNow.bind(NDate);

  // ---- Horloge virtuelle -------------------------------------------------
  // virtuel = ancreVirtuelle + (réel - ancreRéelle) * facteur
  let factor = 1;
  let realAnchor = realNow();
  let virtAnchor = realAnchor;

  const toVirt = (realTs) => virtAnchor + (realTs - realAnchor) * factor;
  const virtNow = () => toVirt(realNow());
  // Date virtuelle = date réelle + avance accumulée par l'horloge virtuelle.
  const virtDateNow = () => {
    const r = realNow();
    return Math.floor(realDateNow() + (toVirt(r) - r));
  };

  // ---- Timers ------------------------------------------------------------
  const timers = new Map();
  const FIRST_ID = 100000; // évite les collisions avec d'éventuels ids natifs déjà émis
  let nextId = FIRST_ID;

  function arm(t) {
    // Arrondi supérieur : le navigateur tronque le délai, le timer partirait avant t.due.
    const delay = Math.max(0, Math.ceil((t.due - virtNow()) / factor));
    t.native = Reflect.apply(nSetTimeout, w, [fire, delay, t]);
  }

  function fire(t) {
    if (timers.get(t.id) !== t) return;
    if (t.repeat) {
      t.due = Math.max(t.due + t.delay, virtNow());
      arm(t);
    } else {
      timers.delete(t.id);
    }
    if (typeof t.handler === 'function') {
      Reflect.apply(t.handler, w, t.args);
    } else {
      // Handler non-fonction (chaîne, TrustedScript) : le navigateur l'exécute (respecte la CSP).
      Reflect.apply(nSetTimeout, w, [t.handler, 0]);
    }
  }

  function create(repeat, handler, timeout, args) {
    let delay = Math.trunc(Number(timeout)); // comme la conversion native en entier
    if (!(delay > 0)) delay = 0;
    // Un handler non-fonction est transmis tel quel au setTimeout natif (chaîne,
    // TrustedScript…), qui fait lui-même la conversion et les contrôles CSP / Trusted Types.
    const t = { id: nextId++, handler, args, delay, repeat, due: virtNow() + delay, native: 0 };
    timers.set(t.id, t);
    arm(t);
    return t.id;
  }

  function clear(id) {
    const n = Number(id);
    const t = timers.get(n);
    if (t) {
      timers.delete(t.id);
      Reflect.apply(nClearTimeout, w, [t.native]);
    } else if (id != null && !(n >= FIRST_ID && n < nextId)) {
      // Seul un id natif (timer créé avant l'injection) est relayé : un de nos ids déjà
      // terminé peut coïncider avec l'id natif qui porte un autre timer encore actif.
      Reflect.apply(nClearTimeout, w, [id]);
    }
  }

  const api = {
    setTimeout(handler, timeout, ...args) { return create(false, handler, timeout, args); },
    setInterval(handler, timeout, ...args) { return create(true, handler, timeout, args); },
    clearTimeout(id) { clear(id); },
    clearInterval(id) { clear(id); },
    requestAnimationFrame(callback) {
      // Horloge jamais modifiée : pas de wrapper (évite une closure par frame).
      if (typeof callback !== 'function' || (factor === 1 && virtAnchor === realAnchor)) {
        return Reflect.apply(nRAF, w, [callback]);
      }
      // Une frame commencée avant le dernier changement de vitesse ne doit pas
      // recevoir un horodatage antérieur à la frame précédente.
      return Reflect.apply(nRAF, w, [(ts) => callback(Math.max(virtAnchor, toVirt(ts)))]);
    },
  };
  for (const name of Object.keys(api)) {
    // Même arité que les fonctions natives (clearTimeout / clearInterval : 0).
    Object.defineProperty(api[name], 'length', { value: name.startsWith('clear') ? 0 : 1 });
    w[name] = api[name];
  }

  // ---- performance.now ---------------------------------------------------
  Performance.prototype.now = { now() { return virtNow(); } }.now;

  // ---- Date --------------------------------------------------------------
  const FDate = function Date(...args) {
    if (!new.target) return new NDate(virtDateNow()).toString();
    return Reflect.construct(NDate, args.length ? args : [virtDateNow()], new.target);
  };
  Object.defineProperty(FDate, 'length', { value: 7 });
  Object.defineProperty(FDate, 'prototype', { value: NDate.prototype, writable: false });
  // Propriétés statiques non énumérables, comme celles du Date natif.
  const statics = { now: { now() { return virtDateNow(); } }.now, parse: NDate.parse, UTC: NDate.UTC };
  for (const [k, value] of Object.entries(statics)) {
    Object.defineProperty(FDate, k, { value, writable: true, configurable: true });
  }
  NDate.prototype.constructor = FDate;
  w.Date = FDate;

  // ---- Changement de vitesse ----------------------------------------------
  function setFactor(f) {
    f = Number(f);
    if (!(f > 0) || f === factor) return;
    const r = realNow();
    virtAnchor = toVirt(r);
    realAnchor = r;
    factor = f;
    for (const t of timers.values()) {
      Reflect.apply(nClearTimeout, w, [t.native]);
      arm(t);
    }
  }

  // Le script « bridge » (monde isolé de l'extension) envoie le facteur via cet événement.
  document.addEventListener('tff:set', (e) => setFactor(e.detail));
  document.dispatchEvent(new CustomEvent('tff:ready'));
})();
