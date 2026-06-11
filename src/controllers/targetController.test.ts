import { mock } from 'vitest-mock-extended';
import { buildQuickPickItems, TargetController } from './targetController';
import * as vscode from 'vscode';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetStore } from '../target/targetStore';
import { TargetModel } from '../models/targetModel';
import { WrappedError } from '../errors/wrappedError';
import { showAndLogError } from '../util/showAndLogError';
import { TopoCli } from '../topoCli';
import { ContainerCommands } from '../target/containerCommands';
import { DockerInspectItem, DockerPsItem } from '../util/types';
import { loaded } from '../util/loadable';
import { HealthCheck } from '../topoCliSchema';

vi.mock('../util/logger');
vi.mock('../util/showAndLogError');

const target = 'user@target';
const health: HealthCheck = {
    host: {
        dependencies: [],
    },
    target: {
        destination: 'ssh://target',
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'ok',
            value: 'connected',
        },
        subsystemDriver: {
            name: 'Subsystem Driver',
            status: 'ok',
            value: 'ready',
        },
        dependencies: [],
    },
};

const dockerPsItem: DockerPsItem = {
    ID: 'abcdef',
    Names: 'service',
    Image: 'image',
    State: 'running',
    Status: 'Up 1 minute',
    Labels: '',
    RunningFor: '1 minute',
    CreatedAt: '',
};

const dockerInspectItem: DockerInspectItem = {
    Id: 'abcdef123456',
    HostConfig: {
        Runtime: 'runc',
        Annotations: {
            key: 'value',
        },
    },
    NetworkSettings: {
        Ports: {
            '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }],
        },
    },
};

afterEach(() => {
    vi.clearAllMocks();
});

function mockTargetStore(
    initialTargets: string[] = [],
    initialSelected?: string,
) {
    let targets = initialTargets;
    let selected = initialSelected;
    const targetStore = mock<TargetStore>();
    targetStore.getTargets.mockImplementation(() => new Set(targets));
    targetStore.getSelectedTarget.mockImplementation(() =>
        targets.includes(selected ?? '') ? selected : undefined,
    );
    targetStore.addTarget.mockImplementation(async (target) => {
        targets = [...targets, target];
    });
    targetStore.setSelected.mockImplementation(async (target) => {
        selected = target;
    });
    targetStore.deleteTarget.mockImplementation(async (target) => {
        targets = targets.filter((existing) => existing !== target);
        if (selected === target) {
            selected = undefined;
        }
    });
    return targetStore;
}

function mockControllerDependencies() {
    const topoCli = mock<TopoCli>();
    topoCli.health.mockResolvedValue(health);
    const containerCommands = mock<ContainerCommands>();
    containerCommands.getContainers.mockResolvedValue([]);
    containerCommands.inspectContainers.mockResolvedValue([]);
    return { topoCli, containerCommands };
}

function createController(targetModel: TargetModel, targetStore: TargetStore) {
    const { topoCli, containerCommands } = mockControllerDependencies();
    const controller = new TargetController(
        targetModel,
        targetStore,
        topoCli,
        containerCommands,
    );
    return { controller, topoCli, containerCommands };
}

