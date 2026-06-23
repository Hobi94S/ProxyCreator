export const ONE_PIECE_IMAGE_BASE_URL = 'https://static.dotgg.gg/onepiece/card/';

export function normalizeCardName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseDeckLine(line, lineNumber = 1) {
  const originalLine = String(line ?? '');
  const s = originalLine.trim();

  if (!s) {
    return null;
  }

  let qty = 1;
  let term = s;

  const m1 = s.match(/^(\d+)\s*x\s*(.+)$/i);
  const m2 = s.match(/^(\d+)\s+(.+)$/);

  if (m1) {
    qty = Number(m1[1]);
    term = m1[2].trim();
  } else if (m2) {
    qty = Number(m2[1]);
    term = m2[2].trim();
  }

  if (!Number.isFinite(qty) || qty < 1) {
    return {
      lineNumber,
      originalLine,
      qty: 0,
      term,
      valid: false,
      error: 'Quantity must be 1 or greater.',
    };
  }

  if (!term) {
    return {
      lineNumber,
      originalLine,
      qty,
      term: '',
      valid: false,
      error: 'Missing card name or card ID.',
    };
  }

  return {
    lineNumber,
    originalLine,
    qty,
    term,
    valid: true,
    error: '',
  };
}

export function parseDecklist(decklistText = '') {
  return String(decklistText)
    .split(/\r?\n/)
    .map((line, index) => parseDeckLine(line, index + 1))
    .filter(Boolean);
}

export function getCardIdentifier(card = {}) {
  return card.id || card.card_id || card.code || card.id_normal || '';
}

export function resolveCardImageUrl(card = {}) {
  const directUrl =
    card.image ||
    card.img ||
    card.image_url ||
    card.imageUrl ||
    card.art ||
    card.art_url ||
    card.artUrl ||
    '';

  if (directUrl) {
    if (/^https?:\/\//i.test(directUrl)) {
      return directUrl;
    }

    try {
      return new URL(directUrl, ONE_PIECE_IMAGE_BASE_URL).toString();
    } catch (_error) {
      return '';
    }
  }

  const cardId = getCardIdentifier(card).toUpperCase();

  if (!cardId) {
    return '';
  }

  return `${ONE_PIECE_IMAGE_BASE_URL}${encodeURIComponent(cardId)}.webp`;
}

