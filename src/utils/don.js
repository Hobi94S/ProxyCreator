export const DON_TEMPLATE_WIDTH = 1105;
export const DON_TEMPLATE_HEIGHT = 1543;
export const MIN_DON_ZOOM = 1;
export const MAX_DON_ZOOM = 3;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeDimension(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1;
}

export function getDonBaseScale(card) {
  const imageWidth = sanitizeDimension(card.imageWidth);
  const imageHeight = sanitizeDimension(card.imageHeight);

  return Math.max(DON_TEMPLATE_WIDTH / imageWidth, DON_TEMPLATE_HEIGHT / imageHeight);
}

export function getDonRenderMetrics(card, zoom = card.zoom ?? MIN_DON_ZOOM) {
  const imageWidth = sanitizeDimension(card.imageWidth);
  const imageHeight = sanitizeDimension(card.imageHeight);
  const baseScale = Number.isFinite(card.baseScale) ? card.baseScale : getDonBaseScale(card);
  const normalizedZoom = clamp(Number(zoom) || MIN_DON_ZOOM, MIN_DON_ZOOM, MAX_DON_ZOOM);
  const renderScale = baseScale * normalizedZoom;
  const drawWidth = imageWidth * renderScale;
  const drawHeight = imageHeight * renderScale;

  return {
    drawWidth,
    drawHeight,
    maxOffsetX: Math.max(0, (drawWidth - DON_TEMPLATE_WIDTH) / 2),
    maxOffsetY: Math.max(0, (drawHeight - DON_TEMPLATE_HEIGHT) / 2),
    renderScale,
  };
}

export function clampDonCardState(card, updates = {}) {
  const zoom = clamp(
    Number.parseFloat(`${updates.zoom ?? card.zoom ?? MIN_DON_ZOOM}`) || MIN_DON_ZOOM,
    MIN_DON_ZOOM,
    MAX_DON_ZOOM,
  );
  const metrics = getDonRenderMetrics(card, zoom);
  const nextOffsetX = Number.parseFloat(`${updates.offsetX ?? card.offsetX ?? 0}`) || 0;
  const nextOffsetY = Number.parseFloat(`${updates.offsetY ?? card.offsetY ?? 0}`) || 0;

  return {
    ...card,
    zoom,
    offsetX: clamp(nextOffsetX, -metrics.maxOffsetX, metrics.maxOffsetX),
    offsetY: clamp(nextOffsetY, -metrics.maxOffsetY, metrics.maxOffsetY),
  };
}
