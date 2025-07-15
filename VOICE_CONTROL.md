# Voice Control Integration 🎙️

Your Invisible AI Sidekick now supports voice control powered by macOS-use!

## Features

### 🎯 Direct Commands
Say these phrases to control your Mac:
- **"Open [app name]"** - Launch any application
- **"Click on [element]"** - Click UI elements by description
- **"Type [text]"** - Type text at current cursor
- **"Scroll [up/down]"** - Scroll in the active window
- **"Show me [something]"** - Navigate to specific content

### 🤖 Natural Language Tasks
For complex tasks, just describe what you want:
- "Find and open my latest document"
- "Reply to the Slack message from John"
- "Schedule a meeting for tomorrow at 3 PM"
- "Search for Python tutorials on YouTube"

## How It Works

1. **Voice → Gemini AI**: Your voice is captured and sent to Gemini
2. **Intent Detection**: Gemini determines if it's a command or conversation
3. **Command Execution**: Commands are routed to macOS-use for execution
4. **Visual Feedback**: You see status updates in the overlay

## Setup

1. Run the setup script:
   ```bash
   ./setup-voice-control.sh
   ```

2. Ensure you have one of these API keys in your `.env`:
   - `GOOGLE_API_KEY` (recommended, already using Gemini)
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`

3. Grant Accessibility permissions when prompted

## Technical Architecture

```
Voice Input → Gemini AI → Command Parser → macOS-use → System Actions
                ↓                             ↓
        Regular Response              Python Bridge → Accessibility API
```

## Examples

### Interview Mode + Voice Control
- Interviewer: "Can you open VS Code and show me your latest project?"
- You: Say "Open Visual Studio Code"
- AI: Opens VS Code automatically

### Productivity Mode
- You: "Create a new document and type meeting notes for today"
- AI: Opens TextEdit, creates new doc, types "Meeting Notes - [date]"

## Troubleshooting

- **"Not authorized"**: Grant Accessibility permissions in System Preferences
- **Commands not working**: Check Python environment is activated
- **Slow response**: Reduce audio quality in settings

## Privacy & Security

- All voice processing happens through your configured AI provider
- No audio is stored locally
- macOS-use only accesses UI elements you explicitly command