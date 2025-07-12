# Usage Guide

## Getting Started

1. **Set up your API key**:
   ```bash
   echo "GEMINI_API_KEY=your_actual_key" > .env
   ```

2. **Start the app**:
   ```bash
   npm start
   ```

## During Interviews

1. **Position the Window**: The app appears as a semi-transparent overlay in the top-right corner

2. **Start Capture**:
   - Click the "Start" button
   - Grant screen recording and microphone permissions when prompted
   - Select the screen/window to capture

3. **AI Assistance**:
   - The AI will analyze your screen content and audio
   - Responses appear as text in the overlay
   - Audio responses play automatically

4. **Controls**:
   - **Click Through Mode** (`Cmd+Shift+I`): Makes the window ignore mouse clicks
   - **Hide/Show** (`Cmd+Shift+H`): Quickly hide or show the overlay
   - **Stop**: Click to end the capture session

## Tips

- Keep the overlay in click-through mode during interviews
- Position it where it won't obstruct important content
- The AI responds to both visual questions on screen and audio questions
- Responses are concise and interview-focused

## Privacy

- All processing happens through Google's Gemini API
- No data is stored locally
- Screen and audio capture only occur when explicitly started