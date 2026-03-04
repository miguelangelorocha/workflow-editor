import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { runTests } from '@vscode/test-electron';

async function main() {
  // Temporary workspace that contains the sample fixture.
  // Use a short prefix to avoid IPC socket path length issues on macOS.
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wfe2e-'));

  // __dirname at runtime = out/test/e2e  (3 levels below project root)
  const projectRoot = path.resolve(__dirname, '..', '..', '..');

  // Fixtures live in the source tree (not compiled) — reference them from project root
  const fixturesDir = path.join(projectRoot, 'src', 'test', 'e2e', 'fixtures');
  const sampleSrc = path.join(fixturesDir, 'sample.yml');
  const sampleDest = path.join(workspaceDir, 'sample.yml');
  fs.copyFileSync(sampleSrc, sampleDest);

  try {
    const extensionDevelopmentPath = projectRoot;
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      // The workspace path must be the first launchArg so VS Code opens it as the
      // active folder. On Linux (CI), @vscode/test-electron uses the `code` shell
      // wrapper which correctly handles a bare directory path as the first argument.
      launchArgs: [workspaceDir],
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
