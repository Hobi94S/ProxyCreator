import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  CARD_GAP_MM,
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  CARDS_PER_PAGE,
  GRID_COLUMNS,
  GRID_ROWS,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  PDF_TARGET_DPI,
  mmToPixels,
} from '../utils/printLayout';

const DEFAULT_DECKLIST = ['4 Monkey.D.Luffy', '2x Roronoa Zoro', '1 OP07-095', '1 NOT-A-REAL-CARD'].join('\n');

function createProxyImageUrl(imageUrl) {
  return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image unavailable.'));
    image.src = src;
  });
}

async function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function generateProxySheet(items) {
  const pageWidthPx = mmToPixels(PAGE_WIDTH_MM, PDF_TARGET_DPI);
  const pageHeightPx = mmToPixels(PAGE_HEIGHT_MM, PDF_TARGET_DPI);
  const cardWidthPx = mmToPixels(CARD_WIDTH_MM, PDF_TARGET_DPI);
  const cardHeightPx = mmToPixels(CARD_HEIGHT_MM, PDF_TARGET_DPI);
  const gapPx = mmToPixels(CARD_GAP_MM, PDF_TARGET_DPI);
  const printQueue = items.flatMap((item) =>
    Array.from({ length: item.qty }, () => ({
      ...item,
      proxiedImageUrl: createProxyImageUrl(item.card.imageUrl),
    })),
  );
  const uniqueImageEntries = Array.from(
    new Map(printQueue.map((item) => [item.card.imageUrl, item.proxiedImageUrl])).entries(),
  );
  const loadedImages = new Map(
    await Promise.all(
      uniqueImageEntries.map(async ([imageUrl, proxiedImageUrl]) => [
        imageUrl,
        await loadImage(proxiedImageUrl),
      ]),
    ),
  );
  const totalGridWidthPx = GRID_COLUMNS * cardWidthPx + (GRID_COLUMNS - 1) * gapPx;
  const totalGridHeightPx = GRID_ROWS * cardHeightPx + (GRID_ROWS - 1) * gapPx;
  const startXPx = Math.round((pageWidthPx - totalGridWidthPx) / 2);
  const startYPx = Math.round((pageHeightPx - totalGridHeightPx) / 2);
  const canvases = [];

  for (let pageStart = 0; pageStart < printQueue.length; pageStart += CARDS_PER_PAGE) {
    const canvas = document.createElement('canvas');
    canvas.width = pageWidthPx;
    canvas.height = pageHeightPx;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is not available in this browser.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, pageWidthPx, pageHeightPx);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.strokeStyle = '#969696';
    context.lineWidth = 1;
    context.setLineDash([4, 4]);

    const pageItems = printQueue.slice(pageStart, pageStart + CARDS_PER_PAGE);

    pageItems.forEach((item, index) => {
      const col = index % GRID_COLUMNS;
      const row = Math.floor(index / GRID_COLUMNS);
      const x = startXPx + col * (cardWidthPx + gapPx);
      const y = startYPx + row * (cardHeightPx + gapPx);
      const image = loadedImages.get(item.card.imageUrl);

      context.drawImage(image, x, y, cardWidthPx, cardHeightPx);
      context.beginPath();

      if (col < GRID_COLUMNS - 1) {
        const guideX = x + cardWidthPx + gapPx / 2;
        context.moveTo(guideX, y);
        context.lineTo(guideX, y + cardHeightPx);
      }

      if (row < GRID_ROWS - 1) {
        const guideY = y + cardHeightPx + gapPx / 2;
        context.moveTo(x, guideY);
        context.lineTo(x + cardWidthPx, guideY);
      }

      context.stroke();
    });

    canvases.push(canvas);
  }

  return canvases;
}

