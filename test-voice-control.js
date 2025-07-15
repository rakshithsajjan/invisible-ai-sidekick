const { spawn } = require('child_process');

console.log('Testing macOS-use bridge...');

const pythonProcess = spawn('python3', ['python/macos_use_bridge.py'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

pythonProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      console.log('Response:', response);
      
      if (response.type === 'ready') {
        console.log('✅ Bridge is ready! Testing a command...');
        
        // Test opening Calculator
        const testCommand = {
          type: 'action',
          action: {
            type: 'open_app',
            app_name: 'Calculator'
          }
        };
        
        pythonProcess.stdin.write(JSON.stringify(testCommand) + '\n');
        
        // Exit after 3 seconds
        setTimeout(() => {
          console.log('Test complete!');
          process.exit(0);
        }, 3000);
      }
    } catch (error) {
      console.error('Parse error:', line);
    }
  }
});

pythonProcess.stderr.on('data', (data) => {
  console.error('Python stderr:', data.toString());
});

pythonProcess.on('close', (code) => {
  console.log(`Python process closed with code ${code}`);
});