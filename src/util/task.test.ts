import * as vscode from 'vscode';
import os from 'node:os';
import { createProcessTask } from './task';
import { mutable } from './test/mutable';

const workspaceFolder: vscode.WorkspaceFolder = {
    uri: vscode.Uri.file('/workspace/project'),
    name: 'project',
    index: 0,
};

describe('createProcessTask', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mutable(vscode.workspace).workspaceFolders = undefined;
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            undefined,
        );
    });

    it('uses the containing workspace folder as scope when cwd is inside a workspace', () => {
        mutable(vscode.workspace).workspaceFolders = [workspaceFolder];
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(
            workspaceFolder,
        );

        const task = createProcessTask('Deploy', ['topo', 'deploy'], {
            cwd: '/workspace/project/app',
        });

        expect(task).toMatchObject({
            scope: workspaceFolder,
            execution: expect.objectContaining({
                options: { cwd: '/workspace/project/app' },
            }),
        });
    });

    it('uses the user home directory when no workspace or cwd is available', () => {
        const task = createProcessTask('Fix Debugger', ['topo', 'install']);

        expect(task).toMatchObject({
            execution: expect.objectContaining({
                options: { cwd: os.homedir() },
            }),
        });
    });
});
