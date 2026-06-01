import * as vscode from 'vscode';
import { AttachVsCode, getDockerContextName } from './attachVsCode';
import { execFile } from '../util/exec';
import { TARGET_HOST_RUNTIME } from '../manifest';
import { DockerCommands } from '../target/dockerCommands';
import { ContainerItem } from '../util/types';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock, MockProxy } from 'vitest-mock-extended';
import { executeCommand } from '../util/test/executeCommand';
import type { Mock } from 'vitest';

vi.mock('../util/exec', () => ({
    execFile: vi.fn(),
}));
vi.mock('../util/logger');

describe('getDockerContextName', () => {
    it('keeps docker context characters that are already valid', () => {
        expect(getDockerContextName('user.name+dev-1_2')).toBe(
            'user.name+dev-1_2',
        );
    });

    it('replaces invalid separators with hyphens', () => {
        expect(getDockerContextName('user@topo.local:22/path')).toBe(
            'user-topo.local-22-path',
        );
    });

    it('replaces each invalid character individually', () => {
        expect(getDockerContextName('user@@topo.local')).toBe(
            'user--topo.local',
        );
    });
});

describe('attachVsCode', () => {
    let execFileMock: Mock;
    let context: MockProxy<vscode.ExtensionContext>;
    let attachVsCode: AttachVsCode;
    const registerCommandMock = vi.mocked(vscode.commands.registerCommand);
    const dockerCommands = new DockerCommands();
    const target = 'user@topo.local';
    const containerItem: ContainerItem = {
        id: 'abc123',
        name: 'my-container',
        image: 'nginx',
        state: 'running',
        status: 'Up',
        labels: '',
        runningFor: '',
        runtime: TARGET_HOST_RUNTIME,
        annotations: {},
        createdAt: '',
        ports: {},
        target,
    };
    const treeItem = new TargetContainerTreeItem(containerItem);
    const dockerContext = getDockerContextName(target);

    beforeEach(() => {
        execFileMock = vi.mocked(execFile);
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        attachVsCode = new AttachVsCode(context, dockerCommands);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    it('registers the command', async () => {
        attachVsCode.activate();

        expect(registerCommandMock).toHaveBeenCalledWith(
            AttachVsCode.attachVsCodeCommand,
            expect.any(Function),
        );
    });

    it("executes attachVsCode command that doesn't create context and calls remote-containers.attachToRunningContainer with container id", async () => {
        attachVsCode.activate();
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                const dockerArgs = args;
                if (dockerArgs.join(' ') === 'context show') {
                    return { stdout: 'default\n', stderr: '' };
                }
                if (dockerArgs.join(' ') === 'context ls --format {{.Name}}') {
                    return {
                        stdout: `default\n${dockerContext}\n`,
                        stderr: '',
                    };
                }
                if (dockerArgs.join(' ') === `context use ${dockerContext}`) {
                    return { stdout: `${dockerContext}\n`, stderr: '' };
                }
                if (dockerArgs.join(' ') === 'context use default') {
                    return { stdout: 'default\n', stderr: '' };
                }
                throw new Error(`Unknown docker args: ${dockerArgs.join(' ')}`);
            },
        );

        const commandExecution = executeCommand(
            AttachVsCode.attachVsCodeCommand,
            treeItem,
        );
        await vi.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(execFileMock).toHaveBeenCalledWith('docker', [
            'context',
            'show',
        ]);
        expect(execFileMock).toHaveBeenCalledWith('docker', [
            'context',
            'ls',
            '--format',
            '{{.Name}}',
        ]);
        expect(execFileMock).toHaveBeenCalledWith('docker', [
            'context',
            'use',
            dockerContext,
        ]);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'remote-containers.attachToRunningContainer',
            containerItem.id,
        );
        expect(execFileMock).toHaveBeenLastCalledWith('docker', [
            'context',
            'use',
            'default',
        ]);
    });

    it('executes attachVsCode command that creates context and calls remote-containers.attachToRunningContainer with container id', async () => {
        attachVsCode.activate();
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                const dockerArgs = args;
                if (dockerArgs.join(' ') === 'context show') {
                    return { stdout: 'default\n', stderr: '' };
                }
                if (dockerArgs.join(' ') === 'context ls --format {{.Name}}') {
                    return { stdout: 'default\n', stderr: '' };
                }
                if (dockerArgs.join(' ') === `context use ${dockerContext}`) {
                    return { stdout: `${dockerContext}\n`, stderr: '' };
                }
                if (dockerArgs.join(' ') === 'context use default') {
                    return { stdout: 'default\n', stderr: '' };
                }
                if (
                    dockerArgs.join(' ') ===
                    `context create ${dockerContext} --docker host=ssh://${target}`
                ) {
                    return { stdout: '', stderr: '' };
                }
                throw new Error(`Unknown docker args: ${dockerArgs.join(' ')}`);
            },
        );

        const commandExecution = executeCommand(
            AttachVsCode.attachVsCodeCommand,
            treeItem,
        );
        await vi.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(execFileMock).toHaveBeenCalledWith('docker', [
            'context',
            'show',
        ]);
        expect(execFileMock).toHaveBeenCalledWith('docker', [
            'context',
            'ls',
            '--format',
            '{{.Name}}',
        ]);
        expect(execFileMock).toHaveBeenCalledWith('docker', [
            'context',
            'create',
            dockerContext,
            '--docker',
            `host=ssh://${target}`,
        ]);
        expect(execFileMock).toHaveBeenCalledWith('docker', [
            'context',
            'use',
            dockerContext,
        ]);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'remote-containers.attachToRunningContainer',
            containerItem.id,
        );
        expect(execFileMock).toHaveBeenLastCalledWith('docker', [
            'context',
            'use',
            'default',
        ]);
    });

    it('shows an error if the attachVsCode command fails', async () => {
        attachVsCode.activate();
        execFileMock.mockImplementation(async () => {
            throw new WrappedError('DOCKER', 'fail');
        });

        const commandExecution = executeCommand(
            AttachVsCode.attachVsCodeCommand,
            treeItem,
        );
        await vi.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to attach VS Code to the container abc123. fail',
        );
    });
});
