// Timer Fast Forward — script de liaison (monde isolé de l'extension).
// Il récupère l'état de l'onglet auprès du service worker et le transmet
// au script de page (inject.js) via un événement DOM.
(() => {
  if (globalThis.__tffBridge) return;
  globalThis.__tffBridge = true;

  let factor = 1;
  let pushes = 0; // nombre de tff:set reçus du service worker
  const push = () => document.dispatchEvent(new CustomEvent('tff:set', { detail: factor }));
  // inject.js ignore déjà un facteur inchangé.
  const apply = (f) => {
    if (typeof f === 'number') {
      factor = f;
      push();
    }
  };
  // Une réponse arrivée après un tff:set plus récent est périmée : on l'ignore.
  const sync = () => {
    const seen = pushes;
    try {
      chrome.runtime.sendMessage({ type: 'tff:get' })
        .then((res) => { if (seen === pushes) apply(res && res.factor); })
        .catch(() => {});
    } catch (_) {
      // Extension rechargée : ce script n'est plus relié au service worker.
    }
  };

  // Si inject.js s'installe après nous, il signale qu'il est prêt.
  document.addEventListener('tff:ready', push);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'tff:set') {
      pushes++;
      apply(msg.factor);
      sendResponse(true); // le service worker sait ainsi que ce cadre est équipé
    }
  });

  // Les scripts ne sont pas réexécutés après une restauration depuis le cache
  // back/forward ni à l'activation d'une page prérendue : on resynchronise.
  addEventListener('pageshow', (e) => { if (e.persisted) sync(); });
  document.addEventListener('prerenderingchange', sync);

  sync();
})();
