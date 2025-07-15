// Convert PCM audio data to WAV format
export function pcmToWav(pcmData: string): string {
  // Decode base64 PCM data
  const pcmBuffer = Buffer.from(pcmData, 'base64');
  
  // WAV file parameters
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  
  // Calculate sizes
  const dataSize = pcmBuffer.length;
  const fileSize = dataSize + 44; // 44 bytes for WAV header
  
  // Create WAV header
  const header = Buffer.alloc(44);
  
  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize - 8, 4);
  header.write('WAVE', 8);
  
  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk size
  header.writeUInt16LE(1, 20); // Audio format (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // Byte rate
  header.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // Block align
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  // Combine header and PCM data
  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  
  // Return as base64
  return wavBuffer.toString('base64');
}