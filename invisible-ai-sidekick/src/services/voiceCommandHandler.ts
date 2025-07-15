import { EventEmitter } from 'events';
import { macOSUse } from './macOSUseService';

interface VoiceCommand {
  command: string;
  params: any;
}

export class VoiceCommandHandler extends EventEmitter {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await macOSUse.initialize();
      this.isInitialized = true;
      console.log('Voice command handler initialized');
    } catch (error) {
      console.error('Failed to initialize voice command handler:', error);
      throw error;
    }
  }

  async handleGeminiResponse(response: string) {
    // Try to parse as JSON command first
    try {
      const trimmedResponse = response.trim();
      
      // Check if response contains JSON command (only in voice control mode)
      const jsonMatch = trimmedResponse.match(/\{[\s\S]*"command"[\s\S]*\}/);
      if (jsonMatch) {
        const command: VoiceCommand = JSON.parse(jsonMatch[0]);
        await this.executeCommand(command);
        return;
      }
    } catch (error) {
      // Not a JSON command, treat as regular response
    }

    // Emit regular text response for display
    this.emit('textResponse', response);
  }

  private async executeCommand(command: VoiceCommand) {
    console.log('Executing voice command:', command);
    
    try {
      switch (command.command.toLowerCase()) {
        case 'open_app':
          await this.openApp(command.params.app || command.params.app_name);
          break;
          
        case 'click':
          await this.clickElement(command.params);
          break;
          
        case 'type':
          await this.typeText(command.params.text);
          break;
          
        case 'scroll':
          await this.scroll(command.params.direction);
          break;
          
        case 'switch_app':
          await this.openApp(command.params.app);
          break;
          
        case 'close':
          await this.executeTask(`Close the current ${command.params.target || 'window'}`);
          break;
          
        case 'navigate':
          await this.executeTask(`Navigate to ${command.params.url}`);
          break;
          
        case 'task':
          // For complex tasks, use the full macOS-use agent
          await this.executeTask(command.params.task);
          break;
          
        default:
          console.warn('Unknown command:', command.command);
      }
      
      this.emit('commandExecuted', command);
      
    } catch (error) {
      console.error('Command execution failed:', error);
      this.emit('commandError', { command, error });
    }
  }

  private async openApp(appName: string) {
    this.emit('feedback', `Opening ${appName}...`);
    
    // Handle common app name variations
    const appNameMap: { [key: string]: string } = {
      'visual studio code': 'Code',
      'vs code': 'Code',
      'vscode': 'Code',
      'chrome': 'Google Chrome',
      'firefox': 'Firefox',
      'terminal': 'Terminal',
      'finder': 'Finder',
      'safari': 'Safari'
    };
    
    const normalizedName = appName.toLowerCase();
    const actualAppName = appNameMap[normalizedName] || appName;
    
    await macOSUse.openApp(actualAppName);
  }

  private async clickElement(params: any) {
    if (params.element_index !== undefined) {
      this.emit('feedback', `Clicking element ${params.element_index}`);
      await macOSUse.clickElement(params.element_index);
    } else if (params.description) {
      // Use natural language to find and click
      await this.executeTask(`Click on ${params.description}`);
    }
  }

  private async typeText(text: string) {
    this.emit('feedback', `Typing: ${text}`);
    
    // For typing, we should use executeTask to let the agent find the right place to type
    await this.executeTask(`Type "${text}" in the current focused element or search bar`);
  }

  private async scroll(direction: string) {
    this.emit('feedback', `Scrolling ${direction}`);
    await macOSUse.executeAction({
      type: 'scroll',
      direction: direction as any
    });
  }

  private async executeTask(task: string) {
    this.emit('feedback', `Executing task: ${task}`);
    const result = await macOSUse.executeTask(task);
    
    if (result.success) {
      this.emit('taskCompleted', result);
    } else {
      this.emit('taskError', result);
    }
  }

  async shutdown() {
    await macOSUse.shutdown();
    this.isInitialized = false;
  }
}

export const voiceCommandHandler = new VoiceCommandHandler();