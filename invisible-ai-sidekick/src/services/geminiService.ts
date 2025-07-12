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

  constructor(config: GeminiConfig) {
    super();
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  async initializeSession() {
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
      this.session = this.model.startChat({
        history: [{
          role: 'user',
          parts: [{text: 'You are an AI interview assistant. Help me answer interview questions by analyzing my screen and audio. Provide concise, relevant answers. When you see a question on screen or hear it in audio, suggest an appropriate response. Keep answers brief and to the point.'}],
        }, {
          role: 'model',
          parts: [{text: 'I understand. I\'m ready to help you with your interview by analyzing your screen and audio. I\'ll provide concise and relevant suggestions when I detect questions. Please share your screen and audio when you\'re ready.'}],
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
      } else if (data.audio) {
        // Audio input (base64 PCM) - skip if too large for slow connection
        const audioSize = data.audio.data.length;
        if (audioSize > 100000) { // Skip very large audio chunks
          console.log('⚠️  Skipping large audio chunk (', audioSize, 'chars) due to slow connection');
          return;
        }
        parts.push({
          inlineData: {
            mimeType: data.audio.mimeType || 'audio/pcm;rate=16000',
            data: data.audio.data
          }
        });
        inputType = 'audio';
      } else if (data.media) {
        // Image input (base64 JPEG) - skip if too large for slow connection
        const imageSize = data.media.data.length;
        if (imageSize > 200000) { // Skip very large images
          console.log('⚠️  Skipping large image (', imageSize, 'chars) due to slow connection');
          return;
        }
        parts.push({
          inlineData: {
            mimeType: data.media.mimeType || 'image/jpeg',
            data: data.media.data
          }
        });
        inputType = 'image';
      }

      // For multimodal inputs, add context instruction
      if (data.audio || data.media) {
        parts.push({
          text: 'Analyze this input in the context of our ongoing conversation. If you detect a question in the audio or see something on screen that requires a response, provide a helpful and concise answer. If it\'s just ambient content, briefly acknowledge what you observe without providing unnecessary responses.'
        });
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
}