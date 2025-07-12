import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function testGemini() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  
  // Using standard model
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  });

  console.log('Starting Gemini test...');
  
  try {
    // Start a chat session
    const chat = model.startChat({
      history: [{
        role: 'user',
        parts: [{text: 'You are an AI assistant. I will send you an image and audio. Please describe what you see and hear.'}],
      }, {
        role: 'model',
        parts: [{text: 'I understand. Please share the image and audio, and I\'ll describe what I see and hear.'}],
      }],
    });

    // Read test files
    const imagePath = process.argv[2] || ''/Users/rakshithsajjan/Desktop/Screenshot 2025-07-12 at 12.04.22 AM.png'';
    const audioPath = process.argv[3] || './test-audio.mp3';
    
    const parts: any[] = [];
    
    // Add image if exists
    if (fs.existsSync(imagePath)) {
      console.log(`Reading image from: ${imagePath}`);
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');
      
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      });
    } else {
      console.log(`Image not found at: ${imagePath}`);
    }
    
    // Add audio if exists
    if (fs.existsSync(audioPath)) {
      console.log(`Reading audio from: ${audioPath}`);
      const audioData = fs.readFileSync(audioPath);
      const base64Audio = audioData.toString('base64');
      
      // Determine audio mime type based on extension
      const ext = audioPath.toLowerCase().split('.').pop();
      let mimeType = 'audio/mp3';
      if (ext === 'm4a') mimeType = 'audio/mp4';
      else if (ext === 'wav') mimeType = 'audio/wav';
      else if (ext === 'mp3') mimeType = 'audio/mp3';
      
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Audio
        }
      });
    } else {
      console.log(`Audio not found at: ${audioPath}`);
    }
    
    if (parts.length === 0) {
      console.log('No files found. Please provide image and/or audio files.');
      console.log('Usage: npx ts-node test-gemini.ts <image-path> <audio-path>');
      return;
    }
    
    // Send to Gemini
    console.log('Sending to Gemini...');
    const result = await chat.sendMessage(parts);
    const response = await result.response;
    const text = response.text();
    
    console.log('\n=== Gemini Response ===');
    console.log(text);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testGemini();