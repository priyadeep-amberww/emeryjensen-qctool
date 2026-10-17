import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: 'primary' | 'error' | 'warning'
  children?: ReactNode
  onConfirm: () => void
  onClose: () => void
}

/** Compact confirmation modal for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'error',
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 0.5 } } }}
    >
      <DialogTitle sx={{ fontSize: '14px', fontWeight: 700, pb: 0.5 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '12px', color: 'text.secondary', lineHeight: 1.55 }}>
          {message}
        </Typography>
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
        <Button
          onClick={onClose}
          size="small"
          variant="outlined"
          sx={{ height: 30, fontSize: '12px', borderRadius: 0.5 }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={() => {
            onConfirm()
            onClose()
          }}
          size="small"
          variant="contained"
          color={confirmColor}
          sx={{ height: 30, fontSize: '12px', borderRadius: 0.5, boxShadow: 'none' }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
