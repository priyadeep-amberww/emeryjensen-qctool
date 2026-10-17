import { Box, Checkbox, Typography } from '@mui/material'
import { useAppTheme } from '../../theme'
import type { InputFieldDef } from '../../data/inputFields'

type InputFieldChipSelectProps = {
  fields: InputFieldDef[]
  selectedIds: ReadonlySet<string> | string[]
  onToggle: (id: string) => void
  disabled?: boolean
  compact?: boolean
}

function isSelected(selectedIds: ReadonlySet<string> | string[], id: string): boolean {
  return Array.isArray(selectedIds) ? selectedIds.includes(id) : selectedIds.has(id)
}

export function InputFieldChipSelect({
  fields,
  selectedIds,
  onToggle,
  disabled = false,
  compact = false,
}: InputFieldChipSelectProps) {
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: compact ? 1 : 1.25,
      }}
    >
      {fields.map((field) => {
        const checked = isSelected(selectedIds, field.id)
        return (
          <Box
            key={field.id}
            component="label"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: compact ? 1.15 : 1.35,
              py: compact ? 0.55 : 0.7,
              borderRadius: 2,
              border: '1px solid',
              borderColor: checked
                ? isDark
                  ? 'rgba(59,130,246,0.45)'
                  : 'rgba(59,130,246,0.4)'
                : isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(15,23,42,0.12)',
              bgcolor: checked
                ? isDark
                  ? 'rgba(59,130,246,0.12)'
                  : 'rgba(59,130,246,0.08)'
                : isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(15,23,42,0.02)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.55 : 1,
              transition: 'border-color 120ms ease, background-color 120ms ease',
              userSelect: 'none',
              '&:hover': disabled
                ? undefined
                : {
                    borderColor: checked
                      ? 'primary.main'
                      : isDark
                        ? 'rgba(255,255,255,0.2)'
                        : 'rgba(15,23,42,0.2)',
                    bgcolor: checked
                      ? isDark
                        ? 'rgba(59,130,246,0.16)'
                        : 'rgba(59,130,246,0.1)'
                      : isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(15,23,42,0.04)',
                  },
            }}
          >
            <Checkbox
              size="small"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(field.id)}
              sx={{
                p: 0.25,
                color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)',
                '&.Mui-checked': { color: 'primary.main' },
              }}
            />
            <Typography
              sx={{
                fontSize: compact ? '12px' : '12.5px',
                fontWeight: checked ? 600 : 500,
                color: checked ? 'text.primary' : 'text.secondary',
                lineHeight: 1.2,
              }}
            >
              {field.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
