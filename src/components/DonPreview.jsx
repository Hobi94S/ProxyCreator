import React from 'react';
import {
  DON_TEMPLATE_HEIGHT,
  DON_TEMPLATE_WIDTH,
  getDonRenderMetrics,
  MAX_DON_ZOOM,
  MIN_DON_ZOOM,
} from '../utils/don';

export default function DonPreview({
  card,
  index,
  templateSrc,
  onQtyChange,
  onRemove,
  onReset,
  onZoomChange,
  onOffsetChange,
}) {
  const metrics = getDonRenderMetrics(card);
  const imageWidthPercent = (metrics.drawWidth / DON_TEMPLATE_WIDTH) * 100;
  const horizontalLimit = Math.round(metrics.maxOffsetX);
  const verticalLimit = Math.round(metrics.maxOffsetY);

  return (
    <div className="card-preview don-preview" id={`don-${card.id}`}>
      <span className="card-order">#{index + 1}</span>

      <div className="don-stage-shell">
        <div className="don-stage">
          <img
            src={card.src}
            alt={card.name}
            className="don-art"
            style={{
              width: `${imageWidthPercent}%`,
              left: `calc(50% + ${(card.offsetX / DON_TEMPLATE_WIDTH) * 100}%)`,
              top: `calc(50% + ${(card.offsetY / DON_TEMPLATE_HEIGHT) * 100}%)`,
            }}
          />
          <img src={templateSrc} alt="" aria-hidden="true" className="don-overlay" />
        </div>
      </div>

      <div className="don-adjustments">
        <div className="don-slider-group">
          <label className="don-slider-label" htmlFor={`zoom-${card.id}`}>
            <span>Zoom</span>
            <span>{card.zoom.toFixed(2)}x</span>
          </label>
          <input
            id={`zoom-${card.id}`}
            type="range"
            min={MIN_DON_ZOOM}
            max={MAX_DON_ZOOM}
            step="0.05"
            value={card.zoom}
            onChange={(event) => onZoomChange(card.id, event.target.value)}
          />
        </div>

        <div className="don-slider-group">
          <label className="don-slider-label" htmlFor={`offset-x-${card.id}`}>
            <span>Horizontal</span>
            <span>{Math.round(card.offsetX)} px</span>
          </label>
          <input
            id={`offset-x-${card.id}`}
            type="range"
            min={-horizontalLimit}
            max={horizontalLimit}
            step="1"
            value={card.offsetX}
            disabled={horizontalLimit === 0}
            onChange={(event) => onOffsetChange(card.id, 'x', event.target.value)}
          />
        </div>

        <div className="don-slider-group">
          <label className="don-slider-label" htmlFor={`offset-y-${card.id}`}>
            <span>Vertical</span>
            <span>{Math.round(card.offsetY)} px</span>
          </label>
          <input
            id={`offset-y-${card.id}`}
            type="range"
            min={-verticalLimit}
            max={verticalLimit}
            step="1"
            value={card.offsetY}
            disabled={verticalLimit === 0}
            onChange={(event) => onOffsetChange(card.id, 'y', event.target.value)}
          />
        </div>
      </div>

      <div className="card-controls">
        <label htmlFor={`qty-${card.id}`}>
          Qty:
          <input
            id={`qty-${card.id}`}
            type="number"
            min="1"
            value={card.qty}
            className="qty-input"
            onChange={(event) => onQtyChange(card.id, event.target.value)}
          />
        </label>

        <div className="don-action-row">
          <button type="button" className="secondary-btn" onClick={() => onReset(card.id)}>
            Reset Frame
          </button>
          <button type="button" className="remove-btn" onClick={() => onRemove(card.id)}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
