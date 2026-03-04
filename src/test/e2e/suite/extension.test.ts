import * as assert from 'node:assert';
import * as path from 'node:path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'Timoa.workflow-visual-editor';
const OPEN_WITH_EDITOR_CMD = 'workflow-visual-editor.openWithEditor';

const workspaceDir = process.env.E2E_WORKSPACE_DIR ?? '';
const fixturesDir = process.env.E2E_FIXTURES_DIR ?? '';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureExtensionActivated(): Promise<void> {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  if (!ext) {
    throw new Error(`Extension ${EXTENSION_ID} not found. Is it installed?`);
  }
  if (!ext.isActive) {
    await ext.activate();
  }
}

suite('Workflow Editor E2E', () => {
  suiteSetup(async () => {
    await ensureExtensionActivated();
  });

  teardown(async () => {
    // Close all editor tabs between tests to reset state
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await wait(300);
  });

  test('Scenario 1: Open existing workflow from the files sidebar', async () => {
    const sampleUri = vscode.Uri.file(path.join(workspaceDir, 'sample.yml'));

    await vscode.commands.executeCommand(OPEN_WITH_EDITOR_CMD, sampleUri);

    // Allow the webview panel to initialize
    await wait(2000);

    // The command should have opened a webview panel — verify via VS Code's tab API
    const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    const editorTab = allTabs.find(
      (tab) =>
        tab.input instanceof vscode.TabInputWebview &&
        tab.label === 'sample.yml'
    );

    assert.ok(editorTab, 'Expected a Workflow Editor webview tab with title "sample.yml" to be open');
  });

  test('Scenario 2: Create an empty workflow and open it from the files sidebar', async () => {
    const newFileName = 'new-workflow.yml';
    const newFileUri = vscode.Uri.file(path.join(workspaceDir, newFileName));

    // Create an empty YAML file in the workspace
    const emptyContent = new TextEncoder().encode('');
    await vscode.workspace.fs.writeFile(newFileUri, emptyContent);

    await vscode.commands.executeCommand(OPEN_WITH_EDITOR_CMD, newFileUri);

    // Allow the webview panel to initialize
    await wait(2000);

    const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    const editorTab = allTabs.find(
      (tab) =>
        tab.input instanceof vscode.TabInputWebview &&
        tab.label === newFileName
    );

    assert.ok(editorTab, `Expected a Workflow Editor webview tab with title "${newFileName}" to be open`);

    // Clean up the created file
    try {
      await vscode.workspace.fs.delete(newFileUri);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('Scenario 3: Open workflow via "Workflow Editor: Open with Workflow Editor" command', async () => {
    const sampleUri = vscode.Uri.file(path.join(fixturesDir, 'sample.yml'));

    // Open the fixture as a text document so it becomes the active editor
    const doc = await vscode.workspace.openTextDocument(sampleUri);
    await vscode.window.showTextDocument(doc);
    await wait(300);

    // Execute command without a URI argument — simulates command palette usage
    // The command reads from the active text editor
    await vscode.commands.executeCommand(OPEN_WITH_EDITOR_CMD);

    // Allow the webview panel to initialize
    await wait(2000);

    const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    const editorTab = allTabs.find(
      (tab) =>
        tab.input instanceof vscode.TabInputWebview &&
        tab.label === 'sample.yml'
    );

    assert.ok(editorTab, 'Expected a Workflow Editor webview tab with title "sample.yml" to be open after command palette invocation');
  });
});
