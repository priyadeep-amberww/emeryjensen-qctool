const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  qc: {
    validateUpload: (request) => ipcRenderer.invoke('qc:validateUpload', request),
    startBatch: (payload) => ipcRenderer.invoke('qc:startBatch', payload),
    pauseBatch: (payload) => ipcRenderer.invoke('qc:pauseBatch', payload),
    resumeBatch: (payload) => ipcRenderer.invoke('qc:resumeBatch', payload),
    stopBatch: (payload) => ipcRenderer.invoke('qc:stopBatch', payload),
    getSession: (payload) => ipcRenderer.invoke('qc:getSession', payload),
    appendBatchResult: (payload) => ipcRenderer.invoke('qc:appendBatchResult', payload),
    exportBatch: (request) => ipcRenderer.invoke('qc:exportBatch', request),
    processRow: (payload) => ipcRenderer.invoke('qc:processRow', payload),
    pingInternet: () => ipcRenderer.invoke('qc:pingInternet'),
  },
  vendorSession: {
    login: (request) => ipcRenderer.invoke('vendorSession:login', request),
    exit: () => ipcRenderer.invoke('vendorSession:exit'),
    relogin: () => ipcRenderer.invoke('vendorSession:relogin'),
    status: () => ipcRenderer.invoke('vendorSession:status'),
  },
  errorEngine: {
    cancelSession: () => ipcRenderer.invoke('errorEngine:cancelSession'),
    relogin: (payload) => ipcRenderer.invoke('errorEngine:relogin', payload),
    executeScrape: (payload) => ipcRenderer.invoke('errorEngine:executeScrape', payload),
  },
  credentials: {
    getStatus: () => ipcRenderer.invoke('credentials:getStatus'),
    getDisplayValues: () => ipcRenderer.invoke('credentials:getDisplayValues'),
    save: (groupId, values) => ipcRenderer.invoke('credentials:save', { groupId, values }),
    saveAll: (items) => ipcRenderer.invoke('credentials:saveAll', { items }),
    clear: (groupId) => ipcRenderer.invoke('credentials:clear', { groupId }),
    test: (groupId) => ipcRenderer.invoke('credentials:test', { groupId }),
    encryptionAvailable: () => ipcRenderer.invoke('credentials:encryptionAvailable'),
  },
  aiCaps: {
    get: () => ipcRenderer.invoke('aiCaps:get'),
    save: (caps) => ipcRenderer.invoke('aiCaps:save', caps),
  },
  bitrix24: {
    testConnection: () => ipcRenderer.invoke('bitrix24:testConnection'),
    sendMessage: (payload) => ipcRenderer.invoke('bitrix24:sendMessage', payload),
  },
  export: {
    generateCustomExcel: (request) => ipcRenderer.invoke('export:generateCustomExcel', request),
  },
})
