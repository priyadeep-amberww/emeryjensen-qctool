/** Regression catalog + EJD pairs from QC sample (2026-10-16). */

export const SIX_SKU_FIXTURES = [
  {
    name: 'hose',
    asin: 'B071RHFKT7',
    amazon: {
      asin: 'B071RHFKT7',
      summaries: [
        {
          itemName:
            'Abbott Rubber Co Inc 3/8 in. x 4 ft. L Blue Rubber Washing Machine Hose',
          manufacturer: 'Abbott Rubber Co Inc',
          packageQuantity: 5,
          partNumber: 'WA6RB7004',
        },
      ],
      attributes: {
        part_number: [{ value: 'WA6RB7004' }],
        unit_count: [{ value: 1 }],
        item_package_quantity: [{ value: 5 }],
        nominal_wall_thickness: [{ value: '1.3 month' }],
        title_differentiation: [{ value: 'Exact UPC searched; original product details preserved' }],
      },
    },
    ejd: {
      identity: {
        ejd_sku: '4599213',
        upc: '708289620901',
        mfg_part_number: 'WA6RB7004',
        title:
          'Ultra Dynamic Products 3/8 in. FGH X 3/4 in. D FGT 4 ft. Rubber Washing Machine Supply Line',
        brand_name: 'Ultra Dynamic Products',
      },
      commercials: { order_multiple: 1 },
    },
    expect: {
      amazonBrand: 'Abbott Rubber Co Inc',
      amazonModel: 'WA6RB7004',
      vendorPack: 1,
      amazonPack: 1,
      packOutcome: 'MATCH',
      brandOutcome: 'MISMATCH',
      modelOutcome: 'MATCH',
      specMustNotInclude: ['1.3 month', 'title_differentiation'],
    },
  },
  {
    name: 'ring_terminal',
    asin: 'B071LF7ZZ5',
    amazon: {
      asin: 'B071LF7ZZ5',
      summaries: [
        {
          itemName: 'RING TERM 16-14AWG4-6',
          brand: 'Gardner Bender',
          packageQuantity: 22,
          partNumber: '20-103',
        },
      ],
      attributes: {
        part_number: [{ value: '20-103' }],
        brand: [{ value: 'Gardner Bender' }],
        number_of_items: [{ value: 22 }],
        unit_count: [{ value: 22 }],
      },
    },
    ejd: {
      identity: {
        ejd_sku: '3538139',
        mfg_part_number: '20-103',
        title: 'Gardner Bender 16-14 Ga. Insulated Wire Ring Terminal Blue 22 pk',
        brand_name: 'Gardner Bender',
      },
      commercials: { order_multiple: 1 },
    },
    expect: {
      amazonBrand: 'Gardner Bender',
      amazonModel: '20-103',
      vendorPack: 22,
      amazonPack: 22,
      packOutcome: 'MATCH',
      brandOutcome: 'MATCH',
      modelOutcome: 'MATCH',
    },
  },
  {
    name: 'leviton',
    asin: 'B071L3SWP1',
    amazon: {
      asin: 'B071L3SWP1',
      summaries: [
        {
          itemName: 'Leviton 20 amps 125 volt Duplex White Outlet 5-20R 1 pk',
          brand: 'Leviton',
          modelNumber: 'T5820-WS',
          packageQuantity: 8,
          partNumber: 'T5820-WS-8pk',
        },
      ],
      attributes: {
        model_number: [{ value: 'T5820-WS' }],
        part_number: [{ value: 'T5820-WS-8pk' }],
        number_of_items: [{ value: 1 }],
        unit_count: [{ value: 1 }],
        item_package_quantity: [{ value: 8 }],
      },
    },
    ejd: {
      identity: {
        ejd_sku: '3825023',
        mfg_part_number: 'R52-T5820-0WS',
        title: 'Leviton 20 amps 125 V Duplex White Outlet 5-20R 1 pk',
        brand_name: 'Leviton',
      },
      commercials: { order_multiple: 1 },
    },
    expect: {
      amazonBrand: 'Leviton',
      amazonModel: 'T5820-WS',
      vendorPack: 1,
      amazonPack: 1,
      packOutcome: 'MATCH',
      packConflict: true,
      brandOutcome: 'MATCH',
      modelOutcome: 'MATCH',
    },
  },
  {
    name: 'showerhead',
    asin: 'B071KVLD47',
    amazon: {
      asin: 'B071KVLD47',
      summaries: [
        {
          itemName: 'LDR Industries Handheld Shwhead 3s Chrm',
          brand: 'LDR Industries',
          packageQuantity: 1,
          partNumber: '520 A3135CP-WS',
          modelNumber: '520 A3135CP-WS',
        },
      ],
      attributes: {
        brand: [{ value: 'LDR Industries' }],
        model_number: [{ value: '520 A3135CP-WS' }],
        bullet_point: [
          {
            value:
              '{ "language_tag": "en_US", "value": "Number of Spray Settings: 3 settings", "marketplace_id": "ATVPDKIKX0DER" }',
          },
        ],
        title_differentiation: [{ value: 'Exact UPC searched; original product details preserved' }],
      },
    },
    ejd: {
      identity: {
        ejd_sku: '4891867',
        mfg_part_number: '520 A3135CP-WS',
        title: 'Oakbrook Collection Chrome PVC 3 settings Handheld Showerhead 1.8 gpm',
        brand_name: 'Oakbrook Collection',
      },
      commercials: { order_multiple: 1 },
    },
    expect: {
      amazonBrand: 'LDR Industries',
      amazonModel: '520 A3135CP-WS',
      vendorPack: 1,
      amazonPack: 1,
      packOutcome: 'MATCH',
      brandOutcome: 'MISMATCH',
      modelOutcome: 'MATCH',
    },
  },
  {
    name: 'access_panel',
    asin: 'B071JYLZ43',
    amazon: {
      asin: 'B071JYLZ43',
      summaries: [
        {
          itemName: 'Eastman 6 Inch x 6 Inch Access Panel with Frame, 34060, White',
          brand: 'Eastman',
          packageQuantity: 1,
          modelNumber: '34060',
          partNumber: '34060',
        },
      ],
      attributes: {
        brand: [{ value: 'Eastman' }],
        model_number: [{ value: '34060' }],
        part_number: [{ value: '34060' }],
      },
    },
    ejd: {
      identity: {
        ejd_sku: '4793824',
        mfg_part_number: '34060',
        title: 'Eastman Access Panel',
        brand_name: 'Eastman',
      },
      commercials: { order_multiple: 1 },
    },
    expect: {
      amazonBrand: 'Eastman',
      amazonModel: '34060',
      vendorPack: 1,
      amazonPack: 1,
      packOutcome: 'MATCH',
      brandOutcome: 'MATCH',
      modelOutcome: 'MATCH',
    },
  },
  {
    name: 'stopper',
    asin: 'B071JYHKD5',
    amazon: {
      asin: 'B071JYHKD5',
      summaries: [
        {
          itemName: 'PLUMB PAK K820-81 Faucet-Trim-Kits, No Size, Stainless Steel',
          brand: 'Plumb Pak',
          packageQuantity: 1,
          modelNumber: 'K820-81',
          partNumber: 'K820-81',
        },
      ],
      attributes: {
        brand: [{ value: 'Plumb Pak' }],
        model_number: [{ value: 'K820-81' }],
        item_shape: [{ value: 'shape' }],
        scent: [{ value: 'Unscented' }],
      },
    },
    ejd: {
      identity: {
        ejd_sku: '4837548',
        mfg_part_number: 'K820-81',
        title: 'Keeney 1.25 in. White Stainless Steel Pop Up Stopper',
        brand_name: 'Keeney',
      },
      commercials: { order_multiple: 1 },
    },
    expect: {
      amazonBrand: 'Plumb Pak',
      amazonModel: 'K820-81',
      vendorPack: 1,
      amazonPack: 1,
      packOutcome: 'MATCH',
      brandOutcome: 'MISMATCH',
      modelOutcome: 'MATCH',
      specMustNotInclude: ['item_shape: shape', 'scent: Unscented'],
    },
  },
]
