import {
  isUsCountryCode,
  normalizeCountryCode,
  validateUsWholesaleIndexGeo,
} from '../search/us-geo.util';

/** Required CSV headers for wholesale catalog ingress. */
export const WHOLESALE_CATALOG_CSV_HEADERS = [
  'product_name',
  'price',
  'stock',
  'moq',
  'country_code',
  'location_data',
] as const;

export type WholesaleCatalogCsvHeader =
  (typeof WHOLESALE_CATALOG_CSV_HEADERS)[number];

export type ParsedLocationData = {
  latitude: number;
  longitude: number;
};

/** Row mapped onto wholesale_products create fields (+ geo gate). */
export type WholesaleCatalogCsvMappedRow = {
  name: string;
  /** USD unit price from CSV `price`, converted to integer cents. */
  unitPriceCents: number;
  availableQuantity: number;
  moq: number;
  countryCode: 'US';
  latitude: number | null;
  longitude: number | null;
  /** Defaults when CSV omits packaging/weight. */
  packagingUnit: string;
  weightLbs: number;
  pricingTiers: Array<{ minQty: number; unitPriceCents: number }>;
};

export type WholesaleCatalogCsvRowResult =
  | {
      OK: true;
      ROW_NUMBER: number;
      DATA: WholesaleCatalogCsvMappedRow;
    }
  | {
      OK: false;
      ROW_NUMBER: number;
      ERROR: string;
      RAW?: Record<string, string>;
    };

export type WholesaleCatalogCsvParseResult = {
  STATUS: 'CSV_PARSE_COMPLETED';
  HEADER_OK: boolean;
  TOTAL_ROWS: number;
  VALID_ROWS: WholesaleCatalogCsvMappedRow[];
  ERRORS: Array<{ ROW_NUMBER: number; ERROR: string }>;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result.map((cell) => cell.trim());
}

function splitCsvLines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

/**
 * Parse location_data cell.
 * Accepted: "lat,lng" | "lat, lng" | JSON {"lat":n,"lng"|"lon"|"longitude":n}
 */
export function parseLocationData(
  raw: string | null | undefined,
):
  | { OK: true; DATA: ParsedLocationData | null }
  | { OK: false; ERROR: string } {
  if (raw == null) return { OK: true, DATA: null };
  const trimmed = raw.trim();
  if (!trimmed) return { OK: true, DATA: null };

  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as Record<string, unknown>;
      const lat = Number(json.lat ?? json.latitude);
      const lng = Number(json.lng ?? json.lon ?? json.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { OK: false, ERROR: 'LOCATION_DATA_INVALID_JSON_COORDS' };
      }
      return { OK: true, DATA: { latitude: lat, longitude: lng } };
    } catch {
      return { OK: false, ERROR: 'LOCATION_DATA_INVALID_JSON' };
    }
  }

  const parts = trimmed.split(',').map((part) => part.trim());
  if (parts.length !== 2) {
    return { OK: false, ERROR: 'LOCATION_DATA_INVALID_FORMAT' };
  }
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { OK: false, ERROR: 'LOCATION_DATA_INVALID_NUMBERS' };
  }
  return { OK: true, DATA: { latitude: lat, longitude: lng } };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Map one CSV object row → wholesale_products fields.
 * Rejects missing required fields, non-US country_code, invalid location.
 */
