/** @typedef {'idle' | 'logging_in' | 'armed' | 'logged_out' | 'relogging'} VendorSessionPhase */

let phase = /** @type {VendorSessionPhase} */ ('idle')
let armed = false
let statusMessage = ''
let activeStore = ''

/**
 * @param {VendorSessionPhase} next
 * @param {string} [message]
 */
export function setVendorSessionPhase(next, message = '') {
  phase = next
  statusMessage = message
  if (next === 'armed') {
    armed = true
  } else if (next === 'logged_out' || next === 'idle') {
    armed = false
  }
}

export function setActiveStoreLabel(label) {
  activeStore = label
}

export function markSessionArmed(storeLabel = '34533') {
  armed = true
  phase = 'armed'
  activeStore = storeLabel
  statusMessage = 'Portal session armed'
}

export function markSessionDisarmed(message = 'Logged out') {
  armed = false
  phase = 'logged_out'
  statusMessage = message
  activeStore = ''
}

export function isSessionArmed() {
  return armed
}

export function getVendorSessionStatus() {
  return {
    state: phase,
    armed,
    message: statusMessage,
    activeStore: activeStore || undefined,
  }
}

export function resetVendorSessionState() {
  phase = 'idle'
  armed = false
  statusMessage = ''
  activeStore = ''
}
