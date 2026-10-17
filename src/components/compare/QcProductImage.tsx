import { memo, useCallback, useState } from 'react'
import { Box, Dialog, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import { fontFamilyMono } from '../../theme/typography'

export type QcProductImageSize = 'sm' | 'md' | 'lg'

const SIZE_PX: Record<QcProductImageSize, number> = {
  sm: 56,
  md: 120,
  lg: 160,
}

export type QcProductImageProps = {
  src?: string | null
  alt?: string
  label?: string
  /** Show URL caption under the thumbnail */
  showUrl?: boolean
  size?: QcProductImageSize
  /** Allow click-to-enlarge lightbox (default true when image loads) */
  enlargeable?: boolean
}

/**
 * Compact QC product thumbnail.
 * Click opens a clean lightbox; X (or backdrop / Escape) closes it.
 */
export const QcProductImage = memo(function QcProductImage({
  src,
  alt = 'Product',
  label,
  showUrl = false,
  size = 'md',
  enlargeable = true,
}: QcProductImageProps) {
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const px = SIZE_PX[size]
  const url = src?.trim() || ''
  const showImage = Boolean(url) && !failed
  const canEnlarge = enlargeable && showImage

  const openPreview = useCallback(() => {
    if (canEnlarge) setOpen(true)
  }, [canEnlarge])

  const closePreview = useCallback(() => setOpen(false), [])

  return (
    <>
      <Box
        sx={{
          display: 'inline-flex',
          flexDirection: 'column',
          gap: 0.75,
          minWidth: 0,
          width: 'fit-content',
          maxWidth: '100%',
        }}
      >
        {label && (
          <Typography
            sx={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'text.secondary',
            }}
          >
            {label}
          </Typography>
        )}
        <Box
          component={canEnlarge ? 'button' : 'div'}
          type={canEnlarge ? 'button' : undefined}
          onClick={canEnlarge ? openPreview : undefined}
          aria-label={canEnlarge ? `Enlarge ${alt}` : undefined}
          title={canEnlarge ? 'Click to enlarge' : undefined}
          sx={{
            all: 'unset',
            boxSizing: 'border-box',
            position: 'relative',
            width: px,
            height: px,
            borderRadius: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            flexShrink: 0,
            bgcolor: showImage ? 'transparent' : 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canEnlarge ? 'zoom-in' : 'default',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
            ...(canEnlarge
              ? {
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 0 0 1px rgba(59,130,246,0.35)',
                  },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                }
              : null),
          }}
        >
          {showImage ? (
            <>
              <Box
                component="img"
                src={url}
                alt={alt}
                loading="lazy"
                onError={() => setFailed(true)}
                sx={{
                  width: px,
                  height: px,
                  objectFit: 'cover',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
              {canEnlarge && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    right: 3,
                    bottom: 3,
                    width: 18,
                    height: 18,
                    borderRadius: 0.5,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.85,
                    pointerEvents: 'none',
                  }}
                >
                  <ZoomInIcon sx={{ fontSize: 12 }} />
                </Box>
              )}
            </>
          ) : (
            <Typography
              sx={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: 'text.secondary',
                px: 1,
                textAlign: 'center',
              }}
            >
              {url ? 'IMAGE UNAVAILABLE' : 'NO IMAGE'}
            </Typography>
          )}
        </Box>
        {showUrl && url && (
          <Typography
            title={url}
            sx={{
              fontSize: '10px',
              fontFamily: fontFamilyMono,
              color: 'text.secondary',
              wordBreak: 'break-all',
              lineHeight: 1.35,
              userSelect: 'text',
              maxWidth: Math.max(px, 160),
            }}
          >
            {url}
          </Typography>
        )}
      </Box>

      <Dialog
        open={open}
        onClose={closePreview}
        maxWidth={false}
        slotProps={{
          backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.72)' } },
          paper: {
            sx: {
              m: 2,
              p: 0,
              borderRadius: 0.5,
              bgcolor: 'transparent',
              boxShadow: 'none',
              overflow: 'visible',
              maxWidth: 'min(92vw, 720px)',
            },
          },
        }}
      >
        <Box sx={{ position: 'relative', width: 'fit-content', maxWidth: '100%', mx: 'auto' }}>
          <IconButton
            aria-label="Close enlarged image"
            onClick={closePreview}
            size="small"
            sx={{
              position: 'absolute',
              top: -12,
              right: -12,
              zIndex: 1,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 2,
              width: 32,
              height: 32,
              '&:hover': { bgcolor: 'background.paper' },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Box
            component="img"
            src={url}
            alt={alt}
            sx={{
              display: 'block',
              maxWidth: 'min(92vw, 720px)',
              maxHeight: '78vh',
              width: 'auto',
              height: 'auto',
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
          {label && (
            <Typography
              sx={{
                mt: 1,
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 600,
                color: '#f4f4f5',
                letterSpacing: '0.04em',
              }}
            >
              {label}
            </Typography>
          )}
        </Box>
      </Dialog>
    </>
  )
})