describe('buildQuickPickItems', () => {
    it('returns hosts', () => {
        const items = buildQuickPickItems(['host-a', 'host-b'], '');

        expect(items).toEqual([
            { label: 'host-a', target: 'host-a' },
            { label: 'host-b', target: 'host-b' },
        ]);
    });

    it('returns current targets before ssh config hosts', () => {
        const items = buildQuickPickItems(['host-a', 'host-b'], '', [
            'saved-host',
            'host-a',
        ]);

        expect(items).toEqual([
            expect.objectContaining({
                label: 'saved-host',
                target: 'saved-host',
                buttons: expect.any(Array),
            }),
            { label: 'host-a', target: 'host-a', buttons: undefined },
            { label: 'host-b', target: 'host-b', buttons: undefined },
        ]);
    });

    it('does not add a remove button to saved targets from ssh config', () => {
        const items = buildQuickPickItems(['host-a'], '', ['host-a']);

        expect(items[0]).toEqual({
            label: 'host-a',
            target: 'host-a',
            buttons: undefined,
        });
    });

    it('adds a remove button to manual saved targets', () => {
        const items = buildQuickPickItems([], '', ['manual-host']);

        expect(items[0]).toEqual({
            label: 'manual-host',
            target: 'manual-host',
            buttons: expect.any(Array),
        });
    });

    it('adds remove buttons to all manual saved targets', () => {
        const items = buildQuickPickItems([], '', [
            'selected-host',
            'other-host',
        ]);

        expect(items).toEqual([
            expect.objectContaining({
                label: 'selected-host',
                target: 'selected-host',
                buttons: expect.any(Array),
            }),
            expect.objectContaining({
                label: 'other-host',
                target: 'other-host',
                buttons: expect.any(Array),
            }),
        ]);
    });

    it('marks the selected target with an icon description', () => {
        const items = buildQuickPickItems(
            [],
            '',
            ['selected-host', 'other-host'],
            'selected-host',
        );

        expect(items).toEqual([
            expect.objectContaining({
                label: 'selected-host',
                target: 'selected-host',
                description: '$(target)',
                buttons: expect.any(Array),
            }),
            expect.objectContaining({
                label: 'other-host',
                target: 'other-host',
                buttons: expect.any(Array),
            }),
        ]);
        expect(items[1]).not.toHaveProperty('description');
    });

    it('does not add a remove button to ssh config hosts that are not saved targets', () => {
        const items = buildQuickPickItems(['host-a'], '');

        expect(items[0]).toEqual({
            label: 'host-a',
            target: 'host-a',
            buttons: undefined,
        });
    });

    it('prepends a manual entry when filter does not match any host', () => {
        const items = buildQuickPickItems(['host-a'], 'root@10.0.0.1');

        expect(items[0]).toEqual({
            label: 'root@10.0.0.1',
            target: 'root@10.0.0.1',
            description: 'Add new SSH target',
        });
        expect(items[1]).toEqual({
            label: 'host-a',
            target: 'host-a',
            buttons: undefined,
        });
    });

    it('does not prepend manual entry when filter matches a host (case-insensitive)', () => {
        const items = buildQuickPickItems(['Host-A'], 'host-a');

        expect(items[0]).toEqual({
            label: 'Host-A',
            target: 'Host-A',
            buttons: undefined,
        });
    });

    it('does not prepend manual entry when filter matches a current target (case-insensitive)', () => {
        const items = buildQuickPickItems([], 'saved-host', ['Saved-Host']);

        expect(items[0]).toEqual(
            expect.objectContaining({
                label: 'Saved-Host',
                target: 'Saved-Host',
                buttons: expect.any(Array),
            }),
        );
    });

    it('does not prepend manual entry when filter is whitespace-only', () => {
        const items = buildQuickPickItems(['host-a'], '   ');

        expect(items[0]).toEqual({
            label: 'host-a',
            target: 'host-a',
            buttons: undefined,
        });
    });

    it('trims whitespace from the filter for the manual entry label', () => {
        const items = buildQuickPickItems([], '  my-host  ');

        expect(items[0]).toEqual({
            label: 'my-host',
            target: 'my-host',
            description: 'Add new SSH target',
        });
    });

    it('returns nothing when no hosts and empty filter', () => {
        const items = buildQuickPickItems([], '');

        expect(items).toEqual([]);
    });
});

