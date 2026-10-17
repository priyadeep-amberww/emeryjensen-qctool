import type {
  CredentialClearResult,
  CredentialSaveAllResult,
  CredentialSaveResult,
  CredentialsStatusResponse,
  CredentialTestResult,
  CredentialDisplayValuesResponse,
} from './types/credentials'
import type { ScrapeErrorKind } from './errorEngine/types'
import type { InputRow } from './utils/inputParse'
import type { CustomExcelExportRequest, CustomExcelExportResponse } from './types/customExport'
import type { QcExportRequest, QcExportResponse } from './types/qcExport'
import type {
  QcBatchControlRequest,
  QcBatchControlResponse,
  QcBatchSessionResponse,
  QcStartBatchRequest,
  QcStartBatchResponse,
  QcValidateRequest,
  QcValidateResponse,
} from './types/qcUpload'
import type { QcProcessRowResponse } from './types/listingExtract'
import type { AppSettings } from './types/settings'
import type { BrandAliasPair } from './types/brandAlias'

export interface ElectronCredentialsBridge {
  getStatus: () => Promise<CredentialsStatusResponse>
  getDisplayValues: () => Promise<CredentialDisplayValuesResponse>
  save: (groupId: string, values: Record<string, string>) => Promise<CredentialSaveResult>
  saveAll: (items: { groupId: string; values: Record<string, string> }[]) => Promise<CredentialSaveAllResult>
  clear: (groupId: string) => Promise<CredentialClearResult>
  test: (groupId: string) => Promise<CredentialTestResult>
  encryptionAvailable: () => Promise<boolean>
}

export type QcProcessRowRequest = {
  row: InputRow
  rowIndex: number
  headless: boolean
  batchLabel?: string
  vendorId: string
  settings: Pick<
    AppSettings,
    | 'titleSimilarityPercent'
    | 'imageSimilarityPercent'
    | 'descriptionSimilarityPercent'
    | 'specificationSimilarityPercent'
  >
  brandAliases: BrandAliasPair[]
  sessionId?: string
}

export interface ElectronQcBridge {
  validateUpload: (request: QcValidateRequest) => Promise<QcValidateResponse>
  startBatch: (payload: QcStartBatchRequest) => Promise<QcStartBatchResponse>
  pauseBatch: (payload: QcBatchControlRequest) => Promise<QcBatchControlResponse>
  resumeBatch: (payload: QcBatchControlRequest) => Promise<QcBatchControlResponse>
  stopBatch: (payload: QcBatchControlRequest) => Promise<QcBatchControlResponse>
  getSession: (payload: { sessionId: string }) => Promise<QcBatchSessionResponse>
  appendBatchResult: (payload: {
    sessionId: string
    result: import('./types/qc').QcResult
  }) => Promise<{ ok: true; count: number } | { ok: false; error: string }>
  exportBatch: (request: QcExportRequest) => Promise<QcExportResponse>
  processRow: (payload: QcProcessRowRequest) => Promise<QcProcessRowResponse>
  pingInternet: () => Promise<{ ok: true; online: boolean }>
}

export type ElectronVendorScrapePayload = {
  row: InputRow
  rowIndex: number
  headless: boolean
  batchLabel?: string
  vendorLoginRequired: boolean
}

export type ElectronVendorScrapeResponse =
  | { ok: true; extract?: unknown }
  | { ok: false; kind: ScrapeErrorKind; error: string }

export type VendorLoginRequest = {
  vendorLoginRequired: boolean
  reuseSession: boolean
  headless: boolean
  batchLabel?: string
}

export type VendorSessionStatus = {
  state: 'idle' | 'logging_in' | 'armed' | 'logged_out' | 'relogging'
  armed: boolean
  message?: string
  activeStore?: string
}

export interface ElectronVendorSessionBridge {
  login: (request: VendorLoginRequest) => Promise<{ ok: true; skipped?: boolean; log?: string[] } | { ok: false; error: string; log?: string[] }>
  exit: () => Promise<{ ok: boolean; error?: string; log?: string[] }>
  relogin: () => Promise<{ ok: true; log?: string[] } | { ok: false; error: string; log?: string[] }>
  status: () => Promise<VendorSessionStatus>
}

export interface ElectronErrorEngineBridge {
  cancelSession: () => Promise<{ ok: true }>
  relogin: (payload: { attempt: number; vendorLoginRequired?: boolean }) => Promise<
    { ok: true } | { ok: false; error: string }
  >
  executeScrape: (payload: ElectronVendorScrapePayload) => Promise<ElectronVendorScrapeResponse>
}

export type Bitrix24SendMessagePayload = {
  message: string
  dialogId?: string
}

export type Bitrix24SendMessageResult =
  | { ok: true; messageId?: unknown }
  | { ok: false; error: string }

export type Bitrix24TestConnectionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string }

export interface ElectronBitrix24Bridge {
  testConnection: () => Promise<Bitrix24TestConnectionResult>
  sendMessage: (payload: Bitrix24SendMessagePayload) => Promise<Bitrix24SendMessageResult>
}

export type AiTokenCaps = {
  inputTokens: number
  outputTokens: number
}

export type AiTokenCapsGetResult = { ok: true; caps: AiTokenCaps }

export type AiTokenCapsSaveResult = { ok: true; caps: AiTokenCaps } | { ok: false; error: string }

export interface ElectronAiCapsBridge {
  get: () => Promise<AiTokenCapsGetResult>
  save: (caps: AiTokenCaps) => Promise<AiTokenCapsSaveResult>
}

export interface ElectronExportBridge {
  generateCustomExcel: (request: CustomExcelExportRequest) => Promise<CustomExcelExportResponse>
}

export interface ElectronBridge {
  platform: string
  qc?: ElectronQcBridge
  vendorSession?: ElectronVendorSessionBridge
  errorEngine?: ElectronErrorEngineBridge
  credentials?: ElectronCredentialsBridge
  aiCaps?: ElectronAiCapsBridge
  bitrix24?: ElectronBitrix24Bridge
  export?: ElectronExportBridge
}

declare global {
  interface Window {
    electronAPI?: ElectronBridge
  }
}

export {}
