'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gettsum', {
  getState: () => ipcRenderer.invoke('state:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  regeneratePairing: () => ipcRenderer.invoke('pairing:regenerate'),
  removeDevice: (id) => ipcRenderer.invoke('device:remove', id),
  renameDevice: (id, name) => ipcRenderer.invoke('device:rename', id, name),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  selectAddress: (address) => ipcRenderer.invoke('address:select', address),
  restartServer: () => ipcRenderer.invoke('server:restart'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state', listener);
    return () => ipcRenderer.removeListener('state', listener);
  },
});
