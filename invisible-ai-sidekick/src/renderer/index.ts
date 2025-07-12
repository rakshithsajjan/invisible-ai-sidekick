console.log('=== RENDERER SCRIPT STARTING ===');

interface ElectronAPI {
  toggleClickThrough: () => Promise<boolean>;
  initializeGemini: () => Promise<boolean>;
  sendImageContent: (imageData: string) => Promise<void>;
  sendAudioContent: (audioData: string) => Promise<void>;
  sendTextMessage: (text: string) => Promise<void>;
  onAIResponse: (callback: (response: { type: string; content: any }) => void) => void;
  onAIStatus: (callback: (status: string) => void) => void;
  startCapture: () => Promise<boolean>;
  stopCapture: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

console.log('=== CHECKING WINDOW STATE ===');
console.log('Window location:', window.location.href);
console.log('Document readyState:', document.readyState);
console.log('electronAPI exists:', !!window.electronAPI);

let isCapturing = false;

function initializeApp() {
  console.log('=== INITIALIZING APP ===');
  
  const toggleCaptureBtn = document.getElementById('toggleCapture');
  const toggleClickThroughBtn = document.getElementById('toggleClickThrough');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const responseText = document.getElementById('responseText');

  console.log('DOM elements found:', {
    toggleCaptureBtn: !!toggleCaptureBtn,
    toggleClickThroughBtn: !!toggleClickThroughBtn,
    statusIndicator: !!statusIndicator,
    statusText: !!statusText,
    responseText: !!responseText
  });
  
  if (!toggleCaptureBtn) {
    console.error('toggleCaptureBtn not found!');
    return;
  }

  if (!window.electronAPI) {
    console.error('electronAPI not available!');
    return;
  }

  console.log('=== ADDING EVENT LISTENERS ===');
  
  // Click Through button
  if (toggleClickThroughBtn) {
    toggleClickThroughBtn.addEventListener('click', async () => {
      console.log('Click through button clicked');
      try {
        const isClickThrough = await window.electronAPI.toggleClickThrough();
        toggleClickThroughBtn.textContent = isClickThrough ? 'Interactive' : 'Click Through';
      } catch (error) {
        console.error('Click through error:', error);
      }
    });
    console.log('✓ Click through event listener added');
  }

  // Capture button
  toggleCaptureBtn.addEventListener('click', async () => {
    console.log('=== CAPTURE BUTTON CLICKED ===');
    console.log('Current isCapturing state:', isCapturing);
    
    try {
      if (!isCapturing) {
        console.log('Starting capture...');
        if (responseText) responseText.textContent = 'Initializing AI...';
        
        const initialized = await window.electronAPI.initializeGemini();
        console.log('Gemini initialized:', initialized);
        
        if (initialized) {
          isCapturing = true;
          toggleCaptureBtn.textContent = 'Stop';
          if (statusText) statusText.textContent = 'Capturing';
          if (statusIndicator) statusIndicator.classList.add('active');
          if (responseText) responseText.textContent = 'AI Connected - Ready for capture';
        } else {
          if (responseText) responseText.textContent = 'Failed to initialize AI';
        }
      } else {
        console.log('Stopping capture...');
        isCapturing = false;
        toggleCaptureBtn.textContent = 'Start';
        if (statusText) statusText.textContent = 'Ready';
        if (statusIndicator) statusIndicator.classList.remove('active');
        if (responseText) responseText.textContent = 'AI Disconnected';
        await window.electronAPI.stopCapture();
      }
    } catch (error) {
      console.error('Capture button error:', error);
      if (responseText) responseText.textContent = 'Error: ' + error;
    }
  });
  
  console.log('✓ Capture event listener added');

  // AI Status listener
  window.electronAPI.onAIStatus((status: string) => {
    console.log('AI Status update:', status);
    if (statusText && statusIndicator) {
      if (status === 'connected') {
        statusText.textContent = 'AI Connected';
        statusIndicator.style.backgroundColor = '#4CAF50';
      } else if (status === 'error') {
        statusText.textContent = 'AI Error';
        statusIndicator.style.backgroundColor = '#f44336';
      } else if (status === 'disconnected') {
        statusText.textContent = 'AI Disconnected';
        statusIndicator.style.backgroundColor = '#666';
      }
    }
  });

  // AI Response listener  
  window.electronAPI.onAIResponse((response: { type: string; content: any }) => {
    console.log('AI Response received:', response);
    if (response.type === 'text' && responseText) {
      responseText.textContent = response.content;
    }
  });

  console.log('✓ All event listeners added successfully');
}

// Initialize immediately or when DOM is ready
console.log('=== SETTING UP DOM READY HANDLER ===');
if (document.readyState === 'loading') {
  console.log('DOM still loading, adding DOMContentLoaded listener');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired');
    initializeApp();
  });
} else {
  console.log('DOM already ready, initializing immediately');
  initializeApp();
}

console.log('=== RENDERER SCRIPT COMPLETED ===');