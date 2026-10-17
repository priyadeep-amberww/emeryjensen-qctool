import { useCallback, useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import { PageFrame } from '../components/layout/PageFrame'
import { useToast } from '../components/toast'
import { useBrandAliases } from '../context/BrandAliasContext'
import { useQcToolVendorDisplayName } from '../context/QcToolConfigContext'
import { useAppTheme } from '../theme'
import { createEmptyBrandAliasRow, normalizeBrandAliases } from '../utils/brandAliasStorage'
import type { BrandAlias } from '../types/brandAlias'

const sectionPaperSx = {
  p: { xs: 1.75, sm: 2 },
  borderRadius: 0.5,
  border: '1px solid',
  borderColor: 'divider',
  width: '100%',
  boxSizing: 'border-box',
} as const

const columnLabelSx = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: 'text.secondary',
} as const

const fieldSx = {
  '& .MuiInputBase-root': {
    borderRadius: 0.5,
    fontSize: '12px',
  },
}

function thinScrollbarSx(isDark: boolean) {
  return {
    scrollbarWidth: 'thin' as const,
    scrollbarColor: isDark ? 'rgba(82,82,91,0.85) transparent' : 'rgba(148,163,184,0.7) transparent',
    '&::-webkit-scrollbar': { width: 5, height: 5 },
    '&::-webkit-scrollbar-track': { background: 'transparent', marginBlock: 6 },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: isDark ? 'rgba(82,82,91,0.9)' : 'rgba(148,163,184,0.75)',
      borderRadius: 999,
      border: '1px solid transparent',
      backgroundClip: 'padding-box',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: isDark ? 'rgba(113,113,122,0.95)' : 'rgba(100,116,139,0.85)',
    },
    '&::-webkit-scrollbar-corner': { background: 'transparent' },
  }
}

function draftHasContent(rows: BrandAlias[]): boolean {
  return rows.some((row) => row.amazonBrand.trim() || row.vendorBrand.trim())
}