export default function OnePieceProxyTool() {
  const [decklist, setDecklist] = useState(DEFAULT_DECKLIST);
  const [resolvedLines, setResolvedLines] = useState([]);
  const [resolvedItems, setResolvedItems] = useState([]);
  const [statusMessage, setStatusMessage] = useState(
    'Paste a One Piece decklist, then resolve it to build printable sheets.',
  );
  const [isResolving, setIsResolving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const matchedItems = useMemo(
    () => resolvedItems.filter((item) => item.card?.imageUrl),
    [resolvedItems],
  );
  const totalCards = useMemo(
    () => matchedItems.reduce((sum, item) => sum + item.qty, 0),
    [matchedItems],
  );
  const unmatchedCount = useMemo(
    () => resolvedLines.filter((line) => !line.matched).length,
    [resolvedLines],
  );
  const totalSheets = useMemo(() => Math.ceil(totalCards / CARDS_PER_PAGE), [totalCards]);

  async function resolveDeck() {
    setIsResolving(true);
    setStatusMessage('Resolving decklist against the cached One Piece card database...');

    try {
      const response = await fetch('/api/onepiece/resolve-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to resolve decklist.');
      }

      setResolvedLines(payload.lines || []);
      setResolvedItems(payload.items || []);
      setStatusMessage(
        payload.items?.length
          ? `Resolved ${payload.items.length} deck entries.`
          : 'No printable cards were resolved from this decklist.',
      );
    } catch (error) {
      setResolvedLines([]);
      setResolvedItems([]);
      setStatusMessage(error instanceof Error ? error.message : 'Unable to resolve decklist.');
    } finally {
      setIsResolving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!matchedItems.length) {
      window.alert('Resolve at least one One Piece card before downloading.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Generating PDF sheets from proxied card images...');

    try {
      const canvases = await generateProxySheet(matchedItems);
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      canvases.forEach((canvas, index) => {
        if (index > 0) {
          doc.addPage();
        }

        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM);
      });

      doc.save('one-piece-proxy-sheets.pdf');
      setStatusMessage(`Generated ${canvases.length} PDF sheet(s).`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to generate PDF.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownloadPng() {
    if (!matchedItems.length) {
      window.alert('Resolve at least one One Piece card before downloading.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Rendering PNG sheets from proxied card images...');

    try {
      const canvases = await generateProxySheet(matchedItems);

      await Promise.all(
        canvases.map(
          (canvas, index) =>
            new Promise((resolve, reject) => {
              canvas.toBlob(async (blob) => {
                if (!blob) {
                  reject(new Error('Unable to encode PNG sheet.'));
                  return;
                }

                await downloadBlob(blob, `one-piece-proxy-sheet-${index + 1}.png`);
                resolve();
              }, 'image/png');
            }),
        ),
      );

      setStatusMessage(`Generated ${canvases.length} PNG sheet(s).`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to generate PNG sheets.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <>
      <div className="controls-panel" data-section-label="DECK INPUT">
        <div className="decklist-panel">
          <label className="field-label" htmlFor="onepiece-decklist">
            Paste One Piece decklist
          </label>
          <textarea
            id="onepiece-decklist"
            className="decklist-input"
            value={decklist}
            onChange={(event) => setDecklist(event.target.value)}
            placeholder="4 Monkey.D.Luffy&#10;2x Roronoa Zoro&#10;1 OP07-095"
          />
          <div className="controls onepiece-actions">
            <button
              type="button"
              className="btn btn-upload"
              onClick={resolveDeck}
              disabled={isResolving || isGenerating}
            >
              <span>{isResolving ? 'Resolving...' : 'Resolve Decklist'}</span>
            </button>
            <button
              type="button"
              className="btn btn-generate"
              onClick={handleDownloadPdf}
              disabled={isResolving || isGenerating}
            >
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              className="btn btn-generate"
              onClick={handleDownloadPng}
              disabled={isResolving || isGenerating}
            >
              <span>Download PNG Sheets</span>
            </button>
            <button
              type="button"
              className="btn btn-clear"
              onClick={() => {
                setDecklist('');
                setResolvedLines([]);
                setResolvedItems([]);
                setStatusMessage('Decklist cleared.');
              }}
              disabled={isResolving || isGenerating}
            >
              <span>Clear Decklist</span>
            </button>
          </div>
          <p className="panel-helper">{statusMessage}</p>
          <p className="panel-helper">
            Print layout matches the standard and DON!! pages: A4 landscape, 4 columns, 2 rows,
            63mm x 88mm cards, and 4mm cut spacing.
          </p>
        </div>
      </div>

      <div className="stats" data-section-label="ONE PIECE STATUS">
        Resolved cards: {matchedItems.length} | Total quantity: {totalCards} | Unmatched lines:{' '}
        {unmatchedCount} | Estimated sheets: {totalSheets}
      </div>

      <div className="onepiece-results">
        {resolvedLines.map((line) => (
          <div
            key={`${line.lineNumber}-${line.originalLine}`}
            className={`card-preview onepiece-preview ${line.matched ? '' : 'onepiece-preview-warning'}`}
          >
            <span className="card-order">#{line.lineNumber}</span>

            {line.card?.imageUrl ? (
              <img
                src={createProxyImageUrl(line.card.imageUrl)}
                alt={line.card.name}
                className="card-art"
              />
            ) : (
              <div className="onepiece-missing-art">No Match</div>
            )}

            <div className="onepiece-card-meta">
              <strong>{line.card?.name || line.term}</strong>
              <span>{line.card?.id || 'Unmatched'}</span>
              <span>Qty: {line.qty}</span>
            </div>

            <div className="onepiece-line-copy">{line.originalLine}</div>

            {line.warning ? <div className="onepiece-warning">{line.warning}</div> : null}
          </div>
        ))}
      </div>
    </>
  );
}
