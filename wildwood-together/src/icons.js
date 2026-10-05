const paths = {
  forest: '<path d="M8 3 2 13h4l-3 5h10l-3-5h4L8 3Z"/><path d="M8 18v3M16 5l5 9h-3l3 5h-7M17 19v2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1"/>',
  book: '<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v16h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3V4Zm9 2v16"/>',
  sound: '<path d="m3 9 4 0 5-4v14l-5-4H3V9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m3 9 4 0 5-4v14l-5-4H3V9Zm13 0 5 6m0-6-5 6"/>',
  tools: '<path d="m4 4 16 16M14 4l6 6M12 8l4-4M4 20l6-6M3 3l4 1-3 3-1-4Z"/>',
  spark: '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z"/>',
  pin: '<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  campfire: '<path d="M13 2c1 5-4 6-3 10 2-1 3-2 4-4 2 2 4 4 4 7a6 6 0 0 1-12 0c0-4 5-6 7-13ZM4 20l16 3M4 23l16-3"/>',
  leaf: '<path d="M20 3c-8-1-16 3-16 9a7 7 0 0 0 7 7c6 0 9-8 9-16ZM3 22 16 8"/>',
  chat: '<path d="M21 4H3v13h4v4l5-4h9V4Z"/><path d="M7 9h10M7 13h6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>',
  hand: '<path d="M8 12V5a2 2 0 0 1 4 0v7-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v10c0 5-4 7-8 7-3 0-5-2-6-4L3 13c-1-3 2-4 4-1l1 1"/>',
  axe: '<path d="m5 22 11-15M10 3l8 2 4 6-7 1-5-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
  heart: '<path d="M20 4c-3-2-6 0-8 3-2-3-5-5-8-3-5 4 0 10 8 17 8-7 13-13 8-17Z"/>',
  hunger: '<path d="M6 3v7m3-7v7M3 3v7a3 3 0 0 0 6 0M6 13v9M18 22V3c-4 1-5 7-4 10h4"/>',
  sanity: '<path d="M9 3a3 3 0 0 0-5 3 4 4 0 0 0-1 7 4 4 0 0 0 3 6 3 3 0 0 0 6 1V5a3 3 0 0 0-3-2Zm6 0a3 3 0 0 1 5 3 4 4 0 0 1 1 7 4 4 0 0 1-3 6 3 3 0 0 1-6 1M5 9h3m-1 7h2m7-7h3m-4 7h2"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  bag: '<path d="M8 7V5a4 4 0 0 1 8 0v2M5 7h14l2 15H3L5 7Z"/><path d="M8 7v4m8-4v4M8 16h8"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  arrow: '<path d="M3 12h18m-6-6 6 6-6 6"/>',
  wood: '<path d="m4 5 14 3 3 10-15 2-3-10 1-5Z"/><path d="m4 5 5 5-3 10m3-10 12 8m-4-10 2 6M6 7l1 4"/>',
  grass: '<path d="M12 22 8 3l5 6 3-7-1 13 7-7-7 14H9L2 12l8 5-4-9"/>',
  stone: '<path d="m3 15 5-10 10-2 4 12-6 6H7l-4-6Zm5-10 3 9 7-11M3 15l8-1 5 7m-5-7 11 1"/>',
  flint: '<path d="m14 2 7 11-5 9-13-8L14 2Zm0 0-4 13 11-2M3 14l7 1 6 7"/>',
  berry: '<circle cx="7" cy="14" r="5"/><circle cx="17" cy="15" r="5"/><circle cx="12" cy="8" r="4"/><path d="M12 4V1l5 1M5 13h1m10 1h1"/>',
  cooked: '<path d="M3 17h18M5 17l2 5h10l2-5M8 12c-4-4 3-5 0-9m5 9c-4-4 3-5 0-9m5 9c-4-4 3-5 0-9"/>',
  torch: '<path d="m10 13 1 9h2l1-9m-6-1h8M13 2c1 3-2 4-1 6l3-3c5 6-5 11-7 5-1-3 1-6 5-8Z"/>',
};
export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
}
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}
