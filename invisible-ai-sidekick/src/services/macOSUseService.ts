import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

interface MacOSAction {
  type: 'click' | 'type' | 'scroll' | 'open_app' | 'apple_script' | 'done';
  element_index?: number;
  text?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  app_name?: string;
  script?: string;
}

interface MacOSResponse {
  success: boolean;
  result?: any;
  error?: string;
  ui_state?: any;
}

export class MacOSUseService extends EventEmitter {
  private pythonProcess: ChildProcess | null = null;
  private isReady = false;
  private messageQueue: Array<{ resolve: Function; reject: Function }> = [];

  constructor() {
    super();
  }

  async initialize() {
    if (this.pythonProcess) {
      console.log('macOS-use service already initialized');
      return;
    }

    const pythonScript = path.join(__dirname, '../../python/macos_use_bridge.py');
    const venvPython = path.join(__dirname, '../../../venv/bin/python');
    
    this.pythonProcess = spawn(venvPython, [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.pythonProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          this.handlePythonResponse(response);
        } catch (error) {
          console.error('Failed to parse Python response:', line);
        }
      }
    });

    this.pythonProcess.stderr?.on('data', (data) => {
      console.error('Python stderr:', data.toString());
    });

    this.pythonProcess.on('close', (code) => {
      console.log(`Python process closed with code ${code}`);
      this.isReady = false;
      this.pythonProcess = null;
      this.emit('disconnected');
    });

    // Wait for ready signal
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python process initialization timeout'));
      }, 10000);

      this.once('ready', () => {
        clearTimeout(timeout);
        this.isReady = true;
        resolve();
      });
    });
  }

  async executeTask(task: string, context?: any): Promise<any> {
    if (!this.isReady) {
      throw new Error('macOS-use service not ready');
    }

    return this.sendMessage({
      type: 'task',
      task,
      context
    });
  }

  async executeAction(action: MacOSAction): Promise<MacOSResponse> {
    if (!this.isReady) {
      throw new Error('macOS-use service not ready');
    }

    return this.sendMessage({
      type: 'action',
      action
    });
  }

  async getUIState(appName?: string): Promise<any> {
    if (!this.isReady) {
      throw new Error('macOS-use service not ready');
    }

    return this.sendMessage({
      type: 'get_ui_state',
      app_name: appName
    });
  }

  async openApp(appName: string): Promise<void> {
    await this.executeAction({
      type: 'open_app',
      app_name: appName
    });
  }

  async clickElement(elementIndex: number): Promise<void> {
    await this.executeAction({
      type: 'click',
      element_index: elementIndex
    });
  }

  async typeText(text: string, elementIndex?: number): Promise<void> {
    await this.executeAction({
      type: 'type',
      text,
      element_index: elementIndex
    });
  }

  async runAppleScript(script: string): Promise<any> {
    const response = await this.executeAction({
      type: 'apple_script',
      script
    });
    return response.result;
  }

  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.pythonProcess?.stdin) {
        reject(new Error('Python process not available'));
        return;
      }

      this.messageQueue.push({ resolve, reject });
      this.pythonProcess.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  private handlePythonResponse(response: any) {
    if (response.type === 'ready') {
      this.emit('ready');
      return;
    }

    if (response.type === 'log') {
      console.log('Python log:', response.message);
      return;
    }

    const handler = this.messageQueue.shift();
    if (handler) {
      if (response.error) {
        handler.reject(new Error(response.error));
      } else {
        handler.resolve(response);
      }
    }
  }

  async shutdown() {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
      this.isReady = false;
    }
  }
}

// Singleton instance
export const macOSUse = new MacOSUseService();