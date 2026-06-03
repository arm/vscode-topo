import * as vscode from 'vscode';
import { AttachVsCode, getDockerContextName } from './attachVsCode';
import { execFile } from '../util/exec';
import { TARGET_HOST_RUNTIME } from '../manifest';
import { DockerCommands } from '../target/dockerCommands';
import { ContainerItem } from '../util/types';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
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
    let attachVsCode: AttachVsCode;
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
    const commandString = (args: string[]): string => args.join('\0');
    const dockerContextShowCommand = commandString(['context', 'show']);
    const dockerContextsCommand = commandString([
        'context',
        'ls',
        '--format',
        '{{.Name}}',
    ]);
    const dockerContextUseCommand = commandString([
        'context',
        'use',
        dockerContext,
    ]);
    const dockerContextUseDefaultCommand = commandString([
        'context',
        'use',
        'default',
    ]);
    const dockerContextCreateCommand = commandString([
        'context',
        'create',
        dockerContext,
        '--docker',
        `host=ssh://${target}`,
    ]);

    beforeEach(() => {
        execFileMock = vi.mocked(execFile);
        attachVsCode = new AttachVsCode(dockerCommands);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    it("executes attachVsCode command that doesn't create context and calls remote-containers.attachToRunningContainer with container id", async () => {
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                const dockerCommandString = commandString(args);
                if (dockerCommandString === dockerContextShowCommand) {
                    return { stdout: 'default\n', stderr: '' };
                }
                if (dockerCommandString === dockerContextsCommand) {
                    return {
                        stdout: `default\n${dockerContext}\n`,
                        stderr: '',
                    };
                }
                if (dockerCommandString === dockerContextUseCommand) {
                    return { stdout: `${dockerContext}\n`, stderr: '' };
                }
                if (dockerCommandString === dockerContextUseDefaultCommand) {
                    return { stdout: 'default\n', stderr: '' };
                }
                throw new Error(`Unknown docker args: ${args.join(' ')}`);
            },
        );

        const commandExecution =
            attachVsCode.attachVsCodeCommandHandler(treeItem);
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
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                const dockerCommandString = commandString(args);
                if (dockerCommandString === dockerContextShowCommand) {
                    return { stdout: 'default\n', stderr: '' };
                }
                if (dockerCommandString === dockerContextsCommand) {
                    return { stdout: 'default\n', stderr: '' };
                }
                if (dockerCommandString === dockerContextUseCommand) {
                    return { stdout: `${dockerContext}\n`, stderr: '' };
                }
                if (dockerCommandString === dockerContextUseDefaultCommand) {
                    return { stdout: 'default\n', stderr: '' };
                }
                if (dockerCommandString === dockerContextCreateCommand) {
                    return { stdout: '', stderr: '' };
                }
                throw new Error(`Unknown docker args: ${args.join(' ')}`);
            },
        );

        const commandExecution =
            attachVsCode.attachVsCodeCommandHandler(treeItem);
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
        execFileMock.mockImplementation(async () => {
            throw new WrappedError('DOCKER', 'fail');
        });

        const commandExecution =
            attachVsCode.attachVsCodeCommandHandler(treeItem);
        await vi.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to attach VS Code to the container abc123. fail',
        );
    });
});
