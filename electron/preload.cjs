const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('alatasDesktop', {
  isElectron: true,
  platform: process.platform,
})