describe('load from store', () => {
    it('loads targets and selected target into the model from the store', () => {
        const targetStore = mockTargetStore(['host-a', 'host-b'], 'host-b');
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        controller.updateTargetsFromStore();

        expect(targetModel.targets).toEqual(['host-a', 'host-b']);
        expect(targetModel.selected).toBe('host-b');
    });

    it('shows a data issue in the model when stored targets are corrupted', () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        targetStore.getTargets.mockImplementation(() => {
            throw new WrappedError('STORAGE', 'Failed to load targets');
        });

        const { controller } = createController(targetModel, targetStore);
        controller.updateTargetsFromStore();

        expect(targetModel.dataIssue).toBe(true);
        expect(targetModel.targets).toEqual([]);
        expect(targetModel.selected).toBeUndefined();
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            'topo.targetDataIssue',
            true,
        );
    });

    it('clears the data issue after targets load successfully', () => {
        const targetStore = mockTargetStore(['host-a'], 'host-a');
        const targetModel = new TargetModel();
        targetModel.setDataStoreCorrupted();

        const { controller } = createController(targetModel, targetStore);
        controller.updateTargetsFromStore();

        expect(targetModel.dataIssue).toBe(false);
        expect(targetModel.targets).toEqual(['host-a']);
        expect(targetModel.selected).toBe('host-a');
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            'topo.targetDataIssue',
            false,
        );
    });

    it('resets extension data when reset command is invoked', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        targetStore.resetExtensionData.mockResolvedValue(undefined);
        const { controller } = createController(targetModel, targetStore);

        await controller.resetExtensionDataCommandHandler();

        expect(targetStore.resetExtensionData).toHaveBeenCalled();
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            'topo.targetDataIssue',
            false,
        );
    });

    it('reports an error when resetting extension data fails', async () => {
        const targetStore = mockTargetStore();
        const error = new Error('boom');
        targetStore.resetExtensionData.mockRejectedValue(error);
        const { controller } = createController(new TargetModel(), targetStore);

        await controller.resetExtensionDataCommandHandler();

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to reset Topo local data',
            error,
        );
    });

    it('throws when selected target loading fails', () => {
        const targetStore = mockTargetStore(['host-a']);
        const targetModel = new TargetModel();
        targetStore.getSelectedTarget.mockImplementation(() => {
            throw new WrappedError('STORAGE', 'Failed to load selected target');
        });
        const { controller } = createController(targetModel, targetStore);

        expect(() => controller.updateTargetsFromStore()).toThrow(
            'Failed to load selected target',
        );
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
});

