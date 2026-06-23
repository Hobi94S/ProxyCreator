import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import CardPreview from './components/CardPreview';
import DonPreview from './components/DonPreview';
import OnePieceProxyTool from './components/OnePieceProxyTool';
import {
  clampDonCardState,
  DON_TEMPLATE_HEIGHT,
  DON_TEMPLATE_WIDTH,
  getDonBaseScale,
  getDonRenderMetrics,
  MIN_DON_ZOOM,
} from './utils/don';
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
} from './utils/printLayout';

const PDF_JPEG_QUALITY = 0.82;
const SMALL_SOURCE_THRESHOLD_BYTES = 350 * 1024;
const IMAGE_UPLOAD_BATCH_SIZE = 4;
const PAGE_STANDARD = 'standard';
const PAGE_CUSTOM_DON = 'custom-don';
const PAGE_ONE_PIECE_PROXY = 'one-piece-proxy';
const DON_TEMPLATE_SRC = new URL('../Card DON!! Template (New) (1).png', import.meta.url).href;
const HELP_LINK =
  'https://docs.google.com/document/d/1zaCg6Ww4wZQyiczGCOnipnVe-ip-8n3V0EFpfkCOx74/edit?';

const INITIAL_UPLOAD_QUEUE_STATE = {
  active: false,
  total: 0,
  processed: 0,
  pending: 0,
  failed: 0,
  currentFileName: '',
};

const PAGE_HASHES = {
  [PAGE_STANDARD]: '#/standard',
  [PAGE_CUSTOM_DON]: '#/custom-don',
  [PAGE_ONE_PIECE_PROXY]: '#/one-piece-proxy',
};

const PAGE_COPY = {
  [PAGE_STANDARD]: {
    title: 'Proxy Card Standard Creator',
    subtitle: 'A4 Landscape | Cut spacing (4mm) | Cut guides',
    panelLabel: 'Options',
    addLabel: '+ Add Cards',
    downloadLabel: 'Download PDF',
    clearLabel: 'Clear All',
    emptyStateMessage: 'Add cards!',
    fileName: 'one-piece-proxies-hobi94s.pdf',
  },
  [PAGE_CUSTOM_DON]: {
    title: 'Custom DON!! Creator',
    subtitle: 'A4 Landscape | Cut spacing (4mm) | Cut guides',
    panelLabel: 'Options',
    addLabel: '+ Add DON!! Art',
    downloadLabel: 'Download DON PDF',
    clearLabel: 'Clear DON!',
    emptyStateMessage: 'Add DON!! art',
    fileName: 'one-piece-don-hobi94s.pdf',
    helperText:
      'Upload artwork, then use the zoom and position sliders to frame it behind the DON!! template.',
  },
  [PAGE_ONE_PIECE_PROXY]: {
    title: 'One Piece Proxy Tool',
    subtitle: 'Decklist resolver | DotGG card cache | Printable A4/A3 proxy sheets',
  },
};

function getPageFromHash(hash) {
  if (hash === PAGE_HASHES[PAGE_CUSTOM_DON]) {
    return PAGE_CUSTOM_DON;
  }

  if (hash === PAGE_HASHES[PAGE_ONE_PIECE_PROXY]) {
    return PAGE_ONE_PIECE_PROXY;
  }

  return PAGE_STANDARD;
}

function createCardId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 11);
}

function detectImageFormat(dataUrl) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
  const format = match?.[1]?.toLowerCase();

  if (format === 'png') {
    return 'PNG';
  }

  if (format === 'webp') {
    return 'WEBP';
  }

  return 'JPEG';
}

function yieldToBrowser() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Error preparing image for PDF.'));
    image.src = src;
  });
}

function readFileAsPromise(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const src = event.target?.result;

      if (typeof src !== 'string') {
        reject(new Error('Unsupported file data.'));
        return;
      }

      loadImage(src)
        .then((image) => {
          resolve({
            id: createCardId(),
            src,
            qty: 1,
            name: file.name,
            format: detectImageFormat(src),
            sourceBytes: file.size,
            imageWidth: image.naturalWidth,
            imageHeight: image.naturalHeight,
          });
        })
        .catch(() => reject(new Error('Unsupported image file.')));
    };

    reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}

