import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { PageFrame } from '../components/layout/PageFrame'
import { InputFieldChipSelect } from '../components/input/InputFieldChipSelect'
import { Pagination, getPageItemRange, DEFAULT_PAGE_SIZE_OPTIONS } from '../components/pagination'
import { useToast } from '../components/toast'
import { useAppTheme } from '../theme'
import {
  AVAILABLE_INPUT_FIELDS,
  fieldsFromIds,
  loadSavedFieldIds,
  saveFieldIds,
  type InputFieldDef,
} from '../data/inputFields'
import {
  buildPastePlaceholder,
  buildSamplePaste,
  type InputRow,
} from '../utils/inputParse'
import { validateUpload, startQcBatch } from '../services/qcApi'
import { useLogs } from '../context/LogsContext'
import { useBatchRun } from '../context/BatchDemoContext'
import { useSettings } from '../context/SettingsContext'
import { ensureVendorLoginBeforeScrape } from '../services/vendorSession/vendorLoginGate'
import { ScrapeOperationError } from '../errorEngine/types'
import { QC_UPLOAD_MAX_BYTES } from '../services/qc/qcUploadValidation'
import { QC_VALIDATE_PREVIEW_ROWS } from '../types/qcUpload'
import type { StartQcPayload } from '../context/BatchDemoContext'
import { fontFamilyMono } from '../theme/typography'

/**
 * Fixed character width per column. Shared by the header table and the paste
 * textarea tab-stops so Excel TSV columns line up under the headings.
 */
const COLUMN_WIDTH_CH = 16
const PREVIEW_ROWS_PER_PAGE = 25
/** How many error lines to mount in the DOM (full list may be larger but capped in parse). */
const ERROR_DISPLAY_LIMIT = 40
const DUPLICATE_ASIN_SKIP_NOTE =
  'Rows with a duplicate ASIN (after the first occurrence in your upload) are skipped and will not run in QC.'

const uploadToolbarBtnSx = {
  height: 32,
  fontSize: '12px',
  borderRadius: 0.5,
} as const

/** Native textarea — much lighter than MUI TextField for 10k+ line pastes. */
const pasteTextareaSx = {
  display: 'block',
  width: '100%',
  minHeight: '12rem',
  boxSizing: 'border-box',
  m: 0,
  px: 1.5,
  py: 1.25,
  border: 'none',
  outline: 'none',
  resize: 'vertical',
  fontFamily: fontFamilyMono,
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.5,
  whiteSpace: 'pre',
  overflowX: 'auto',
  bgcolor: 'background.paper',
  color: 'text.primary',
  tabSize: COLUMN_WIDTH_CH,
  MozTabSize: COLUMN_WIDTH_CH,
  '&:disabled': {
    opacity: 1,
    cursor: 'not-allowed',
  },
} as const

const INPUT_FIELDS_DEBOUNCE_MS = 120

