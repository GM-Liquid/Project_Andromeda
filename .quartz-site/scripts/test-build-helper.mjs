import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Build against the checked-in public mirrors. Tests must not auto-import a
 * maintainer's sibling private repository into the tracked working tree.
 */
export async function buildQuartzForTest(cwd) {
  const options = {
    cwd,
    windowsHide: true,
    env: {
      ...process.env,
      PROJECT_ANDROMEDA_DOCS_REPO: resolve(cwd, '.test-missing-docs-repo')
    }
  };

  if (process.platform === 'win32') {
    await execFileAsync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], options);
    return;
  }

  await execFileAsync('npm', ['run', 'build'], options);
}
