// Timer Fast Forward — service worker.
// Un clic sur l'icône active/désactive l'accélération x10 pour l'onglet courant.
// L'état est conservé par onglet (chrome.storage.session) : il reste actif
// quand l'onglet change de page, jusqu'au prochain clic ou à la fermeture de l'onglet.

const FACTOR = 10;
const OFF_TITLE = chrome.runtime.getManifest().action.default_title;
const key = (tabId) => `tab_${tabId}`;

chrome.action.setBadgeBackgroundColor({ color: '#E8590C' });

async function getFactor(tabId) {
  const k = key(tabId);
  const stored = await chrome.storage.session.get(k);
  return stored[k] || 1;
}

async function updateBadge(tabId, factor) {
  const on = factor > 1;
  try {
    await Promise.all([
      chrome.action.setBadgeText({ tabId, text: on ? `x${factor}` : '' }),
      chrome.action.setTitle({
        tabId,
        title: on ? `Timer Fast Forward : actif x${factor} (cliquer pour désactiver)` : OFF_TITLE,
      }),
    ]);
  } catch (_) {
    // L'onglet a pu être fermé entre-temps.
  }
}

async function setFactor(tabId, factor) {
  if (factor > 1) await chrome.storage.session.set({ [key(tabId)]: factor });
  else await chrome.storage.session.remove(key(tabId));
  await updateBadge(tabId, factor);
}

// Les gestionnaires sont asynchrones : on enchaîne les lectures/écritures d'état pour
// qu'un double clic, un onglet créé ou un tff:get concurrent ne lise pas un état périmé.
let queue = Promise.resolve();
function serialize(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

async function pushToTab(tabId, factor) {
  const msg = { type: 'tff:set', factor };
  // Iframes : un cadre sans script n'est pas une erreur.
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
  try {
    // Le cadre principal est vérifié à part : des iframes chargées après l'installation
    // peuvent répondre alors que la page elle-même n'a aucun script.
    await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
  } catch (_) {
    // Aucun script présent (onglet ouvert avant l'installation de l'extension) :
    // on l'injecte maintenant dans la page affichée.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['inject.js'],
        world: 'MAIN',
        injectImmediately: true,
      });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['bridge.js'] });
    } catch (err) {
      console.warn('Timer Fast Forward : injection impossible sur cet onglet', err);
    }
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  serialize(async () => {
    const next = (await getFactor(tab.id)) > 1 ? 1 : FACTOR;
    await setFactor(tab.id, next);
    await pushToTab(tab.id, next);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'tff:get' && sender.tab && sender.tab.id != null) {
    const tabId = sender.tab.id;
    serialize(async () => {
      const factor = await getFactor(tabId);
      sendResponse({ factor });
      // Onglet inactif : le badge par défaut convient déjà.
      if (sender.frameId === 0 && factor > 1) await updateBadge(tabId, factor);
    }).catch(() => sendResponse());
    return true; // réponse asynchrone
  }
  return false;
});

// Un onglet ouvert depuis un onglet accéléré (lien target=_blank, window.open…) hérite de l'accélération.
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id == null || tab.openerTabId == null) return;
  serialize(async () => {
    const factor = await getFactor(tab.openerTabId);
    // Le tff:get du nouvel onglet, mis en file après ceci, lira le facteur hérité.
    if (factor > 1) await setFactor(tab.id, factor);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  serialize(() => chrome.storage.session.remove(key(tabId)));
});
