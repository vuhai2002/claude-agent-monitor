/*
 * A small inline icon set. Drawn here rather than pulled from a library so the
 * page keeps working with no network and nothing to install.
 *
 * All icons share a 24x24 box and a 2px stroke, so they sit together evenly at
 * any size.
 */

const PATHS = {
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  layers: '<rect x="3" y="3" width="7" height="7" rx="1.5"/>'
    + '<rect x="14" y="3" width="7" height="7" rx="1.5"/>'
    + '<rect x="3" y="14" width="7" height="7" rx="1.5"/>'
    + '<rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  eyeOff: '<path d="M3 3l18 18"/>'
    + '<path d="M10.6 5.2A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7a15 15 0 0 1-3 4"/>'
    + '<path d="M6.5 7.3C4.3 8.8 2.6 10.9 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.3-1"/>'
    + '<path d="M9.9 10a3 3 0 0 0 4.2 4.2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/>'
    + '<circle cx="12" cy="12" r="3"/>',
  wrench: '<path d="M20.4 5.6a5 5 0 0 1-6.3 6.3L5.7 20.3a2 2 0 0 1-2.8-2.8l8.4-8.4a5 5 0 0 1 6.3-6.3l-3 3 2.1 2.1z"/>',
  branch: '<circle cx="6" cy="5" r="2.4"/><circle cx="6" cy="19" r="2.4"/>'
    + '<circle cx="18" cy="9" r="2.4"/><path d="M6 7.4v9.2"/>'
    + '<path d="M18 11.4c0 3.4-4 3.6-6 4.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  alert: '<path d="M12 3.6L1.8 20.4h20.4z"/><path d="M12 10v4"/><path d="M12 17.4v.1"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5"/><path d="M12 19.5V22"/>'
    + '<path d="M2 12h2.5"/><path d="M19.5 12H22"/><path d="M4.9 4.9l1.8 1.8"/>'
    + '<path d="M17.3 17.3l1.8 1.8"/><path d="M19.1 4.9l-1.8 1.8"/><path d="M6.7 17.3l-1.8 1.8"/>',
  moon: '<path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z"/>',
};

export function icon(name, size = 16) {
  const body = PATHS[name];
  if (!body) return '';
  return '<svg class="ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24"'
    + ' fill="none" stroke="currentColor" stroke-width="2"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
}

/**
 * The empty-state character. A small robot rather than a generic icon, because
 * an idle board is the state a reader sees most and it may as well be pleasant.
 */
export function idleFigure() {
  return '<svg class="idle-art" viewBox="0 0 160 120" role="img" aria-hidden="true">'
    + '<ellipse cx="80" cy="103" rx="34" ry="6" fill="var(--accent)" opacity="0.12"/>'
    + '<rect x="52" y="40" width="56" height="46" rx="16" fill="var(--accent)" opacity="0.22"/>'
    + '<rect x="58" y="46" width="44" height="34" rx="13" fill="var(--accent)" opacity="0.55"/>'
    + '<circle cx="71" cy="63" r="4.2" fill="var(--surface)"/>'
    + '<circle cx="89" cy="63" r="4.2" fill="var(--surface)"/>'
    + '<path d="M74 72h12" stroke="var(--surface)" stroke-width="2.6" stroke-linecap="round"/>'
    + '<path d="M80 40V30" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" opacity="0.5"/>'
    + '<circle cx="80" cy="27" r="4" fill="var(--accent)" opacity="0.5"/>'
    + '<g fill="var(--accent)" opacity="0.45">'
    + '<path d="M124 34l1.7 4.6 4.6 1.7-4.6 1.7-1.7 4.6-1.7-4.6-4.6-1.7 4.6-1.7z"/>'
    + '<path d="M36 52l1.3 3.5 3.5 1.3-3.5 1.3-1.3 3.5-1.3-3.5-3.5-1.3 3.5-1.3z"/>'
    + '<path d="M114 74l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z"/>'
    + '</g></svg>';
}
