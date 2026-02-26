import * as vscode from 'vscode';
import { TargetManager } from './targetManager';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetStore } from './targetStore';
import { logger } from '../util/logger';
import { ContainersManager } from './containersManager';
import { TargetItem } from '../util/types';
import { mock, MockProxy } from 'jest-mock-extended';
import type { TopoCli } from '../topoCli';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('../util/logger');
jest.mock('fs');
jest.mock('os');

const yamlTargetDescription = `host:
    - model: Cortex-A55
      cores: 2
      features:
        - fp
        - asimd
        - evtstrm
        - aes
remoteprocs:
    - name: imx-rproc`;

const targetDescription = {
    hostProcessor: [
        {
            model: 'Cortex-A55',
            cores: 2,
            features: ['fp', 'asimd', 'evtstrm', 'aes'],
        },
    ],
    remoteprocCPU: [
        {
            name: 'imx-rproc',
        },
    ],
};

const healthyBoard = {
    IsLocalHost: false,
    Connectivity: {
        Healthy: true,
        Name: 'Connectivity',
        Value: '',
    },
    Dependencies: [{ Healthy: true, Name: 'Container Engine', Value: '' }],
    SubsystemDriver: {
        Healthy: true,
        Name: 'Subsystem Driver',
        Value: '',
    },
};

const waitImmediate = () =>
    new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

const createTargetManager = () => {
    const onChangeEmitter = new vscode.EventEmitter<void>();
    const onDataUpdateEmitter = new vscode.EventEmitter<void>();
    const context = mock<vscode.ExtensionContext>({ subscriptions: [] });

    const targetTreeDataProvider: MockProxy<TargetTreeDataProvider> =
        mock<TargetTreeDataProvider>();

    const targetStore = mock<TargetStore>();
    targetStore.onChanged.mockImplementation(onChangeEmitter.event);

    const containersManager: MockProxy<ContainersManager> =
        mock<ContainersManager>();
    containersManager.getBoardState.mockResolvedValue({
        health: undefined,
        targetId: undefined,
    });
    containersManager.onDataUpdate.mockImplementation(
        onDataUpdateEmitter.event,
    );
    const topoCli: MockProxy<TopoCli> = mock<TopoCli>();
    const targetManager = new TargetManager(
        context,
        targetTreeDataProvider,
        targetStore,
        containersManager,
        topoCli,
    );
    return {
        onChangeEmitter,
        onDataUpdateEmitter,
        targetTreeDataProvider,
        targetManager,
        targetStore,
        containersManager,
        topoCli,
        context,
    };
};

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
    const addCall = calls.find((c: unknown[]) => c[0] === command);
    const handler = addCall![1] as (...args: unknown[]) => Promise<void>;
    await handler(...args);
}

let statusBarItems: vscode.StatusBarItem[] = [];

const mockedStatusBarItemCreation: typeof vscode.window.createStatusBarItem = ((
    id: string,
    alignment?: vscode.StatusBarAlignment,
    priority?: number,
) => {
    const statusBarItem: vscode.StatusBarItem = {
        id,
        alignment: alignment || vscode.StatusBarAlignment.Left,
        priority,
        name: undefined,
        text: '',
        tooltip: undefined,
        color: undefined,
        backgroundColor: undefined,
        command: undefined,
        accessibilityInformation: undefined,
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
    };
    statusBarItems.push(statusBarItem);
    return statusBarItem;
}) as unknown as typeof vscode.window.createStatusBarItem;

const emptyTargetDescription = {
    hostProcessor: [],
    remoteprocCPU: [],
};

