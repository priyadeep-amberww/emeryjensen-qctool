import { useEffect, useMemo, useState } from 'react'
import { Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material'
import { useToast } from '../toast'
import { HAIKU_INPUT_PER_M, HAIKU_OUTPUT_PER_M } from '../../utils/aiPricing'

const INPUT_MIN = 0
const INPUT_MAX = 5000
const OUTPUT_MIN = 0
const OUTPUT_MAX = 1000
const DEFAULT_INPUT = 3000
const DEFAULT_OUTPUT = 250

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function batchCostUsd(calls: number, inputTokens: number, outputTokens: number) {
  const perCall =
    (inputTokens / 1_000_000) * HAIKU_INPUT_PER_M + (outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_M
  return calls * perCall
}

function formatUsd(n: number) {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

export function HaikuTokenCapSection() {
  const { showToast } = useToast()
  const [inputTokens, setInputTokens] = useState(DEFAULT_INPUT)
  const [outputTokens, setOutputTokens] = useState(DEFAULT_OUTPUT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await window.electronAPI?.aiCaps?.get()
        if (!cancelled && result?.ok && result.caps) {
          setInputTokens(clamp(result.caps.inputTokens, INPUT_MIN, INPUT_MAX, DEFAULT_INPUT))
          setOutputTokens(clamp(result.caps.outputTokens, OUTPUT_MIN, OUTPUT_MAX, DEFAULT_OUTPUT))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const costs = useMemo(
    () => ({
      thousand: batchCostUsd(1_000, inputTokens, outputTokens),
      tenThousand: batchCostUsd(10_000, inputTokens, outputTokens),
    }),
    [inputTokens, outputTokens],
  )

  const save = async () => {
    const caps = {
      inputTokens: clamp(inputTokens, INPUT_MIN, INPUT_MAX, DEFAULT_INPUT),
      outputTokens: clamp(outputTokens, OUTPUT_MIN, OUTPUT_MAX, DEFAULT_OUTPUT),
    }
    setInputTokens(caps.inputTokens)
    setOutputTokens(caps.outputTokens)
    if (!window.electronAPI?.aiCaps?.save) {
      showToast('Token caps save in the desktop app.', 'error')
      return
    }
    setSaving(true)
    try {
      const result = await window.electronAPI.aiCaps.save(caps)
      if (!result.ok) {
        showToast(result.error ?? 'Could not save token caps.', 'error')
        return
      }
      setInputTokens(result.caps.inputTokens)
      setOutputTokens(result.caps.outputTokens)
      showToast('Haiku token caps saved.', 'success')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paper
      sx={{
        p: { xs: 1.75, sm: 2 },
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
        ADAPTIVE RESTRICTION
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
          mt: 1.5,
        }}
      >
        <TextField
          size="small"
          type="number"
          label="Input token cap"
          value={loading ? '' : inputTokens}
          disabled={loading}
          onChange={(e) => setInputTokens(clamp(Number(e.target.value), INPUT_MIN, INPUT_MAX, DEFAULT_INPUT))}
          slotProps={{ htmlInput: { min: INPUT_MIN, max: INPUT_MAX, step: 1 } }}
          helperText={`${INPUT_MIN}–${INPUT_MAX}. Default ${DEFAULT_INPUT}.`}
        />
        <TextField
          size="small"
          type="number"
          label="Output token cap"
          value={loading ? '' : outputTokens}
          disabled={loading}
          onChange={(e) => setOutputTokens(clamp(Number(e.target.value), OUTPUT_MIN, OUTPUT_MAX, DEFAULT_OUTPUT))}
          slotProps={{ htmlInput: { min: OUTPUT_MIN, max: OUTPUT_MAX, step: 1 } }}
          helperText={`${OUTPUT_MIN}–${OUTPUT_MAX}. Default ${DEFAULT_OUTPUT}.`}
        />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
          mt: 1.5,
        }}
      >
        {(
          [
            ['1,000 calls', costs.thousand],
            ['10,000 calls', costs.tenThousand],
          ] as const
        ).map(([label, amount]) => (
          <Box
            key={label}
            sx={{
              height: 40,
              px: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 0.5,
              boxSizing: 'border-box',
            }}
          >
            <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>{label}</Typography>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {formatUsd(amount)}
            </Typography>
          </Box>
        ))}
      </Box>
      <Button
        variant="contained"
        size="small"
        disabled={loading || saving}
        onClick={() => void save()}
        sx={{ mt: 1.5, height: 32, fontSize: '11px', fontWeight: 700, borderRadius: 0.5 }}
      >
        {saving ? <CircularProgress size={16} color="inherit" /> : 'SAVE'}
      </Button>
    </Paper>
  )
}
