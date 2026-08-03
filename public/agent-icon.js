/*
 * Gives every agent type a stable glyph, so a board of thirty cards can be
 * scanned by shape instead of by reading each name.
 *
 * Known kinds of work are matched by keyword. Anything unrecognised - a custom
 * or future agent type - still gets a fixed glyph chosen by hashing its name,
 * so the same type always looks the same without needing to be listed here.
 */

/*
 * Order matters: the first match wins, so anything specific has to sit above
 * the broad catch-alls. Short tokens are anchored with \b - without it "guide"
 * matches a bare "ui" rule, and "onboarding-engineer" matches "engineer" before
 * ever reaching the documentation rule.
 */
const KEYWORD_ICONS = [
  [/explore|inventory|scout/, '\u{1F50D}'],
  [/review|audit/, '\u{1F9D0}'],
  [/debug|diagnos/, '\u{1F41B}'],
  [/architect/, '\u{1F4D0}'],
  [/database|postgres|sql/, '\u{1F5C4}\u{FE0F}'],
  [/security|appsec/, '\u{1F6E1}\u{FE0F}'],
  [/onboarding|codebase|\bdocs?\b/, '\u{1F4D6}'],
  [/guide|help/, '\u{1F9ED}'],
  [/persona|walkthrough/, '\u{1F464}'],
  [/brainstorm|idea/, '\u{1F4A1}'],
  [/prompt/, '\u{270D}\u{FE0F}'],
  [/mcp|connector/, '\u{1F50C}'],
  [/simplif|clean/, '\u{2702}\u{FE0F}'],
  [/deploy|ship|vps/, '\u{1F680}'],
  [/payment|invoice|finance/, '\u{1F4B3}'],
  [/design|frontend|\bui\b|\bux\b/, '\u{1F3A8}'],
  [/\btest\b|testing/, '\u{1F9EA}'],
  [/statusline|status/, '\u{1F4CA}'],
  [/\bplan\b|planner/, '\u{1F5FA}\u{FE0F}'],
  [/general-purpose/, '\u{1F9F0}'],
  [/fullstack|developer|backend|engineer/, '\u{1F527}'],
];

const FALLBACK_ICONS = [
  '\u{1F9E9}', '\u{1F6F0}\u{FE0F}', '\u{1F9F1}', '\u{1F3AF}', '\u{1FA84}',
  '\u{1F4E6}', '\u{1F9F5}', '\u{1F52D}', '\u{1FAB6}', '\u{1F9FF}',
];

export function agentIcon(agentType) {
  const key = String(agentType || '').toLowerCase();
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(key)) return icon;
  }
  return FALLBACK_ICONS[hash(key) % FALLBACK_ICONS.length];
}

/** djb2 - small, stable, and good enough to spread names across the palette. */
function hash(text) {
  let value = 5381;
  for (let i = 0; i < text.length; i += 1) {
    value = ((value << 5) + value + text.charCodeAt(i)) >>> 0;
  }
  return value;
}
