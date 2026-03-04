import * as path from 'node:path';
import * as fs from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mocha = require(path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', 'mocha'));

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 30000,
  });

  const testsRoot = path.resolve(__dirname);

  function collectTestFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectTestFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  for (const file of collectTestFiles(testsRoot)) {
    mocha.addFile(file);
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures: number) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
