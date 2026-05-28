import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { FixIssue } from './fixIssue';
import { TargetStore } from '../target/targetStore';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { executeTask } from '../util/executeTask';
import { executeCommand } from '../util/test/executeCommand';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('FixIssue', () => {
    const targetStore = mock<TargetStore>();
    const target = 'user@topo.local';

    beforeEach(() => {
        targetStore.getSelectedTarget.mockReturnValue(target);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers fix issue command', async () => {
        new FixIssue(targetStore);

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            FixIssue.fixIssueCommand,
            expect.any(Function),
        );
    });

    it('runs fix task for dependency with executable fix', async () => {
        new FixIssue(targetStore);
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install the remoteproc runtime',
                command: `topo install remoteproc-runtime --target ${target}`,
            },
        });

        await executeCommand(FixIssue.fixIssueCommand, dependencyItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Remoteproc Runtime on ${target}`,
            ['topo', 'install', 'remoteproc-runtime', '--target', target],
        );
    });

    it('does nothing for a healthy dependency', async () => {
        new FixIssue(targetStore);
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'ok',
            value: 'installed',
        });

        await executeCommand(FixIssue.fixIssueCommand, dependencyItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });
});
