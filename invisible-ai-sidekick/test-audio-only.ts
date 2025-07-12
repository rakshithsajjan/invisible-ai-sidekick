import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function testGeminiAudio() {
  console.log('Starting Gemini audio test...');
  console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  
  // Using standard model that supports audio
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
  });

  try {
    const audioPath = '/Users/rakshithsajjan/Desktop/audio.m4a';
    
    if (!fs.existsSync(audioPath)) {
      console.log('Audio file not found at:', audioPath);
      return;
    }
    
    console.log('Reading audio file...');
    const audioData = fs.readFileSync(audioPath);
    const base64Audio = audioData.toString('base64');
    console.log('Audio file size:', audioData.length, 'bytes');
    console.log('Base64 length:', base64Audio.length);
    
    // Send just the audio
    console.log('Sending audio to Gemini...');
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/mp4',
          data: base64Audio
        }
      },
      {
        text: 'Please transcribe this audio and tell me what you hear.'
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    console.log('\n=== Gemini Response ===');
    console.log(text);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

testGeminiAudio();