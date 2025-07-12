import { app, BrowserWindow, screen, globalShortcut, ipcMain, session, desktopCapturer } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GeminiService } from '../services/geminiService';

dotenv.config();

let mainWindow: BrowserWindow | null = null;
let isClickThrough = false;
let geminiService: GeminiService | null = null;

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: width - 420,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      enableBlinkFeatures: 'GetDisplayMedia',
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));
  
  // Open devtools for debugging
  mainWindow.webContents.openDevTools();
  
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating', 1);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Setup display media request handler (like cheating-daddy)
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    console.log('Display media request received');
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources.length > 0) {
        console.log('Screen sources found:', sources.length);
        callback({ video: sources[0], audio: 'loopback' });
      } else {
        console.error('No screen sources found');
        callback({});
      }
    } catch (error) {
      console.error('Error in display media request handler:', error);
      callback({});
    }
  }, { useSystemPicker: true });
  
  createWindow();
  
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      isClickThrough = !isClickThrough;
      mainWindow.setIgnoreMouseEvents(isClickThrough);
    }
  });
  
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
  
  app.setAccessibilitySupportEnabled(true);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});


ipcMain.handle('toggle-click-through', () => {
  console.log('=== IPC: toggle-click-through called ===');
  if (mainWindow) {
    isClickThrough = !isClickThrough;
    mainWindow.setIgnoreMouseEvents(isClickThrough);
    return isClickThrough;
  }
  return false;
});

// Initialize Gemini session
async function initializeGemini() {
  console.log('Initializing Gemini...');
  console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not found');
    return false;
  }

  geminiService = new GeminiService({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash-lite-preview-06-17'  // Using 2.5 lite model
  });

  geminiService.on('connected', () => {
    console.log('Connected to Gemini');
    mainWindow?.webContents.send('ai-status', 'connected');
  });

  geminiService.on('response', (text: string) => {
    console.log('Gemini response:', text);
    mainWindow?.webContents.send('ai-response', { type: 'text', content: text });
  });

  geminiService.on('error', (error: Error) => {
    console.error('Gemini error:', error);
    mainWindow?.webContents.send('ai-status', 'error');
  });

  geminiService.on('disconnected', () => {
    mainWindow?.webContents.send('ai-status', 'disconnected');
  });

  const initialized = await geminiService.initializeSession();
  console.log('Gemini initialization result:', initialized);
  return initialized;
}

// IPC Handlers (following cheating-daddy pattern)
ipcMain.handle('initialize-gemini', async () => {
  console.log('=== IPC: initialize-gemini called ===');
  try {
    // Add timeout to prevent infinite hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Initialization timeout')), 10000)
    );
    
    const result = await Promise.race([
      initializeGemini(),
      timeoutPromise
    ]);
    
    return result;
  } catch (error) {
    console.error('Gemini initialization failed:', error);
    return false;
  }
});

ipcMain.handle('send-image-content', async (_event, imageData: string) => {
  if (!geminiService) {
    console.error('Gemini not initialized');
    return;
  }
  
  // Remove data URL prefix if present
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  await geminiService.sendRealtimeInput({
    media: {
      data: base64Data,
      mimeType: 'image/jpeg'
    }
  });
});

ipcMain.handle('send-audio-content', async (_event, audioData: string) => {
  if (!geminiService) {
    console.error('Gemini not initialized');
    return;
  }
  
  // Audio should be base64 PCM data
  await geminiService.sendRealtimeInput({
    audio: {
      data: audioData,
      mimeType: 'audio/pcm;rate=24000'
    }
  });
});

ipcMain.handle('send-text-message', async (_event, text: string) => {
  if (!geminiService) {
    console.error('Gemini not initialized');
    return;
  }
  
  await geminiService.sendRealtimeInput({ text });
});

ipcMain.on('screen-capture', (_event, imageData: string) => {
  // Legacy handler - redirect to new handler
  ipcMain.emit('send-image-content', _event, imageData);
});

ipcMain.on('audio-data', (_event, audioData: string) => {
  // Legacy handler - redirect to new handler
  ipcMain.emit('send-audio-content', _event, audioData);
});

ipcMain.handle('start-capture', async () => {
  // Initialize Gemini if not already done
  if (!geminiService) {
    return await initializeGemini();
  }
  return true;
});

ipcMain.handle('stop-capture', () => {
  if (geminiService) {
    geminiService.close();
    geminiService = null;
  }
  return true;
});