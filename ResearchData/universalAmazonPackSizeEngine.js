/**
 * ============================================================================
 *  UNIVERSAL AMAZON PACK SIZE EXTRACTION ENGINE
 * ============================================================================
 *
 *  Standalone, zero-dependency JavaScript. Copy this file (or this whole
 *  folder) into any other tool. Works in Node.js (CommonJS) and in the
 *  browser (global). This folder has its own package.json ("type": "commonjs")
 *  so it still runs if the parent project is ESM.
 *
 *  This is the complete Amazon pack-size extractor: every signal, every
 *  false-positive mask, every inner-count rule, and the Lysol-priority
 *  inner-count resolver. Nothing from the production Amazon engine is omitted.
 *
 *  Public API
 *    extractAmazonPackSize(amazonData)  — outer bundle pack size (default 1)
 *    extractInnerCount(amazonData)      — what's inside one listing unit
 *    extractPackFromText(text, prefix)  — title/size pack-count signals
 *    maskFalsePositives(title)          — strip 3-in-1, 2-ply, oz, dims, etc.
 *    normalizeText(str)                 — HTML entities / whitespace
 *    analyzeAmazonListing(input)        — unwraps scrape / catalog shapes
 *    analyzeAmazonListings(data)        — batch over arrays or scrape JSON
 *
 *  Design
 *    - Default outer pack size = 1 when nothing says otherwise
 *    - Every signal has a confidence weight; winner is highest confidence
 *    - False-positive masking is aggressive
 *    - Inner count is independent of outer pack (Lysol: numberOfItems first)
 *
 *  Expected input (any extra fields are ignored)
 *    {
 *      success?: boolean,          // false → no_data result
 *      title?: string,
 *      size?: string,              // catalog size, e.g. "12.5 Ounce (Pack of 2)"
 *      packageQuantity?: number,
 *      numberOfItems?: number,
 *      unitCount?: string|number,
 *      specs?: { item_package_quantity?: string|number, ... },
 *      productTypes?: string[]
 *    }
 *
 *  Usage (Node)
 *    const engine = require('./universalAmazonPackSizeEngine');
 *    const result = engine.extractAmazonPackSize({
 *      success: true,
 *      title: 'Lysol Disinfectant Spray',
 *      size: '12.5 Ounce (Pack of 2)',
 *      packageQuantity: 1,
 *      numberOfItems: 2,
 *      unitCount: '25 Ounce',
 *      specs: {},
 *    });
 *    // result.packSize === 2, result.innerCount === 2
 *
 *  Usage (browser)
 *    <script src="universalAmazonPackSizeEngine.js"></script>
 *    const result = UniversalAmazonPackSizeEngine.extractAmazonPackSize({...});
 *
 * ============================================================================
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Amazon volume/weight/measurement unit tokens that should NOT be treated as pack qty.
 * e.g. "38 fl oz" → 38 is volume, not pack.
 */
const MEASUREMENT_UNITS = new Set([
  'oz', 'fl', 'floz', 'lb', 'lbs', 'kg', 'g', 'mg', 'ml', 'l', 'liter', 'liters',
  'gallon', 'gallons', 'gal', 'quart', 'quarts', 'qt', 'pint', 'pints', 'pt',
  'inch', 'inches', 'in', 'ft', 'feet', 'foot', 'cm', 'mm', 'm', 'meter', 'meters',
  'yard', 'yards', 'yd', 'sqft', 'sq',
  'watt', 'watts', 'w', 'volt', 'volts', 'v', 'amp', 'amps', 'mah',
  'sheet', 'sheets', 'ply', 'mega', 'super', 'regular', 'double', 'triple', 'big',
  'year', 'years', 'month', 'months', 'day', 'days', 'hour', 'hours', 'hr', 'hrs',
  'gb', 'tb', 'mb', 'kb',
]);

/**
 * Words that appear BEFORE a number and indicate it's NOT a pack count.
 * e.g. "saves up to 5x more" or "lasts 3x longer"
 */
const NON_PACK_PREFIXES = new Set([
  'model', 'version', 'edition', 'generation', 'gen', 'series', 'grade', 'level',
  'step', 'phase', 'stage', 'chapter', 'part', 'volume', 'vol', 'no', 'number',
  '#', 'size', 'type',
]);

const VOLUME_INNER_TYPES = new Set(['fl_oz', 'ml', 'l', 'gal', 'qt', 'pt']);

