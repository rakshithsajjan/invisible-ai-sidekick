# Invisible AI Sidekick

A transparent, always-on-top macOS assistant for real-time interview help using screen capture, audio processing, and Google Gemini AI.

## Setup

1. **Get Gemini API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Create an API key
   - Copy the `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Add your API key to `.env`:
     ```
     GEMINI_API_KEY=your_actual_api_key_here
     ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Quick Start

```bash
# Run in development mode
npm run dev

# Build and run
npm start

# Package for distribution
npm run dist
```

## Features

- **Transparent Overlay**: Invisible window that floats above other apps
- **Gemini AI Integration**: Real-time responses via text and audio
- **Screen Capture**: Captures screen content at 1 FPS
- **Audio Recording**: Records microphone input (system audio coming next)
- **AI Response Modes**:
  - Text streaming on overlay
  - Audio playback from Gemini
- **Keyboard Shortcuts**:
  - `Cmd+Shift+I`: Toggle click-through mode
  - `Cmd+Shift+H`: Hide/Show window

## Project Structure

```
├── src/
│   ├── main/          # Main process (Electron)
│   │   ├── index.ts   # Window management
│   │   └── preload.ts # Bridge between main/renderer
│   └── renderer/      # Renderer process (UI)
│       └── index.ts   # Screen/audio capture logic
├── public/
│   └── index.html     # UI layout
└── dist/              # Compiled JavaScript
```

## Next Steps

1. **Gemini Integration**: Add Gemini Realtime API connection
2. **System Audio**: Implement macOS system audio capture
3. **AI Responses**: Add audio/text streaming responses
4. **Voice Control**: Future version with system control

## Current Status

- ✅ Basic Electron app structure
- ✅ Transparent overlay window
- ✅ Screen capture functionality
- ✅ Microphone recording
- ✅ Gemini API integration
- ✅ AI response display (text & audio)
- ⏳ System audio capture
- ⏳ Voice control (v2.0)