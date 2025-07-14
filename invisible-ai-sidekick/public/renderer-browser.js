console.log('=== RENDERER SCRIPT STARTING ===');
console.log('=== CHECKING WINDOW STATE ===');
console.log('Window location:', window.location.href);
console.log('Document readyState:', document.readyState);
console.log('electronAPI exists:', !!window.electronAPI);

let isCapturing = false;
let isInterviewMode = false; // Default OFF - voice control mode

function initializeApp() {
  console.log('=== INITIALIZING APP ===');
  
  const toggleCaptureBtn = document.getElementById('toggleCapture');
  const toggleClickThroughBtn = document.getElementById('toggleClickThrough');
  const toggleInterviewModeBtn = document.getElementById('toggleInterviewMode');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const responseText = document.getElementById('responseText');
  const commandInput = document.getElementById('commandInput');
  const sendCommand = document.getElementById('sendCommand');

  console.log('DOM elements found:', {
    toggleCaptureBtn: !!toggleCaptureBtn,
    toggleClickThroughBtn: !!toggleClickThroughBtn,
    toggleInterviewModeBtn: !!toggleInterviewModeBtn,
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
  
  // Interview Mode button
  if (toggleInterviewModeBtn) {
    toggleInterviewModeBtn.addEventListener('click', async () => {
      console.log('Interview mode button clicked');
      isInterviewMode = !isInterviewMode;
      toggleInterviewModeBtn.textContent = isInterviewMode ? 'Interview Mode: ON' : 'Interview Mode: OFF';
      toggleInterviewModeBtn.classList.toggle('active', isInterviewMode);
      
      // Update Gemini with new mode
      if (isCapturing) {
        await window.electronAPI.setInterviewMode(isInterviewMode);
      }
      
      // Update response text to show mode change
      if (responseText) {
        responseText.textContent = isInterviewMode 
          ? 'Interview Mode ON - I will explain what I see and hear to help you'
          : 'Voice Control Mode ON - Say commands to control your Mac';
      }
    });
    console.log('✓ Interview mode event listener added');
  }
  
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
    console.log('Current capture state:', isCapturing);
    
    try {
      if (!isCapturing) {
        console.log('Starting capture...');
        toggleCaptureBtn.textContent = 'Stop';
        toggleCaptureBtn.classList.add('stop');
        
        console.log('Calling electronAPI.initializeGemini()...');
        const initialized = await window.electronAPI.initializeGemini(isInterviewMode);
        console.log('Gemini initialized result:', initialized);
        
        if (initialized) {
          isCapturing = true;
          console.log('Starting capture process...');
          startCapture();
          
          if (statusIndicator) statusIndicator.classList.add('active');
          if (responseText) responseText.textContent = 'AI Connected - Ready for capture';
        } else {
          console.error('Failed to initialize Gemini');
          toggleCaptureBtn.textContent = 'Start';
          toggleCaptureBtn.classList.remove('stop');
          if (responseText) responseText.textContent = 'Failed to initialize AI';
        }
      } else {
        console.log('Stopping capture...');
        isCapturing = false;
        toggleCaptureBtn.textContent = 'Start';
        toggleCaptureBtn.classList.remove('stop');
        
        stopCapture();
        
        if (statusIndicator) statusIndicator.classList.remove('active');
        if (responseText) responseText.textContent = 'AI Disconnected';
        await window.electronAPI.stopCapture();
      }
    } catch (error) {
      console.error('Capture toggle error:', error);
      toggleCaptureBtn.textContent = 'Start';
      toggleCaptureBtn.classList.remove('stop');
      isCapturing = false;
    }
  });
  console.log('✓ Capture event listener added');
  
  // Command input handlers
  if (sendCommand && commandInput) {
    const sendCommandHandler = async () => {
      const command = commandInput.value.trim();
      if (!command) return;
      
      if (!isCapturing) {
        alert('Please start capture first');
        return;
      }
      
      console.log('Sending command:', command);
      try {
        await window.electronAPI.sendTextMessage(command);
        commandInput.value = '';
      } catch (error) {
        console.error('Failed to send command:', error);
      }
    };
    
    sendCommand.addEventListener('click', sendCommandHandler);
    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendCommandHandler();
      }
    });
    console.log('✓ Command input event listeners added');
  }

  // AI Status listener
  window.electronAPI.onAIStatus((status) => {
    console.log('AI Status update:', status);
    if (statusText && statusIndicator) {
      switch(status) {
        case 'connected':
          statusText.textContent = 'Connected';
          statusIndicator.classList.add('active');
          break;
        case 'error':
          statusText.textContent = 'Error';
          statusIndicator.classList.remove('active');
          break;
        default:
          statusText.textContent = 'Disconnected';
          statusIndicator.classList.remove('active');
      }
    }
  });

  // AI Response listener  
  window.electronAPI.onAIResponse((response) => {
    console.log('AI Response received:', response);
    if (response.type === 'text' && responseText) {
      responseText.textContent = response.content;
    } else if (response.type === 'system' && responseText) {
      responseText.innerHTML = `<span style="color: #00ff00;">${response.content}</span>`;
    }
  });

  console.log('=== INITIALIZATION COMPLETE ===');
}

