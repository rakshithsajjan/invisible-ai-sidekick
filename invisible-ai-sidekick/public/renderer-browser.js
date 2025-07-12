console.log('=== RENDERER SCRIPT STARTING ===');
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
        if (responseText) {
          responseText.textContent = 'Initializing AI...';
          console.log('Set response text to: Initializing AI...');
        }
        
        console.log('Calling electronAPI.initializeGemini()...');
        const initialized = await window.electronAPI.initializeGemini();
        console.log('Gemini initialized result:', initialized);
        
        if (initialized) {
          console.log('Gemini initialized successfully, starting capture...');
          isCapturing = true;
          toggleCaptureBtn.textContent = 'Stop';
          
          if (statusText) statusText.textContent = 'Capturing';
          if (statusIndicator) statusIndicator.classList.add('active');
          if (responseText) responseText.textContent = 'Starting screen and audio capture...';
          
          // Start actual capture
          await startCapture();
        } else {
          console.log('Gemini initialization failed');
          if (responseText) {
            responseText.textContent = 'Failed to initialize AI';
            console.log('Response text changed to: Failed to initialize AI');
          }
        }
      } else {
        console.log('Stopping capture...');
        isCapturing = false;
        stopCapture();
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
  window.electronAPI.onAIStatus((status) => {
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
  window.electronAPI.onAIResponse((response) => {
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

// Capture functionality
let screenStream = null;
let audioContext = null;
let scriptProcessor = null;
let screenshotInterval = null;

// Smart context tracking
let lastScreenshot = null;
let lastAudioLevel = 0;
let conversationState = {
  hasRecentQuestion: false,
  lastQuestionTime: 0,
  awaitingResponse: false
};

async function startCapture() {
  try {
    console.log('Starting screen capture...');
    
    // 1. Get screen stream
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
        frameRate: 5
      },
      audio: false
    });
    
    console.log('Screen capture started');
    
    // 2. Get microphone audio stream (lower quality for faster uploads)
    console.log('Starting microphone capture...');
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000  // Reduced from 24000 to 16000
      }
    });
    
    // 3. Get system audio via display media (if supported)
    console.log('Starting system audio capture...');
    let systemAudioStream = null;
    try {
      systemAudioStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 16000  // Reduced from 24000 to 16000
        }
      });
      console.log('System audio capture started');
    } catch (error) {
      console.log('System audio not available, using microphone only:', error.message);
    }
    
    console.log('Audio capture configured');
    
    // 4. Start screenshot capture
    startScreenshotCapture();
    
    // 5. Start audio processing (both mic and system audio)
    startAudioProcessing(micStream, systemAudioStream);
    
    const responseText = document.getElementById('responseText');
    if (responseText) responseText.textContent = 'Capturing screen and audio - Ask questions!';
    
  } catch (error) {
    console.error('Failed to start capture:', error);
    const responseText = document.getElementById('responseText');
    if (responseText) responseText.textContent = 'Capture failed: ' + error.message;
  }
}

