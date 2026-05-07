import { ContainersManager } from './containersManager';
import { ContainerItem, DockerPsItem } from '../util/types';
import * as manifest from '../manifest';
import { exec } from '../util/exec';
import { DockerCommands } from './dockerCommands';
import * as vscode from 'vscode';
import { TargetStore } from './targetStore';
import { mock } from 'jest-mock-extended';
import { TopoCli } from '../topoCli';
import type { ContainerCommands } from './containerCommands';
import type { HealthCheckResult } from '../topoCliSchema';

const waitImmediate = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

jest.mock('../util/exec', () => ({
    exec: jest.fn(),
}));
jest.mock('../util/logger');

const webServerPortInfo = {
    '80/tcp': [
        { HostIp: '0.0.0.0', HostPort: '8080' },
        { HostIp: '::', HostPort: '8080' },
    ],
};
const remoteprocAnnotations = { 'remoteproc.name': 'imx-rproc' };
const mockContainers: DockerPsItem[] = [
    {
        ID: 'id1',
        Names: 'cont1',
        Image: 'img1',
        State: 'running',
        Status: 'Up 4 days',
        Labels: 'foo=bar',
        RunningFor: '1h',
        CreatedAt: '2024-01-01T00:00:00Z',
    },
    {
        ID: 'id2',
        Names: 'cont2',
        Image: 'img2',
        State: 'exited',
        Status: 'Exited (0) 2 hours ago',
        Labels: 'baz=qux',
        RunningFor: '2h',
        CreatedAt: '2024-01-02T00:00:00Z',
    },
];
const dockerCommands = new DockerCommands();
const defaultContextOutput = {
    stdout: 'default\ntopo\n',
    stderr: '',
};
const defaultPsOutput = {
    stdout: mockContainers.map((c) => JSON.stringify(c)).join('\n'),
    stderr: '',
};
const defaultInspectOutput = {
    stdout: [
        JSON.stringify({
            Id: mockContainers[0].ID,
            NetworkSettings: { Ports: webServerPortInfo },
            HostConfig: {
                Runtime: manifest.TARGET_HOST_RUNTIME,
                Annotations: {},
            },
        }),
        JSON.stringify({
            Id: mockContainers[1].ID,
            NetworkSettings: { Ports: {} },
            HostConfig: {
                Runtime: manifest.TARGET_REMOTEPROC_RUNTIME,
                Annotations: remoteprocAnnotations,
            },
        }),
    ].join('\n'),
    stderr: '',
};

const defaultInfoOutput = {
    stdout: 'Server Version: 8',
    stderr: '',
};
const execMock = exec as jest.Mock;
const target = 'user@topo.local';
const loadedHealth: HealthCheckResult = {
    host: { dependencies: [] },
    target: {
        isLocalhost: false,
        dependencies: [
            {
                name: 'Container Engine',
                status: 'ok',
                value: 'docker',
            },
        ],
        connectivity: { name: 'Connected', status: 'ok', value: '' },
        subsystemDriver: {
            name: 'Subsystem Driver (remoteproc)',
            status: 'ok',
            value: 'driver-x',
        },
    },
};
const topoCli = mock<TopoCli>();

