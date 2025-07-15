#!/usr/bin/env python3
import sys
import json
import asyncio
import os
from typing import Dict, Any, Optional
import logging
from dotenv import load_dotenv
import contextlib
import io

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import macOS-use components
try:
    from mlx_use import Agent, Controller
    from mlx_use.mac.tree import MacUITreeBuilder
    from langchain_openai import ChatOpenAI
    from langchain_anthropic import ChatAnthropic
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError as e:
    logger.error(f"Failed to import macOS-use components: {e}")
    logger.error("Please install mlx-use: pip install mlx-use")
    sys.exit(1)

class MacOSUseBridge:
    def __init__(self):
        self.agent = None
        self.controller = Controller()
        self.tree_builder = MacUITreeBuilder()
        self.llm = None
        self.initialize_llm()
        
    def initialize_llm(self):
        """Initialize LLM based on available API keys"""
        # Try Gemini first (since user is already using it)
        if os.getenv('GEMINI_API_KEY'):
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-pro",
                google_api_key=os.getenv('GEMINI_API_KEY')
            )
            logger.info("Using Gemini LLM")
        elif os.getenv('OPENAI_API_KEY'):
            self.llm = ChatOpenAI(model="gpt-4")
            logger.info("Using OpenAI LLM")
        elif os.getenv('ANTHROPIC_API_KEY'):
            self.llm = ChatAnthropic(model="claude-3-opus-20240229")
            logger.info("Using Anthropic LLM")
        else:
            logger.error("No LLM API key found. Please set GOOGLE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY")
            
    def send_response(self, response: Dict[str, Any]):
        """Send JSON response to Node.js process"""
        # Use stderr for debug logs, stdout for JSON responses only
        print(json.dumps(response), flush=True)
        
    def log(self, message: str):
        """Send log message to Node.js"""
        self.send_response({"type": "log", "message": message})
        
    async def handle_task(self, task: str, context: Optional[Dict] = None):
        """Execute a natural language task"""
        try:
            if not self.llm:
                return self.send_response({
                    "success": False,
                    "error": "LLM not initialized"
                })
                
            # Create agent for this task
            self.agent = Agent(
                task=task,
                llm=self.llm,
                controller=self.controller
            )
            
            # Run the agent
            result = await self.agent.run()
            
            self.send_response({
                "success": True,
                "result": result,
                "conversation": self.agent.history
            })
            
        except Exception as e:
            logger.error(f"Task execution error: {e}")
            self.send_response({
                "success": False,
                "error": str(e)
            })
            
    async def handle_action(self, action: Dict[str, Any]):
        """Execute a specific action"""
        try:
            action_type = action.get('type')
            
            # Redirect all stdout to stderr to keep JSON output clean
            with contextlib.redirect_stdout(sys.stderr):
                if action_type == 'click':
                element_index = action.get('element_index')
                result = await self.controller.registry.execute_action(
                    action_name="click_element",
                    params={"index": element_index},
                    mac_tree_builder=self.tree_builder
                )
                
            elif action_type == 'type':
                text = action.get('text')
                element_index = action.get('element_index', 0)
                result = await self.controller.registry.execute_action(
                    action_name="input_text",
                    params={"index": element_index, "text": text, "submit": False},
                    mac_tree_builder=self.tree_builder
                )
                
            elif action_type == 'open_app':
                app_name = action.get('app_name')
                # Capture stdout to avoid polluting JSON output
                with contextlib.redirect_stdout(sys.stderr):
                    result = await self.controller.registry.execute_action(
                        action_name="open_app",
                        params={"app_name": app_name}
                    )
                
            elif action_type == 'apple_script':
                script = action.get('script')
                result = await self.controller.registry.execute_action(
                    action_name="run_apple_script",
                    params={"script": script}
                )
                
            elif action_type == 'scroll':
                direction = action.get('direction', 'down')
                element_index = action.get('element_index', 0)
                # Convert direction to scroll units
                scroll_amount = 5 if direction == 'down' else -5
                result = await self.controller.registry.execute_action(
                    action_name="scroll_element",
                    params={"index": element_index, "direction": direction},
                    mac_tree_builder=self.tree_builder
                )
                
            else:
                raise ValueError(f"Unknown action type: {action_type}")
                
            # Convert result to serializable format
            result_data = result
            if hasattr(result, 'model_dump'):
                result_data = result.model_dump()
            elif hasattr(result, '__dict__'):
                result_data = result.__dict__
                
            self.send_response({
                "success": True,
                "result": result_data
            })
            
        except Exception as e:
            logger.error(f"Action execution error: {e}")
            self.send_response({
                "success": False,
                "error": str(e)
            })
            
    async def handle_get_ui_state(self, app_name: Optional[str] = None):
        """Get current UI state"""
        try:
            # Get the front app if not specified
            if not app_name:
                # This would need to be implemented to get the frontmost app
                pass
                
            # Build UI tree
            tree = self.tree_builder.build_tree()
            
            # Convert tree to serializable format
            ui_state = self._serialize_tree(tree)
            
            self.send_response({
                "success": True,
                "ui_state": ui_state
            })
            
        except Exception as e:
            logger.error(f"UI state error: {e}")
            self.send_response({
                "success": False,
                "error": str(e)
            })
            
    def _serialize_tree(self, node):
        """Convert UI tree to JSON-serializable format"""
        if not node:
            return None
            
        return {
            "role": node.role,
            "title": node.title,
            "value": node.value,
            "description": node.description,
            "position": node.position,
            "size": node.size,
            "index": node.index,
            "children": [self._serialize_tree(child) for child in node.children]
        }
        
    async def run(self):
        """Main event loop"""
        self.send_response({"type": "ready"})
        
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                    
                message = json.loads(line.strip())
                msg_type = message.get('type')
                
                if msg_type == 'task':
                    await self.handle_task(
                        message.get('task'),
                        message.get('context')
                    )
                    
                elif msg_type == 'action':
                    await self.handle_action(message.get('action'))
                    
                elif msg_type == 'get_ui_state':
                    await self.handle_get_ui_state(message.get('app_name'))
                    
                else:
                    self.send_response({
                        "success": False,
                        "error": f"Unknown message type: {msg_type}"
                    })
                    
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                self.send_response({
                    "success": False,
                    "error": str(e)
                })

if __name__ == "__main__":
    bridge = MacOSUseBridge()
    asyncio.run(bridge.run())