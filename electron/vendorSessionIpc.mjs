import { ipcMain } from 'electron'
import {
  cancelEmryVendorBrowserSession,
  getVendorSessionStatus,
  performEmryVendorLogin,
  reloginEmryVendorSession,
} from './vendor/emry/vendorSessionManager.mjs'

export function registerVendorSessionIpc() {
  ipcMain.handle('vendorSession:login', async (_event, payload) => {
    return performEmryVendorLogin({
      vendorLoginRequired: payload?.vendorLoginRequired !== false,
      reuseSession: payload?.reuseSession === true,
    })
  })

  ipcMain.handle('vendorSession:exit', async () => cancelEmryVendorBrowserSession())

  ipcMain.handle('vendorSession:relogin', async () => reloginEmryVendorSession())

  ipcMain.handle('vendorSession:status', async () => getVendorSessionStatus())
}
