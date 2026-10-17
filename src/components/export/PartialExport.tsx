import { useBatchRun } from '../../context/BatchDemoContext'
import { useQcToolVendorDisplayName } from '../../context/QcToolConfigContext'
import { ExportBatchPanel } from './ExportBatchPanel'

export function PartialExport() {
  const { completedCount, exportVerdictCounts, total, sessionId } = useBatchRun()
  const vendorDisplayName = useQcToolVendorDisplayName()

  return (
    <ExportBatchPanel
      title="Partial export"
      statusText={`${completedCount} finished`}
      counts={exportVerdictCounts}
      batchTotal={total}
      sessionId={sessionId}
      vendorDisplayName={vendorDisplayName}
      exportEnabled={completedCount > 0}
      exportScope="partial"
    />
  )
}