const NAMED_PACKS = {
  single: 1,
  twin: 2,
  double: 2,
  dual: 2,
  triple: 3,
  quad: 4,
  quintuple: 5,
  'half dozen': 6,
  dozen: 12,
};

const ENGINE_VERSION = '1.2.1-universal';

/** Catalog fields that default to 1 when Amazon did not set a multi-pack. */
const CATALOG_QTY_SOURCES = new Set(['packageQuantity', 'specs.item_package_quantity']);

/** Explicit sell-pack phrases outrank a filled catalog quantity and an inner-count override. */
const EXPLICIT_SELL_PACK_CONFIDENCE = 98;

const WORD_QTY = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  'twenty-four': 24,
  'twenty four': 24,
};

const PER_CONTAINER_UNIT =
  'bag|bags|bg|box|boxes|bx|case|cases|cs|pack|packs|pk|carton|cartons|ca';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: TEXT NORMALIZATION & FALSE-POSITIVE MASKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a string for pattern matching: decode HTML entities, collapse
 * whitespace. Does not lowercase (callers lower as needed).
 */
function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&reg;/gi, '')
    .replace(/&trade;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\u00ae|\u2122|\u00a9/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mask title/size segments that look like pack counts but are not.
 * Replaces them with placeholder tokens so pack regexes will not pick them up.
 *
 * False positives masked:
 *   - "3-in-1", "4-in-1", "2in1" (product features, not packs)
 *   - "2-ply", "3-ply" (tissue/paper thickness)
 *   - Dimensions: "8.5x11", "12 x 9"
 *   - Volume/weight: "38 fl oz", "90oz", "2.69 LBS"
 *   - Equivalence statements: "12 Mega Rolls = 24 Regular Rolls"
 *   - Multiplier marketing: "50% less", "2x more", "3x longer"
 */
function maskFalsePositives(title) {
  if (!title) return '';
  let masked = title;

  // 1) X-in-1 / X in 1 / Xin1 patterns (product formulas)
  masked = masked.replace(/\b(\d+)\s*[-]?\s*in\s*[-]?\s*(\d+)\b/gi, '__FEATURE_$1_IN_$2__');

  // 2) X-ply (tissue thickness)
  masked = masked.replace(/\b(\d+)\s*[-]?\s*ply\b/gi, '__PLY_$1__');

  // 3) Equivalence statements: "12 Mega Rolls = 24 Regular Rolls"
  masked = masked.replace(
    /\b(\d+)\s*(mega|super|double|triple|big|giant|family|jumbo)\s*(rolls?|sheets?)?\s*[=]\s*(\d+)\s*(regular|standard|single|normal)?\s*(rolls?|sheets?)?\b/gi,
    '__EQUIV_$1_$4__',
  );

  // 4) Percentage patterns: "50% less", "100% biodegradable"
  masked = masked.replace(/\b(\d+(?:\.\d+)?)\s*%/g, '__PCT_$1__');

  // 5) Multiplier marketing: "2x more", "3x longer", "5x cleaning"
  masked = masked.replace(
    /\b(\d+)\s*x\s+(more|less|longer|faster|stronger|better|thicker|cleaning|power|absorbent|concentrated)\b/gi,
    '__MULT_$1__',
  );

  // 6) Dimensions: "8.5 x 11", "12x9", "3.5 x 2.5 x 1"
  //    But NOT "2 x 38 fl oz" (that IS a pack pattern — handled separately)
  masked = masked.replace(
    /\b(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\b/gi,
    '__DIM_$1x$2x$3__',
  );
  masked = masked.replace(
    /\b(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(?=(?:inch|inches|in|cm|mm|ft|feet|"|')\b)/gi,
    '__DIM_$1x$2__',
  );

  // 7) Volume/weight: "38 fl oz", "38oz", "2.69 LBS", "1.2 quart"
  masked = masked.replace(
    /\b(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?(?:oz|ounces?|fl\.?\s*oz|floz)\b/gi,
    '__VOL_$1_OZ__',
  );
  masked = masked.replace(
    /\b(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kilograms?|kg|grams?|g|mg|milligrams?)\b/gi,
    '__WT_$1__',
  );
  masked = masked.replace(
    /\b(\d+(?:\.\d+)?)\s*(?:ml|liters?|l|gallons?|gal|quarts?|qt|pints?|pt)\b/gi,
    '__VOL_$1__',
  );
  masked = masked.replace(
    /\b(\d+(?:\.\d+)?)\s*(?:inches?|inch|in|feet|ft|foot|cm|mm|meters?|m|yards?|yd)\b/gi,
    '__MEAS_$1__',
  );

  return masked;
}

/**
 * True when quantity N is the inner piece count in the title, not the outer pack.
 * e.g. packageQuantity=100 + title "BAND-AID ... 100 Count" → inner, pack=1.
 */
function isPiecesPerContainer(n, text) {
  const re = new RegExp(
    `\\b${n}\\s*(?:pcs?|pieces?)\\s*/\\s*(?:${PER_CONTAINER_UNIT})\\b`,
    'i',
  );
  return re.test(String(text || ''));
}

function isInnerCountMistake(n, title) {
  if (n <= 1) return false;
  // "4 Pcs/Box" is the sell pack, not an inner count inside one unit.
  if (isPiecesPerContainer(n, title)) return false;
  const innerPatterns = [
    new RegExp(
      `\\b${n}\\s*(?:ct|count|pcs?|pieces?|sheets?|plates?|cups?|packets?|napkins?|bandages?|pads?|tablets?|capsules?)\\b`,
      'i',
    ),
    new RegExp(
      `\\b${n}\\s*(?:ct|count)\\.?\\s*(?:tub|box|bag|bottle|jar|can|tin|pouch|roll|pack|carton|case)\\b`,
      'i',
    ),
    new RegExp(
      `\\bpack\\s+of\\s+${n}\\s+(?:plates?|napkins?|sheets?|cups?|spoons?|forks?|straws?|packets?|capsules?|tablets?|bandages?|wipes?|pieces?|items?|pads?|filters?|gloves?)\\b`,
      'i',
    ),
  ];
  return innerPatterns.some((re) => re.test(title));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: PACK-COUNT SIGNALS FROM MASKED TEXT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract pack-count signals from a masked title or size string.
 * Returns an array of { source, value, confidence, evidence }.
 */
function extractPackFromText(text, sourcePrefix) {
  if (!text) return [];
  const signals = [];
  const lowerText = text.toLowerCase();

  // Pattern 1: "(Pack of X)" or "Pack of X" — HIGHEST confidence
  {
    const re = /\(?\bpack\s+of\s+(\d+)\)?/gi;
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 1 && val <= 10000) {
        signals.push({
          source: `${sourcePrefix}_pack_of`,
          value: val,
          confidence: 95,
          evidence: `"${m[0]}" → Pack of ${val}`,
        });
      }
    }
  }

  // Pattern 2: "X-Pack", "X Pack", "XPack" (but NOT "X-Packed" or "X Packing")
  {
    const re = /\b(\d+)\s*[-]?\s*pack(?!\w)/gi;
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 2 && val <= 10000) {
        if (!lowerText.includes(`pack of ${val}`)) {
          signals.push({
            source: `${sourcePrefix}_x_pack`,
            value: val,
            confidence: 90,
            evidence: `"${m[0]}" → ${val}-Pack`,
          });
        }
      }
    }
  }

  // Pattern 3: "XPK", "X PK", "X/PK"
  {
    const re = /\b(\d+)\s*[\/]?\s*pk\b/gi;
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 2 && val <= 10000) {
        signals.push({
          source: `${sourcePrefix}_xpk`,
          value: val,
          confidence: 88,
          evidence: `"${m[0]}" → ${val}PK`,
        });
      }
    }
  }

  // Pattern 4: "X/Bag", "X/Box", "X/Pack", "X/BX", "X/CS"
  {
    const re = new RegExp(`\\b(\\d+)\\s*\\/\\s*(${PER_CONTAINER_UNIT})\\b`, 'gi');
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 2 && val <= 10000) {
        signals.push({
          source: `${sourcePrefix}_per_container`,
          value: val,
          confidence: EXPLICIT_SELL_PACK_CONFIDENCE,
          evidence: `"${m[0]}" → ${val} per ${m[2].toUpperCase()}`,
        });
      }
    }
  }

  // Pattern 4a: "X/CT" kept as a weak carton abbreviation (not a count word by itself)
  {
    const re = /\b(\d+)\s*\/\s*ct\b/gi;
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 2 && val <= 10000) {
        signals.push({
          source: `${sourcePrefix}_per_container`,
          value: val,
          confidence: 88,
          evidence: `"${m[0]}" → ${val} per CT`,
        });
      }
    }
  }

  // Pattern 4c: "4 Pcs/Box", "4 Pieces/Bag" — sell pack, not an inner count
  {
    const re = new RegExp(
      `\\b(\\d+)\\s*(?:pcs?|pieces?)\\s*/\\s*(${PER_CONTAINER_UNIT})\\b`,
      'gi',
    );
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 2 && val <= 10000) {
        signals.push({
          source: `${sourcePrefix}_pieces_per_container`,
          value: val,
          confidence: EXPLICIT_SELL_PACK_CONFIDENCE,
          evidence: `"${m[0]}" → ${val} per ${m[2].toUpperCase()}`,
        });
      }
    }
  }

  // Pattern 4b: "2 per bag", "2 ornaments per bag", "two per bag", "includes 3 pieces per bag"
  {
    const wordAlt = Object.keys(WORD_QTY)
      .sort((a, b) => b.length - a.length)
      .join('|');
    const re = new RegExp(
      `\\b(?:includes?\\s+)?(?:(\\d+)|(${wordAlt}))\\s+(?:(?:ornaments?|pieces?|items?|pcs?)\\s+)?per\\s+(${PER_CONTAINER_UNIT})\\b`,
      'gi',
    );
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = m[1] ? parseInt(m[1], 10) : WORD_QTY[m[2].toLowerCase()];
      if (val >= 2 && val <= 10000) {
        signals.push({
          source: `${sourcePrefix}_per_container_phrase`,
          value: val,
          confidence: EXPLICIT_SELL_PACK_CONFIDENCE,
          evidence: `"${m[0]}" → ${val} per ${m[3].toUpperCase()}`,
        });
      }
    }
  }

  // Pattern 5: "Set of X", "Bundle of X", "Box/Bag/Case/Carton of X"
  {
    const re = /\b(?:set|bundle|box|boxes|case|cases|bag|bags|carton|cartons)\s+of\s+(\d+)\b/gi;
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 2 && val <= 10000) {
        signals.push({
          source: `${sourcePrefix}_container_of`,
          value: val,
          confidence: 88,
          evidence: `"${m[0]}" → ${val}`,
        });
      }
    }
  }

  // Pattern 6: "X Piece", "X Pieces", "X Pcs" — lower confidence (often inner)
  {
    const re = /\b(\d+)\s*[-]?\s*(?:pieces?|pcs?|pc)\b/gi;
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 2 && val <= 50) {
        signals.push({
          source: `${sourcePrefix}_pieces`,
          value: val,
          confidence: 70,
          evidence: `"${m[0]}" → ${val} pieces`,
        });
      }
    }
  }

  // Pattern 7: Named packs — "Twin Pack", "Double Pack", "Triple Pack"
  {
    for (const [name, count] of Object.entries(NAMED_PACKS)) {
      const re = new RegExp(`\\b${name}\\s*[-]?\\s*pack\\b`, 'gi');
      if (re.test(lowerText)) {
        signals.push({
          source: `${sourcePrefix}_named_pack`,
          value: count,
          confidence: 92,
          evidence: `"${name} pack" → ${count}`,
        });
      }
    }
  }

  // Pattern 8: "X ct" — ONLY small values, very low confidence (ambiguous)
  {
    const re = /\b(\d+)\s*ct\b/gi;
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 2 && val <= 12) {
        signals.push({
          source: `${sourcePrefix}_small_ct`,
          value: val,
          confidence: 35,
          evidence: `"${m[0]}" → ${val}ct (ambiguous)`,
        });
      }
    }
  }

  return signals;
}

