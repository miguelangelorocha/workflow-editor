import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { runTests } from '@vscode/test-electron';

async function main() {
  // Temporary workspace that contains the sample fixture
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-editor-e2e-'));

  // Copy sample fixture into the temp workspace
  const fixturesDir = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'e2e', 'fixtures');
  const sampleSrc = path.join(fixturesDir, 'sample.yml');
  const sampleDest = path.join(workspaceDir, 'sample.yml');
  fs.copyFileSync(sampleSrc, sampleDest);

  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..', '..', '..', '..');
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        workspaceDir,
        '--disable-extensions',
        '--disable-gpu',
      ],
      extensionTestsEnv: {
        E2E_WORKSPACE_DIR: workspaceDir,
        E2E_FIXTURES_DIR: fixturesDir,
      },
    });
  } finally {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('E2E test run failed:', err);
  process.exit(1);
});
