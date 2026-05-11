# Proxy Card Standard Creator

A React-based proxy sheet generator for TCG cards with the same manga-inspired UI and PDF output behavior as the original single-file version.

## What It Does

- Upload multiple card images at once
- Set how many copies of each card should be printed
- Preview the card list in upload order
- See the total card count and estimated A4 sheet count
- Generate an A4 landscape PDF with:
  - 4 columns x 2 rows
  - 63mm x 88mm card size
  - 4mm spacing
  - dotted cut guides between cards

All image processing and PDF generation still happen locally in the browser.

## Stack

- Node.js
- React
- Vite
- jsPDF

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm start
```

3. Open the local URL shown by Vite in your browser.

Important: this is now a React app served by Vite. Opening the root `index.html` directly like the old version will not run the app logic.

## Production Build

Build the app:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

- `index.html`: Vite entry HTML
- `src/main.jsx`: React bootstrap
- `src/App.jsx`: main app logic and PDF generation
- `src/components/CardPreview.jsx`: individual card preview UI
- `src/styles.css`: app styling

## Technical Settings

If you want to change the output layout, edit the constants near the top of `src/App.jsx`:

```js
const CARD_WIDTH = 63;
const CARD_HEIGHT = 88;
const COLS = 4;
const ROWS = 2;
const GAP = 4;
```
