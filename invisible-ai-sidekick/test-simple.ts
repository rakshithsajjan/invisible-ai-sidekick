import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSimple() {
  console.log('=== Simple Gemini Test ===');
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  try {
    // Test 1: Simple text
    console.log('\n1. Testing simple text...');
    const result1 = await model.generateContent('What is 2 + 2?');
    console.log('Response:', result1.response.text());
    
    // Test 2: Chat with context
    console.log('\n2. Testing chat with context...');
    const chat = model.startChat({
      history: [{
        role: 'user',
        parts: [{text: 'You are an AI interview assistant. Help me answer interview questions concisely.'}],
      }, {
        role: 'model',
        parts: [{text: 'I\'ll help you answer interview questions concisely and effectively. Please share any questions you need help with.'}],
      }],
    });
    
    const result2 = await chat.sendMessage('What is the time complexity of quicksort?');
    console.log('Response:', result2.response.text());
    
    console.log('\n✅ All tests passed! Gemini API is working correctly.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testSimple();