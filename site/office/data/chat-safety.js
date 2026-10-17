import words from './profanity-words.js';

const escaped = word => String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = words.map(word => new RegExp(`(^|[^\\p{L}\\p{N}])${escaped(word)}($|[^\\p{L}\\p{N}])`, 'giu'));

export function filterChatText(value) {
  let text = String(value ?? '');
  for (const pattern of patterns) text = text.replace(pattern, (_match, before, after) => `${before}•••${after}`);
  return text;
}

export function ratingAllowed(title, { childAccount = false, maxRating = 'T' } = {}) {
  const rating = String(title?.rating || 'Unknown').toUpperCase();
  const ranks = { E: 0, 'E10+': 1, T: 2, M: 3, R: 4, AO: 5 };
  if (!(rating in ranks) || !(maxRating in ranks)) return false;
  return ranks[rating] <= ranks[childAccount ? 'E10+' : maxRating];
}

export function xboxTheaterTitles(titles, { childAccount = false, maxRating = 'T', childAllowList = [] } = {}) {
  const allowed = new Set(childAllowList.map(x => String(x).toLowerCase()));
  return (titles || []).filter(title => ratingAllowed(title, { childAccount, maxRating }) &&
    (!childAccount || allowed.has(String(title.title || '').toLowerCase())));
}

export function xboxChatDisabled(privileges = {}) {
  return privileges.communications === false || privileges.childAccount === true;
}