describe('TargetManager', () => {
    beforeEach(() => {
        statusBarItems = [];
        jest.clearAllMocks();
        jest.mocked(os.tmpdir).mockReturnValue('/tmp');
        jest.mocked(fs.mkdtempSync).mockReturnValue('/tmp/topo-target-1234');
        jest.mocked(fs.readFileSync).mockReturnValue(yamlTargetDescription);
    });

    describe('activation', () => {
        it('registers tree provider and refresh command on activate', async () => {
            const { targetManager, context } = createTargetManager();

            await targetManager.activate();

            expect(vscode.window.createTreeView).toHaveBeenCalledWith(
                TargetManager.viewId,
                expect.anything(),
            );
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                TargetManager.refreshCommand,
                expect.any(Function),
            );
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                TargetManager.addTargetCommand,
                expect.any(Function),
            );
            expect(context.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('target addition', () => {
        it('handles addTargetCommand: prompts for ssh and name, stores and selects new target', async () => {
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('root@192.0.2.1')
                .mockResolvedValueOnce('My target');
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            const tmpDir = '/tmp/topo-target-1234';
            const yamlDescriptionPath = path.join(
                tmpDir,
                'target-description.yaml',
            );
            topoCli.describe.mockResolvedValue(yamlDescriptionPath);
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(topoCli.describe).toHaveBeenCalledWith(
                tmpDir,
                'root@192.0.2.1',
            );
            expect(fs.readFileSync).toHaveBeenCalledWith(
                yamlDescriptionPath,
                'utf8',
            );
            expect(fs.rmSync).toHaveBeenCalledWith(tmpDir, {
                recursive: true,
                force: true,
            });

            expect(
                jest.mocked(targetStore.addTarget).mock.calls.length,
            ).toBeGreaterThanOrEqual(1);
            const created = jest.mocked(targetStore.addTarget).mock.calls[0][0];
            expect(created).toBeDefined();
            expect(created.id).toBe('My target');
            expect(created.targetDescription).toEqual(targetDescription);
            expect(targetStore.setSelected).toHaveBeenCalledWith('My target');
        });

        it('does nothing when ssh input is cancelled', async () => {
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );
            const { targetStore, targetManager } = createTargetManager();
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).not.toHaveBeenCalled();
            expect(targetStore.setSelected).not.toHaveBeenCalled();
        });

        it('adds target when topoCli.describe fails', async () => {
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('root@192.0.2.1')
                .mockResolvedValueOnce('My target');
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            const error = new Error('describe failed');
            topoCli.describe.mockRejectedValueOnce(error);
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(topoCli.describe).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'Failed to get target description for root@192.0.2.1',
                ),
            );
            expect(targetStore.addTarget).toHaveBeenCalled();
            expect(targetStore.setSelected).toHaveBeenCalled();
        });

        it('does nothing when id input is cancelled', async () => {
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('root@192.0.2.1')
                .mockResolvedValueOnce(undefined);
            const { targetStore, targetManager } = createTargetManager();
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).not.toHaveBeenCalled();
            expect(targetStore.setSelected).not.toHaveBeenCalled();
        });

        it('shows error when targetStore.addTarget fails', async () => {
            jest.mocked(vscode.window.showInputBox)
                .mockResolvedValueOnce('root@192.0.2.1')
                .mockResolvedValueOnce('My target');
            const { targetTreeDataProvider, targetStore, targetManager } =
                createTargetManager();
            const error = new Error('boom');
            jest.mocked(targetStore.addTarget).mockRejectedValueOnce(error);
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(jest.mocked(targetStore.addTarget)).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to add target'),
                error,
            );
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to add target'),
            );
            expect(jest.mocked(targetStore.setSelected)).not.toHaveBeenCalled();
            expect(
                jest.mocked(targetTreeDataProvider.refresh),
            ).not.toHaveBeenCalled();
        });
    });

    describe('status bar', () => {
        it('shows an item in the status bar with the currently selected target', async () => {
            const target: TargetItem = {
                id: 'test',
                ssh: 'root@localhost',
                user: 'root',
                host: 'localhost',
                targetDescription: emptyTargetDescription,
            };
            const { targetManager, targetStore, containersManager } =
                createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target,
            );
            jest.mocked(containersManager.getBoardState).mockResolvedValue({
                health: undefined,
                targetId: undefined,
            });
            jest.mocked(vscode.window.createStatusBarItem).mockImplementation(
                mockedStatusBarItemCreation,
            );

            await targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.command).toBe(TargetManager.FocusViewCommand);
            expect(statusBarItem.text).toBe(`$(loading~spin) ${target.id}`);
            expect(statusBarItem.tooltip).toBe(
                'Connection String: root@localhost',
            );
            expect(statusBarItem.show).toHaveBeenCalledTimes(1);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });

        it("doesn't show an item in the status bar when no target is selected", async () => {
            const { targetManager, targetStore, containersManager } =
                createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                undefined,
            );
            jest.mocked(containersManager.getBoardState).mockResolvedValue({
                health: undefined,
                targetId: undefined,
            });
            jest.mocked(vscode.window.createStatusBarItem).mockImplementation(
                mockedStatusBarItemCreation,
            );

            await targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.text).toBe('');
            expect(statusBarItem.tooltip).toBe(undefined);
            expect(statusBarItem.hide).toHaveBeenCalledTimes(1);
            expect(statusBarItem.show).not.toHaveBeenCalled();
        });

        it('changes the item in the status bar when the currently selected target changes', async () => {
            const target1: TargetItem = {
                id: 'test',
                ssh: 'root@localhost',
                user: 'root',
                host: 'localhost',
                targetDescription: emptyTargetDescription,
            };
            const target2: TargetItem = {
                id: 'test2',
                ssh: 'root@other-host',
                user: 'root',
                host: 'other-host',
                targetDescription: emptyTargetDescription,
            };
            const {
                targetManager,
                targetStore,
                containersManager,
                onChangeEmitter,
            } = createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target1,
            );
            jest.mocked(containersManager.getBoardState).mockResolvedValue({
                health: healthyBoard,
                targetId: target1.id,
            });
            jest.mocked(vscode.window.createStatusBarItem).mockImplementation(
                mockedStatusBarItemCreation,
            );
            await targetManager.activate();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target2,
            );
            jest.mocked(containersManager.getBoardState).mockResolvedValue({
                health: healthyBoard,
                targetId: target2.id,
            });

            onChangeEmitter.fire();
            await waitImmediate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.text).toBe(`$(pass-filled) ${target2.id}`);
            expect(statusBarItem.tooltip).toBe(
                'Connection String: root@other-host',
            );
            expect(statusBarItem.show).toHaveBeenCalledTimes(2);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });

        it('logs an error if updating the status bar fails. Status bar stays unchanged', async () => {
            const target: TargetItem = {
                id: 'test',
                ssh: 'root@localhost',
                user: 'root',
                host: 'localhost',
                targetDescription: emptyTargetDescription,
            };
            const {
                targetManager,
                targetStore,
                containersManager,
                onDataUpdateEmitter,
            } = createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target,
            );
            jest.mocked(containersManager.getBoardState).mockResolvedValue({
                health: healthyBoard,
                targetId: target.id,
            });
            jest.mocked(vscode.window.createStatusBarItem).mockImplementation(
                mockedStatusBarItemCreation,
            );
            await targetManager.activate();
            const error = new Error('boom');
            jest.mocked(containersManager.getBoardState).mockRejectedValue(
                error,
            );

            onDataUpdateEmitter.fire();
            await waitImmediate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.text).toBe(`$(pass-filled) ${target.id}`);
            expect(statusBarItem.tooltip).toBe(
                'Connection String: root@localhost',
            );
            expect(statusBarItem.show).toHaveBeenCalledTimes(1);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to update target manager status bar',
                error,
            );
        });
    });
});