function startScreenshotCapture() {
  console.log('Setting up screenshot capture...');
  const canvas = document.createElement('canvas');
  const video = document.createElement('video');
  video.srcObject = screenStream;
  video.play();
  
  video.onloadedmetadata = () => {
    // Reduce resolution for faster uploads (max 1280px wide)
    const maxWidth = 1280;
    const aspectRatio = video.videoHeight / video.videoWidth;
    
    if (video.videoWidth > maxWidth) {
      canvas.width = maxWidth;
      canvas.height = maxWidth * aspectRatio;
    } else {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    const ctx = canvas.getContext('2d');
    console.log('Screenshot resolution:', canvas.width + 'x' + canvas.height);
    
    console.log('Starting screenshot interval');
    screenshotInterval = setInterval(() => {
      if (!isCapturing) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Only send screenshot if there's recent conversation activity
      const now = Date.now();
      const hasRecentActivity = conversationState.hasRecentQuestion && (now - conversationState.lastQuestionTime < 10000); // 10 seconds
      
      if (hasRecentActivity || !lastScreenshot) {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result;
            
            // Simple change detection - only send if different from last
            if (base64 !== lastScreenshot) {
              console.log('Sending screenshot, size:', base64.length, 'chars');
              const startTime = Date.now();
              
              try {
                await window.electronAPI.sendImageContent(base64);
                const endTime = Date.now();
                console.log('✓ Screenshot upload completed in', (endTime - startTime) + 'ms');
                lastScreenshot = base64;
              } catch (error) {
                const endTime = Date.now();
                console.error('✗ Screenshot upload failed after', (endTime - startTime) + 'ms:', error);
              }
            }
          };
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.5); // Reduced quality from 0.7 to 0.5 for faster uploads
      }
      
    }, 1500); // Every 1.5 seconds but smart filtering
  };
}

function startAudioProcessing(micStream, systemAudioStream) {
  console.log('Setting up audio processing...');
  audioContext = new AudioContext({ sampleRate: 16000 }); // Reduced from 24000
  
  // Create sources for both streams
  const micSource = audioContext.createMediaStreamSource(micStream);
  let systemSource = null;
  
  // Create a mixer to combine both audio sources
  const mixer = audioContext.createGain();
  
  // Connect microphone
  micSource.connect(mixer);
  
  // Connect system audio if available
  if (systemAudioStream) {
    try {
      systemSource = audioContext.createMediaStreamSource(systemAudioStream);
      systemSource.connect(mixer);
      console.log('System audio connected to mixer');
    } catch (error) {
      console.log('Could not connect system audio:', error.message);
    }
  }
  
  scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1); // Larger buffer
  
  let audioBuffer = [];
  let lastSent = 0;
  
  scriptProcessor.onaudioprocess = (event) => {
    if (!isCapturing) return;
    
    const inputBuffer = event.inputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    
    // Convert to PCM16
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Accumulate audio data
    audioBuffer.push(...pcm16);
    
    // Calculate audio level to detect speech/system audio
    let audioLevel = 0;
    for (let i = 0; i < inputData.length; i++) {
      audioLevel += Math.abs(inputData[i]);
    }
    audioLevel = audioLevel / inputData.length;
    
    // Send audio when there's significant activity (lower threshold for system audio)
    const now = Date.now();
    const hasAudioActivity = audioLevel > 0.005; // Lower threshold to catch system audio
    const shouldSendAudio = hasAudioActivity && (now - lastSent > 5000) && audioBuffer.length > 32000; // Wait 5 seconds between sends
    
    if (shouldSendAudio) {
      const audioChunk = audioBuffer.slice(0, 32000); // 2 seconds at 16kHz
      audioBuffer = audioBuffer.slice(32000);
      
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioChunk.buffer)));
      
      console.log('Sending audio chunk, size:', base64Audio.length, 'chars');
      const startTime = Date.now();
      
      window.electronAPI.sendAudioContent(base64Audio).then(() => {
        const endTime = Date.now();
        console.log('✓ Audio upload completed in', (endTime - startTime) + 'ms');
      }).catch(error => {
        const endTime = Date.now();
        console.error('✗ Audio upload failed after', (endTime - startTime) + 'ms:', error);
      });
      
      lastSent = now;
      conversationState.hasRecentQuestion = true;
      conversationState.lastQuestionTime = now;
      console.log('Sent 2-second audio chunk (16kHz, level:', audioLevel.toFixed(4), ')');
    }
    
    lastAudioLevel = audioLevel;
  };
  
  // Connect mixer to processor
  mixer.connect(scriptProcessor);
  scriptProcessor.connect(audioContext.destination);
  
  console.log('Audio processing started (mic + system audio)');
}

function stopCapture() {
  console.log('Stopping capture...');
  
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
  
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  
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