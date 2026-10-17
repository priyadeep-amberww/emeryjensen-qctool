/** Set from the browser worker when the QC tool is paused or stopped. */
let halted = false

export function setScrapeHalted(value) {
  halted = Boolean(value)
}

export function isScrapeHalted() {
  return halted
}
