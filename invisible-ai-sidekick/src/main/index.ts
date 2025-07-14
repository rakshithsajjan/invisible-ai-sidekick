import { app, BrowserWindow, screen, globalShortcut, ipcMain, session, desktopCapturer } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GeminiService } from '../services/geminiService';
import { voiceCommandHandler } from '../services/voiceCommandHandler';
import { pcmToWav } from '../utils/audioUtils';

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

// Initialize voice command handler
async function initializeVoiceCommands() {
  try {
    await voiceCommandHandler.initialize();
    
    // Listen for feedback to show in UI
    voiceCommandHandler.on('feedback', (message: string) => {
      mainWindow?.webContents.send('ai-response', { 
        type: 'system', 
        content: `🎯 ${message}` 
      });
    });
    
    // Listen for text responses
    voiceCommandHandler.on('textResponse', (text: string) => {
      mainWindow?.webContents.send('ai-response', { 
        type: 'text', 
        content: text 
      });
    });
    
    // Listen for command execution results
    voiceCommandHandler.on('commandExecuted', (command: any) => {
      mainWindow?.webContents.send('ai-response', { 
        type: 'system', 
        content: `✅ Command executed: ${command.command}` 
      });
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize voice commands:', error);
    return false;
  }
}

// Initialize Gemini session
async function initializeGemini(interviewMode: boolean = false) {
  console.log('Initializing Gemini...');
  console.log('Interview Mode:', interviewMode);
  console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not found');
    return false;
  }

  geminiService = new GeminiService({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-1.5-flash'  // Using stable model
  });

  geminiService.on('connected', () => {
    console.log('Connected to Gemini');
    mainWindow?.webContents.send('ai-status', 'connected');
  });

  geminiService.on('response', async (text: string) => {
    console.log('Gemini response:', text);
    
    // Pass response to voice command handler
    try {
      await voiceCommandHandler.handleGeminiResponse(text);
    } catch (error) {
      console.error('Voice command handling error:', error);
      // Still send the response to UI even if command fails
      mainWindow?.webContents.send('ai-response', { type: 'text', content: text });
    }
  });

  geminiService.on('error', (error: Error) => {
    console.error('Gemini error:', error);
    mainWindow?.webContents.send('ai-status', 'error');
  });

  geminiService.on('disconnected', () => {
    mainWindow?.webContents.send('ai-status', 'disconnected');
  });

  const initialized = await geminiService.initializeSession(interviewMode);
  console.log('Gemini initialization result:', initialized);
  return initialized;
}

// IPC Handlers (following cheating-daddy pattern)
ipcMain.handle('initialize-gemini', async (_event, interviewMode: boolean = false) => {
  console.log('=== IPC: initialize-gemini called ===');
  console.log('Interview Mode:', interviewMode);
  try {
    // Initialize voice commands first
    const voiceInitResult = await initializeVoiceCommands();
    if (!voiceInitResult) {
      console.warn('Voice commands initialization failed, continuing without voice control');
    }
    
    // Add timeout to prevent infinite hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Initialization timeout')), 10000)
    );
    
    const result = await Promise.race([
      initializeGemini(interviewMode),
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
  
  // Convert PCM to WAV format
  const wavData = pcmToWav(audioData);
  await geminiService.sendRealtimeInput({
    audio: {
      data: wavData,
      mimeType: 'audio/wav'
    }
  });
});

ipcMain.handle('send-combined-content', async (_event, data: { image?: string; audio?: string }) => {
  if (!geminiService) {
    console.error('Gemini not initialized');
    return;
  }
  
  const parts: any = {};
  
  if (data.image) {
    const base64Data = data.image.replace(/^data:image\/\w+;base64,/, '');
    parts.media = {
      data: base64Data,
      mimeType: 'image/jpeg'
    };
  }
  
  if (data.audio) {
    // Convert PCM to WAV format
    const wavData = pcmToWav(data.audio);
    parts.audio = {
      data: wavData,
      mimeType: 'audio/wav'
    };
  }
  
  await geminiService.sendRealtimeInput(parts);
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

ipcMain.handle('set-interview-mode', (_event, enabled: boolean) => {
  console.log('Setting interview mode:', enabled);
  if (geminiService) {
    geminiService.setInterviewMode(enabled);
    return true;
  }
  return false;
});