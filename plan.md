# Invisible AI Sidekick - Project Plan

## Project Overview
An invisible AI assistant for macOS that provides real-time interview assistance using screen capture, audio processing, and the Gemini Realtime API.

## Core Requirements

### 1. Invisible Interface
- Transparent, frameless window
- Always-on-top overlay
- Click-through capability when not in use
- Minimal UI footprint

### 2. Screen Capture
- Real-time screen content analysis
- Configurable capture rate (1-5 FPS for efficiency)
- Selective region capture option

### 3. Audio Capture
- **System Audio**: Capture interview questions from video calls
- **Microphone Audio**: Capture user's responses
- Platform-specific implementation for macOS

### 4. AI Response Methods
- **Audio Response**: Direct audio output from Gemini API (natural conversation)
- **Text Overlay**: Streaming text display on invisible overlay
- User-selectable response mode

### 5. Gemini Realtime API Integration
- WebSocket connection for low latency
- Multimodal input (audio + screen)
- Real-time streaming responses

## Version Roadmap

### Version 1.0 - Interview Assistant MVP
**Focus**: Pure interview assistance with no system control

**Features**:
- Screen capture of interview window
- Dual audio capture (system + mic)
- Real-time question analysis
- AI-generated response suggestions
- Audio OR text overlay responses
- Hotkeys for quick actions (toggle overlay, mute AI)

**Tech Stack**:
- Electron (proven approach from reference projects)
- TypeScript
- Gemini Realtime API
- macOS-specific audio capture (SystemAudioDump or similar)

### Version 2.0 - Voice Control Integration
**Focus**: Full voice-controlled macOS automation

**Features**:
- Voice command recognition
- macOS system control via:
  - Accessibility APIs
  - AppleScript integration
  - Tool calling with Gemini
- Custom voice commands
- App launching and control
- Text dictation anywhere

## Technical Architecture

### Main Process (Node.js)
- Window management
- Audio capture coordination
- Gemini API WebSocket management
- System permissions handling

### Renderer Process (Chromium)
- Transparent UI overlay
- Screen capture via getDisplayMedia
- Text streaming display
- Audio playback for Gemini responses

### Audio Pipeline
1. **System Audio**: Native binary or ScreenCaptureKit
2. **Microphone**: Web Audio API
3. **Processing**: 0.1s chunks, 24kHz mono
4. **Transmission**: Base64 encoded to Gemini

### Screen Capture Pipeline
1. **Capture**: getDisplayMedia or ScreenCaptureKit
2. **Processing**: JPEG compression (configurable quality)
3. **Rate**: Adaptive based on content changes
4. **Transmission**: Base64 images to Gemini

## macOS System Access Research

### For Version 2.0 Voice Control

#### 1. **Accessibility APIs**
- Requires user permission in System Preferences
- Can control mouse, keyboard, and UI elements
- Access via `CGEventCreateKeyboardEvent`, `AXUIElement`

#### 2. **AppleScript Bridge**
- Execute AppleScript from Node.js
- Control most macOS applications
- Natural language to AppleScript translation via Gemini

#### 3. **ScreenCaptureKit (macOS 12.3+)**
- Modern API for screen/audio capture
- Better performance than older methods
- Requires Screen Recording permission

#### 4. **Speech Recognition**
- Native macOS Speech framework
- Or use Gemini's audio transcription
- Continuous listening capability

#### 5. **Required Permissions**
- Screen Recording
- Microphone Access
- Accessibility (for system control)
- Input Monitoring (for global hotkeys)

### Implementation Approach for Voice Control
1. **Phase 1**: Voice transcription via Gemini
2. **Phase 2**: Intent recognition and command parsing
3. **Phase 3**: Execute commands via:
   - Direct API calls (for supported actions)
   - AppleScript generation (for complex tasks)
   - Accessibility API (for UI manipulation)

## MVP Development Timeline

### Week 1: Foundation
- Electron app setup with TypeScript
- Basic transparent overlay window
- Screen capture implementation

### Week 2: Audio Integration
- macOS system audio capture
- Microphone capture
- Audio mixing and encoding

### Week 3: Gemini Integration
- Realtime API connection
- Multimodal input streaming
- Response handling (audio/text)

### Week 4: Polish & Testing
- UI refinements
- Hotkey implementation
- Performance optimization
- User testing

## Key Technical Decisions

1. **Electron over Swift**: Faster MVP development, proven approach
2. **Gemini Realtime API**: Low latency for natural conversation
3. **Dual Response Mode**: Flexibility for different interview scenarios
4. **SystemAudioDump approach**: Reliable macOS audio capture

## Open Questions

1. Best approach for system audio on macOS 13+?
2. Optimal screen capture rate for battery life?
3. Audio response latency requirements?
4. Privacy/security considerations for interview content?