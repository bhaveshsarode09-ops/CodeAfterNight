/**
 * Barcode & Synthetic ISBT-128 Mock Unit Scanner Service
 *
 * CRITICAL NON-CLINICAL SAFETY DISCLAIMER:
 * This scanner module reads synthetic barcode and QR encodings on fictional blood-unit test labels.
 * Ordinary camera optical frames DO NOT analyze serological blood group, expiry validity,
 * viral safety markers, or transfusion authorization.
 * Manual DIN entry is provided as a resilient fallback.
 */

export const SCANNER_SAFETY_NOTICE =
  'TEST LABEL SCANNER ONLY: Camera vision decodes synthetic barcode/QR data only. Camera images DO NOT analyze or verify blood group antigens, biological safety, sterility, or clinical release status.';

export interface ParsedScannedUnit {
  din: string;
  normalizedId?: string;
  rawText: string;
  source: 'camera_qr' | 'camera_barcode' | 'manual_fallback' | 'quick_test_tap';
}

/**
 * Extracts and normalizes synthetic DIN or Unit ID from scanned text
 */
export function parseScannedBarcode(raw: string, source: ParsedScannedUnit['source'] = 'manual_fallback'): ParsedScannedUnit | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  // Pattern 1: ISBT-128 standard synthetic DIN e.g. =W1234260010400= or W1234-26-00104
  const isbtMatch = cleaned.match(/=?W123426(\d{5})\d*=?/i);
  if (isbtMatch) {
    const num = parseInt(isbtMatch[1], 10);
    return {
      din: cleaned.startsWith('=') ? cleaned : `=${cleaned}=`,
      normalizedId: `VS-U-${num}`,
      rawText: cleaned,
      source,
    };
  }

  // Pattern 2: Unit ID format e.g. VS-U-104
  const vsMatch = cleaned.match(/VS-U-(\d+)/i);
  if (vsMatch) {
    const num = parseInt(vsMatch[1], 10);
    return {
      din: `=W123426${String(num).padStart(5, '0')}00=`,
      normalizedId: `VS-U-${num}`,
      rawText: cleaned,
      source,
    };
  }

  // Fallback for general text
  return {
    din: cleaned,
    normalizedId: cleaned,
    rawText: cleaned,
    source,
  };
}

/**
 * Generates high-fidelity SVG mock Code-128 bar pattern for synthetic blood label
 */
export function generateBarcodeSvgBars(data: string): string {
  // Generate pseudo-deterministic bar widths from string hash
  const bars: { width: number; fill: boolean }[] = [];
  bars.push({ width: 3, fill: true });
  bars.push({ width: 2, fill: false });
  bars.push({ width: 2, fill: true });
  bars.push({ width: 1, fill: false });

  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    const pattern = (charCode * 7 + i * 13) % 16;
    for (let b = 0; b < 4; b++) {
      const isBlack = ((pattern >> b) & 1) === 1;
      const width = ((charCode + b) % 3) + 1;
      bars.push({ width, fill: isBlack });
    }
  }

  // Stop pattern
  bars.push({ width: 3, fill: true });
  bars.push({ width: 1, fill: false });
  bars.push({ width: 4, fill: true });

  let x = 0;
  const rects: string[] = [];
  for (const bar of bars) {
    if (bar.fill) {
      rects.push(`<rect x="${x}" y="0" width="${bar.width}" height="42" fill="#0f172a" />`);
    }
    x += bar.width;
  }

  return `<svg viewBox="0 0 ${x} 42" preserveAspectRatio="none" class="w-full h-11">${rects.join('')}</svg>`;
}
