import * as vscode from 'vscode';
import { FixIssue } from './fixIssue';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { executeTask } from '../util/executeTask';
import { executeCommand } from '../util/test/executeCommand';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';
import { mock, MockProxy } from 'vitest-mock-extended';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('FixIssue', () => {
    const targetModel = new TargetModel();
    const target = 'user@topo.local';
    const topoBinaryPath = '/fake/extension/resources/topo';
    let topoCli: MockProxy<TopoCli>;

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        targetModel.setSelected(target);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers fix issue command', async () => {
        new FixIssue(topoCli, targetModel);

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            FixIssue.fixIssueCommand,
            expect.any(Function),
        );
    });

    it('does not prompt to fix issues on construction', async () => {
        new FixIssue(topoCli, targetModel);

        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('runs fix task for dependency with executable fix', async () => {
        new FixIssue(topoCli, targetModel);
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
            [
                topoBinaryPath,
                'install',
                'remoteproc-runtime',
                '--target',
                target,
            ],
        );
    });

    it('does nothing for a healthy dependency', async () => {
        new FixIssue(topoCli, targetModel);
        const dependencyItem = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            status: 'ok',
            value: 'installed',
        });

        await executeCommand(FixIssue.fixIssueCommand, dependencyItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });
});
