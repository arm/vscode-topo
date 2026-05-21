import * as vscode from 'vscode';
import { AttachVsCode, getDockerContextName } from './attachVsCode';
import { exec } from '../util/exec';
import { TARGET_HOST_RUNTIME } from '../manifest';
import { DockerCommands } from '../target/dockerCommands';
import { ContainerItem } from '../util/types';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';
import { WrappedError } from '../errors/wrappedError';
import { mock, MockProxy } from 'jest-mock-extended';
import { executeCommand } from '../util/test/executeCommand';

jest.mock('../util/exec', () => ({
    exec: jest.fn(),
}));
jest.mock('../util/logger');

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
    let execMock: jest.Mock;
    let context: MockProxy<vscode.ExtensionContext>;
    let attachVsCode: AttachVsCode;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
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
        execMock = jest.mocked(exec);
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        attachVsCode = new AttachVsCode(context, dockerCommands);
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.resetAllMocks();
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

        const commandExecution = executeCommand(
            AttachVsCode.attachVsCodeCommand,
            treeItem,
        );
        await jest.advanceTimersByTimeAsync(3000);
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
        attachVsCode.activate();
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

        const commandExecution = executeCommand(
            AttachVsCode.attachVsCodeCommand,
            treeItem,
        );
        await jest.advanceTimersByTimeAsync(3000);
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
        attachVsCode.activate();
        execMock.mockImplementation(async () => {
            throw new WrappedError('DOCKER', 'fail');
        });

        const commandExecution = executeCommand(
            AttachVsCode.attachVsCodeCommand,
            treeItem,
        );
        await jest.advanceTimersByTimeAsync(3000);
        await commandExecution;

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to attach VS Code to the container abc123. fail',
        );
    });
});
