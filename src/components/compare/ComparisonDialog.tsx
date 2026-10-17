import { Dialog, DialogContent, DialogTitle, Box, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { QcResult } from '../../types/qc'
import { SkuViewerShell } from '../live/skuViewer'

type ComparisonDialogProps = {
  open: boolean
  result: QcResult | null
  onClose: () => void
}

export function ComparisonDialog({ open, result, onClose }: ComparisonDialogProps) {
  if (!result) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 0.5,
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          py: 1.25,
          px: 2,
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1, fontSize: '14px', fontWeight: 700 }}>
          SKU live output viewer
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ mt: -0.25 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          pt: 0,
          px: 2,
          pb: 2,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <SkuViewerShell key={result.id} result={result} />
      </DialogContent>
    </Dialog>
  )
}