export function mapWholesaleCatalogCsvRow(
  row: Record<string, string>,
  rowNumber: number,
): WholesaleCatalogCsvRowResult {
  const productName = (row.product_name ?? '').trim();
  const priceRaw = (row.price ?? '').trim();
  const stockRaw = (row.stock ?? '').trim();
  const moqRaw = (row.moq ?? '').trim();
  const countryRaw = (row.country_code ?? '').trim();
  const locationRaw = (row.location_data ?? '').trim();

  if (!productName) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: PRODUCT_NAME REQUIRED',
      RAW: row,
    };
  }
  if (!priceRaw) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: PRICE REQUIRED',
      RAW: row,
    };
  }
  if (!stockRaw) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: STOCK REQUIRED',
      RAW: row,
    };
  }
  if (!moqRaw) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: MOQ REQUIRED',
      RAW: row,
    };
  }
  if (!countryRaw) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: COUNTRY_CODE REQUIRED',
      RAW: row,
    };
  }

  if (!isUsCountryCode(countryRaw)) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: `CSV_VALIDATION_ERROR: COUNTRY_CODE MUST BE US GOT=${normalizeCountryCode(countryRaw) ?? 'UNKNOWN'}`,
      RAW: row,
    };
  }

  const priceUsd = Number(priceRaw);
  if (!Number.isFinite(priceUsd) || priceUsd < 0) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: PRICE INVALID',
      RAW: row,
    };
  }
  const unitPriceCents = Math.round(priceUsd * 100);
  if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: PRICE CENTS INVALID',
      RAW: row,
    };
  }

  const stock = Number(stockRaw);
  if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: STOCK INVALID',
      RAW: row,
    };
  }

  const moq = Number(moqRaw);
  if (!Number.isFinite(moq) || !Number.isInteger(moq) || moq < 1) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: MOQ INVALID',
      RAW: row,
    };
  }

  const location = parseLocationData(locationRaw);
  if (!location.OK) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: `CSV_VALIDATION_ERROR: ${location.ERROR}`,
      RAW: row,
    };
  }

  const geo = validateUsWholesaleIndexGeo({
    country: 'US',
    latitude: location.DATA?.latitude ?? null,
    longitude: location.DATA?.longitude ?? null,
  });
  if (!geo.OK) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: `CSV_VALIDATION_ERROR: ${geo.REASON}`,
      RAW: row,
    };
  }

  const packagingUnit = (row.packaging_unit ?? 'EACH').trim().toUpperCase() || 'EACH';
  const weightRaw = (row.weight_lbs ?? '').trim();
  const weightLbs = weightRaw ? Number(weightRaw) : 1;
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) {
    return {
      OK: false,
      ROW_NUMBER: rowNumber,
      ERROR: 'CSV_VALIDATION_ERROR: WEIGHT_LBS INVALID',
      RAW: row,
    };
  }

  return {
    OK: true,
    ROW_NUMBER: rowNumber,
    DATA: {
      name: productName.slice(0, 200),
      unitPriceCents,
      availableQuantity: stock,
      moq,
      countryCode: 'US',
      latitude: geo.LATITUDE,
      longitude: geo.LONGITUDE,
      packagingUnit: packagingUnit.slice(0, 64),
      weightLbs,
      pricingTiers: [],
    },
  };
}

/**
 * Parse vendor-uploaded wholesale catalog CSV text into mapped rows.
 * Strict: rejects bad headers, missing required fields, non-US, bad location.
 */
export function parseWholesaleCatalogCsv(
  csvText: string,
): WholesaleCatalogCsvParseResult {
  const lines = splitCsvLines(csvText);
  if (lines.length === 0) {
    return {
      STATUS: 'CSV_PARSE_COMPLETED',
      HEADER_OK: false,
      TOTAL_ROWS: 0,
      VALID_ROWS: [],
      ERRORS: [{ ROW_NUMBER: 0, ERROR: 'CSV_VALIDATION_ERROR: EMPTY_FILE' }],
    };
  }

  const headerCells = parseCsvLine(lines[0]!).map(normalizeHeader);
  const required = [...WHOLESALE_CATALOG_CSV_HEADERS];
  const missing = required.filter((header) => !headerCells.includes(header));
  if (missing.length > 0) {
    return {
      STATUS: 'CSV_PARSE_COMPLETED',
      HEADER_OK: false,
      TOTAL_ROWS: 0,
      VALID_ROWS: [],
      ERRORS: [
        {
          ROW_NUMBER: 1,
          ERROR: `CSV_VALIDATION_ERROR: MISSING_HEADERS ${missing.join(',').toUpperCase()}`,
        },
      ],
    };
  }

  const validRows: WholesaleCatalogCsvMappedRow[] = [];
  const errors: Array<{ ROW_NUMBER: number; ERROR: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    for (let c = 0; c < headerCells.length; c++) {
      row[headerCells[c]!] = cells[c] ?? '';
    }
    const mapped = mapWholesaleCatalogCsvRow(row, i + 1);
    if (mapped.OK) {
      validRows.push(mapped.DATA);
    } else {
      errors.push({ ROW_NUMBER: mapped.ROW_NUMBER, ERROR: mapped.ERROR });
    }
  }

  return {
    STATUS: 'CSV_PARSE_COMPLETED',
    HEADER_OK: true,
    TOTAL_ROWS: Math.max(0, lines.length - 1),
    VALID_ROWS: validRows,
    ERRORS: errors,
  };
}
