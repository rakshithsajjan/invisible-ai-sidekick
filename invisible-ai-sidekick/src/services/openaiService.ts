import { EventEmitter } from 'events';
import OpenAI from 'openai';

interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

export class OpenAIService extends EventEmitter {
  private openai: OpenAI;
  private config: OpenAIConfig;
  private conversation: Array<any> = [];
  private lastRequestTime: number = 0;

  constructor(config: OpenAIConfig) {
    super();
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey
    });
  }

  async initializeSession() {
    try {
      console.log('Initializing OpenAI session...');
      console.log('API Key length:', this.config.apiKey?.length);
      
      // Initialize conversation with system message
      this.conversation = [{
        role: 'system',
        content: `You are an AI assistant with two main capabilities:

1. **Interview Assistant**: Help answer interview questions by analyzing screen and audio
2. **Voice Control**: Execute system commands when the user says control phrases like:
   - "Open [app name]" - to open applications
   - "Click on [element]" - to click UI elements
   - "Type [text]" - to type text
   - "Scroll [up/down]" - to scroll
   - "Show me [something]" - to navigate or search

When you detect a voice command, respond with a structured JSON command in this format:
{"command": "ACTION_TYPE", "params": {...}}

For normal conversation and interview help, respond with regular text.`
      }];

      console.log('OpenAI session initialized successfully');
      this.emit('connected');
      
      return true;
    } catch (error: any) {
      console.error('Failed to initialize OpenAI session:', error);
      console.error('Error details:', error.message);
      this.emit('error', error);
      return false;
    }
  }

  async sendRealtimeInput(data: any, retryCount = 0) {
    // Rate limiting: ensure at least 2 seconds between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = 2000; // 2 seconds
    
    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();

    const maxRetries = 2;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    try {
      // Build the message content
      let messageContent: any[] = [];
      let inputType = 'unknown';

      // Handle text input
      if (data.text) {
        messageContent.push({ type: 'text', text: data.text });
        inputType = 'text';
      }
      
      // Handle audio input - Note: gpt-4o-mini doesn't support audio input directly
      // For now, we'll skip audio processing and note it in the response
      if (data.audio) {
        console.log('⚠️  Audio input received but gpt-4o-mini does not support audio input');
        // You could implement audio transcription here using Whisper API if needed
        inputType = inputType === 'unknown' ? 'audio' : inputType + '+audio';
      }
      
      // Handle image input
      if (data.media) {
        const imageSize = data.media.data.length;
        if (imageSize > 200000) {
          console.log('⚠️  Skipping large image (', imageSize, 'chars) due to size limits');
        } else {
          // Add image_url with base64 data
          const imageData = data.media.data.includes('base64,') 
            ? data.media.data 
            : `data:${data.media.mimeType || 'image/jpeg'};base64,${data.media.data}`;
          
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: imageData,
              detail: 'low' // Use low detail to save tokens
            }
          });
          inputType = inputType === 'unknown' ? 'image' : inputType + '+image';
        }
      }

      // Add context instruction for multimodal inputs
      if ((data.audio || data.media) && messageContent.length > 0) {
        messageContent.push({
          type: 'text',
          text: 'Analyze this input in the context of our ongoing conversation. If you detect a question in the audio or see something on screen that requires a response, provide a helpful and concise answer. If it\'s just ambient content, briefly acknowledge what you observe without providing unnecessary responses.'
        });
      }

      // Add user message to conversation
      this.conversation.push({
        role: 'user',
        content: messageContent
      });

      // Make the API call
      const startTime = Date.now();
      console.log('📤 Sending', inputType, 'to OpenAI... (attempt', retryCount + 1, 'of', maxRetries + 1, ')');
      
      // Create the completion with audio support for gpt-4o-mini
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: this.conversation,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      });
      
      const response = completion.choices[0].message;
      const text = response.content || '';
      
      // Add assistant response to conversation history
      this.conversation.push({
        role: 'assistant',
        content: text
      });
      
      // Keep conversation history limited to prevent token overflow
      if (this.conversation.length > 20) {
        // Keep system message and last 18 messages
        this.conversation = [
          this.conversation[0], // System message
          ...this.conversation.slice(-18)
        ];
      }
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log('📥 OpenAI response received:');
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
      
      console.error('❌ Error sending input after', retryCount + 1, 'attempts:', error.message);
      this.emit('error', error);
    }
  }

  async close() {
    // Clean up session
    this.conversation = [];
    this.emit('disconnected');
  }
}