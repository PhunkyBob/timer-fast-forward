*[English version](README.md)*

<img src="icons/icon128.png" alt="Icône Timer Fast Forward" width="64">

# Timer Fast Forward

Extension Chrome / Edge (Manifest V3) qui accélère x10 les timers d'une page : `setTimeout`, `setInterval`, `requestAnimationFrame`, ainsi que l'horloge vue par la page (`Date`, `Date.now()`, `performance.now()`), pour que les comptes à rebours basés sur l'heure réelle défilent eux aussi plus vite.

## Installation

1. Ouvrir `chrome://extensions` (Chrome) ou `edge://extensions` (Edge).
2. Activer le « Mode développeur ».
3. Cliquer sur « Charger l'extension non empaquetée » et sélectionner ce dossier.
4. Épingler l'icône orange dans la barre d'outils.

## Utilisation

- Un clic sur l'icône active l'accélération x10 sur l'onglet courant (badge « x10 »). Un compte à rebours déjà en cours est accéléré immédiatement.
- L'accélération reste active quand l'onglet change de page, et les onglets ouverts depuis cet onglet en héritent.
- Un nouveau clic la désactive. Elle disparaît aussi à la fermeture de l'onglet.

## Limites

- Si le site vérifie le temps écoulé côté serveur, l'attente réelle reste imposée par le serveur.
- Les timers exécutés dans des Web Workers ou les animations CSS ne sont pas accélérés.
- Les onglets ouverts avant l'installation de l'extension : au premier clic, seule la page affichée est injectée (sans ses iframes) ; recharger la page pour un fonctionnement complet.