// Wait for DOM to load
if (document.readyState === 'loading') {
  console.log('DOM loading, adding event listener...');
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  console.log('DOM already loaded, initializing...');
  initializeApp();
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('=== GLOBAL ERROR ===', event.error);
});

// Combined capture state
let captureState = {
  audioBuffer: [],
  currentScreenshot: null,
  lastSendTime: 0,
  sendInterval: null
};

// Capture functionality
let screenStream = null;
let audioContext = null;
let scriptProcessor = null;

async function startCapture() {
  console.log('=== STARTING CAPTURE ===');
  
  try {
    // 1. Get screen capture with system audio using Electron's display media handler
    console.log('Getting display media...');
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    
    console.log('Screen capture started');
    
    // 2. Get microphone audio stream
    console.log('Starting microphone capture...');
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
        channelCount: 1
      }
    });
    console.log('Microphone capture started');
    
    // 3. Extract system audio from screen stream if available
    let systemAudioStream = null;
    try {
      const audioTracks = screenStream.getAudioTracks();
      if (audioTracks.length > 0) {
        systemAudioStream = new MediaStream([audioTracks[0]]);
        console.log('System audio available');
      }
    } catch (error) {
      console.log('System audio not available:', error.message);
    }
    
    // 4. Start screenshot capture
    startScreenshotCapture();
    
    // 5. Start audio processing
    startAudioProcessing(micStream, systemAudioStream);
    
    // 6. Start combined data sender
    startCombinedSender();
    
    const responseText = document.getElementById('responseText');
    if (responseText) responseText.textContent = 'Capturing screen and audio - Speak naturally!';
    
    console.log('=== CAPTURE STARTED SUCCESSFULLY ===');
  } catch (error) {
    console.error('Capture error:', error);
    const responseText = document.getElementById('responseText');
    if (responseText) responseText.textContent = `Error: ${error.message}`;
    isCapturing = false;
  }
}

function startScreenshotCapture() {
  const video = document.createElement('video');
  video.srcObject = screenStream;
  video.play();
  
  video.onloadedmetadata = () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    console.log('Screenshot resolution:', canvas.width + 'x' + canvas.height);
    
    // Capture screenshots continuously
    setInterval(() => {
      if (!isCapturing) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        
        const reader = new FileReader();
        reader.onloadend = () => {
          captureState.currentScreenshot = reader.result;
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.7);
    }, 1000); // Every second
  };
}

function startAudioProcessing(micStream, systemAudioStream) {
  console.log('Setting up audio processing...');
  audioContext = new AudioContext({ sampleRate: 16000 });
  
  // Create sources
  const micSource = audioContext.createMediaStreamSource(micStream);
  let systemSource = null;
  
  // Create mixer
  const mixer = audioContext.createGain();
  
  // Connect microphone
  micSource.connect(mixer);
  
  // Connect system audio if available
  if (systemAudioStream) {
    try {
      systemSource = audioContext.createMediaStreamSource(systemAudioStream);
      systemSource.connect(mixer);
      console.log('System audio connected');
    } catch (error) {
      console.warn('Could not connect system audio:', error);
    }
  }
  
  // Create processor
  scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
  
  scriptProcessor.onaudioprocess = (event) => {
    if (!isCapturing) return;
    
    const inputData = event.inputBuffer.getChannelData(0);
    const pcm16 = new Int16Array(inputData.length);
    
    // Convert to PCM16
    for (let i = 0; i < inputData.length; i++) {
      pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
    }
    
    // Add to buffer - no limits as requested
    captureState.audioBuffer.push(...pcm16);
  };
  
  // Connect everything
  mixer.connect(scriptProcessor);
  scriptProcessor.connect(audioContext.destination);
  
  console.log('Audio processing started');
}

function startCombinedSender() {
  // Send combined data every 3 seconds
  captureState.sendInterval = setInterval(async () => {
    if (!isCapturing) return;
    
    const now = Date.now();
    
    // Prepare combined data
    const combinedData = {};
    
    // Add screenshot if available
    if (captureState.currentScreenshot) {
      combinedData.image = captureState.currentScreenshot;
    }
    
    // Add all accumulated audio
    if (captureState.audioBuffer.length > 0) {
      // Convert entire buffer to base64
      const audioArray = new Int16Array(captureState.audioBuffer);
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioArray.buffer)));
      combinedData.audio = base64Audio;
      
      console.log('Sending combined data - Audio samples:', captureState.audioBuffer.length, 'Screenshot:', !!combinedData.image);
      
      // Clear buffer after sending
      captureState.audioBuffer = [];
    }
    
    // Send if we have any data
    if (combinedData.image || combinedData.audio) {
      try {
        await window.electronAPI.sendCombinedContent(combinedData);
        captureState.lastSendTime = now;
      } catch (error) {
        console.error('Failed to send combined content:', error);
      }
    }
  }, 2000); // Every 2 seconds
}

function stopCapture() {
  console.log('=== STOPPING CAPTURE ===');
  
  // Stop combined sender
  if (captureState.sendInterval) {
    clearInterval(captureState.sendInterval);
    captureState.sendInterval = null;
  }
  
  // Clear capture state
  captureState.audioBuffer = [];
  captureState.currentScreenshot = null;
  
  // Stop streams
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  
  // Stop audio
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  console.log('Capture stopped');
}

console.log('=== RENDERER SCRIPT LOADED ===');