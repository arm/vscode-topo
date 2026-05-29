import * as vscode from 'vscode';
import { FixIssue } from './fixIssue';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { executeTask } from '../util/executeTask';
import { executeCommand } from '../util/test/executeCommand';
import { TargetModel } from '../models/targetModel';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('FixIssue', () => {
    const targetModel = new TargetModel();
    const target = 'user@topo.local';

    beforeEach(() => {
        targetModel.setSelected(target);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers fix issue command', async () => {
        new FixIssue(targetModel);

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            FixIssue.fixIssueCommand,
            expect.any(Function),
        );
    });

    it('does not prompt to fix issues on construction', async () => {
        new FixIssue(targetModel);

        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('runs fix task for dependency with executable fix', async () => {
        new FixIssue(targetModel);
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
        new FixIssue(targetModel);
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'ok',
            value: 'installed',
        });

        await executeCommand(FixIssue.fixIssueCommand, dependencyItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });
});
