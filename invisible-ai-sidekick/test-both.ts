import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function testGeminiBoth() {
  console.log('Starting Gemini test with image and audio...');
  console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
  });

  try {
    // Use the paths you provided
    const imagePath = '/Users/rakshithsajjan/Desktop/Screenshot 2025-07-12 at 12.04.22 AM.png';
    const audioPath = '/Users/rakshithsajjan/Desktop/audio.m4a';
    
    const parts: any[] = [];
    
    // Add image
    if (fs.existsSync(imagePath)) {
      console.log('Reading image...');
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');
      console.log('Image size:', imageData.length, 'bytes');
      
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Image
        }
      });
    } else {
      console.log('Image not found at:', imagePath);
    }
    
    // Add audio
    if (fs.existsSync(audioPath)) {
      console.log('Reading audio...');
      const audioData = fs.readFileSync(audioPath);
      const base64Audio = audioData.toString('base64');
      console.log('Audio size:', audioData.length, 'bytes');
      
      parts.push({
        inlineData: {
          mimeType: 'audio/mp4',
          data: base64Audio
        }
      });
    } else {
      console.log('Audio not found at:', audioPath);
    }
    
    // Add instruction
    parts.push({
      text: 'I am in an interview. The audio contains a question being asked. The screenshot shows what\'s on my screen. Please help me answer the question appropriately.'
    });
    
    // Send to Gemini
    console.log('Sending to Gemini...');
    const result = await model.generateContent(parts);
    
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

testGeminiBoth();