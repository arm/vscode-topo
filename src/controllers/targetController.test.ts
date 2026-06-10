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
            selected = [...targets].sort((a, b) => a.localeCompare(b))[0];
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

        expect(items).toEqual([{ label: 'host-a' }, { label: 'host-b' }]);
    });

    it('prepends a manual entry when filter does not match any host', () => {
        const items = buildQuickPickItems(['host-a'], 'root@10.0.0.1');

        expect(items[0]).toEqual({
            label: 'root@10.0.0.1',
            description: 'Add new SSH target',
        });
        expect(items[1]).toEqual({ label: 'host-a' });
    });

    it('does not prepend manual entry when filter matches a host (case-insensitive)', () => {
        const items = buildQuickPickItems(['Host-A'], 'host-a');

        expect(items[0]).toEqual({ label: 'Host-A' });
    });

    it('does not prepend manual entry when filter is whitespace-only', () => {
        const items = buildQuickPickItems(['host-a'], '   ');

        expect(items[0]).toEqual({ label: 'host-a' });
    });

    it('trims whitespace from the filter for the manual entry label', () => {
        const items = buildQuickPickItems([], '  my-host  ');

        expect(items[0]).toEqual({
            label: 'my-host',
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
});

describe('target addition', () => {
    function mockQuickPick(selectedItem: vscode.QuickPickItem | undefined) {
        const onDidAcceptEmitter = new vscode.EventEmitter<void>();
        const onDidHideEmitter = new vscode.EventEmitter<void>();
        const onDidChangeValueEmitter = new vscode.EventEmitter<string>();
        const quickPick = mock<vscode.QuickPick<vscode.QuickPickItem>>({
            title: '',
            placeholder: '',
            items: [] as vscode.QuickPickItem[],
            selectedItems: selectedItem ? [selectedItem] : [],
            onDidAccept: onDidAcceptEmitter.event,
            onDidHide: onDidHideEmitter.event,
            onDidChangeValue: onDidChangeValueEmitter.event,
            show: vi.fn(() => {
                if (selectedItem) {
                    onDidAcceptEmitter.fire();
                } else {
                    onDidHideEmitter.fire();
                }
            }),
        });
        vi.mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPick);
        return quickPick;
    }

    it('prompts for ssh, stores and selects new target', async () => {
        const targetSsh = 'root@192.0.2.1';
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        mockQuickPick({ label: targetSsh });

        await controller.addCommandHandler();

        expect(targetStore.addTarget).toHaveBeenCalledWith(targetSsh);
        expect(targetStore.setSelected).toHaveBeenCalledWith(targetSsh);
        expect(targetModel.selected).toBe(targetSsh);
        expect(targetModel.targets).toEqual([targetSsh]);
    });

    it('trims the selected target before storing and selecting it', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        mockQuickPick({ label: '  root@192.0.2.1  ' });

        await controller.addCommandHandler();

        expect(targetStore.addTarget).toHaveBeenCalledWith('root@192.0.2.1');
        expect(targetStore.setSelected).toHaveBeenCalledWith('root@192.0.2.1');
        expect(targetModel.selected).toBe('root@192.0.2.1');
        expect(targetModel.targets).toEqual(['root@192.0.2.1']);
    });

    it('does nothing when quick pick is dismissed', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        mockQuickPick(undefined);

        await controller.addCommandHandler();

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
        expect(targetModel.selected).toBeUndefined();
        expect(targetModel.targets).toEqual([]);
    });

    it('shows error when targetStore.addTarget fails with an invalid target error', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        const error = new WrappedError('INVALID_SSH_DESTINATION', 'boom');
        targetStore.addTarget.mockRejectedValueOnce(error);
        mockQuickPick({ label: 'root@192.0.2.1' });

        await controller.addCommandHandler();

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
        mockQuickPick({ label: 'root@192.0.2.1' });

        await expect(controller.addCommandHandler()).rejects.toThrow(error);

        expect(showAndLogError).not.toHaveBeenCalled();
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });
});

describe('target selection', () => {
    it('saves the selected target, updates model and clears selected target data', async () => {
        const previousTarget = 'user@previous-board';
        const targetStore = mockTargetStore(
            [previousTarget, 'user@board'],
            previousTarget,
        );
        const targetModel = new TargetModel();
        targetModel.setSelected(previousTarget);
        const { controller } = createController(targetModel, targetStore);
        const targetItem = new TargetTreeItem({
            target: 'user@board',
            selected: true,
        });

        await controller.selectCommandHandler(targetItem);

        expect(targetStore.setSelected).toHaveBeenCalledWith(targetItem.target);
        expect(targetModel.selected).toBe(targetItem.target);
        expect(targetModel.selectedTargetHealth).toEqual(loaded(undefined));
        expect(targetModel.selectedTargetContainers).toEqual(loaded([]));
    });

    it('does nothing when select command is executed with a non-target item', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller, topoCli } = createController(
            targetModel,
            targetStore,
        );

        await controller.selectCommandHandler();

        expect(targetStore.setSelected).not.toHaveBeenCalled();
        expect(targetModel.selected).toBeUndefined();
        expect(topoCli.health).not.toHaveBeenCalled();
    });
});

describe('target removal', () => {
    it('deletes the target from the store when removeTarget is invoked with a target item', async () => {
        const targetItem = new TargetTreeItem({
            target: 'foo@bar.co',
            selected: true,
        });
        const targetStore = mockTargetStore([targetItem.target]);
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);

        await controller.removeCommandHandler(targetItem);

        expect(targetStore.deleteTarget).toHaveBeenCalledWith(
            targetItem.target,
        );
        expect(targetModel.targets).toEqual([]);
    });

    it('selects a remaining target when the removed target was selected', async () => {
        const removedTarget = 'foo@bar.co';
        const remainingTarget = 'bar@bar.co';
        const targetStore = mockTargetStore(
            [removedTarget, remainingTarget],
            removedTarget,
        );
        const targetModel = new TargetModel();
        targetModel.setSelected(removedTarget);
        const { controller } = createController(targetModel, targetStore);
        const targetItem = new TargetTreeItem({
            target: removedTarget,
            selected: true,
        });

        await controller.removeCommandHandler(targetItem);

        expect(targetStore.deleteTarget).toHaveBeenCalledWith(removedTarget);
        expect(targetModel.selected).toBe(remainingTarget);
    });

    it('does nothing when removeTarget is invoked with a non-target item', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);

        await controller.removeCommandHandler();

        expect(targetStore.deleteTarget).not.toHaveBeenCalled();
        expect(targetModel.targets).toEqual([]);
    });

    it('shows an error when deleteTarget fails', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const { controller } = createController(targetModel, targetStore);
        const targetItem = new TargetTreeItem({
            target: 'foo@bar.co',
            selected: true,
        });
        const error = new Error('Target not found');
        targetStore.deleteTarget.mockRejectedValue(error);

        await controller.removeCommandHandler(targetItem);

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to remove target',
            error,
        );
    });
});

describe('selected target data refresh', () => {
    it('clears selected target data when no target is selected', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        targetModel.setSelectedTargetHealth(loaded(health.target));
        targetModel.setSelectedTargetContainers(loaded([]));
        const { controller, topoCli, containerCommands } = createController(
            targetModel,
            targetStore,
        );

        await controller.refreshSelectedTargetDataCommandHandler();

        expect(targetModel.selectedTargetHealth).toEqual(loaded(undefined));
        expect(targetModel.selectedTargetContainers).toEqual(loaded([]));
        expect(topoCli.health).not.toHaveBeenCalled();
        expect(containerCommands.getContainers).not.toHaveBeenCalled();
    });

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
