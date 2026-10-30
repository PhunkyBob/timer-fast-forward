*[Version française](README.fr.md)*

# Timer Fast Forward

Chrome / Edge extension (Manifest V3) that speeds up a page's timers by x10: `setTimeout`, `setInterval`, `requestAnimationFrame`, as well as the clock seen by the page (`Date`, `Date.now()`, `performance.now()`), so that countdowns based on real time also run faster.

## Installation

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Enable "Developer mode".
3. Click "Load unpacked" and select this folder.
4. Pin the orange icon to the toolbar.

## Usage

- Clicking the icon enables x10 acceleration on the current tab ("x10" badge). A countdown already in progress is sped up immediately.
- Acceleration stays active when the tab navigates to another page, and tabs opened from this tab inherit it.
- Clicking again disables it. It is also cleared when the tab is closed.

## Limitations

- If the site checks elapsed time server-side, the real wait is still enforced by the server.
- Timers running in Web Workers and CSS animations are not sped up.
- Tabs opened before the extension was installed: on the first click, only the displayed page is injected (not its iframes); reload the page for full functionality.