/**
 * Drop catalog quantity=1 signals when title/size already show a multi-pack.
 */
function filterDefaultCatalogOneSignals(signals) {
  const hasMultiPackSignal = signals.some(
    (s) => s.value > 1 && !CATALOG_QTY_SOURCES.has(s.source),
  );
  if (!hasMultiPackSignal) return signals;
  return signals.filter((s) => {
    if (s.value === 1 && CATALOG_QTY_SOURCES.has(s.source)) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: INNER COUNT (Lysol-priority + original size/title fallbacks)
// ─────────────────────────────────────────────────────────────────────────────

function parseUnitCountNumber(unitCount) {
  if (unitCount == null) return null;
  const m = String(unitCount).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function emptyInnerCount() {
  return { count: null, unitType: null, source: null, evidence: null };
}

/**
 * Extract inner count — what's physically inside one Amazon listing unit.
 *
 * Signal priority (highest first):
 *   1. numberOfItems (structured catalog field) — Lysol B01LOC9N9G
 *   2. size-field pack/roll/count patterns, including "(Pack of N)" anywhere
 *   3. unitCount free-text (dropped if it conflicts with numberOfItems/packageQuantity)
 *   4. volume-only size fallback
 *
 * @param {Object} data - Amazon listing fields (size, numberOfItems, unitCount, packageQuantity, title)
 * @returns {{ count: number|null, unitType: string|null, source: string|null, evidence: string|null }}
 */
function extractInnerCount(data) {
  const amazonData = data || {};
  const size = normalizeText(amazonData.size);
  const title = normalizeText(amazonData.title);
  const numberOfItems = amazonData.numberOfItems;
  const unitCountRaw = amazonData.unitCount;
  const unitCount = unitCountRaw == null ? '' : String(unitCountRaw).trim();
  const packageQuantity = amazonData.packageQuantity;

  const isLiquid = /\b(?:fl\s*oz|ounces?|oz|ml|liters?|gallons?|quarts?)\b/i.test(size + ' ' + unitCount);
  const isCountable = /\b(?:count|ct|pods?|pacs?|rolls?|sheets?|napkins?|bandages?|wipes?|tablets?|capsules?|sponges?|erasers?|pads?)\b/i.test(
    size + ' ' + title + ' ' + unitCount,
  );

  // 1. Structured numberOfItems — most reliable
  if (numberOfItems != null && numberOfItems >= 1) {
    return {
      count: numberOfItems,
      unitType: 'count',
      source: 'numberOfItems',
      evidence: `numberOfItems = ${numberOfItems}`,
    };
  }

  // 2. Explicit pack/roll/count patterns in size field
  if (size) {
    const packOfMatch =
      size.match(/\(pack\s+of\s+(\d+)\)/i) ?? size.match(/\bpack\s+of\s+(\d+)\b/i);
    if (packOfMatch) {
      const count = parseInt(packOfMatch[1], 10);
      return {
        count,
        unitType: 'count',
        source: 'size_pack_of',
        evidence: `size field: "${size}" → Pack of ${count}`,
      };
    }

    const rollMatch = size.match(/\b(\d+)\s*rolls?\b/i);
    if (rollMatch) {
      const count = parseInt(rollMatch[1], 10);
      return {
        count,
        unitType: 'rolls',
        source: 'size_rolls',
        evidence: `size field: "${size}"`,
      };
    }

    const countStartMatch = size.match(/^(\d+(?:\.\d+)?)\s*(?:count|ct)\b/i);
    if (countStartMatch) {
      const count = parseFloat(countStartMatch[1]);
      return {
        count,
        unitType: 'count',
        source: 'size_count',
        evidence: `size field: "${size}"`,
      };
    }

    const flozStartMatch = size.match(/^(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz\b/i);
    if (flozStartMatch) {
      const count = parseFloat(flozStartMatch[1]);
      return {
        count,
        unitType: 'fl_oz',
        source: 'size_fl_oz',
        evidence: `size field: "${size}"`,
      };
    }
  }

  // 3. unitCount free-text — drop if it conflicts with structured refs
  if (unitCount) {
    const parsed = parseUnitCountNumber(unitCount);
    if (parsed != null) {
      const trustedRefs = [numberOfItems, packageQuantity].filter(
        (n) => n != null && n >= 1,
      );
      const rounded = Math.round(parsed);
      const conflictsTrusted =
        trustedRefs.length > 0 && !trustedRefs.some((ref) => ref === rounded);
      if (!conflictsTrusted) {
        const isVolume = /\b(?:oz|ounce|fl|ml|liter|gallon|quart|pound|lb)\b/i.test(unitCount);
        const unitType = isVolume ? 'fl_oz' : isCountable ? 'count' : isLiquid ? 'fl_oz' : 'count';
        return {
          count: parsed,
          unitType,
          source: 'unitCount',
          evidence: `unitCount = ${unitCount}`,
        };
      }
    }
  }

  // 4. Volume-only fallback anywhere in size
  if (size) {
    const flozMatch = size.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz\b/i);
    if (flozMatch) {
      const count = parseFloat(flozMatch[1]);
      return {
        count,
        unitType: 'fl_oz',
        source: 'size_volume_fallback',
        evidence: `size field fallback: "${size}"`,
      };
    }
  }

  return emptyInnerCount();
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: OUTER BUNDLE PACK SIZE
// ─────────────────────────────────────────────────────────────────────────────

function noDataResult() {
  return {
    packSize: 1,
    confidence: 0,
    methods: ['no_data'],
    evidence: [],
    allSignals: [],
    innerCount: null,
    innerUnitType: null,
    innerEvidence: null,
    innerSource: null,
    productTypes: [],
    warnings: ['Amazon data missing or unsuccessful'],
    engineVersion: ENGINE_VERSION,
  };
}

/**
 * Extract the OUTER BUNDLE PACK SIZE from an Amazon listing.
 * This is the number of discrete sellable units the customer receives —
 * NOT the inner count of items inside each unit.
 *
 * Examples:
 *   "Dawn Dishwashing Liquid, 38 fl oz"            → packSize = 1
 *   "Dawn Dishwashing Liquid, 38 fl oz, 2 Pack"    → packSize = 2
 *   "BAND-AID Bandages, 100 Count"                 → packSize = 1
 *   "BAND-AID Bandages, 100 Count (Pack of 3)"     → packSize = 3
 *   "Charmin 12 Mega Rolls = 24 Regular Rolls"     → packSize = 1
 *   "Tide Pods, 42 Count, Twin Pack"               → packSize = 2
 *   "Lysol ... 12.5 Ounce (Pack of 2)"             → packSize = 2
 *
 * Signals (all collected, then highest-confidence wins):
 *   1. packageQuantity (structured), unless it is clearly inner piece count
 *   2. specs.item_package_quantity (same inner-count guard)
 *   3. "Pack of N" in the size field
 *   4. Title patterns via extractPackFromText (after false-positive masking)
 *   5. Size-field patterns via extractPackFromText
 *   6. numberOfItems cross-check (boosts packageQuantity; skipped when inner)
 *   7. Title multiplier "2 x 38 fl oz"
 *
 * Defaults to 1 when no pack indicators are found.
 *
 * @param {Object} amazonData
 * @returns {Object} packSize, confidence, methods, evidence, allSignals, inner*, warnings
 */
function extractAmazonPackSize(amazonData) {
  if (!amazonData || amazonData.success === false) {
    return noDataResult();
  }

  const signals = [];
  const warnings = [];

  const title = normalizeText(amazonData.title);
  const size = normalizeText(amazonData.size);
  const listingText = normalizeText(amazonData.listingText || amazonData.description || '');
  const maskedTitle = maskFalsePositives(title);
  const maskedSize = maskFalsePositives(size);
  const maskedListing = maskFalsePositives(listingText);
  const specs = amazonData.specs && typeof amazonData.specs === 'object' ? amazonData.specs : {};
  const productTypes = Array.isArray(amazonData.productTypes) ? amazonData.productTypes : [];

  // ── Signal 1: amazon.packageQuantity (structured field) ──────────────────
  if (amazonData.packageQuantity != null) {
    const pq = parseInt(String(amazonData.packageQuantity), 10);
    if (!Number.isNaN(pq) && pq >= 1) {
      if (pq > 1 && isInnerCountMistake(pq, `${title} ${listingText}`)) {
        signals.push({
          source: 'packageQuantity_inner_piece_count',
          value: 1,
          confidence: 92,
          evidence: `packageQuantity=${pq} is inner count in title → single container (pack=1)`,
        });
      } else {
        const catalogConfidence = pq > 1 ? 97 : 85;
        signals.push({
          source: 'packageQuantity',
          value: pq,
          confidence: catalogConfidence,
          evidence: `packageQuantity = ${pq}`,
        });
      }
    }
  }

  // ── Signal 2: specs.item_package_quantity ─────────────────────────────────
  const ipqRaw = specs.item_package_quantity;
  if (ipqRaw != null) {
    const ipq = parseInt(String(ipqRaw), 10);
    if (!Number.isNaN(ipq) && ipq >= 1) {
      if (ipq > 1 && isInnerCountMistake(ipq, `${title} ${listingText}`)) {
        signals.push({
          source: 'specs.item_package_quantity_inner_piece_count',
          value: 1,
          confidence: 92,
          evidence: `specs.item_package_quantity=${ipq} is inner count in title → single container (pack=1)`,
        });
      } else {
        const catalogConfidence = ipq > 1 ? 97 : 85;
        signals.push({
          source: 'specs.item_package_quantity',
          value: ipq,
          confidence: catalogConfidence,
          evidence: `specs.item_package_quantity = ${ipq}`,
        });
      }
    }
  }

  // ── Signal 3: "Pack of X" in size field ──────────────────────────────────
  {
    const packOfMatch = size.match(/\bpack\s+of\s+(\d+)\b/i);
    if (packOfMatch) {
      const val = parseInt(packOfMatch[1], 10);
      signals.push({
        source: 'size_field_pack_of',
        value: val,
        confidence: 95,
        evidence: `size = "${size}" → Pack of ${val}`,
      });
    }
  }

  // ── Signal 4: Title pattern extraction ───────────────────────────────────
  signals.push(...extractPackFromText(maskedTitle, 'title'));

  // ── Signal 5: Size field pattern extraction ──────────────────────────────
  signals.push(...extractPackFromText(maskedSize, 'size_field'));

  // ── Signal 5b: Bullets / product description (often holds "N per bag") ──
  signals.push(...extractPackFromText(maskedListing, 'listing'));

  // ── Signal 6: numberOfItems cross-check ──────────────────────────────────
  // numberOfItems sometimes = inner count (e.g. 12 rolls) or outer pack.
  // If numberOfItems > 1 and packageQuantity == 1, it is inner count — skip.
  // If they match, boost packageQuantity confidence.
  if (amazonData.numberOfItems != null) {
    const noi = parseInt(String(amazonData.numberOfItems), 10);
    if (!Number.isNaN(noi) && noi >= 1) {
      const pq = parseInt(String(amazonData.packageQuantity ?? 1), 10);
      if (noi > 1 && pq === 1) {
        // inner count, not outer pack — skip
      } else if (noi === pq) {
        const existing = signals.find((s) => s.source === 'packageQuantity');
        if (existing) existing.confidence = Math.min(existing.confidence + 5, 99);
      }
    }
  }

  // ── Signal 7: Multiplier patterns in title: "2 x 38 fl oz" ──────────────
  {
    const multMatch = title.match(
      /\b(\d+)\s*x\s*\d+(?:\.\d+)?\s*(?:fl\.?\s*)?(?:oz|ounces?|floz|ml|liters?|l|lbs?|gallons?|gal|quarts?|qt)\b/i,
    );
    if (multMatch) {
      const val = parseInt(multMatch[1], 10);
      if (val >= 2 && val <= 200) {
        signals.push({
          source: 'title_multiplier',
          value: val,
          confidence: 90,
          evidence: `title multiplier: "${multMatch[0]}" → ${val}`,
        });
      }
    }
  }

  // ── Resolve: pick highest confidence, cross-validate ─────────────────────
  const resolvedSignals = filterDefaultCatalogOneSignals(signals);

  let finalPackSize = 1;
  let finalConfidence = 50;
  let methods = [];
  let evidence = [];

  if (resolvedSignals.length === 0) {
    methods = ['default_1'];
    evidence = ['No pack indicators found; default = 1'];
    finalConfidence = 50;
  } else {
    resolvedSignals.sort((a, b) => b.confidence - a.confidence);

    const topSignal = resolvedSignals[0];
    const agreeingSignals = resolvedSignals.filter((s) => s.value === topSignal.value);
    const disagreeingSignals = resolvedSignals.filter(
      (s) => s.value !== topSignal.value && s.confidence >= 60,
    );

    finalPackSize = topSignal.value;
    finalConfidence = topSignal.confidence;

    if (agreeingSignals.length >= 2) {
      finalConfidence = Math.min(finalConfidence + 5 * (agreeingSignals.length - 1), 99);
    }

    if (disagreeingSignals.length > 0) {
      warnings.push(
        `Conflicting signals: top=${topSignal.value} (${topSignal.source}) vs ` +
          disagreeingSignals.map((s) => `${s.value} (${s.source})`).join(', '),
      );
      finalConfidence = Math.max(finalConfidence - 10, 30);
    }

    methods = agreeingSignals.map((s) => s.source);
    evidence = resolvedSignals.map((s) => s.evidence);
  }

  const innerInfo = extractInnerCount({
    size: amazonData.size,
    title: amazonData.title,
    numberOfItems: amazonData.numberOfItems,
    unitCount: amazonData.unitCount,
    packageQuantity: amazonData.packageQuantity,
    specs: amazonData.specs,
    productTypes,
  });

  return {
    packSize: finalPackSize,
    confidence: finalConfidence,
    methods,
    evidence,
    allSignals: signals,
    innerCount: innerInfo.count,
    innerUnitType: innerInfo.unitType,
    innerEvidence: innerInfo.evidence || innerInfo.source,
    innerSource: innerInfo.source,
    productTypes,
    warnings,
    engineVersion: ENGINE_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: FLEXIBLE INPUT / BATCH HELPERS (for other tools)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce common listing shapes into the Amazon pack-size input object.
 * Accepts a flat listing, { amazon: {...} } scrape rows, or catalog-like objects.
 */
function coerceAmazonInput(input) {
  if (!input || typeof input !== 'object') return { success: false };

  if (input.amazon && typeof input.amazon === 'object' && !Array.isArray(input.amazon)) {
    return coerceAmazonInput(input.amazon);
  }

  const specs =
    input.specs && typeof input.specs === 'object'
      ? input.specs
      : input.attributes && typeof input.attributes === 'object'
        ? input.attributes
        : {};

  return {
    success: input.success !== false,
    title: input.title ?? input.itemName ?? input.name ?? null,
    size: input.size ?? specs.size ?? null,
    packageQuantity:
      input.packageQuantity ??
      input.packQuantity ??
      input.item_package_quantity ??
      specs.item_package_quantity ??
      null,
    numberOfItems:
      input.numberOfItems ??
      input.number_of_items ??
      specs.number_of_items ??
      null,
    unitCount: input.unitCount ?? input.unit_count ?? specs.unit_count ?? null,
    listingText: input.listingText ?? input.description ?? null,
    specs: specs,
    productTypes: Array.isArray(input.productTypes)
      ? input.productTypes
      : Array.isArray(input.product_types)
        ? input.product_types
        : [],
    asin: input.asin ?? null,
    brand: input.brand ?? input.brandName ?? null,
    upc: input.upc ?? input.identifiers?.upc ?? null,
  };
}

/**
 * Run the full Amazon pack-size engine on one listing of any common shape.
 */
function analyzeAmazonListing(input) {
  const amazonData = coerceAmazonInput(input);
  const extracted = extractAmazonPackSize(amazonData);
  return {
    asin: amazonData.asin || input?.asin || null,
    upc: amazonData.upc || input?.upc || null,
    title: amazonData.title,
    size: amazonData.size,
    brand: amazonData.brand || null,
    amazon: extracted,
    summary: {
      packSize: extracted.packSize,
      confidence: extracted.confidence,
      innerCount: extracted.innerCount,
      innerUnitType: extracted.innerUnitType,
      methods: extracted.methods,
      warnings: extracted.warnings,
    },
  };
}

function extractResultRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.listings)) return data.listings;
  if (typeof data === 'object') return [data];
  return [];
}

/**
 * Batch-analyze scrape JSON, an array of listings, or a single listing.
 */
function analyzeAmazonListings(data) {
  return extractResultRows(data).map((row, index) => {
    const analyzed = analyzeAmazonListing(row);
    analyzed.index = index;
    analyzed.id = row.id ?? analyzed.asin ?? index;
    analyzed.vendorModel = row.vendorModel ?? row.vendor_model ?? null;
    return analyzed;
  });
}

function toCompactFormat(rowAnalysis) {
  return {
    asin: rowAnalysis.asin,
    vendorModel: rowAnalysis.vendorModel || null,
    amazonPackSize: rowAnalysis.summary.packSize,
    amazonPackConfidence: rowAnalysis.summary.confidence,
    attributes: {
      upc: rowAnalysis.upc || null,
      amazonTitle: rowAnalysis.title || null,
      amazonSize: rowAnalysis.size || null,
      innerCount: rowAnalysis.summary.innerCount,
      innerUnitType: rowAnalysis.summary.innerUnitType,
      methods: rowAnalysis.amazon.methods,
      warnings: rowAnalysis.summary.warnings || [],
    },
  };
}

function generateCompactSummary(dataOrAnalysis) {
  const analyzed = Array.isArray(dataOrAnalysis) && dataOrAnalysis[0]?.amazon
    ? dataOrAnalysis
    : analyzeAmazonListings(dataOrAnalysis);
  return analyzed.map((row) => toCompactFormat(row));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

const UniversalAmazonPackSizeEngine = {
  ENGINE_VERSION,
  extractAmazonPackSize,
  extractInnerCount,
  extractPackFromText,
  maskFalsePositives,
  normalizeText,
  isInnerCountMistake,
  parseUnitCountNumber,
  coerceAmazonInput,
  analyzeAmazonListing,
  analyzeAmazonListings,
  toCompactFormat,
  generateCompactSummary,
  MEASUREMENT_UNITS,
  NON_PACK_PREFIXES,
  VOLUME_INNER_TYPES,
  NAMED_PACKS,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UniversalAmazonPackSizeEngine;
}

if (typeof window !== 'undefined') {
  window.UniversalAmazonPackSizeEngine = UniversalAmazonPackSizeEngine;
}
