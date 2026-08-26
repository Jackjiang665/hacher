const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbito', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  patchState: (changes) => ipcRenderer.invoke('state:patch', changes),
  chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  recognizeInventoryImage: (payload) => ipcRenderer.invoke('inventory:recognize-image', payload),
  getAIStatus: () => ipcRenderer.invoke('ai:status'),
  saveAIKey: (key) => ipcRenderer.invoke('ai:save-key', key),
  saveAISettings: (settings) => ipcRenderer.invoke('ai:save-settings', settings),
  clearAIKey: () => ipcRenderer.invoke('ai:clear-key'),
  getMailStatus: () => ipcRenderer.invoke('mail:status'),
  saveAndTestMail: (settings) => ipcRenderer.invoke('mail:save-and-test', settings),
  syncMailInbox: (options) => ipcRenderer.invoke('mail:sync', options),
  getMailDetail: (itemId) => ipcRenderer.invoke('mail:detail', itemId),
  clearMailSettings: () => ipcRenderer.invoke('mail:clear'),
  onMailStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('mail:status-changed', handler);
    return () => ipcRenderer.removeListener('mail:status-changed', handler);
  },
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  showDataFolder: () => ipcRenderer.invoke('data:show-folder'),
  importPapers: () => ipcRenderer.invoke('paper:import'),
  openPaper: (paperId) => ipcRenderer.invoke('paper:open', paperId),
  deletePaper: (paperId) => ipcRenderer.invoke('paper:delete', paperId),
  attachProjectFiles: (options) => ipcRenderer.invoke('project:attach-files', options),
  openProjectFile: (projectId, fileId) => ipcRenderer.invoke('project:open-file', projectId, fileId),
  removeProjectFile: (projectId, fileId) => ipcRenderer.invoke('project:remove-file', projectId, fileId),
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
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
  generateBriefing: (topic) => ipcRenderer.invoke('briefing:generate', topic),
  addTopic: (name) => ipcRenderer.invoke('topic:add', name),
  deleteTopic: (id) => ipcRenderer.invoke('topic:delete', id),
  generateTopicBriefing: (topicId) => ipcRenderer.invoke('briefing:generate', topicId),
});