const TabularColumnHeader = memo(function TabularColumnHeader({
  fields,
}: {
  fields: InputFieldDef[]
}) {
  if (fields.length === 0) return null
  const tableWidthCh = fields.length * COLUMN_WIDTH_CH
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{
          width: `${tableWidthCh}ch`,
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontFamily: fontFamilyMono,
          fontSize: '11px',
          '& th': {
            width: `${COLUMN_WIDTH_CH}ch`,
            maxWidth: `${COLUMN_WIDTH_CH}ch`,
            fontFamily: fontFamilyMono,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.04em',
            lineHeight: 1.5,
            textAlign: 'left',
            verticalAlign: 'middle',
            // Muted label — clearly distinct from the brighter paste values below
            color: 'text.secondary',
            px: 0,
            py: 1.1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }}
      >
        <Box component="colgroup">
          {fields.map((field) => (
            <Box component="col" key={field.id} sx={{ width: `${COLUMN_WIDTH_CH}ch` }} />
          ))}
        </Box>
        <Box component="thead">
          <Box component="tr">
            {fields.map((field) => (
              <Box component="th" key={field.id} scope="col" title={field.label}>
                {field.label}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
})

/**
 * Uncontrolled multiline input so large Excel pastes stay in the DOM and do not
 * rewrite React state (or re-render the page) on every keystroke / paste.
 *
 * The textarea always holds the complete pasted text. Pagination / preview never
 * write back into this control. `resetKey` remounts only when fields are Saved
 * (intentional sample reset) — never on validate or page changes.
 */
const PasteDataInput = memo(function PasteDataInput({
  fields,
  disabled,
  resetKey,
  defaultValue,
  inputRef,
  onUserEdit,
}: {
  fields: InputFieldDef[]
  disabled: boolean
  resetKey: number
  defaultValue: string
  inputRef: RefObject<HTMLTextAreaElement | null>
  onUserEdit: () => void
}) {
  const placeholder = useMemo(
    () => (fields.length > 0 ? buildPastePlaceholder(fields) : ''),
    [fields],
  )

  const handleInput = useCallback(() => {
    onUserEdit()
  }, [onUserEdit])

  return (
    <Box
      key={resetKey}
      component="textarea"
      ref={inputRef}
      defaultValue={defaultValue}
      onInput={handleInput}
      placeholder={placeholder}
      disabled={disabled}
      spellCheck={false}
      aria-label="Paste product data"
      sx={pasteTextareaSx}
    />
  )
})

const InputFieldsPanel = memo(function InputFieldsPanel({
  draftIdSet,
  draftDirty,
  onToggle,
  onSave,
}: {
  draftIdSet: ReadonlySet<string>
  draftDirty: boolean
  onToggle: (id: string) => void
  onSave: () => void
}) {
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  return (
    <Paper
      sx={{
        p: 2.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)',
        bgcolor: isDark ? '#141416' : '#ffffff',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
          mb: 1.25,
        }}
      >
        <Typography sx={{ fontSize: '14px', fontWeight: 650, letterSpacing: '-0.01em' }}>
          Input fields
        </Typography>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={draftIdSet.size === 0 || !draftDirty}
          sx={{
            height: 34,
            px: 2,
            fontSize: '12.5px',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 1.75,
            boxShadow: 'none',
          }}
        >
          Save
        </Button>
      </Box>
      <InputFieldChipSelect
        fields={AVAILABLE_INPUT_FIELDS}
        selectedIds={draftIdSet}
        onToggle={onToggle}
      />
    </Paper>
  )
})

const ValidationErrors = memo(function ValidationErrors({
  errors,
  duplicateAsinBlocked,
  onContinueAnyway,
  continuing,
}: {
  errors: string[]
  duplicateAsinBlocked?: boolean
  onContinueAnyway?: () => void
  continuing?: boolean
}) {
  const visible = errors.slice(0, ERROR_DISPLAY_LIMIT)
  const hiddenCount = errors.length - visible.length
  return (
    <Alert
      severity={duplicateAsinBlocked ? 'warning' : 'error'}
      sx={{ borderRadius: 0.5, '& .MuiAlert-message': { fontSize: '12px', width: '100%' } }}
    >
      {duplicateAsinBlocked && (
        <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
          Duplicate ASINs found. UPC and PART SKU duplicates are allowed; ASIN must be unique per
          QC run unless you continue.
        </Typography>
      )}
      {visible.map((e, i) => (
        <Box key={`${i}-${e.slice(0, 48)}`}>{e}</Box>
      ))}
      {hiddenCount > 0 && (
        <Box sx={{ mt: 0.5, fontWeight: 600 }}>… and {hiddenCount} more issue(s)</Box>
      )}
      {duplicateAsinBlocked && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: '12px', color: 'text.secondary', mb: 1 }}>
            {DUPLICATE_ASIN_SKIP_NOTE}
          </Typography>
          <Button
            variant="contained"
            size="small"
            disabled={continuing}
            onClick={onContinueAnyway}
            sx={{ fontSize: '12px', textTransform: 'none', boxShadow: 'none' }}
          >
            {continuing ? 'Continuing…' : 'Continue anyway'}
          </Button>
        </Box>
      )}
    </Alert>
  )
})

/**
 * Display-only window over the full validated `rows` array. Pagination never
 * mutates or replaces the underlying dataset (or the original paste text).
 */
