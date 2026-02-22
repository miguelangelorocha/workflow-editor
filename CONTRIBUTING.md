# Contributing to Workflow Visual Editor

Thank you for your interest in contributing. Please read this guide before opening a pull request. Keyboard shortcuts are listed in the [README](README.md#keyboard-shortcuts).

## How to contribute

1. **Fork** the repository by clicking the "Fork" button on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/workflow-editor.git
   cd workflow-editor
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/my-bug
   ```
4. **Install dependencies** and set up the project (see [Setup](#setup) below).
5. **Make your changes**, following the [coding standards](#coding-standards).
6. **Test** your changes locally (see [Test](#test) and [Debug](#debug) below).
7. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add visual editor for step conditions"
   git commit -m "fix: resolve crash when workflow has no jobs"
   ```
8. **Push** your branch to your fork:
   ```bash
   git push origin feat/my-feature
   ```
9. **Open a Pull Request** against the `main` branch of this repository. Fill in the PR template that appears automatically.

The CI pipeline will run lint, tests, and a build check on your PR. All checks must pass before the PR can be merged.

## Coding standards

- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages — this drives automated versioning and changelog generation.
- Write strict TypeScript; avoid `any`.
- Keep UI logic in React components (`src/webview/`) and extension logic in the extension host (`src/extension/`). Do not mix them.
- Add or update tests for any logic change in `src/lib/`.
- Update `README.md` if your change adds a feature, keyboard shortcut, or modifies existing behaviour.

## Prerequisites

- Node.js >= 24
- PNPM >= 10
- VSCode (for testing the extension)

## Setup

```bash
pnpm install
```

## Build

```bash
# Build extension code
pnpm run compile

# Build webview bundle
pnpm run webpack

# Or build both (for packaging)
pnpm run vscode:prepublish
```

## Development Mode

```bash
# Watch extension code
pnpm run watch

# Watch webview bundle (in another terminal)
pnpm run webpack-dev
```

## Debug

1. Open this project in VSCode
2. Press `F5` to launch Extension Development Host
3. In the Extension Development Host, use the commands to open the workflow editor
4. Set breakpoints in `src/extension/` or `src/webview/` code

## Package Extension

```bash
# Create .vsix file
pnpm run package
```

The `.vsix` file will be created in the project root.

## Test

```bash
pnpm test
pnpm lint
```

The test suite includes **property-based fuzz tests** (`src/lib/workflow.fuzz.test.ts`) powered by [fast-check](https://fast-check.dev/). These generate hundreds of random inputs to verify that `parseWorkflow` and `serializeWorkflow` never throw and satisfy key invariants (safety, round-trip stability). This also satisfies the [OpenSSF Scorecard](https://securityscorecards.dev/) fuzzing criterion for TypeScript projects.

## CI (Pull request checks)

On every pull request to `main` or `master`, GitHub Actions runs:

- **Lint**: ESLint (TypeScript + React hooks and refresh)
- **Test**: Vitest
- **Build**: TypeScript compilation and webpack bundle
- **React Doctor**: Scans changed React files for issues (state/reset, keys, a11y, performance). Posts a comment on the PR with the score and diagnostics.
- **Security**: `pnpm audit --audit-level=high` (fails on high or critical vulnerabilities)

Workflow file: [.github/workflows/pull-request.yml](.github/workflows/pull-request.yml).

## React Doctor (local)

Run React Doctor locally to check the React codebase before pushing:

```bash
npx -y react-doctor@latest .
```

To scan only files changed vs `main` (same as in CI):

```bash
npx -y react-doctor@latest . --diff main
```

Use `--verbose` for per-file details. The tool outputs a 0–100 score and actionable diagnostics; see [react.doctor](https://www.react.doctor) for more.

## Security (Harden Runner)

All GitHub Actions workflows use [step-security/harden-runner](https://github.com/step-security/harden-runner) with **egress blocking** to mitigate supply chain attacks (e.g. compromised dependencies exfiltrating data or fetching malicious code during CI). Only explicitly allowed endpoints can be reached.

**What it does:**
- Monitors network egress to detect unauthorized outbound calls
- Tracks file integrity to detect tampering
- Monitors process activity for suspicious behavior
- Auto-detects GitHub Actions cache endpoints

**Current Configuration:**
Workflows run with egress **block** policy and an allowlist of endpoints. This ensures that even if a dependency is compromised, it cannot phone home or pull payloads from arbitrary URLs.

**Workflows protected:**
- [.github/workflows/pull-request.yml](.github/workflows/pull-request.yml) - CI checks
- [.github/workflows/release.yml](.github/workflows/release.yml) - Release automation
- [.github/workflows/publish.yml](.github/workflows/publish.yml) - Marketplace publishing

Audit results and insights are available at the [Step Security dashboard](https://app.stepsecurity.io/).

## Release & Publishing

### Automated Release

Releases are automated with [Semantic Release](https://semantic-release.gitbook.io/). On every **push to `main` or `master`**:

1. **Test** job runs: lint, unit tests (Vitest), and build.
2. **Release** job runs only if tests pass: Semantic Release analyzes commits, bumps the version, updates `package.json` and `CHANGELOG.md`, pushes a release commit, and creates a GitHub release.

Use [Conventional Commits](https://www.conventionalcommits.org/) so versions and changelog are derived from commit messages:

- `feat: ...` → minor release (e.g. 1.1.0)
- `fix: ...` → patch (e.g. 1.0.1)
- `feat!: ...` or `fix!: ...` → major (e.g. 2.0.0)
- `docs:`, `chore:`, etc. → no release (included in changelog when relevant)

Workflow: [.github/workflows/release.yml](.github/workflows/release.yml). Config: [.releaserc.cjs](.releaserc.cjs).

### Publishing to Marketplace

When a GitHub release is created by Semantic Release, the [publish workflow](.github/workflows/publish.yml) automatically:

1. Builds the extension (`pnpm run compile` + `pnpm run webpack`)
2. Packages it (`pnpm run package`)
3. Uploads the `.vsix` file to the GitHub release assets
4. Publishes to VSCode Marketplace (`pnpm run publish`)

**Note**: Commits with `chore:`, `docs:`, or other non-release types don't trigger publishing since Semantic Release doesn't create a release for them.

**Required Secret**: `VSCE_PAT` - Personal Access Token from [Azure DevOps](https://dev.azure.com/) with Marketplace publish permissions.

To get a token:
1. Go to https://dev.azure.com/
2. Create or sign in to your organization
3. Go to User Settings → Personal Access Tokens
4. Create a token with "Marketplace (Manage)" scope
5. Add it as `VSCE_PAT` secret in GitHub repository settings

## Stack

- **Extension Host**: Node.js + VSCode Extension API
- **Webview UI**: React 18 + TypeScript
- **Build**: TypeScript compiler + Webpack
- **Flow Editor**: [@xyflow/react](https://www.npmjs.com/package/@xyflow/react) (React Flow)
- **YAML**: [yaml](https://www.npmjs.com/package/yaml) for parse/serialize
- **Styling**: Tailwind CSS
- **Packaging**: [@vscode/vsce](https://www.npmjs.com/package/@vscode/vsce)
