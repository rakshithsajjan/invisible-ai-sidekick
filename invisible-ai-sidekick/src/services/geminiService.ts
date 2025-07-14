import { GoogleGenerativeAI } from '@google/generative-ai';
import { EventEmitter } from 'events';

interface GeminiConfig {
  apiKey: string;
  model?: string;
  systemPrompt?: string;
}

export class GeminiService extends EventEmitter {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private session: any;
  private config: GeminiConfig;
  private lastRequestTime: number = 0;
  private interviewMode: boolean = false;

  constructor(config: GeminiConfig) {
    super();
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  setInterviewMode(enabled: boolean) {
    this.interviewMode = enabled;
    console.log('Interview mode set to:', enabled);
  }

  async initializeSession(interviewMode: boolean = false) {
    this.interviewMode = interviewMode;
    try {
      // Using a standard model that definitely exists
      const modelName = this.config.model || 'gemini-1.5-flash';
      
      console.log('Initializing Gemini model:', modelName);
      console.log('API Key length:', this.config.apiKey?.length);
      
      this.model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      // Start a multi-turn conversation with initial context
      const systemPrompt = this.interviewMode ? this.getInterviewModePrompt() : this.getVoiceControlPrompt();
      
      this.session = this.model.startChat({
        history: [{
          role: 'user',
          parts: [{text: systemPrompt}],
        }, {
          role: 'model',
          parts: [{text: this.interviewMode 
            ? 'I understand. I\'m in Interview Mode - I\'ll analyze what I see on your screen and hear in the audio to provide helpful explanations and assistance for your interview.'
            : 'I understand. I\'m in Voice Control Mode - I\'ll listen for your voice commands to control your Mac. Say things like "open Safari" or "click the button" and I\'ll execute them.'}],
        }],
      });

      console.log('Gemini session initialized successfully');
      this.emit('connected');
      
      return true;
    } catch (error: any) {
      console.error('Failed to initialize Gemini session:', error);
      console.error('Error details:', error.message);
      this.emit('error', error);
      return false;
    }
  }

  async sendRealtimeInput(data: any, retryCount = 0) {
    if (!this.session) {
      console.error('Session not initialized');
      return;
    }

    // Rate limiting: ensure at least 4 seconds between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = 4000; // 4 seconds = 15 requests per minute max
    
    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();

    const maxRetries = 2;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    try {
      // Handle different input types like cheating-daddy
      let parts: any[] = [];
      let inputType = 'unknown';

      if (data.text) {
        // Text input
        parts.push({ text: data.text });
        inputType = 'text';
      } 
      
      // Handle audio - Gemini supports audio input!
      if (data.audio) {
        // Gemini expects audio as inline data with proper MIME type
        parts.push({
          inlineData: {
            mimeType: 'audio/wav',  // Changed from audio/pcm
            data: data.audio.data
          }
        });
        inputType = inputType === 'unknown' ? 'audio' : inputType + '+audio';
        console.log('🎤 Audio data added to request');
      }
      
      // Handle image
      if (data.media) {
        const imageSize = data.media.data.length;
        if (imageSize > 200000) { // Still limit images for performance
          console.log('⚠️  Skipping large image (', imageSize, 'chars) due to slow connection');
          // Don't return - still send audio if present
        } else {
          parts.push({
            inlineData: {
              mimeType: data.media.mimeType || 'image/jpeg',
              data: data.media.data
            }
          });
          inputType = inputType ? inputType + '+image' : 'image';
        }
      }

      // For multimodal inputs, add context instruction based on mode
      if (this.interviewMode) {
        // Interview mode - explain everything
        if (data.audio && data.media) {
          parts.push({
            text: 'Analyze both the screenshot and audio. Explain what you see on screen, transcribe and respond to any questions or conversation in the audio. Be proactive in offering assistance.'
          });
        } else if (data.audio) {
          parts.push({
            text: 'Listen to the audio and transcribe any speech. Identify interview questions or topics being discussed and provide helpful responses.'
          });
        } else if (data.media) {
          parts.push({
            text: 'Analyze the screenshot and explain what you see. Identify any code, errors, or interview-related content that might need explanation.'
          });
        }
      } else {
        // Voice control mode - only respond to commands
        if (data.audio && data.media) {
          parts.push({
            text: 'Listen for voice commands in the audio. Only respond if you hear commands like "open", "click", "type", etc. Use the screenshot for context when executing commands.'
          });
        } else if (data.audio) {
          parts.push({
            text: 'Listen for voice commands only. Respond only if you hear a command like "open", "click", "type", etc.'
          });
        } else if (data.media) {
          parts.push({
            text: 'Screenshot received. Waiting for voice commands.'
          });
        }
      }

      // Only send if we have content
      if (parts.length === 0) {
        console.log('⚠️  No valid content to send to Gemini');
        return;
      }

      // Send to persistent chat session (maintains context)
      const startTime = Date.now();
      console.log('📤 Sending', inputType, 'to Gemini... (attempt', retryCount + 1, 'of', maxRetries + 1, ')');
      
      // Set a timeout for slow connections
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000) // 30 second timeout
      );
      
      const result = await Promise.race([
        this.session.sendMessage(parts),
        timeoutPromise
      ]);
      
      const response = await result.response;
      const text = response.text();
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log('📥 Gemini response received:');
      console.log('   ⏱️  Response time:', responseTime + 'ms');
      console.log('   📝 Response length:', text.length, 'characters');
      console.log('   💬 Response preview:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      this.emit('response', text);
      
    } catch (error: any) {
      const isNetworkError = error.message.includes('fetch failed') || 
                            error.message.includes('timeout') ||
                            error.message.includes('network');
      
      if (isNetworkError && retryCount < maxRetries) {
        console.log('🔄 Network error, retrying in', retryDelay + 'ms... (attempt', retryCount + 1, 'of', maxRetries + 1, ')');
        
        setTimeout(() => {
          this.sendRealtimeInput(data, retryCount + 1);
        }, retryDelay);
        
        return;
      }
      
      console.error('❌ Error sending realtime input after', retryCount + 1, 'attempts:', error.message);
      this.emit('error', error);
    }
  }