describe('ContainersManager', () => {
    let containersManager: ContainersManager | undefined;

    const createContainersManager = (
        targetStore: TargetStore,
        containerCommands: ContainerCommands = dockerCommands,
    ): ContainersManager => {
        const manager = new ContainersManager(
            topoCli,
            containerCommands,
            targetStore,
        );
        containersManager = manager;
        return manager;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetAllMocks();
        topoCli.health.mockResolvedValue(loadedHealth);
        containersManager = undefined;
    });

    afterEach(() => {
        containersManager?.dispose();
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('getContainersData returns containers with runtime', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{json .}}'`:
                    return defaultInspectOutput;
                case `ssh ${target} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const manager = createContainersManager(targetStore);
        await manager.activate();

        const result = await manager.getContainersData(target);

        const hostContainer: ContainerItem = {
            id: mockContainers[0].ID,
            name: mockContainers[0].Names,
            image: mockContainers[0].Image,
            state: mockContainers[0].State,
            status: mockContainers[0].Status,
            labels: mockContainers[0].Labels,
            runningFor: mockContainers[0].RunningFor,
            createdAt: mockContainers[0].CreatedAt,
            runtime: manifest.TARGET_HOST_RUNTIME,
            annotations: {},
            ports: webServerPortInfo,
            target,
        };
        const remoteprocContainer: ContainerItem = {
            id: mockContainers[1].ID,
            name: mockContainers[1].Names,
            image: mockContainers[1].Image,
            state: mockContainers[1].State,
            status: mockContainers[1].Status,
            labels: mockContainers[1].Labels,
            runningFor: mockContainers[1].RunningFor,
            createdAt: mockContainers[1].CreatedAt,
            runtime: manifest.TARGET_REMOTEPROC_RUNTIME,
            annotations: remoteprocAnnotations,
            ports: {},
            target,
        };
        const expectedContainers = [hostContainer, remoteprocContainer];
        expect(result).toStrictEqual(expectedContainers);
    });

    it('getContainersData returns empty array on ps error', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target} ps -a --format "{{json .}}"`:
                    throw Error('ps error');
                case `ssh ${target} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const manager = createContainersManager(targetStore);
        await manager.activate();

        const result = await manager.getContainersData(target);
        expect(result).toEqual([]);
    });

    it('getContainersData returns empty array on parse error', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target} ps -a --format "{{json .}}"`:
                    return {
                        stdout: 'not-json\n',
                        stderr: '',
                    };
                case `ssh ${target} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const manager = createContainersManager(targetStore);

        await manager.activate();

        const result = await manager.getContainersData(target);
        expect(result).toEqual([]);
    });

    it('getContainersData caches result after first call', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{json .}}'`:
                    return defaultInspectOutput;
                case `ssh ${target} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const manager = createContainersManager(targetStore);
        await manager.activate();

        const first = await manager.getContainersData(target);
        expect(first).toHaveLength(2);

        execMock.mockClear();
        const second = await manager.getContainersData(target);
        expect(second).toBe(first);
        expect(execMock).not.toHaveBeenCalled();
    });

    it('clears cached containers when the container engine becomes unhealthy', async () => {
        const unhealthyContainerEngine: HealthCheckResult = {
            host: { dependencies: [] },
            target: {
                isLocalhost: false,
                dependencies: [
                    {
                        name: 'Container Engine',
                        status: 'error',
                        value: 'docker',
                    },
                ],
                connectivity: { name: 'Connected', status: 'ok', value: '' },
                subsystemDriver: {
                    name: 'Subsystem Driver (remoteproc)',
                    status: 'ok',
                    value: 'driver-x',
                },
            },
        };
        topoCli.health
            .mockResolvedValueOnce(loadedHealth)
            .mockResolvedValueOnce(unhealthyContainerEngine);
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const containerCommands = mock<ContainerCommands>();
        containerCommands.getContainers.mockResolvedValue(mockContainers);
        containerCommands.inspectContainers.mockResolvedValue([]);
        const manager = createContainersManager(targetStore, containerCommands);
        await manager.activate();
        await expect(manager.getContainersData(target)).resolves.toHaveLength(
            mockContainers.length,
        );

        containerCommands.getContainers.mockClear();
        await jest.advanceTimersByTimeAsync(3000);

        await expect(manager.getContainersData(target)).resolves.toEqual([]);
        expect(containerCommands.getContainers).not.toHaveBeenCalled();
    });

    it('startAutoRefresh and stopAutoRefresh manage timer and update data', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{json .}}'`:
                    return defaultInspectOutput;
                case `ssh ${target} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const manager = createContainersManager(targetStore);
        await manager.activate();

        const spy = jest.fn();
        manager.onDataUpdate(spy);
        expect(spy).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(4000);
        expect(spy).toHaveBeenCalled();
    });

    it('fires onDataUpdate event', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{json .}}'`:
                    return defaultInspectOutput;
                case `ssh ${target} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const manager = createContainersManager(targetStore);
        await manager.activate();

        const spy = jest.fn();
        manager.onDataUpdate(spy);

        await jest.advanceTimersByTimeAsync(3000);
        expect(spy).toHaveBeenCalled();
    });

    it('getTargetStateSnapshot returns default state before health load completes', async () => {
        topoCli.health.mockReturnValueOnce(
            new Promise<HealthCheckResult>(() => {}),
        );
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const containerCommands = mock<ContainerCommands>();
        containerCommands.getContainers.mockResolvedValue([]);
        containerCommands.inspectContainers.mockResolvedValue([]);
        const manager = createContainersManager(targetStore, containerCommands);

        manager.activate();
        await waitImmediate();

        expect(manager.getTargetStateSnapshot(target)).toEqual({
            health: undefined,
            status: 'disconnected',
        });
    });

    it('getTargetState waits for health load and updates the snapshot', async () => {
        let resolveHealth: (result: HealthCheckResult) => void;
        const pendingHealth = new Promise<HealthCheckResult>(
            (resolve) => (resolveHealth = resolve),
        );
        topoCli.health.mockReturnValueOnce(pendingHealth);
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        const containerCommands = mock<ContainerCommands>();
        containerCommands.getContainers.mockResolvedValue([]);
        containerCommands.inspectContainers.mockResolvedValue([]);
        const manager = createContainersManager(targetStore, containerCommands);

        const activation = manager.activate();
        await waitImmediate();

        const targetStatePromise = manager.getTargetState(target);
        resolveHealth!(loadedHealth);

        await activation;
        await expect(targetStatePromise).resolves.toEqual({
            health: loadedHealth.target,
            status: 'connected',
        });
        expect(manager.getTargetStateSnapshot(target)).toEqual({
            health: loadedHealth.target,
            status: 'connected',
        });
    });

    it('updates when targetStore onSelectedTargetChanged fires (re-queries selected target)', async () => {
        const newTarget = 'bob@other.local';
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case `ssh ${target} 'docker info'`:
                    return defaultInfoOutput;
                case `ssh ${newTarget} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        let selectedTarget: string | undefined = target;
        const onSelectedTargetChangedEmitter = new vscode.EventEmitter<void>();
        const targetStore = mock<TargetStore>();
        targetStore.onSelectedTargetChanged.mockImplementation(
            onSelectedTargetChangedEmitter.event,
        );
        targetStore.getSelectedTarget.mockImplementation(
            async () => selectedTarget,
        );
        const manager = createContainersManager(targetStore);
        await manager.activate();
        expect(
            targetStore.getSelectedTarget.mock.calls.length,
        ).toBeGreaterThanOrEqual(1);
        const dataUpdateSpy = jest.fn();
        manager.onDataUpdate(dataUpdateSpy);
        selectedTarget = newTarget;

        onSelectedTargetChangedEmitter.fire();
        await waitImmediate();

        expect(
            targetStore.getSelectedTarget.mock.calls.length,
        ).toBeGreaterThanOrEqual(2);
    });

    it('refreshes the newly selected target after target change', async () => {
        const newTarget = 'bob@other.local';
        let selectedTarget: string | undefined = target;
        const onSelectedTargetChangedEmitter = new vscode.EventEmitter<void>();
        const targetStore = mock<TargetStore>();
        targetStore.onSelectedTargetChanged.mockImplementation(
            onSelectedTargetChangedEmitter.event,
        );
        targetStore.getSelectedTarget.mockImplementation(
            async () => selectedTarget,
        );

        let resolveOldHealth: (result: HealthCheckResult) => void;
        const pendingOldHealth = new Promise<HealthCheckResult>(
            (resolve) => (resolveOldHealth = resolve),
        );
        topoCli.health.mockImplementation(async (ssh: string) => {
            if (ssh === target) {
                return pendingOldHealth;
            }

            return {
                host: { dependencies: [] },
                target: {
                    isLocalhost: false,
                    dependencies: [
                        {
                            name: 'Container Engine',
                            status: 'ok',
                            value: 'docker',
                        },
                    ],
                    connectivity: {
                        name: 'Connected',
                        status: 'ok',
                        value: '',
                    },
                    subsystemDriver: {
                        name: 'Subsystem Driver (remoteproc)',
                        status: 'ok',
                        value: 'driver-x',
                    },
                },
            };
        });

        const containerCommands = mock<ContainerCommands>();
        containerCommands.getContainers.mockResolvedValue([]);
        containerCommands.inspectContainers.mockResolvedValue([]);

        const manager = new ContainersManager(
            topoCli,
            containerCommands,
            targetStore,
        );

        const activation = manager.activate();
        await waitImmediate();
        selectedTarget = newTarget;

        onSelectedTargetChangedEmitter.fire();
        await waitImmediate();

        resolveOldHealth!({
            host: { dependencies: [] },
            target: {
                isLocalhost: false,
                dependencies: [
                    {
                        name: 'Container Engine',
                        status: 'ok',
                        value: 'docker',
                    },
                ],
                connectivity: { name: 'Connected', status: 'ok', value: '' },
                subsystemDriver: {
                    name: 'Subsystem Driver (remoteproc)',
                    status: 'ok',
                    value: 'driver-x',
                },
            },
        });
        await activation;
        await waitImmediate();

        topoCli.health.mockClear();

        await jest.advanceTimersByTimeAsync(9000);

        expect(topoCli.health).toHaveBeenCalled();
        expect(topoCli.health).toHaveBeenCalledWith(newTarget);
        expect(topoCli.health).not.toHaveBeenCalledWith(target);
    });
});
