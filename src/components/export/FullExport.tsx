import { useBatchRun } from '../../context/BatchDemoContext'
import { useQcToolVendorDisplayName } from '../../context/QcToolConfigContext'
import { ExportBatchPanel } from './ExportBatchPanel'

export function FullExport() {
  const { completedCount, exportVerdictCounts, total, sessionId } = useBatchRun()
  const vendorDisplayName = useQcToolVendorDisplayName()
  const batchComplete = total > 0 && completedCount >= total
  const statusText = batchComplete
    ? `${completedCount} / ${total}`
    : `${completedCount} / ${total > 0 ? total : '—'} · finish batch to unlock`

  return (
    <ExportBatchPanel
      title="Full export"
      statusText={statusText}
      counts={exportVerdictCounts}
      batchTotal={total}
      sessionId={sessionId}
      vendorDisplayName={vendorDisplayName}
      exportEnabled={batchComplete}
      exportScope="full"
    />
  )
}
