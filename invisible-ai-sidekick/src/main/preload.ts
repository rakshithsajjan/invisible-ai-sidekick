import { contextBridge, ipcRenderer } from 'electron';

// Following cheating-daddy's pattern
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  toggleClickThrough: () => ipcRenderer.invoke('toggle-click-through'),
  
  // Gemini integration (cheating-daddy style)
  initializeGemini: () => ipcRenderer.invoke('initialize-gemini'),
  sendImageContent: (imageData: string) => ipcRenderer.invoke('send-image-content', imageData),
  sendAudioContent: (audioData: string) => ipcRenderer.invoke('send-audio-content', audioData),
  sendTextMessage: (text: string) => ipcRenderer.invoke('send-text-message', text),
  
  // Event listeners
  onAIResponse: (callback: (response: { type: string; content: any }) => void) => {
    ipcRenderer.on('ai-response', (_event, response) => callback(response));
  },
  onAIStatus: (callback: (status: string) => void) => {
    ipcRenderer.on('ai-status', (_event, status) => callback(status));
  },
  
  // Legacy compatibility
  sendScreenCapture: (imageData: string) => {
    ipcRenderer.send('screen-capture', imageData);
  },
  sendAudioData: (audioData: string) => {
    ipcRenderer.send('audio-data', audioData);
  },
  startCapture: () => ipcRenderer.invoke('start-capture'),
  stopCapture: () => ipcRenderer.invoke('stop-capture')
});