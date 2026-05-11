import React from 'react';

export default function CardPreview({ card, index, onQtyChange, onRemove }) {
  return (
    <div className="card-preview" id={`card-${card.id}`}>
      <span className="card-order">#{index + 1}</span>
      <img src={card.src} alt={card.name} className="card-art" />

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

        <button type="button" className="remove-btn" onClick={() => onRemove(card.id)}>
          Remove
        </button>
      </div>
    </div>
  );
}
