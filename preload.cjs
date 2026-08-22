const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbito', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  recognizeInventoryImage: (payload) => ipcRenderer.invoke('inventory:recognize-image', payload),
  getAIStatus: () => ipcRenderer.invoke('ai:status'),
  saveAIKey: (key) => ipcRenderer.invoke('ai:save-key', key),
  saveAISettings: (settings) => ipcRenderer.invoke('ai:save-settings', settings),
  clearAIKey: () => ipcRenderer.invoke('ai:clear-key'),
  showDataFolder: () => ipcRenderer.invoke('data:show-folder'),
  importPapers: () => ipcRenderer.invoke('paper:import'),
  openPaper: (paperId) => ipcRenderer.invoke('paper:open', paperId),
  deletePaper: (paperId) => ipcRenderer.invoke('paper:delete', paperId),
  terminalStart: (options) => ipcRenderer.invoke('terminal:start', options),
  terminalWrite: (data) => ipcRenderer.send('terminal:write', data),
  terminalResize: (cols, rows) => ipcRenderer.send('terminal:resize', { cols, rows }),
  terminalKill: () => ipcRenderer.invoke('terminal:kill'),
  onTerminalData: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
  onTerminalExit: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  },
  onStateChanged: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', handler);
    return () => ipcRenderer.removeListener('state:changed', handler);
  },
  generateBriefing: (topic) => ipcRenderer.invoke('briefing:generate', topic),
  addTopic: (name) => ipcRenderer.invoke('topic:add', name),
  deleteTopic: (id) => ipcRenderer.invoke('topic:delete', id),
  generateTopicBriefing: (topicId) => ipcRenderer.invoke('briefing:generate', topicId),
});
