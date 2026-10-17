import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BrandAlias, BrandAliasPair } from '../types/brandAlias'
import { loadBrandAliases, saveBrandAliases } from '../utils/brandAliasStorage'

type BrandAliasContextValue = {
  aliases: BrandAlias[]
  /** Saved pairs for QC (no empty rows). */
  aliasPairs: BrandAliasPair[]
  saveAliases: (rows: BrandAlias[]) => void
}

const BrandAliasContext = createContext<BrandAliasContextValue | null>(null)

export function BrandAliasProvider({ children }: { children: ReactNode }) {
  const [aliases, setAliases] = useState<BrandAlias[]>(loadBrandAliases)

  useEffect(() => {
    saveBrandAliases(aliases)
  }, [aliases])

  const saveAliases = useCallback((rows: BrandAlias[]) => {
    setAliases(rows)
  }, [])

  const aliasPairs = useMemo(
    () =>
      aliases.map((row) => ({
        amazonBrand: row.amazonBrand,
        vendorBrand: row.vendorBrand,
      })),
    [aliases],
  )

  const value = useMemo(
    () => ({
      aliases,
      aliasPairs,
      saveAliases,
    }),
    [aliases, aliasPairs, saveAliases],
  )

  return <BrandAliasContext.Provider value={value}>{children}</BrandAliasContext.Provider>
}

export function useBrandAliases() {
  const ctx = useContext(BrandAliasContext)
  if (!ctx) throw new Error('useBrandAliases must be used within BrandAliasProvider')
  return ctx
}
