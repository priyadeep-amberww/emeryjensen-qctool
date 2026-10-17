export type EjdRiskLevel = 'GREEN_CLEAR' | 'YELLOW_AUDIT' | 'RED_BLOCKED' | 'UNKNOWN'

export type EjdItemStatus = 'ACTIVE' | 'DISCONTINUED' | 'SPECIAL_ORDER' | 'UNKNOWN'

export interface EjdVendorRef {
  id: string
  name: string
}

export interface EjdProductIdentity {
  ejd_sku: string
  upc: string
  mfg_part_number: string
  title: string
  brand_name: string
  vendor: EjdVendorRef
}

export interface EjdProductCommercials {
  wholesale_cost: number
  store_retail_msrp: number
  order_multiple: number
  currency: 'USD'
  case_cost?: number
}

export interface EjdProductInventory {
  rsc_site: string
  available_qty: number
  is_in_stock: boolean
  is_special_order: boolean
  item_status: EjdItemStatus
  velocity: string | null
}

export interface EjdProductLogistics {
  unit_of_measure?: string
  om_weight_lbs?: number
  returnable?: boolean
  hazardous_material?: boolean
  country_of_origin?: string
  tariff_code?: string
}

export interface EjdProductMedia {
  primary_image_url?: string
}

export interface EjdProductCompliance {
  marketplace_prohibited: boolean | null
  restriction_policy_text: string | null
  risk_level: EjdRiskLevel
}

export interface EjdProductProvenance {
  extracted_at: string
  search_term_used: string
  store_context: string
  parsing_confidence_score: number
}

export interface EjdProductRecord {
  identity: EjdProductIdentity
  commercials: EjdProductCommercials
  inventory: EjdProductInventory
  compliance: EjdProductCompliance
  provenance: EjdProductProvenance
  logistics?: EjdProductLogistics
  media?: EjdProductMedia
}

export function isEjdProductRecord(raw: unknown): raw is EjdProductRecord {
  if (!raw || typeof raw !== 'object') return false
  const id = (raw as EjdProductRecord).identity
  return Boolean(id?.ejd_sku)
}
