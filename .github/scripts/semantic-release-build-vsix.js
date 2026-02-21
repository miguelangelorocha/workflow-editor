const { execSync } = require('child_process');

/**
 * Semantic-release plugin: builds the VS Code extension (compile, webpack, package)
 * so the VSIX exists when @semantic-release/github creates the release.
 * Runs after @semantic-release/npm (version in package.json) and before @semantic-release/git.
 */
module.exports = function buildVsix() {
  return {
    async prepare(_pluginConfig, context) {
      const cwd = context.cwd || process.cwd();
      execSync('pnpm run compile', { stdio: 'inherit', cwd });
      execSync('pnpm run webpack', { stdio: 'inherit', cwd });
      execSync('pnpm run package', { stdio: 'inherit', cwd });
    },
  };
};