describe('target addition', () => {
    type TestQuickPickItem = vscode.QuickPickItem & { target?: string };

    function mockQuickPick({
        selectedItem,
        triggerButtonForLabel,
    }: {
        selectedItem?: TestQuickPickItem;
        triggerButtonForLabel?: string;
    }) {
        const onDidAcceptEmitter = new vscode.EventEmitter<void>();
        const onDidHideEmitter = new vscode.EventEmitter<void>();
        const onDidChangeValueEmitter = new vscode.EventEmitter<string>();
        const onDidTriggerItemButtonEmitter = new vscode.EventEmitter<
            vscode.QuickPickItemButtonEvent<TestQuickPickItem>
        >();
        const quickPick = mock<vscode.QuickPick<TestQuickPickItem>>({
            title: '',
            placeholder: '',
            items: [] as TestQuickPickItem[],
            selectedItems: selectedItem
                ? [{ target: selectedItem.label, ...selectedItem }]
                : [],
            onDidAccept: onDidAcceptEmitter.event,
            onDidHide: onDidHideEmitter.event,
            onDidChangeValue: onDidChangeValueEmitter.event,
            onDidTriggerItemButton: onDidTriggerItemButtonEmitter.event,
            show: vi.fn(() => {
                if (triggerButtonForLabel) {
                    const item = quickPick.items.find(
                        (item) => item.label === triggerButtonForLabel,
                    );
                    onDidTriggerItemButtonEmitter.fire({
                        item,
                        button: item?.buttons?.[0],
                    } as vscode.QuickPickItemButtonEvent<TestQuickPickItem>);
                } else if (selectedItem) {
                    onDidAcceptEmitter.fire();
                } else {
                    onDidHideEmitter.fire();
                }
            }),
        });
        vi.mocked(vscode.window.createQuickPick).mockReturnValueOnce(
            quickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
        );
        return quickPick;
    }

    it('prompts for ssh, stores and selects new target', async () => {
        const targetSsh = 'root@192.0.2.1';
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        mockQuickPick({ selectedItem: { label: targetSsh } });

        await controller.selectCommandHandler();

        expect(targetStore.addTarget).toHaveBeenCalledWith(targetSsh);
        expect(targetStore.setSelected).toHaveBeenCalledWith(targetSsh);
        expect(targetModel.selected).toBe(targetSsh);
        expect(targetModel.targets).toEqual([targetSsh]);
    });

    it('trims the selected target before storing and selecting it', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        mockQuickPick({ selectedItem: { label: '  root@192.0.2.1  ' } });

        await controller.selectCommandHandler();

        expect(targetStore.addTarget).toHaveBeenCalledWith('root@192.0.2.1');
        expect(targetStore.setSelected).toHaveBeenCalledWith('root@192.0.2.1');
        expect(targetModel.selected).toBe('root@192.0.2.1');
        expect(targetModel.targets).toEqual(['root@192.0.2.1']);
    });

    it('selects an existing target without adding it again', async () => {
        const targetStore = mockTargetStore(['saved-host'], 'saved-host');
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        controller.updateTargetsFromStore();
        const quickPick = mockQuickPick({
            selectedItem: { label: 'saved-host' },
        });

        await controller.selectCommandHandler();

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        expect(targetStore.setSelected).toHaveBeenCalledWith('saved-host');
        expect(quickPick.items[0]).toEqual(
            expect.objectContaining({
                target: 'saved-host',
                description: '$(target)',
            }),
        );
        expect(targetModel.selected).toBe('saved-host');
        expect(targetModel.targets).toEqual(['saved-host']);
    });

    it('does nothing when quick pick is dismissed', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        mockQuickPick({});

        await controller.selectCommandHandler();

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
        expect(targetModel.selected).toBeUndefined();
        expect(targetModel.targets).toEqual([]);
    });

    it('removes a saved target from the quick pick item button', async () => {
        const targetStore = mockTargetStore(['manual-host']);
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        controller.updateTargetsFromStore();
        mockQuickPick({ triggerButtonForLabel: 'manual-host' });

        await controller.selectCommandHandler();

        expect(targetStore.deleteTarget).toHaveBeenCalledWith('manual-host');
        expect(targetStore.setSelected).not.toHaveBeenCalled();
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(targetModel.selected).toBeUndefined();
        expect(targetModel.targets).toEqual([]);
    });

    it('confirms before removing the selected target from the quick pick item button', async () => {
        const targetStore = mockTargetStore(
            ['selected-host', 'other-host'],
            'selected-host',
        );
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        controller.updateTargetsFromStore();
        vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
            'Remove Target' as unknown as vscode.MessageItem,
        );
        mockQuickPick({ triggerButtonForLabel: 'selected-host' });

        await controller.selectCommandHandler();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Remove the selected target "selected-host"?',
            { modal: true },
            'Remove Target',
        );
        expect(targetStore.deleteTarget).toHaveBeenCalledWith('selected-host');
        expect(targetModel.selected).toBeUndefined();
        expect(targetModel.targets).toEqual(['other-host']);
    });

    it('does not remove the selected target when confirmation is dismissed', async () => {
        const targetStore = mockTargetStore(['selected-host'], 'selected-host');
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        controller.updateTargetsFromStore();
        vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
            undefined,
        );
        mockQuickPick({ triggerButtonForLabel: 'selected-host' });

        await controller.selectCommandHandler();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Remove the selected target "selected-host"?',
            { modal: true },
            'Remove Target',
        );
        expect(targetStore.deleteTarget).not.toHaveBeenCalled();
        expect(targetModel.selected).toBe('selected-host');
        expect(targetModel.targets).toEqual(['selected-host']);
    });

    it('shows an error when targetStore.deleteTarget fails with a storage error', async () => {
        const targetStore = mockTargetStore(['manual-host']);
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        const error = new WrappedError('STORAGE', 'Failed to load targets');
        targetStore.deleteTarget.mockRejectedValue(error);
        controller.updateTargetsFromStore();
        mockQuickPick({ triggerButtonForLabel: 'manual-host' });

        await controller.selectCommandHandler();

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to remove target',
            error,
        );
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('shows error when targetStore.addTarget fails with an invalid target error', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        const error = new WrappedError('INVALID_SSH_DESTINATION', 'boom');
        targetStore.addTarget.mockRejectedValueOnce(error);
        mockQuickPick({ selectedItem: { label: 'root@192.0.2.1' } });

        await controller.selectCommandHandler();

        expect(targetStore.addTarget).toHaveBeenCalled();
        expect(showAndLogError).toHaveBeenCalledWith(
            'Cannot add target. Enter a valid SSH destination',
            error,
        );
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });

    it('throws when targetStore.addTarget fails with a non-invalid-target error', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        const error = new Error('boom');
        targetStore.addTarget.mockRejectedValueOnce(error);
        mockQuickPick({ selectedItem: { label: 'root@192.0.2.1' } });

        await expect(controller.selectCommandHandler()).rejects.toThrow(error);

        expect(showAndLogError).not.toHaveBeenCalled();
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });

    it('throws when targetStore.addTarget fails with a storage error', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        const error = new WrappedError('STORAGE', 'Failed to load targets');
        targetStore.addTarget.mockRejectedValueOnce(error);
        mockQuickPick({ selectedItem: { label: 'root@192.0.2.1' } });

        await expect(controller.selectCommandHandler()).rejects.toThrow(error);

        expect(showAndLogError).not.toHaveBeenCalled();
    });
});

