const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
const env = {
  ...process.env,
  ELECTRON_BUILDER_BINARIES_MIRROR: process.env.ELECTRON_BUILDER_BINARIES_MIRROR
    || 'https://npmmirror.com/mirrors/electron-builder-binaries/',
};

const result = spawnSync(process.execPath, [cli, '--win', 'portable'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: false,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
