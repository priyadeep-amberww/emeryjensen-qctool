import { useEffect, useRef } from 'react'
import { useBatchRun } from './BatchDemoContext'
import { useBitrix24Settings } from './Bitrix24SettingsContext'
import { useLogs } from './LogsContext'
import { dispatchBitrix24Notification } from '../services/bitrix24/bitrix24NotificationService'
import {
  buildQcEventPayload,
  emitQcEngineEvent,
  subscribeQcEngineEvents,
} from '../services/qc/qcEngineEventBus'
import type { QcProcessStatus } from '../types/qc'

function shouldEmitProgress(
  completedCount: number,
  interval: number,
  lastEmitted: number,
): boolean {
  if (completedCount <= 0) return false
  if (completedCount < interval) return false
  if (completedCount % interval !== 0) return false
  return completedCount !== lastEmitted
}

export function Bitrix24NotificationBridge({ children }: { children: React.ReactNode }) {
  const { bitrix24 } = useBitrix24Settings()
  const { appendLog } = useLogs()
  const {
    completedCount,
    passCount,
    total,
    status,
    startedAt,
    currentBatchLabel,
  } = useBatchRun()

  const lastProgressRef = useRef(0)
  const halfwaySentRef = useRef(false)
  const prevStatusRef = useRef<QcProcessStatus>('idle')
  const periodicTimerRef = useRef<number | null>(null)
  const completedCountRef = useRef(completedCount)
  const passCountRef = useRef(passCount)
  const totalRef = useRef(total)
  const startedAtRef = useRef(startedAt)
  const batchLabelRef = useRef(currentBatchLabel)
  completedCountRef.current = completedCount
  passCountRef.current = passCount
  totalRef.current = total
  startedAtRef.current = startedAt
  batchLabelRef.current = currentBatchLabel

  useEffect(() => {
    return subscribeQcEngineEvents((payload) => {
      if (!bitrix24.enabled) return
      void dispatchBitrix24Notification(bitrix24, payload).then((result) => {
        if (!result.ok && result.error && result.error !== 'Trigger disabled.') {
          appendLog({
            category: 'ERROR',
            message: 'Bitrix24 notification failed',
            detail: result.error,
            batchLabel: payload.batchLabel ?? undefined,
          })
        }
      })
    })
  }, [bitrix24, appendLog])

  useEffect(() => {
    if (status === 'idle' || status === 'done' || status === 'stopped') {
      lastProgressRef.current = 0
      halfwaySentRef.current = false
    }
  }, [status])

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev === status) return

    const base = buildQcEventPayload({
      batchLabel: currentBatchLabel,
      completedCount,
      passCount,
      total,
      status,
      startedAt,
    })

    if (prev !== 'running' && status === 'running' && completedCount === 0) {
      emitQcEngineEvent('onBatchStart', base)
    } else if (prev === 'running' && status === 'paused') {
      emitQcEngineEvent('onBatchPause', base)
    } else if ((prev === 'running' || prev === 'paused') && status === 'stopped') {
      emitQcEngineEvent('onBatchStop', base)
    } else if (status === 'done' && prev === 'running') {
      emitQcEngineEvent('onBatchComplete', base)
    }
  }, [status, completedCount, passCount, total, startedAt, currentBatchLabel])

  useEffect(() => {
    if (status !== 'running') return
    if (!shouldEmitProgress(completedCount, bitrix24.progressSkuInterval, lastProgressRef.current)) {
      return
    }
    lastProgressRef.current = completedCount
    emitQcEngineEvent(
      'onProgress',
      buildQcEventPayload({
        batchLabel: currentBatchLabel,
        completedCount,
        passCount,
        total,
        status,
        startedAt,
      }),
    )
  }, [completedCount, passCount, status, bitrix24.progressSkuInterval, total, startedAt, currentBatchLabel])

  useEffect(() => {
    if (status !== 'running') return
    if (halfwaySentRef.current) return
    if (total <= 0) return
    if (completedCount < Math.ceil(total / 2)) return
    halfwaySentRef.current = true
    emitQcEngineEvent(
      'onHalfway',
      buildQcEventPayload({
        batchLabel: currentBatchLabel,
        completedCount,
        passCount,
        total,
        status,
        startedAt,
      }),
    )
  }, [completedCount, passCount, total, status, startedAt, currentBatchLabel])

  useEffect(() => {
    if (periodicTimerRef.current !== null) {
      window.clearInterval(periodicTimerRef.current)
      periodicTimerRef.current = null
    }
    if (status !== 'running' || !bitrix24.enabled || !bitrix24.triggers.periodicStatus) return

    const minutes = bitrix24.periodicStatusMinutes
    const ms = minutes * 60 * 1000
    periodicTimerRef.current = window.setInterval(() => {
      const payload = buildQcEventPayload({
        batchLabel: batchLabelRef.current,
        completedCount: completedCountRef.current,
        passCount: passCountRef.current,
        total: totalRef.current,
        status: 'running',
        startedAt: startedAtRef.current,
      })
      emitQcEngineEvent('onPeriodicStatus', payload)
    }, ms)

    return () => {
      if (periodicTimerRef.current !== null) {
        window.clearInterval(periodicTimerRef.current)
        periodicTimerRef.current = null
      }
    }
  }, [status, bitrix24.enabled, bitrix24.triggers.periodicStatus, bitrix24.periodicStatusMinutes])

  return children
}
