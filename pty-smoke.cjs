const fs = require('fs');
const path = require('path');
const output = path.join(__dirname, 'pty-smoke-result.json');
try {
  const pty = require('@homebridge/node-pty-prebuilt-multiarch');
  const processPty = pty.spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', 'Write-Output ELECTRON_PTY_OK'], { cols: 80, rows: 24 });
  let data = '';
  processPty.onData(chunk => { data += chunk; });
  processPty.onExit(() => {
    fs.writeFileSync(output, JSON.stringify({ ok: data.includes('ELECTRON_PTY_OK') }));
    process.exit(data.includes('ELECTRON_PTY_OK') ? 0 : 1);
  });
} catch (error) {
  fs.writeFileSync(output, JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
}