describe('target unselection', () => {
    it('clears the selected target and updates model', async () => {
        const targetStore = mockTargetStore(['user@board'], 'user@board');
        const targetModel = new TargetModel();
        targetModel.setSelected('user@board');
        const { controller } = createController(targetModel, targetStore);
        const targetItem = new TargetTreeItem({
            target: 'user@board',
        });

        await controller.unselectCommandHandler(targetItem);

        expect(targetStore.setSelected).toHaveBeenCalledWith(undefined);
        expect(targetModel.selected).toBeUndefined();
        expect(targetModel.selectedTargetHealth).toEqual(loaded(undefined));
        expect(targetModel.selectedTargetContainers).toEqual(loaded([]));
    });

    it('does nothing when unselect command is executed with a non-target item', async () => {
        const targetStore = mockTargetStore(['user@board'], 'user@board');
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);

        await controller.unselectCommandHandler();

        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });
});

describe('selected target data refresh', () => {
    it('loads health and containers for the selected target', async () => {
        const targetStore = mockTargetStore([target], target);
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const { controller, topoCli, containerCommands } = createController(
            targetModel,
            targetStore,
        );
        containerCommands.getContainers.mockResolvedValue([dockerPsItem]);
        containerCommands.inspectContainers.mockResolvedValue([
            dockerInspectItem,
        ]);

        await controller.refreshSelectedTargetDataCommandHandler();

        expect(targetModel.selectedTargetContainers).toStrictEqual(
            loaded([
                {
                    id: dockerPsItem.ID,
                    name: dockerPsItem.Names,
                    image: dockerPsItem.Image,
                    state: dockerPsItem.State,
                    status: dockerPsItem.Status,
                    labels: dockerPsItem.Labels,
                    runningFor: dockerPsItem.RunningFor,
                    createdAt: dockerPsItem.CreatedAt,
                    runtime: dockerInspectItem.HostConfig.Runtime,
                    annotations: dockerInspectItem.HostConfig.Annotations,
                    ports: dockerInspectItem.NetworkSettings.Ports,
                    target,
                },
            ]),
        );
        expect(targetModel.selectedTargetHealth).toStrictEqual(
            loaded(health.target),
        );
        expect(topoCli.health).toHaveBeenCalledWith(target);
        expect(containerCommands.getContainers).toHaveBeenCalledWith(target);
        expect(containerCommands.inspectContainers).toHaveBeenCalledWith(
            [dockerPsItem.ID],
            target,
        );
    });

    it('treats container engine dependency error as error when loading containers', async () => {
        const unhealthyContainerEngineHealth: HealthCheck = {
            ...health,
            target: {
                ...health.target,
                dependencies: [
                    {
                        name: 'Container Engine',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install container engine',
                        },
                    },
                ],
            },
        };
        const targetStore = mockTargetStore([target], target);
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const { controller, topoCli, containerCommands } = createController(
            targetModel,
            targetStore,
        );
        topoCli.health.mockResolvedValue(unhealthyContainerEngineHealth);

        await controller.refreshSelectedTargetDataCommandHandler();

        expect(targetModel.selectedTargetContainers).toStrictEqual({
            status: 'errored',
            error: new Error('Install container engine'),
            loading: false,
        });
        expect(containerCommands.getContainers).not.toHaveBeenCalled();
        expect(containerCommands.inspectContainers).not.toHaveBeenCalled();
    });

    it('sets empty containers when selected target health is disconnected', async () => {
        const disconnectedHealth: HealthCheck = {
            ...health,
            target: {
                ...health.target,
                connectivity: {
                    name: 'Connectivity',
                    status: 'error',
                    value: 'unreachable',
                    fix: {
                        description: 'Connect the target',
                    },
                },
            },
        };
        const targetStore = mockTargetStore([target], target);
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const { controller, topoCli, containerCommands } = createController(
            targetModel,
            targetStore,
        );
        topoCli.health.mockResolvedValue(disconnectedHealth);

        await controller.refreshSelectedTargetDataCommandHandler();

        expect(targetModel.selectedTargetHealth).toStrictEqual(
            loaded(disconnectedHealth.target),
        );
        expect(targetModel.selectedTargetContainers).toStrictEqual(loaded([]));
        expect(containerCommands.getContainers).not.toHaveBeenCalled();
    });
});
