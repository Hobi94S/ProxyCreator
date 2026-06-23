import { Buffer } from 'node:buffer';
import { parseDecklist, normalizeCardName, resolveCardImageUrl } from '../src/utils/onePiece.js';

const DOTGG_API = 'https://api.dotgg.gg/cgfw';
const GAME = 'onepiece';
const CACHE_TTL = 1000 * 60 * 60 * 6;
const REQUEST_TIMEOUT_MS = 15000;
const ALLOWED_IMAGE_HOSTNAMES = new Set(['static.dotgg.gg', 'onepiece.gg', 'www.onepiece.gg']);

let cardCache = null;
let cacheTime = 0;
let inFlightCardsPromise = null;
let lastDotggRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 compatible OnePiece proxy tool',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`DotGG API failed: HTTP ${response.status}`);
  }

  return response.json();
}

async function enforceDotggRateLimit() {
  const elapsed = Date.now() - lastDotggRequestAt;

  if (elapsed < 1000) {
    await sleep(1000 - elapsed);
  }

  lastDotggRequestAt = Date.now();
}

function transformIndexedCards(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.names) && Array.isArray(data?.data)) {
    return data.data.map((row) => {
      const card = {};
      data.names.forEach((field, index) => {
        card[field] = row[index];
      });
      return card;
    });
  }

  throw new Error('Unexpected DotGG response format');
}

function getPublicCard(card) {
  return {
    ...card,
    imageUrl: resolveCardImageUrl(card),
  };
}

export async function getOnePieceCards() {
  const fresh = cardCache && Date.now() - cacheTime < CACHE_TTL;

  if (fresh) {
    return cardCache;
  }

  if (inFlightCardsPromise) {
    return inFlightCardsPromise;
  }

  inFlightCardsPromise = (async () => {
    await enforceDotggRateLimit();
    const url = `${DOTGG_API}/getcards?game=${GAME}&mode=indexed`;
    const data = await fetchJson(url);
    const cards = transformIndexedCards(data);
    cardCache = cards;
    cacheTime = Date.now();
    return cards;
  })();

  try {
    return await inFlightCardsPromise;
  } finally {
    inFlightCardsPromise = null;
  }
}

export function findOnePieceCard(cards, term) {
  const wanted = normalizeCardName(term);
  const wantedTokens = wanted.split(' ').filter((token) => token.length >= 2);

  const byId = cards.find((card) => {
    return (
      normalizeCardName(card.id) === wanted ||
      normalizeCardName(card.card_id) === wanted ||
      normalizeCardName(card.code) === wanted ||
      normalizeCardName(card.id_normal) === wanted
    );
  });

  if (byId) {
    return byId;
  }

  const byExactName = cards.find((card) => normalizeCardName(card.name) === wanted);

  if (byExactName) {
    return byExactName;
  }

  const byLooseName = cards.find((card) => {
    const name = normalizeCardName(card.name);
    const nameTokens = name.split(' ').filter((token) => token.length >= 2);
    const wantedWithinName =
      wantedTokens.length > 0 && wantedTokens.every((token) => name.includes(token));
    const nameWithinWanted =
      nameTokens.length > 0 &&
      nameTokens.every((token) => wanted.includes(token)) &&
      nameTokens.some((token) => token.length >= 3);

    return Boolean(wanted && name) && (wantedWithinName || nameWithinWanted);
  });

  return byLooseName || null;
}

export async function resolveDecklist(decklistText = '') {
  const cards = await getOnePieceCards();
  const parsedLines = parseDecklist(decklistText);

  const lines = parsedLines.map((line) => {
    if (!line.valid) {
      return {
        ...line,
        matched: false,
        warning: line.error,
        card: null,
      };
    }

    const matchedCard = findOnePieceCard(cards, line.term);

    if (!matchedCard) {
      return {
        ...line,
        matched: false,
        warning: 'No One Piece card matched this line.',
        card: null,
      };
    }

    return {
      ...line,
      matched: true,
      warning: '',
      card: getPublicCard(matchedCard),
    };
  });

  return {
    lines,
    items: lines
      .filter((line) => line.matched && line.card)
      .map((line, index) => ({
        id: `resolved-${line.lineNumber}-${index}`,
        qty: line.qty,
        card: line.card,
      })),
  };
}

function isAllowedImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_IMAGE_HOSTNAMES.has(parsed.hostname);
  } catch (_error) {
    return false;
  }
}

export async function proxyImage(url) {
  if (!isAllowedImageUrl(url)) {
    const error = new Error('Invalid image URL');
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 compatible OnePiece proxy tool',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = new Error(`Image fetch failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'image/webp',
  };
}

export async function handleOnePieceApiRequest(req, res, requestUrl) {
  if (req.method === 'GET' && requestUrl.pathname === '/api/onepiece/cards') {
    try {
      const cards = await getOnePieceCards();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ cards: cards.map(getPublicCard), cachedAt: cacheTime }));
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/onepiece/search') {
    try {
      const q = requestUrl.searchParams.get('q')?.trim() || '';

      if (!q) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Missing search term.' }));
        return true;
      }

      const cards = await getOnePieceCards();
      const match = findOnePieceCard(cards, q);

      if (!match) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No matching One Piece card found.' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ card: getPublicCard(match) }));
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/onepiece/resolve-deck') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }

      const bodyText = Buffer.concat(chunks).toString('utf8');
      const body = bodyText ? JSON.parse(bodyText) : {};
      const decklist = String(body.decklist || '');
      const result = await resolveDecklist(decklist);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : 502;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/image-proxy') {
    try {
      const url = String(requestUrl.searchParams.get('url') || '');
      const { buffer, contentType } = await proxyImage(url);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(buffer);
    } catch (error) {
      res.writeHead(error.statusCode || 500, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  return false;
}