function normalizeQuantity(nextValue) {
  const parsedValue = Number.parseInt(nextValue, 10);
  return Number.isNaN(parsedValue) || parsedValue < 1 ? 1 : parsedValue;
}

function createDonCard(upload) {
  return clampDonCardState({
    ...upload,
    baseScale: getDonBaseScale(upload),
    zoom: MIN_DON_ZOOM,
    offsetX: 0,
    offsetY: 0,
  });
}

async function preparePdfAsset(card) {
  const image = await loadImage(card.src);
  const maxWidth = mmToPixels(CARD_WIDTH_MM);
  const maxHeight = mmToPixels(CARD_HEIGHT_MM);
  const targetWidth = Math.max(1, Math.min(image.naturalWidth, maxWidth));
  const targetHeight = Math.max(1, Math.min(image.naturalHeight, maxHeight));
  const isNearPrintResolution =
    image.naturalWidth <= Math.round(maxWidth * 1.15) &&
    image.naturalHeight <= Math.round(maxHeight * 1.15);
  const isAlreadySmall = (card.sourceBytes ?? Number.POSITIVE_INFINITY) <= SMALL_SOURCE_THRESHOLD_BYTES;

  if (card.format === 'JPEG' && isNearPrintResolution && isAlreadySmall) {
    return {
      alias: `card-${card.id}`,
      format: 'JPEG',
      src: card.src,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available in this browser.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return {
    alias: `card-${card.id}`,
    format: 'JPEG',
    src: canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY),
  };
}

export default function App() {
  const [activePage, setActivePage] = useState(() => getPageFromHash(window.location.hash));
  const [cards, setCards] = useState([]);
  const [donCards, setDonCards] = useState([]);
  const [cardUploadQueueState, setCardUploadQueueState] = useState(INITIAL_UPLOAD_QUEUE_STATE);
  const [donUploadQueueState, setDonUploadQueueState] = useState(INITIAL_UPLOAD_QUEUE_STATE);
  const [isGeneratingCardPdf, setIsGeneratingCardPdf] = useState(false);
  const [isGeneratingDonPdf, setIsGeneratingDonPdf] = useState(false);
  const cardFileInputRef = useRef(null);
  const donFileInputRef = useRef(null);
  const cardPdfAssetCacheRef = useRef(new Map());
  const donPdfAssetCacheRef = useRef(new Map());
  const donTemplateImagePromiseRef = useRef(null);
  const cardUploadQueueRef = useRef([]);
  const donUploadQueueRef = useRef([]);
  const isProcessingCardUploadQueueRef = useRef(false);
  const isProcessingDonUploadQueueRef = useRef(false);
  const cardUploadSessionRef = useRef(0);
  const donUploadSessionRef = useRef(0);

  useEffect(() => {
    const syncPage = () => setActivePage(getPageFromHash(window.location.hash));

    if (!window.location.hash) {
      window.history.replaceState(null, '', PAGE_HASHES[PAGE_STANDARD]);
    }

    syncPage();
    window.addEventListener('hashchange', syncPage);

    return () => {
      window.removeEventListener('hashchange', syncPage);
    };
  }, []);

  useEffect(() => {
    document.title =
      activePage === PAGE_CUSTOM_DON
        ? 'Custom DON!! Creator'
        : activePage === PAGE_ONE_PIECE_PROXY
          ? 'One Piece Proxy Tool'
          : 'Proxy Card Standard Creator';
  }, [activePage]);

  const currentItems = activePage === PAGE_CUSTOM_DON ? donCards : cards;
  const currentUploadState = activePage === PAGE_CUSTOM_DON ? donUploadQueueState : cardUploadQueueState;
  const currentIsGeneratingPdf = activePage === PAGE_CUSTOM_DON ? isGeneratingDonPdf : isGeneratingCardPdf;
  const totalCards = currentItems.reduce((sum, card) => sum + card.qty, 0);
  const totalSheets = Math.ceil(totalCards / CARDS_PER_PAGE);
  const pageCopy = PAGE_COPY[activePage];
  const isLegacyPage = activePage !== PAGE_ONE_PIECE_PROXY;

  function navigateToPage(page) {
    if (window.location.hash !== PAGE_HASHES[page]) {
      window.location.hash = PAGE_HASHES[page];
      return;
    }

    setActivePage(page);
  }

  async function processUploadQueue({
    queueRef,
    processingRef,
    sessionRef,
    setUploadState,
    appendItems,
    transformUpload = (upload) => upload,
  }) {
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;
    let failedInCurrentRun = 0;

    try {
      while (queueRef.current.length > 0) {
        const batch = queueRef.current.splice(0, IMAGE_UPLOAD_BATCH_SIZE);
        const batchSessionId = batch[0]?.sessionId ?? sessionRef.current;

        if (batchSessionId === sessionRef.current) {
          setUploadState((currentState) => ({
            ...currentState,
            active: true,
            currentFileName: batch[0]?.file.name ?? currentState.currentFileName,
          }));
        }

        const settledResults = await Promise.allSettled(
          batch.map(({ file }) => readFileAsPromise(file).then(transformUpload)),
        );

        if (batchSessionId !== sessionRef.current) {
          await yieldToBrowser();
          continue;
        }

        const loadedItems = [];
        let failedInBatch = 0;

        settledResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            loadedItems.push(result.value);
            return;
          }

          failedInBatch += 1;
        });

        failedInCurrentRun += failedInBatch;

        if (loadedItems.length > 0) {
          appendItems(loadedItems);
        }

        const remainingItems = queueRef.current.filter(
          (queuedItem) => queuedItem.sessionId === sessionRef.current,
        );

        setUploadState((currentState) => {
          const processed = currentState.processed + batch.length;
          const pending = remainingItems.length;
          const nextState = {
            ...currentState,
            active: pending > 0,
            processed,
            pending,
            failed: currentState.failed + failedInBatch,
            currentFileName: remainingItems[0]?.file.name ?? '',
          };

          return pending === 0 ? INITIAL_UPLOAD_QUEUE_STATE : nextState;
        });

        await yieldToBrowser();
      }
    } finally {
      processingRef.current = false;
    }

    if (failedInCurrentRun > 0) {
      window.alert(`${failedInCurrentRun} image(s) could not be loaded.`);
    }
  }

  async function handleFiles(
    fileList,
    { queueRef, sessionRef, setUploadState, processingRef, appendItems, transformUpload, fileInputRef },
  ) {
    if (!fileList?.length) {
      return;
    }

    const incomingFiles = Array.from(fileList);
    const sessionId = sessionRef.current;

    queueRef.current.push(...incomingFiles.map((file) => ({ file, sessionId })));

    setUploadState((currentState) => {
      if (!currentState.active && currentState.pending === 0) {
        return {
          active: true,
          total: incomingFiles.length,
          processed: 0,
          pending: incomingFiles.length,
          failed: 0,
          currentFileName: incomingFiles[0]?.name ?? '',
        };
      }

      return {
        ...currentState,
        active: true,
        total: currentState.total + incomingFiles.length,
        pending: currentState.pending + incomingFiles.length,
      };
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    await processUploadQueue({
      queueRef,
      processingRef,
      sessionRef,
      setUploadState,
      appendItems,
      transformUpload,
    });
  }

  function clearUploadQueue({ sessionRef, queueRef, setUploadState, fileInputRef }) {
    sessionRef.current += 1;
    queueRef.current = [];
    setUploadState(INITIAL_UPLOAD_QUEUE_STATE);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function getDonTemplateImage() {
    if (!donTemplateImagePromiseRef.current) {
      donTemplateImagePromiseRef.current = loadImage(DON_TEMPLATE_SRC);
    }

    return donTemplateImagePromiseRef.current;
  }

  function updateCardQty(id, nextValue) {
    const qty = normalizeQuantity(nextValue);
    setCards((currentCards) =>
      currentCards.map((card) => (card.id === id ? { ...card, qty } : card)),
    );
  }

  function updateDonQty(id, nextValue) {
    const qty = normalizeQuantity(nextValue);
    setDonCards((currentCards) =>
      currentCards.map((card) => (card.id === id ? { ...card, qty } : card)),
    );
  }

  function removeCard(id) {
    cardPdfAssetCacheRef.current.delete(id);
    setCards((currentCards) => currentCards.filter((card) => card.id !== id));
  }

  function removeDonCard(id) {
    donPdfAssetCacheRef.current.delete(id);
    setDonCards((currentCards) => currentCards.filter((card) => card.id !== id));
  }

  function clearCards() {
    clearUploadQueue({
      sessionRef: cardUploadSessionRef,
      queueRef: cardUploadQueueRef,
      setUploadState: setCardUploadQueueState,
      fileInputRef: cardFileInputRef,
    });
    cardPdfAssetCacheRef.current.clear();
    setCards([]);
  }

  function clearDonCards() {
    clearUploadQueue({
      sessionRef: donUploadSessionRef,
      queueRef: donUploadQueueRef,
      setUploadState: setDonUploadQueueState,
      fileInputRef: donFileInputRef,
    });
    donPdfAssetCacheRef.current.clear();
    setDonCards([]);
  }

  function updateDonCard(id, updater) {
    setDonCards((currentCards) =>
      currentCards.map((card) => {
        if (card.id !== id) {
          return card;
        }

        donPdfAssetCacheRef.current.delete(id);
        return updater(card);
      }),
    );
  }

  function updateDonZoom(id, nextValue) {
    updateDonCard(id, (card) => clampDonCardState(card, { zoom: nextValue }));
  }

  function updateDonOffset(id, axis, nextValue) {
    updateDonCard(id, (card) =>
      axis === 'x'
        ? clampDonCardState(card, { offsetX: nextValue })
        : clampDonCardState(card, { offsetY: nextValue }),
    );
  }

  function resetDonFrame(id) {
    updateDonCard(id, (card) =>
      clampDonCardState(card, {
        zoom: MIN_DON_ZOOM,
        offsetX: 0,
        offsetY: 0,
      }),
    );
  }

  async function getCardPdfAsset(card) {
    const cachedAsset = cardPdfAssetCacheRef.current.get(card.id);

    if (cachedAsset) {
      return cachedAsset;
    }

    const preparedAsset = await preparePdfAsset(card);
    cardPdfAssetCacheRef.current.set(card.id, preparedAsset);
    return preparedAsset;
  }

  async function prepareDonPdfAsset(card) {
    const [image, template] = await Promise.all([loadImage(card.src), getDonTemplateImage()]);
    const metrics = getDonRenderMetrics(card);
    const canvas = document.createElement('canvas');
    canvas.width = DON_TEMPLATE_WIDTH;
    canvas.height = DON_TEMPLATE_HEIGHT;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is not available in this browser.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, DON_TEMPLATE_WIDTH, DON_TEMPLATE_HEIGHT);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      (DON_TEMPLATE_WIDTH - metrics.drawWidth) / 2 + card.offsetX,
      (DON_TEMPLATE_HEIGHT - metrics.drawHeight) / 2 + card.offsetY,
      metrics.drawWidth,
      metrics.drawHeight,
    );
    context.drawImage(template, 0, 0, DON_TEMPLATE_WIDTH, DON_TEMPLATE_HEIGHT);

    return {
      alias: `don-${card.id}`,
      format: 'JPEG',
      src: canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY),
    };
  }

  async function getDonPdfAsset(card) {
    const cachedAsset = donPdfAssetCacheRef.current.get(card.id);

    if (cachedAsset) {
      return cachedAsset;
    }

    const preparedAsset = await prepareDonPdfAsset(card);
    donPdfAssetCacheRef.current.set(card.id, preparedAsset);
    return preparedAsset;
  }

  async function renderPdf(items, getAsset, fileName) {
    const doc = new jsPDF({
      compress: true,
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const totalGridWidth = GRID_COLUMNS * CARD_WIDTH_MM + (GRID_COLUMNS - 1) * CARD_GAP_MM;
    const totalGridHeight = GRID_ROWS * CARD_HEIGHT_MM + (GRID_ROWS - 1) * CARD_GAP_MM;
    const startX = (PAGE_WIDTH_MM - totalGridWidth) / 2;
    const startY = (PAGE_HEIGHT_MM - totalGridHeight) / 2;
    const pdfAssets = new Map(
      await Promise.all(items.map(async (item) => [item.id, await getAsset(item)])),
    );
    const printQueue = items.flatMap((item) =>
      Array.from({ length: item.qty }, () => ({
        ...pdfAssets.get(item.id),
        id: item.id,
      })),
    );

    for (let index = 0; index < printQueue.length; index += 1) {
      if (index > 0 && index % CARDS_PER_PAGE === 0) {
        doc.addPage();
      }

      const position = index % CARDS_PER_PAGE;
      const col = position % GRID_COLUMNS;
      const row = Math.floor(position / GRID_COLUMNS);
      const x = startX + col * (CARD_WIDTH_MM + CARD_GAP_MM);
      const y = startY + row * (CARD_HEIGHT_MM + CARD_GAP_MM);
      const currentCard = printQueue[index];

      doc.addImage(
        currentCard.src,
        currentCard.format,
        x,
        y,
        CARD_WIDTH_MM,
        CARD_HEIGHT_MM,
        currentCard.alias,
        'MEDIUM',
      );
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.1);
      doc.setLineDashPattern([1, 1], 0);

      if (col < GRID_COLUMNS - 1) {
        const guideX = x + CARD_WIDTH_MM + CARD_GAP_MM / 2;
        doc.line(guideX, y, guideX, y + CARD_HEIGHT_MM);
      }

      if (row < GRID_ROWS - 1) {
        const guideY = y + CARD_HEIGHT_MM + CARD_GAP_MM / 2;
        doc.line(x, guideY, x + CARD_WIDTH_MM, guideY);
      }
    }

    doc.save(fileName);
  }

  async function generateCardPdf() {
    if (cards.length === 0) {
      window.alert(PAGE_COPY[PAGE_STANDARD].emptyStateMessage);
      return;
    }

    setIsGeneratingCardPdf(true);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      await renderPdf(cards, getCardPdfAsset, PAGE_COPY[PAGE_STANDARD].fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PDF error.';
      window.alert(`Error generating PDF: ${message}`);
    } finally {
      setIsGeneratingCardPdf(false);
    }
  }

  async function generateDonPdf() {
    if (donCards.length === 0) {
      window.alert(PAGE_COPY[PAGE_CUSTOM_DON].emptyStateMessage);
      return;
    }

    setIsGeneratingDonPdf(true);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      await renderPdf(donCards, getDonPdfAsset, PAGE_COPY[PAGE_CUSTOM_DON].fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PDF error.';
      window.alert(`Error generating PDF: ${message}`);
    } finally {
      setIsGeneratingDonPdf(false);
    }
  }

  return (
    <>
      <a className="floating-help" href={HELP_LINK}>
        <span className="floating-help-label">Help!</span>
        <span className="floating-help-text">Proxy Images can be found here</span>
      </a>

      <div className="container">
        <header>
          <div className="page-switcher" aria-label="Creator pages">
            <button
              type="button"
              className={`page-tab ${activePage === PAGE_STANDARD ? 'active' : ''}`}
              onClick={() => navigateToPage(PAGE_STANDARD)}
            >
              Standard Cards
            </button>
            <button
              type="button"
              className={`page-tab ${activePage === PAGE_CUSTOM_DON ? 'active' : ''}`}
              onClick={() => navigateToPage(PAGE_CUSTOM_DON)}
            >
              Custom DON!!
            </button>
            <button
              type="button"
              className={`page-tab ${activePage === PAGE_ONE_PIECE_PROXY ? 'active' : ''}`}
              onClick={() => navigateToPage(PAGE_ONE_PIECE_PROXY)}
            >
              One Piece Proxy Tool
            </button>
          </div>

          <h1>{pageCopy.title}</h1>
          <p>{pageCopy.subtitle}</p>
        </header>

        {isLegacyPage ? (
          <>
            <div className="controls-panel" data-section-label={pageCopy.panelLabel}>
              <div className="controls">
                {activePage === PAGE_STANDARD ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-upload"
                      onClick={() => cardFileInputRef.current?.click()}
                    >
                      <span>{PAGE_COPY[PAGE_STANDARD].addLabel}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-generate"
                      onClick={generateCardPdf}
                      disabled={currentUploadState.active}
                    >
                      <span>{PAGE_COPY[PAGE_STANDARD].downloadLabel}</span>
                    </button>
                    <button type="button" className="btn btn-clear" onClick={clearCards}>
                      <span>{PAGE_COPY[PAGE_STANDARD].clearLabel}</span>
                    </button>
                    <input
                      ref={cardFileInputRef}
                      type="file"
                      id="card-file-input"
                      multiple
                      accept="image/*"
                      onChange={(event) =>
                        handleFiles(event.target.files, {
                          queueRef: cardUploadQueueRef,
                          sessionRef: cardUploadSessionRef,
                          setUploadState: setCardUploadQueueState,
                          processingRef: isProcessingCardUploadQueueRef,
                          appendItems: (loadedItems) =>
                            setCards((currentCards) => [...currentCards, ...loadedItems]),
                          transformUpload: (upload) => upload,
                          fileInputRef: cardFileInputRef,
                        })
                      }
                    />
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-upload"
                      onClick={() => donFileInputRef.current?.click()}
                    >
                      <span>{PAGE_COPY[PAGE_CUSTOM_DON].addLabel}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-generate"
                      onClick={generateDonPdf}
                      disabled={currentUploadState.active}
                    >
                      <span>{PAGE_COPY[PAGE_CUSTOM_DON].downloadLabel}</span>
                    </button>
                    <button type="button" className="btn btn-clear" onClick={clearDonCards}>
                      <span>{PAGE_COPY[PAGE_CUSTOM_DON].clearLabel}</span>
                    </button>
                    <input
                      ref={donFileInputRef}
                      type="file"
                      id="don-file-input"
                      multiple
                      accept="image/*"
                      onChange={(event) =>
                        handleFiles(event.target.files, {
                          queueRef: donUploadQueueRef,
                          sessionRef: donUploadSessionRef,
                          setUploadState: setDonUploadQueueState,
                          processingRef: isProcessingDonUploadQueueRef,
                          appendItems: (loadedItems) =>
                            setDonCards((currentCards) => [...currentCards, ...loadedItems]),
                          transformUpload: createDonCard,
                          fileInputRef: donFileInputRef,
                        })
                      }
                    />
                  </>
                )}
              </div>

              {pageCopy.helperText ? <p className="panel-helper">{pageCopy.helperText}</p> : null}
            </div>

            {currentUploadState.active ? (
              <div id="loading">
                <div className="loading-title">Loading images in queue...</div>
                <div className="loading-meta">
                  Processed {currentUploadState.processed} of {currentUploadState.total} | Remaining{' '}
                  {currentUploadState.pending}
                </div>
                {currentUploadState.currentFileName ? (
                  <div className="loading-current">Current file: {currentUploadState.currentFileName}</div>
                ) : null}
              </div>
            ) : null}

            {currentIsGeneratingPdf ? (
              <div id="pdf-loading">
                <div className="pdf-loading-spinner" />
              </div>
            ) : null}

            <div className="stats" id="stats-info" data-section-label="PRINT STATUS">
              Total cards: {totalCards} | A4 sheets needed: {totalSheets}
            </div>

            <div id="preview-area" className={activePage === PAGE_CUSTOM_DON ? 'don-preview-area' : ''}>
              {activePage === PAGE_STANDARD
                ? cards.map((card, index) => (
                    <CardPreview
                      key={card.id}
                      card={card}
                      index={index}
                      onQtyChange={updateCardQty}
                      onRemove={removeCard}
                    />
                  ))
                : donCards.map((card, index) => (
                    <DonPreview
                      key={card.id}
                      card={card}
                      index={index}
                      templateSrc={DON_TEMPLATE_SRC}
                      onQtyChange={updateDonQty}
                      onRemove={removeDonCard}
                      onReset={resetDonFrame}
                      onZoomChange={updateDonZoom}
                      onOffsetChange={updateDonOffset}
                    />
                  ))}
            </div>
          </>
        ) : (
          <OnePieceProxyTool />
        )}
      </div>

      <footer>
        <div className="footer-content">
          <span className="footer-title">Created by Hobi94S</span>
          <a href="https://github.com/Hobi94S" target="_blank" rel="noreferrer" className="btn btn-github">
            <svg
              height="10"
              width="20"
              viewBox="0 0 16 16"
              fill="currentColor"
              style={{ marginRight: '8px', position: 'relative', zIndex: 1 }}
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>Access Github</span>
          </a>
        </div>
      </footer>
    </>
  );
}
