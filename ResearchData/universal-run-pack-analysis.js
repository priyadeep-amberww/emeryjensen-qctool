#!/usr/bin/env node
/**
 * ============================================================================
 *  UNIVERSAL AMAZON PACK SIZE ANALYSIS RUNNER
 * ============================================================================
 *
 *  CLI around universalAmazonPackSizeEngine.js.
 *  Drop this folder into another tool; the engine file is the library,
 *  this file is the batch runner.
 *
 *  Usage:
 *    node universal-run-pack-analysis.js [inputFile] [outputFile] [summaryFile]
 *    node universal-run-pack-analysis.js --demo
 *
 *  Input shapes accepted:
 *    1. Scrape JSON   { results: [{ amazon: { title, size, ... } }] }
 *    2. Array         [{ title, size, packageQuantity, numberOfItems, ... }]
 *    3. Single object { title, size, ... }
 *
 *  Examples:
 *    node universal-run-pack-analysis.js
 *    node universal-run-pack-analysis.js listings.json
 *    node universal-run-pack-analysis.js scrape.json out.json summary.json
 *    node universal-run-pack-analysis.js --demo
 *
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const engine = require('./universalAmazonPackSizeEngine');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Universal Amazon Pack Size Analysis Runner
Engine: ${engine.ENGINE_VERSION}

Usage:
  node universal-run-pack-analysis.js [inputFile] [outputFile] [summaryFile]
  node universal-run-pack-analysis.js --demo

Examples:
  node universal-run-pack-analysis.js
  node universal-run-pack-analysis.js listings.json
  node universal-run-pack-analysis.js scrape.json out.json summary.json
  node universal-run-pack-analysis.js --demo

Input:
  Scrape JSON { results: [...] }, an array of listings, or a single listing.
  Each listing needs some of: title, size, packageQuantity, numberOfItems,
  unitCount, specs, productTypes, success.

Outputs:
  1. Full detailed JSON  — packSize, allSignals, inner count, evidence
  2. Compact summary JSON — asin, packSize, innerCount, methods
`);
  process.exit(0);
}

const DEMO_LISTINGS = {
  results: [
    {
      asin: 'DEMO-DAWN',
      amazon: {
        success: true,
        title: 'Dawn Dishwashing Liquid, Original Scent',
        size: '38 Fl Oz',
        packageQuantity: null,
        numberOfItems: null,
        unitCount: null,
        specs: {},
      },
    },
    {
      asin: 'DEMO-LYSOL',
      amazon: {
        success: true,
        title: 'Lysol Disinfectant Spray',
        size: '12.5 Ounce (Pack of 2)',
        packageQuantity: 1,
        numberOfItems: 2,
        unitCount: '25 Ounce',
        specs: {},
      },
    },
    {
      asin: 'DEMO-BANDAID',
      amazon: {
        success: true,
        title: 'BAND-AID Brand Adhesive Bandages, 100 Count',
        size: '100 Count',
        packageQuantity: 100,
        numberOfItems: null,
        unitCount: null,
        specs: {},
      },
    },
    {
      asin: 'DEMO-DAWN-2PK',
      amazon: {
        success: true,
        title: 'Dawn Dish Soap, 2 x 38 fl oz',
        size: '38 Fl Oz',
        packageQuantity: 1,
        numberOfItems: null,
        unitCount: null,
        specs: {},
      },
    },
    {
      asin: 'DEMO-FEBREZE',
      amazon: {
        success: true,
        title: 'Febreze 3-in-1 Air Care Spray, 8.8 oz',
        size: '8.8 oz',
        packageQuantity: 1,
        numberOfItems: null,
        unitCount: null,
        specs: {},
      },
    },
    {
      asin: 'DEMO-CHARMIN',
      amazon: {
        success: true,
        title: 'Charmin Ultra Soft 2-Ply Toilet Paper, 12 Mega Rolls',
        size: '12 Mega Rolls',
        packageQuantity: 1,
        numberOfItems: null,
        unitCount: null,
        specs: {},
      },
    },
    {
      asin: 'DEMO-TIDE',
      amazon: {
        success: true,
        title: 'Tide Pods, 42 Count, Twin Pack',
        size: '42 Count (Pack of 2)',
        packageQuantity: 2,
        numberOfItems: 2,
        unitCount: '84 Count',
        specs: {},
      },
    },
  ],
};

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function pad(str, len) {
  str = String(str ?? '');
  return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

function loadInput(inputFile) {
  if (!fs.existsSync(inputFile)) {
    console.error(C.red + 'ERROR: Input file not found: ' + inputFile + C.reset);
    process.exit(1);
  }
  const raw = fs.readFileSync(inputFile, 'utf8');
  return JSON.parse(raw);
}

function printBanner() {
  console.log(C.bold + C.cyan);
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     UNIVERSAL AMAZON PACK SIZE EXTRACTION ENGINE                   ║');
  console.log('║     Standalone multi-signal outer-pack + inner-count resolver      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(C.reset);
  console.log(C.dim + 'Engine version: ' + engine.ENGINE_VERSION + C.reset);
  console.log();
}

function printResult(r, idx, total) {
  const a = r.amazon;
  console.log(C.bold + C.blue + '━'.repeat(72) + C.reset);
  console.log(
    C.bold +
      ' [' +
      (idx + 1) +
      '/' +
      total +
      '] ' +
      C.cyan +
      (r.asin || 'NO-ASIN') +
      C.reset +
      (r.vendorModel ? C.dim + '  |  ' + r.vendorModel + C.reset : ''),
  );
  console.log(C.bold + ' ' + (r.title || 'N/A') + C.reset);
  console.log();

  console.log(C.magenta + '  ┌─ AMAZON OUTER PACK SIZE' + C.reset);
  console.log(
    '  │  Pack Size:     ' +
      C.bold +
      a.packSize +
      C.reset +
      '  (confidence: ' +
      a.confidence +
      '%)',
  );
  console.log(
    '  │  Inner Count:   ' +
      (a.innerCount != null ? a.innerCount : 'N/A') +
      (a.innerUnitType ? ' ' + a.innerUnitType : '') +
      (a.innerSource ? C.dim + '  [' + a.innerSource + ']' + C.reset : ''),
  );
  console.log('  │  Size Field:    ' + (r.size || 'N/A'));
  console.log('  │  Product Type:  ' + (a.productTypes && a.productTypes.length ? a.productTypes.join(', ') : 'N/A'));
  console.log('  │  Methods:       ' + a.methods.join(', '));
  if (a.evidence.length > 0) {
    console.log('  │  Evidence:');
    a.evidence.forEach((e) => console.log('  │    → ' + e));
  }
  if (a.allSignals && a.allSignals.length > 0) {
    console.log('  │  All Signals:');
    a.allSignals.forEach((s) =>
      console.log(
        '  │    · ' + s.source + ' = ' + s.value + ' (conf ' + s.confidence + ')',
      ),
    );
  }
  if (a.warnings.length > 0) {
    console.log('  │  ' + C.yellow + 'Warnings:' + C.reset);
    a.warnings.forEach((w) => console.log('  │    ⚠ ' + w));
  }
  console.log(C.magenta + '  └─' + C.reset);
  console.log();
}

function printSummaryTable(results) {
  console.log(C.bold + C.cyan);
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY TABLE                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(C.reset);

  const header = [
    pad('#', 3),
    pad('ASIN', 14),
    pad('Pack', 6),
    pad('Conf', 5),
    pad('Inner', 8),
    pad('Unit', 8),
    pad('Methods', 22),
  ].join(' │ ');

  console.log(C.bold + header + C.reset);
  console.log('─'.repeat(header.length + 4));

  results.forEach((r, idx) => {
    const row = [
      pad(String(idx + 1), 3),
      pad(r.asin || '-', 14),
      pad(String(r.summary.packSize), 6),
      pad(String(r.summary.confidence), 5),
      pad(r.summary.innerCount != null ? String(r.summary.innerCount) : 'N/A', 8),
      pad(r.summary.innerUnitType || '-', 8),
      pad((r.amazon.methods || []).join(','), 22),
    ].join(' │ ');
    console.log(row);
  });
  console.log();
}

function main() {
  printBanner();

  const isDemo = args.includes('--demo');
  const positional = args.filter((a) => !a.startsWith('-'));

  let scrapeData;
  let inputLabel;

  if (isDemo) {
    scrapeData = DEMO_LISTINGS;
    inputLabel = '(built-in demo listings)';
  } else {
    const defaultInputCandidates = [
      path.join(__dirname, '..', 'SCRAPE800.json'),
      path.join(__dirname, '..', 'scrape-15.json'),
      path.join(__dirname, 'listings.json'),
    ];
    const defaultInput = defaultInputCandidates.find((p) => fs.existsSync(p));

    if (!positional[0] && !defaultInput) {
      console.log(C.yellow + 'No input file given. Running built-in demo.' + C.reset);
      console.log(C.dim + 'Pass a JSON file, or use --help / --demo.' + C.reset);
      console.log();
      scrapeData = DEMO_LISTINGS;
      inputLabel = '(built-in demo listings)';
    } else {
      const INPUT_FILE = path.resolve(positional[0] || defaultInput);
      scrapeData = loadInput(INPUT_FILE);
      inputLabel = INPUT_FILE;
    }
  }

  const results = engine.analyzeAmazonListings(scrapeData);
  console.log(C.dim + 'Analyzed ' + results.length + ' listing(s) from ' + inputLabel + C.reset);
  console.log();

  results.forEach((r, idx) => printResult(r, idx, results.length));
  printSummaryTable(results);

  const defaults = results.filter((r) => r.amazon.methods.includes('default_1')).length;
  const noData = results.filter((r) => r.amazon.methods.includes('no_data')).length;
  const withWarnings = results.filter((r) => r.amazon.warnings.length > 0).length;
  const multiPack = results.filter((r) => r.amazon.packSize > 1).length;

  console.log(C.bold + 'Statistics:' + C.reset);
  console.log('  Total listings:     ' + results.length);
  console.log('  ' + C.green + 'Multi-pack (N>1):   ' + multiPack + C.reset);
  console.log('  Default pack=1:     ' + defaults);
  console.log('  No data:            ' + noData);
  console.log('  With warnings:      ' + withWarnings);
  console.log();

  if (isDemo && positional.length === 0) {
    console.log(C.dim + 'Demo mode — no files written. Pass an input JSON to save output.' + C.reset);
    console.log();
    return;
  }

  const inputPath = positional[0]
    ? path.resolve(positional[0])
    : path.join(__dirname, 'universal-pack-demo');
  const inputBase = positional[0]
    ? path.basename(inputPath, path.extname(inputPath))
    : 'universal-pack-demo';
  const inputDir = positional[0] ? path.dirname(inputPath) : __dirname;

  const OUTPUT_FILE = path.resolve(
    positional[1] || path.join(inputDir, `${inputBase}-AMAZON-PACK-OUTPUT.json`),
  );
  const SUMMARY_FILE = path.resolve(
    positional[2] || path.join(inputDir, `${inputBase}-AMAZON-PACK-SUMMARY.json`),
  );

  const output = {
    generatedAt: new Date().toISOString(),
    engineVersion: engine.ENGINE_VERSION,
    inputFile: inputLabel,
    totalItems: results.length,
    statistics: { multiPack, defaults, noData, withWarnings },
    results,
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(C.green + '1. Full detailed output saved to : ' + OUTPUT_FILE + C.reset);

  const summaryOutput = {
    generatedAt: new Date().toISOString(),
    engineVersion: engine.ENGINE_VERSION,
    totalItems: results.length,
    sourceFile: path.basename(String(inputLabel)),
    items: engine.generateCompactSummary(results),
  };
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summaryOutput, null, 2), 'utf8');
  console.log(C.cyan + C.bold + '2. Compact summary saved to:      ' + SUMMARY_FILE + C.reset);
  console.log();
}

main();
