import { execSync, spawn } from 'node:child_process';

console.log('[dev] starting TypeScript compiler in watch mode...');

try {
  if (process.platform === 'win32') {
    execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :3001\') do taskkill /f /pid %a', { stdio: 'ignore' });
  }
} catch { /* ignore */ }

const children = [];
const stop = () => { children.forEach((c) => { try { c.kill(); } catch {} }); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Start tsc -w and wait for its first "Watching for file changes." before launching
// the runtime watcher, so the initial compilation doesn't trigger a spurious restart.
const tsc = spawn('npx', ['tsc', '-w', '-p', 'tsconfig.build.json', '--preserveWatchOutput'], {
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: true,
});
children.push(tsc);

let nodeProc = null;
let ready = false;

tsc.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (!ready && chunk.toString().includes('Watching for file changes')) {
    ready = true;
    // Node's built-in --watch can spawn the next process before the previous
    // HTTP listener has released its port on Windows. Nodemon serializes the
    // restart and adds a short debounce for the batch of files emitted by tsc.
    nodeProc = spawn('npx', [
      'nodemon',
      '--watch', 'dist',
      '--ext', 'js',
      '--delay', '1000ms',
      '--signal', 'SIGTERM',
      '--exec', 'node --require tsconfig-paths/register dist/index.js',
    ], {
      stdio: 'inherit',
      shell: true,
    });
    children.push(nodeProc);
  }
});
