const { execSync } = require('child_process');

/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ['main', 'master'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    [
      function buildVsix() {
        return {
          async prepare(_pluginConfig, context) {
            const cwd = context.cwd || process.cwd();
            execSync('pnpm run compile', { stdio: 'inherit', cwd });
            execSync('pnpm run webpack', { stdio: 'inherit', cwd });
            execSync('pnpm run package', { stdio: 'inherit', cwd });
          },
        };
      },
      {},
    ],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: ['*.vsix'],
      },
    ],
  ],
};
