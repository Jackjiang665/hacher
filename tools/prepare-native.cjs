const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'vendor', 'node-pty-win32-x64');
const destination = path.join(root, 'node_modules', '@homebridge', 'node-pty-prebuilt-multiarch', 'build', 'Release');
const files = ['conpty.node', 'conpty_console_list.node', 'pty.node'];

for (const file of files) {
  const input = path.join(source, file);
  if (!fs.existsSync(input)) {
    throw new Error(`缺少 Windows 终端原生文件：${input}`);
  }
}

fs.mkdirSync(destination, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(source, file), path.join(destination, file));
console.log('Windows 终端原生组件已准备完成。');