  async close() {
    // Clean up session
    this.session = null;
    this.emit('disconnected');
  }

  private getInterviewModePrompt(): string {
    return `You are an AI interview assistant receiving real-time audio and screenshots every 2 seconds.

## Your Role
- Analyze everything you see AND hear to help the user during their interview
- Transcribe and respond to interview questions
- Provide clear explanations of what's on screen
- Offer suggestions and corrections proactively
- Help with coding problems, system design, behavioral questions

## What to Do
- When you hear questions: Transcribe them and provide helpful answers
- When you see code: Explain what it does, identify bugs, suggest improvements
- When you see interview platforms (Zoom, Teams, etc.): Note any visible questions or shared content
- When you see errors: Immediately point them out and suggest fixes
- When nothing is happening: Stay quiet unless you see something important

## Response Style
- Be concise but thorough
- Use bullet points for clarity
- Highlight important information
- Provide code snippets when relevant
- Always transcribe what you hear first

Remember: You're here to help them succeed in their interview!`;
  }

  private getVoiceControlPrompt(): string {
    return `You are a voice-controlled Mac automation assistant receiving real-time audio and screenshots every 2 seconds.

## Your Role
- ONLY respond to direct voice commands
- Ignore all other conversation and ambient noise
- Execute Mac system controls when commanded

## Supported Voice Commands
- "Open [app name]" → {"command": "open_app", "params": {"app": "Safari"}}
- "Click on [element]" → {"command": "click", "params": {"element": "submit button"}}
- "Type [text]" → {"command": "type", "params": {"text": "Hello world"}}
- "Scroll [direction]" → {"command": "scroll", "params": {"direction": "down"}}
- "Switch to [app]" → {"command": "switch_app", "params": {"app": "Chrome"}}
- "Close this tab/window" → {"command": "close", "params": {"target": "tab"}}
- "Take me to [website]" → {"command": "navigate", "params": {"url": "github.com"}}

## Important Rules
- ONLY respond when you hear a clear voice command
- Return JSON format for commands
- Use screenshots for context but don't describe them
- Stay silent unless executing a command
- Ignore background conversations

Remember: You're a voice control system, not a chatbot!`;
  }
}