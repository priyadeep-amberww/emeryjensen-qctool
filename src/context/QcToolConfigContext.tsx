import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  DEFAULT_QC_TOOL_CODENAME,
  DEFAULT_QC_TOOL_VENDOR_DISPLAY_NAME,
  formatQcToolCodename,
} from '../config/qcTool'

type QcToolConfigContextValue = {
  /** Always exactly four characters for layout-stable display. */
  codename: string
  /** Full vendor name from integration config. */
  vendorDisplayName: string
}

const QcToolConfigContext = createContext<QcToolConfigContextValue>({
  codename: formatQcToolCodename(DEFAULT_QC_TOOL_CODENAME),
  vendorDisplayName: DEFAULT_QC_TOOL_VENDOR_DISPLAY_NAME,
})

export type QcToolConfigProviderProps = {
  children: ReactNode
  /** Optional 4-character codename for this vendor QC tool build. */
  codename?: string
  /** Optional full vendor display name for this QC tool build. */
  vendorDisplayName?: string
}

export function QcToolConfigProvider({
  children,
  codename,
  vendorDisplayName,
}: QcToolConfigProviderProps) {
  const value = useMemo(
    () => ({
      codename: formatQcToolCodename(codename ?? DEFAULT_QC_TOOL_CODENAME),
      vendorDisplayName: (vendorDisplayName ?? DEFAULT_QC_TOOL_VENDOR_DISPLAY_NAME).trim(),
    }),
    [codename, vendorDisplayName],
  )

  return <QcToolConfigContext.Provider value={value}>{children}</QcToolConfigContext.Provider>
}

export function useQcToolCodename(): string {
  return useContext(QcToolConfigContext).codename
}

export function useQcToolVendorDisplayName(): string {
  return useContext(QcToolConfigContext).vendorDisplayName
}
