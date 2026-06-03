import * as vscode from 'vscode';
import { AttachVsCode, getDockerContextName } from './attachVsCode';
import { exec } from '../util/exec';
import { TARGET_HOST_RUNTIME } from '../manifest';
import { DockerCommands } from '../target/dockerCommands';
import { ContainerItem } from '../util/types';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import type { Mock } from 'vitest';

vi.mock('../util/exec', () => ({
    exec: vi.fn(),
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
    let execMock: Mock;
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

    beforeEach(() => {
        execMock = vi.mocked(exec);
        attachVsCode = new AttachVsCode(dockerCommands);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    it("executes attachVsCode command that doesn't create context and calls remote-containers.attachToRunningContainer with container id", async () => {
        execMock.mockImplementation(async (command) => {
            if (command === 'docker context show') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === "docker context ls --format '{{.Name}}'") {
                return { stdout: `default\n${dockerContext}\n`, stderr: '' };
            }
            if (command === `docker context use ${dockerContext}`) {
                return { stdout: `${dockerContext}\n`, stderr: '' };
            }
            if (command === 'docker context use default') {
                return { stdout: 'default\n', stderr: '' };
            }
            throw new Error(`Unknown command: ${command}`);
        });

        const commandExecution =
            attachVsCode.attachVsCodeCommandHandler(treeItem);
        await vi.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(execMock).toHaveBeenCalledWith('docker context show');
        expect(execMock).toHaveBeenCalledWith(
            "docker context ls --format '{{.Name}}'",
        );
        expect(execMock).toHaveBeenCalledWith(
            `docker context use ${dockerContext}`,
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'remote-containers.attachToRunningContainer',
            containerItem.id,
        );
        expect(execMock).toHaveBeenLastCalledWith('docker context use default');
    });

    it('executes attachVsCode command that creates context and calls remote-containers.attachToRunningContainer with container id', async () => {
        execMock.mockImplementation(async (command) => {
            if (command === 'docker context show') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === "docker context ls --format '{{.Name}}'") {
                return { stdout: 'default\n', stderr: '' };
            }
            if (command === `docker context use ${dockerContext}`) {
                return { stdout: `${dockerContext}\n`, stderr: '' };
            }
            if (command === 'docker context use default') {
                return { stdout: 'default\n', stderr: '' };
            }
            if (
                command ===
                `docker context create ${dockerContext} --docker host=ssh://${target}`
            ) {
                return { stdout: '', stderr: '' };
            }
            throw new Error(`Unknown command: ${command}`);
        });

        const commandExecution =
            attachVsCode.attachVsCodeCommandHandler(treeItem);
        await vi.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(execMock).toHaveBeenCalledWith('docker context show');
        expect(execMock).toHaveBeenCalledWith(
            "docker context ls --format '{{.Name}}'",
        );
        expect(execMock).toHaveBeenCalledWith(
            `docker context create ${dockerContext} --docker host=ssh://${target}`,
        );
        expect(execMock).toHaveBeenCalledWith(
            `docker context use ${dockerContext}`,
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'remote-containers.attachToRunningContainer',
            containerItem.id,
        );
        expect(execMock).toHaveBeenLastCalledWith('docker context use default');
    });

    it('shows an error if the attachVsCode command fails', async () => {
        execMock.mockImplementation(async () => {
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
