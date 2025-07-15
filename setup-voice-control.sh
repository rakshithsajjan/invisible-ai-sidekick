#!/bin/bash

echo "🎙️  Setting up Voice Control for Invisible AI Sidekick"
echo "=================================================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3.11 or higher from python.org"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
REQUIRED_VERSION="3.11"

if [[ $(echo -e "$PYTHON_VERSION\n$REQUIRED_VERSION" | sort -V | head -n1) != "$REQUIRED_VERSION" ]]; then
    echo "❌ Python $REQUIRED_VERSION or higher is required (found $PYTHON_VERSION)"
    exit 1
fi

echo "✅ Python $PYTHON_VERSION found"

# Create virtual environment
echo "📦 Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check for API keys
echo ""
echo "🔑 Checking API keys..."

if [ -z "$GOOGLE_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  No LLM API key found!"
    echo "Please set one of the following environment variables in your .env file:"
    echo "  - GOOGLE_API_KEY (for Gemini)"
    echo "  - OPENAI_API_KEY (for GPT-4)"
    echo "  - ANTHROPIC_API_KEY (for Claude)"
else
    echo "✅ LLM API key found"
fi

echo ""
echo "✨ Voice control setup complete!"
echo ""
echo "To use voice commands, say things like:"
echo "  - 'Open Safari'"
echo "  - 'Click on the button'"
echo "  - 'Type hello world'"
echo "  - 'Scroll down'"
echo "  - 'Show me my calendar'"
echo ""
echo "Run 'npm start' to launch the app with voice control enabled!"