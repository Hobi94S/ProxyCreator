export const CARD_WIDTH_MM = 63;
export const CARD_HEIGHT_MM = 88;
export const PAGE_WIDTH_MM = 297;
export const PAGE_HEIGHT_MM = 210;
export const GRID_COLUMNS = 4;
export const GRID_ROWS = 2;
export const CARDS_PER_PAGE = GRID_COLUMNS * GRID_ROWS;
export const CARD_GAP_MM = 4;
export const PDF_TARGET_DPI = 300;
export const MM_PER_INCH = 25.4;

export function mmToPixels(mm, dpi = PDF_TARGET_DPI) {
  return Math.round((mm / MM_PER_INCH) * dpi);
}
