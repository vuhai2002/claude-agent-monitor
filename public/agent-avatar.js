/*
 * Draws a portrait for an agent: head and shoulders, built from the agent type
 * so the same type always gets the same face.
 *
 * Silhouettes rather than faces with eyes - at 38px a drawn face reads as a
 * cartoon, while a silhouette stays calm on a board of forty cards and still
 * says "someone is doing this".
 *
 * All portraits are male, by request. Variety therefore comes from short cuts,
 * facial hair and one accessory rather than from hair length.
 *
 * Everything is inline SVG: no network, no sprite sheet, nothing to keep in
 * sync when a new agent type appears.
 */

const SKINS = [
  '#d97757', '#c9803f', '#9a8b4f', '#6f8f6a',
  '#4f8a8b', '#5b7fa6', '#8a6f9e', '#bf6f86',
];

const HEAD = { x: 20, y: 15.5, r: 7.2 };

// Cap over the top of the skull, hairline curving down at the temples.
const CROP = 'M12.8 14.6c0-4 3.2-6.4 7.2-6.4s7.2 2.4 7.2 6.4'
  + 'c-1.6-2.2-4.2-3.2-7.2-3.2s-5.6 1-7.2 3.2z';
// Shallower version of the same cap.
const BUZZ = 'M13 13.9c0-3.5 3.1-5.7 7-5.7s7 2.2 7 5.7'
  + 'c-1.5-1.7-4-2.5-7-2.5s-5.5.8-7 2.5z';
// Squarer top with the corners kept high.
const FLAT_TOP = 'M12.8 14.4V11c0-1.7 1.4-3 3.2-3h8c1.8 0 3.2 1.3 3.2 3v3.4'
  + 'c-1.6-2.1-4.2-3.1-7.2-3.1s-5.6 1-7.2 3.1z';
// Thin sliver cut back through a crop, drawn in skin colour to read as a parting.
const PARTING = 'M21.9 8.4l1.6 4.8-1.1.35-1.6-4.8z';

// Each entry owns its own fills, so a variant can cut skin-coloured detail back
// into the hair instead of every shape being forced to one colour.
const HAIR = [
  (skin, dark) => fill(CROP, dark),
  (skin, dark) => fill(BUZZ, dark),
  (skin, dark) => fill(FLAT_TOP, dark),
  () => '',
  (skin, dark) => fill(CROP, dark) + fill(PARTING, skin),
];

// Beards are circular segments of the head, so they always land on the jaw.
const CHIN_BEARD = 'M13.71 19A7.2 7.2 0 0 0 26.29 19Z';
const FULL_BEARD = 'M12.96 17A7.2 7.2 0 0 0 27.04 17Z';
const MOUSTACHE = 'M17.2 17.3c1-.7 4.6-.7 5.6 0-.9 1.1-4.7 1.1-5.6 0z';

const FACIAL_HAIR = ['', MOUSTACHE, CHIN_BEARD, FULL_BEARD + MOUSTACHE];

const ACCESSORIES = ['none', 'glasses', 'headset'];

export function agentAvatar(agentType) {
  const seed = hash(String(agentType || ''));
  const skin = SKINS[seed % SKINS.length];
  const dark = shade(skin, 0.62);

  const hair = HAIR[Math.floor(seed / 8) % HAIR.length](skin, dark);
  const facial = FACIAL_HAIR[Math.floor(seed / 64) % FACIAL_HAIR.length];
  const accessory = ACCESSORIES[Math.floor(seed / 512) % ACCESSORIES.length];

  return '<svg class="avatar-art" viewBox="0 0 40 40" role="img" aria-hidden="true">'
    + '<rect width="40" height="40" rx="11" fill="' + skin + '" opacity="0.18"/>'
    + '<path d="M20 24.8C11.7 24.8 5 31.5 5 39.8V40h30v-.2c0-8.3-6.7-15-15-15z" fill="' + skin + '"/>'
    + '<circle cx="' + HEAD.x + '" cy="' + HEAD.y + '" r="' + HEAD.r + '" fill="' + skin + '"/>'
    + (facial ? '<path d="' + facial + '" fill="' + dark + '" opacity="0.85"/>' : '')
    + hair
    + accessoryMarkup(accessory, dark)
    + '</svg>';
}

function fill(d, colour) {
  return '<path d="' + d + '" fill="' + colour + '"/>';
}

function accessoryMarkup(kind, stroke) {
  if (kind === 'glasses') {
    return '<g fill="none" stroke="' + stroke + '" stroke-width="0.9">'
      + '<circle cx="17.1" cy="16.2" r="2.4"/><circle cx="22.9" cy="16.2" r="2.4"/>'
      + '<path d="M19.5 16.2h1"/></g>';
  }
  if (kind === 'headset') {
    return '<g fill="' + stroke + '">'
      + '<path d="M11.9 17.2v-1.7a8.1 8.1 0 0 1 16.2 0v1.7h-1.5v-1.7a6.6 6.6 0 0 0-13.2 0v1.7z"/>'
      + '<rect x="10.4" y="15.6" width="3" height="5.4" rx="1.5"/>'
      + '<rect x="26.6" y="15.6" width="3" height="5.4" rx="1.5"/></g>';
  }
  return '';
}

/** Mixes a hex colour towards black; used for hair, beard and accessory lines. */
function shade(hex, factor) {
  const value = parseInt(hex.slice(1), 16);
  const parts = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    .map((channel) => Math.round(channel * factor).toString(16).padStart(2, '0'));
  return '#' + parts.join('');
}

/** djb2 - small, stable, and spreads names evenly across the variants. */
function hash(text) {
  let value = 5381;
  for (let i = 0; i < text.length; i += 1) {
    value = ((value << 5) + value + text.charCodeAt(i)) >>> 0;
  }
  return value;
}