export function BrandAliasPage() {
  const { aliases, saveAliases } = useBrandAliases()
  const vendorDisplayName = useQcToolVendorDisplayName()
  const { showToast } = useToast()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const [draftRows, setDraftRows] = useState<BrandAlias[]>(() => [createEmptyBrandAliasRow()])
  const [savedListOpen, setSavedListOpen] = useState(() => aliases.length > 0)

  const updateRow = useCallback((id: string, patch: Partial<Pick<BrandAlias, 'amazonBrand' | 'vendorBrand'>>) => {
    setDraftRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }, [])

  const addRow = useCallback(() => {
    setDraftRows((prev) => [...prev, createEmptyBrandAliasRow()])
  }, [])

  const removeDraftRow = useCallback((id: string) => {
    setDraftRows((prev) => {
      const next = prev.filter((row) => row.id !== id)
      return next.length > 0 ? next : [createEmptyBrandAliasRow()]
    })
  }, [])

  const removeSavedRow = useCallback(
    (id: string) => {
      const next = aliases.filter((row) => row.id !== id)
      saveAliases(next)
      if (next.length === 0) setSavedListOpen(false)
      showToast('Brand pair removed', 'success')
    },
    [aliases, saveAliases, showToast],
  )

  const handleSaveList = useCallback(() => {
    const hasDraft = draftHasContent(draftRows)

    if (!hasDraft) {
      if (aliases.length === 0) {
        showToast('Add an Amazon Brand and Vendor Brand pair first', 'warning')
        return
      }
      setSavedListOpen((open) => !open)
      return
    }

    const incomplete = draftRows.some((row) => {
      const amazon = row.amazonBrand.trim()
      const vendor = row.vendorBrand.trim()
      return (amazon && !vendor) || (!amazon && vendor)
    })
    if (incomplete) {
      showToast('Each row needs both Amazon Brand and Vendor Brand, or leave both empty', 'warning')
      return
    }

    const added = normalizeBrandAliases(draftRows)
    if (added.length === 0) {
      showToast('Add an Amazon Brand and Vendor Brand pair first', 'warning')
      return
    }

    const merged = normalizeBrandAliases([...aliases, ...added])
    saveAliases(merged)
    setDraftRows([createEmptyBrandAliasRow()])
    setSavedListOpen(true)
    showToast(`Brand alias list saved · ${merged.length} pair(s)`, 'success')
  }, [aliases, draftRows, saveAliases, showToast])

  return (
    <PageFrame
      title="Brand Filter"
      subtitle="Amazon brand ↔ vendor brand pairs that count as a match when exact brand strings differ."
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: savedListOpen ? 2 : 0,
          transition: 'gap 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <Paper sx={sectionPaperSx}>
          <Typography sx={{ fontSize: '12px', color: 'text.secondary', lineHeight: 1.55, maxWidth: '72ch' }}>
            When Amazon and {vendorDisplayName} use different brand strings for the same company, add a row
            here. QC treats that pair as Brand Result YES. Pairs are stored locally as JSON.
          </Typography>

          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 40px' },
              gap: { xs: 1, sm: 1.25 },
              alignItems: 'center',
            }}
          >
            <Typography sx={{ ...columnLabelSx, display: { xs: 'none', sm: 'block' } }}>
              AMAZON BRAND
            </Typography>
            <Typography sx={{ ...columnLabelSx, display: { xs: 'none', sm: 'block' } }}>
              VENDOR BRAND
            </Typography>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }} />

            {draftRows.map((row) => (
              <Box key={row.id} sx={{ display: 'contents' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ ...columnLabelSx, display: { xs: 'block', sm: 'none' }, mb: 0.5 }}>
                    AMAZON BRAND
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="As on Amazon"
                    value={row.amazonBrand}
                    onChange={(e) => updateRow(row.id, { amazonBrand: e.target.value })}
                    sx={fieldSx}
                  />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ ...columnLabelSx, display: { xs: 'block', sm: 'none' }, mb: 0.5 }}>
                    VENDOR BRAND
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="As on vendor site"
                    value={row.vendorBrand}
                    onChange={(e) => updateRow(row.id, { vendorBrand: e.target.value })}
                    sx={fieldSx}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', sm: 'center' } }}>
                  <IconButton
                    size="small"
                    aria-label="Remove draft row"
                    onClick={() => removeDraftRow(row.id)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 0.5,
                      color: 'text.secondary',
                      '&:hover': { color: 'error.main', bgcolor: 'action.hover' },
                    }}
                  >
                    <DeleteOutlineOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2.25 }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<AddOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={addRow}
              sx={{
                height: 32,
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 0.5,
                textTransform: 'none',
              }}
            >
              Add row
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveList}
              aria-expanded={savedListOpen}
              sx={{
                height: 32,
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                borderRadius: 0.5,
                boxShadow: 'none',
                textTransform: 'none',
              }}
            >
              Save list
            </Button>
          </Box>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gridTemplateRows: savedListOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 320ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <Box sx={{ overflow: 'hidden', minHeight: 0 }}>
            <Paper
              sx={{
                ...sectionPaperSx,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 320,
                opacity: savedListOpen ? 1 : 0,
                transform: savedListOpen ? 'translateY(0)' : 'translateY(-8px)',
                transition:
                  'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <Typography sx={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', mb: 1.5 }}>
                Saved list
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 40px',
                  gap: 1.25,
                  mb: 1,
                  flexShrink: 0,
                }}
              >
                <Typography sx={columnLabelSx}>AMAZON BRAND</Typography>
                <Typography sx={columnLabelSx}>VENDOR BRAND</Typography>
                <Box />
              </Box>

              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  ...thinScrollbarSx(isDark),
                }}
              >
                {aliases.length === 0 ? (
                  <Typography sx={{ fontSize: '12px', color: 'text.secondary', py: 2 }}>
                    No saved pairs yet. Add brands above and click Save list.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {aliases.map((row) => (
                      <Box
                        key={row.id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 40px',
                          gap: 1.25,
                          alignItems: 'center',
                          py: 0.85,
                          borderTop: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Typography
                          sx={{ fontSize: '13px', fontWeight: 500, minWidth: 0, wordBreak: 'break-word' }}
                        >
                          {row.amazonBrand}
                        </Typography>
                        <Typography
                          sx={{ fontSize: '13px', fontWeight: 500, minWidth: 0, wordBreak: 'break-word' }}
                        >
                          {row.vendorBrand}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <IconButton
                            size="small"
                            aria-label={`Remove ${row.amazonBrand}`}
                            onClick={() => removeSavedRow(row.id)}
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 0.5,
                              color: 'text.secondary',
                              '&:hover': { color: 'error.main', bgcolor: 'action.hover' },
                            }}
                          >
                            <DeleteOutlineOutlinedIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </PageFrame>
  )
}