type ValidatedPreviewState = {
  rowCount: number
  previewRows: InputRow[]
  skippedDuplicateAsinRows?: number
}

const ValidatedPreview = memo(function ValidatedPreview({
  validation,
  fields,
}: {
  validation: ValidatedPreviewState
  fields: InputFieldDef[]
}) {
  const { rowCount, previewRows, skippedDuplicateAsinRows } = validation
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PREVIEW_ROWS_PER_PAGE)

  const previewCap = previewRows.length
  const { start, end } = getPageItemRange(page, pageSize, previewCap)
  const visibleRows = previewRows.slice(start, end)
  const previewTruncated = rowCount > previewCap

  return (
    <Box>
      <Alert
        severity="success"
        sx={{ borderRadius: 0.5, mb: 1.5, '& .MuiAlert-message': { fontSize: '12px' } }}
      >
        {rowCount.toLocaleString()} rows validated successfully. Start QC is available.
        {skippedDuplicateAsinRows != null && skippedDuplicateAsinRows > 0 && (
          <>
            {' '}
            {skippedDuplicateAsinRows.toLocaleString()} duplicate ASIN row(s) were removed from the
            batch ({DUPLICATE_ASIN_SKIP_NOTE})
          </>
        )}
        {previewTruncated && (
          <>
            {' '}
            Preview shows the first {Math.min(previewCap, QC_VALIDATE_PREVIEW_ROWS).toLocaleString()}{' '}
            rows; the full batch is kept in the QC session.
          </>
        )}
      </Alert>
      <Typography sx={{ fontSize: '13px', fontWeight: 700, mb: 1 }}>Preview</Typography>
      <Paper sx={{ borderRadius: 0.5, border: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {fields.map((f) => (
                <TableCell
                  key={f.id}
                  sx={{ fontSize: '11px', fontWeight: 700, width: `${COLUMN_WIDTH_CH}ch` }}
                >
                  {f.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row, idx) => (
              <TableRow key={start + idx}>
                {fields.map((f) => (
                  <TableCell key={f.id} sx={{ fontSize: '12px', fontFamily: fontFamilyMono }}>
                    {row[f.id]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          totalItems={previewCap}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          pageSizeOptions={DEFAULT_PAGE_SIZE_OPTIONS}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
          boundaryCount={3}
        />
      </Paper>
    </Box>
  )
})

type UploadPageProps = {
  onStartQc?: (payload: StartQcPayload) => void | Promise<void>
}

export function UploadPage({ onStartQc }: UploadPageProps) {
  const [draftIds, setDraftIds] = useState<string[]>(() => loadSavedFieldIds())
  const [savedIds, setSavedIds] = useState<string[]>(() => loadSavedFieldIds())
  const savedFields = useMemo(() => fieldsFromIds(savedIds), [savedIds])

  const [mode, setMode] = useState<'paste' | 'file'>('paste')
  const initialPaste = useMemo(
    () => buildSamplePaste(fieldsFromIds(loadSavedFieldIds())),
    [],
  )
  /** Seed for intentional remounts (Save fields only). Never used as live paste state. */
  const [pasteDefault, setPasteDefault] = useState(initialPaste)
  const [pasteResetKey, setPasteResetKey] = useState(0)
  const pasteInputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  /**
   * Complete pasted / typed input, preserved exactly. Survives mode switches,
   * validation, pagination, and re-renders. Only overwritten when the user edits
   * the textarea or clicks Save (sample reset).
   */
  const pasteTextRef = useRef(initialPaste)
  /** File contents kept off the hot paste path; updated only when a file is chosen. */
  const fileTextRef = useRef('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [duplicateAsinBlocked, setDuplicateAsinBlocked] = useState(false)
  /** Preview slice only — full rows live in the QC batch session (main / in-process store). */
  const [validatedPreview, setValidatedPreview] = useState<ValidatedPreviewState | null>(null)
  const [validationSessionId, setValidationSessionId] = useState<string | null>(null)
  const [previewEpoch, setPreviewEpoch] = useState(0)
  const [isValidating, setIsValidating] = useState(false)
  const [isStartingQc, setIsStartingQc] = useState(false)
  const validateGenRef = useRef(0)
  const { showToast } = useToast()
  const { settings } = useSettings()
  const { appendLog } = useLogs()
  const { rememberValidatedSession } = useBatchRun()

  useEffect(() => {
    if (!validationSessionId) rememberValidatedSession(null)
  }, [validationSessionId, rememberValidatedSession])
  const uploadSessionReadyRef = useRef(false)

  const draftIdSet = useMemo(() => new Set(draftIds), [draftIds])

  const draftDirty = useMemo(
    () => draftIds.join('\0') !== savedIds.join('\0'),
    [draftIds, savedIds],
  )

  const hasActiveValidation = validatedPreview !== null || validationSessionId !== null
  const hasActiveValidationRef = useRef(hasActiveValidation)
  hasActiveValidationRef.current = hasActiveValidation

  const clearValidationIfNeeded = useCallback(() => {
    setValidatedPreview((prev) => (prev !== null ? null : prev))
    setValidationSessionId((prev) => (prev !== null ? null : prev))
    setErrors((prev) => (prev.length > 0 ? [] : prev))
    setDuplicateAsinBlocked((prev) => (prev ? false : prev))
  }, [])

  const clearValidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (clearValidationTimerRef.current) clearTimeout(clearValidationTimerRef.current)
    }
  }, [])

  /** Keep paste in a ref; debounce clearing validation so large pastes do not flood React. */
  const syncPasteTextFromInput = useCallback(() => {
    const el = pasteInputRef.current
    if (el) pasteTextRef.current = el.value
    if (!hasActiveValidationRef.current) return
    if (clearValidationTimerRef.current) clearTimeout(clearValidationTimerRef.current)
    clearValidationTimerRef.current = setTimeout(() => {
      clearValidationTimerRef.current = null
      clearValidationIfNeeded()
    }, INPUT_FIELDS_DEBOUNCE_MS)
  }, [clearValidationIfNeeded])

  const clearFileInput = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const applySampleUploadData = useCallback(
    (fields: InputFieldDef[]) => {
      validateGenRef.current += 1
      setIsValidating(false)
      const sample = buildSamplePaste(fields)
      pasteTextRef.current = sample
      setPasteDefault(sample)
      setPasteResetKey((k) => k + 1)
      setValidatedPreview(null)
      setValidationSessionId(null)
      setErrors([])
      setFileName(null)
      setFileSize(null)
      fileTextRef.current = ''
      clearFileInput()
    },
    [clearFileInput],
  )

  const toggleDraft = useCallback((id: string) => {
    setDraftIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }, [])

  const handleReset = () => {
    if (isValidating || isStartingQc) return
    validateGenRef.current += 1
    setIsValidating(false)
    setDraftIds(savedIds)
    setMode('paste')
    pasteTextRef.current = ''
    setPasteDefault('')
    setPasteResetKey((k) => k + 1)
    setValidatedPreview(null)
    setValidationSessionId(null)
    setErrors([])
    setPreviewEpoch(0)
    setFileName(null)
    setFileSize(null)
    fileTextRef.current = ''
    clearFileInput()
    showToast('Upload section reset', 'info')
  }

  const handleSaveFields = () => {
    if (draftIds.length === 0) {
      showToast('Select at least one field', 'warning')
      return
    }
    const ordered = draftIds.filter((id) => Boolean(AVAILABLE_INPUT_FIELDS.find((f) => f.id === id)))
    saveFieldIds(ordered)
    setSavedIds(ordered)
    setDraftIds(ordered)
    const nextFields = fieldsFromIds(ordered)
    applySampleUploadData(nextFields)
    showToast('Input fields saved', 'success')
  }

  const handleValidate = async (options?: { acceptDuplicateAsins?: boolean }) => {
    if (savedFields.length === 0) {
      setErrors(['Save at least one input field before validating'])
      setValidatedPreview(null)
      setValidationSessionId(null)
      return
    }

    if (pasteInputRef.current) {
      pasteTextRef.current = pasteInputRef.current.value
    }
    let raw = mode === 'paste' ? pasteTextRef.current : fileTextRef.current

    if (mode === 'file' && !fileName) {
      setErrors(['Choose a .csv or .txt file first'])
      setValidatedPreview(null)
      setValidationSessionId(null)
      return
    }

    if (mode === 'file') {
      const file = fileInputRef.current?.files?.[0]
      if (file && !raw.trim()) {
        try {
          raw = await file.text()
          fileTextRef.current = raw
        } catch {
          setErrors(['Could not read the selected file. Try another CSV or paste the data.'])
          return
        }
      }
    }

    const gen = ++validateGenRef.current
    setIsValidating(true)
    setErrors([])
    setDuplicateAsinBlocked(false)
    setValidatedPreview(null)
    setValidationSessionId(null)

    try {
      const response = await validateUpload({
        mode,
        raw,
        fieldIds: savedIds,
        acceptDuplicateAsins: options?.acceptDuplicateAsins === true,
        file:
          mode === 'file' && fileName && fileSize != null
            ? { name: fileName, size: fileSize }
            : undefined,
      })

      if (gen !== validateGenRef.current) return

      if (!response.ok) {
        setErrors(response.errors)
        setDuplicateAsinBlocked(response.duplicateAsinBlocked === true)
        setValidatedPreview(null)
        setValidationSessionId(null)
        showToast(
          response.duplicateAsinBlocked
            ? 'Duplicate ASINs found — review or continue anyway'
            : 'Validation failed — fix the issues below',
          response.duplicateAsinBlocked ? 'warning' : 'error',
        )
        return
      }

      const nextPreview: ValidatedPreviewState = {
        rowCount: response.rowCount,
        previewRows: response.previewRows,
        skippedDuplicateAsinRows: response.skippedDuplicateAsinRows,
      }
      startTransition(() => {
        setValidatedPreview(nextPreview)
        setValidationSessionId(response.sessionId)
        rememberValidatedSession(response.sessionId)
        setPreviewEpoch((n) => n + 1)
      })
      showToast(`${response.rowCount.toLocaleString()} rows validated successfully`, 'success')
    } catch {
      if (gen !== validateGenRef.current) return
      setErrors(['Validation could not reach the QC engine. Try again.'])
      setValidatedPreview(null)
      setValidationSessionId(null)
      showToast('Validation failed unexpectedly', 'error')
    } finally {
      if (gen === validateGenRef.current) {
        setIsValidating(false)
      }
    }
  }

  const handleStartQc = async () => {
    if (!validatedPreview || validatedPreview.rowCount === 0 || !validationSessionId) return
    setIsStartingQc(true)
    try {
      uploadSessionReadyRef.current = false
      await ensureVendorLoginBeforeScrape(
        settings,
        { sessionReady: uploadSessionReadyRef },
        appendLog,
        'UPLOAD',
      )

      const started = await startQcBatch({ sessionId: validationSessionId })
      if (!started.ok) {
        showToast(started.error, 'error')
        setValidationSessionId(null)
        setValidatedPreview(null)
        return
      }
      await onStartQc?.({ sessionId: validationSessionId })
    } catch (error) {
      const detail =
        error instanceof ScrapeOperationError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not start QC.'
      showToast(detail, 'error')
    } finally {
      setIsStartingQc(false)
    }
  }

  const onFileChange = (file: File | null) => {
    if (!file) return
    if (file.size > QC_UPLOAD_MAX_BYTES) {
      setFileName(file.name)
      setFileSize(file.size)
      fileTextRef.current = ''
      clearValidationIfNeeded()
      setErrors([
        `File exceeds ${Math.round(QC_UPLOAD_MAX_BYTES / (1024 * 1024))} MB limit (${file.name})`,
      ])
      return
    }
    setFileName(file.name)
    setFileSize(file.size)
    clearValidationIfNeeded()
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) {
      file.text().then((text) => {
        fileTextRef.current = text
      })
    } else {
      fileTextRef.current = ''
    }
  }

  const handleModeChange = (_: ChangeEvent<HTMLInputElement>, value: string) => {
    // Flush textarea → ref before any visibility change so the full paste is kept.
    if (pasteInputRef.current) {
      pasteTextRef.current = pasteInputRef.current.value
    }
    setMode(value as 'paste' | 'file')
    clearValidationIfNeeded()
  }

  const busy = isValidating || isStartingQc

  return (
    <PageFrame
      title="Upload"
      subtitle="Paste or upload SKU rows, validate format, then start headed capture QC."
      actions={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={handleReset} disabled={busy} sx={uploadToolbarBtnSx}>
            Reset
          </Button>
          {busy && <CircularProgress size={16} thickness={5} />}
          <Button
            variant="outlined"
            onClick={() => void handleValidate()}
            disabled={busy}
            sx={uploadToolbarBtnSx}
          >
            Validate
          </Button>
          <Button
            variant="contained"
            disabled={
              !validatedPreview ||
              !validationSessionId ||
              validatedPreview.rowCount === 0 ||
              busy
            }
            onClick={() => void handleStartQc()}
            sx={{ ...uploadToolbarBtnSx, boxShadow: 'none' }}
          >
            {isStartingQc ? 'Starting…' : 'Start QC'}
          </Button>
        </Box>
      }
    >
      <InputFieldsPanel
        draftIdSet={draftIdSet}
        draftDirty={draftDirty}
        onToggle={toggleDraft}
        onSave={handleSaveFields}
      />

      <RadioGroup
        row
        value={mode}
        onChange={handleModeChange}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          m: 0,
        }}
      >
        {(
          [
            { value: 'paste', label: 'Text paste' },
            { value: 'file', label: 'File upload' },
          ] as const
        ).map((option) => {
          const selected = mode === option.value
          return (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio size="small" sx={{ p: 0.35 }} />}
              label={
                <Typography sx={{ fontSize: '12.5px', fontWeight: selected ? 600 : 500 }}>
                  {option.label}
                </Typography>
              }
              sx={{
                m: 0,
                mr: 0,
                px: 1.35,
                py: 0.65,
                borderRadius: 2,
                border: '1px solid',
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected
                  ? (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(59,130,246,0.12)'
                        : 'rgba(59,130,246,0.08)'
                  : 'transparent',
                gap: 0.5,
              }}
            />
          )
        })}
      </RadioGroup>

      {/* Keep paste input mounted across mode switches so the full dataset is never discarded. */}
      <Paper
        sx={{
          display: mode === 'paste' ? 'block' : 'none',
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          opacity: savedFields.length === 0 ? 0.6 : 1,
        }}
        aria-hidden={mode !== 'paste'}
      >
        {savedFields.length > 0 && (
          <Box
            sx={{
              px: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <TabularColumnHeader fields={savedFields} />
          </Box>
        )}
        <PasteDataInput
          fields={savedFields}
          disabled={savedFields.length === 0}
          resetKey={pasteResetKey}
          defaultValue={pasteDefault}
          inputRef={pasteInputRef}
          onUserEdit={syncPasteTextFromInput}
        />
      </Paper>

      <Paper
        sx={{
          display: mode === 'file' ? 'block' : 'none',
          p: 2,
          borderRadius: 0.5,
          border: '1px dashed',
          borderColor: 'divider',
        }}
        aria-hidden={mode !== 'file'}
      >
        {savedFields.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <TabularColumnHeader fields={savedFields} />
          </Box>
        )}
        <Button
          component="label"
          variant="outlined"
          disabled={savedFields.length === 0}
          startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ height: 32, fontSize: '12px', borderRadius: 0.5 }}
        >
          Choose file
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".csv,.xlsx,.txt"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </Button>
        {fileName && (
          <Typography sx={{ fontSize: '12px', mt: 1, color: 'text.secondary' }}>{fileName}</Typography>
        )}
      </Paper>

      {errors.length > 0 && (
        <ValidationErrors
          errors={errors}
          duplicateAsinBlocked={duplicateAsinBlocked}
          continuing={isValidating}
          onContinueAnyway={
            duplicateAsinBlocked ? () => void handleValidate({ acceptDuplicateAsins: true }) : undefined
          }
        />
      )}

      {validatedPreview && (
        <ValidatedPreview key={previewEpoch} validation={validatedPreview} fields={savedFields} />
      )}
    </PageFrame>
  )
}
