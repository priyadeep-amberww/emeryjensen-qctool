import { VENDOR_INTEGRATION_ID } from '../../config/vendorIntegration'
import { ScrapeOperationError } from '../../errorEngine/types'
import type { BrandAliasPair } from '../../types/brandAlias'
import type { QcProcessRowResponse } from '../../types/listingExtract'
import type { AppSettings } from '../../types/settings'
import type { QcResult } from '../../types/qc'
import type { InputRow } from '../../utils/inputParse'
import { normalizeScrapeErrorKind } from '../errorEngine/errorEngineService'
import { scrapeProductForRow } from '../scraping/vendorScrape'
import { buildQcResultForRow } from './qcEngineService'
import {
  buildFailedQcResult,
  capturePayloadToQcResult,
  listingQcPayloadToQcResult,
} from './listingQcMapper'
import type { AppendLogInput } from '../../types/log'
import type { VendorLoginGateRefs } from '../vendorSession/vendorLoginGate'

export type ProcessQcRowContext = {
  rowIndex: number
  headless: boolean
  batchLabel?: string
  settings: AppSettings
  brandAliases: readonly BrandAliasPair[]
  loginGateRefs: VendorLoginGateRefs
  appendLog: (input: AppendLogInput) => void
}

function qcBridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.qc : undefined
}

async function invokeBackendProcessRow(
  row: InputRow,
  context: ProcessQcRowContext,
): Promise<QcProcessRowResponse> {
  const bridge = qcBridge()
  if (!bridge?.processRow) {
    throw new Error('QC backend bridge unavailable')
  }
  return bridge.processRow({
    row,
    rowIndex: context.rowIndex,
    headless: context.headless,
    batchLabel: context.batchLabel,
    vendorId: VENDOR_INTEGRATION_ID,
    settings: {
      titleSimilarityPercent: context.settings.titleSimilarityPercent,
      imageSimilarityPercent: context.settings.imageSimilarityPercent,
      descriptionSimilarityPercent: context.settings.descriptionSimilarityPercent,
      specificationSimilarityPercent: context.settings.specificationSimilarityPercent,
    },
    brandAliases: [...context.brandAliases],
  })
}

/**
 * Run one QC row (Electron backend or browser demo fallback).
 * Vendor scrape failures throw `ScrapeOperationError` for the Error Engine.
 */
export async function processQcRowForBatch(
  row: InputRow,
  context: ProcessQcRowContext,
): Promise<QcResult> {
  const bridge = qcBridge()
  if (!bridge?.processRow) {
    await scrapeProductForRow(row, {
      rowIndex: context.rowIndex,
      headless: context.headless,
      batchLabel: context.batchLabel,
      settings: context.settings,
      loginGateRefs: context.loginGateRefs,
      appendLog: context.appendLog,
    })
    return buildQcResultForRow(row, context.settings, context.brandAliases)
  }

  const response = await invokeBackendProcessRow(row, context)

  if (!response.ok) {
    if (response.phase === 'vendor') {
      throw new ScrapeOperationError({
        kind: normalizeScrapeErrorKind(response.kind),
        message: response.error,
        sku: String(row.part_sku ?? row.sku ?? ''),
        retryable: true,
      })
    }
    return buildFailedQcResult(row, response.error)
  }

  if (response.mode === 'capture') {
    return capturePayloadToQcResult(response.result)
  }
  return listingQcPayloadToQcResult(response.result)
}

/** Single-row QC for Sandbox (backend when Electron is available). */
export async function processQcRowForSandbox(
  row: InputRow,
  context: Omit<ProcessQcRowContext, 'loginGateRefs' | 'appendLog'> & {
    loginGateRefs?: VendorLoginGateRefs
    appendLog?: (input: AppendLogInput) => void
  },
): Promise<QcResult> {
  const bridge = qcBridge()
  if (!bridge?.processRow) {
    return buildQcResultForRow(row, context.settings, context.brandAliases)
  }

  const response = await invokeBackendProcessRow(row, {
    ...context,
    loginGateRefs: context.loginGateRefs ?? { sessionReady: { current: true } },
    appendLog: context.appendLog ?? (() => {}),
  })

  if (!response.ok) {
    if (response.phase === 'vendor') {
      throw new ScrapeOperationError({
        kind: normalizeScrapeErrorKind(response.kind),
        message: response.error,
        sku: String(row.part_sku ?? row.sku ?? ''),
        retryable: true,
      })
    }
    return buildFailedQcResult(row, response.error)
  }

  if (response.mode === 'capture') {
    return capturePayloadToQcResult(response.result)
  }
  return listingQcPayloadToQcResult(response.result)
}
