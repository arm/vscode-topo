import { ContainersManager } from './containersManager';
import { ContainerItem, DockerPsItem } from '../util/types';
import * as manifest from '../manifest';
import { execFile } from '../util/exec';
import { DockerCommands } from './dockerCommands';
import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { TopoCli } from '../topoCli';
import type { ContainerCommands } from './containerCommands';
import type { HealthCheck } from '../topoCliSchema';
import type { Mock } from 'vitest';
import { TargetModel } from '../models/targetModel';

const waitImmediate = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

vi.mock('../util/exec', () => ({
    execFile: vi.fn(),
}));
vi.mock('../util/logger');

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
const execFileMock = execFile as Mock;
const target = 'user@topo.local';
const commandString = (args: string[]): string => args.join('\0');
const dockerContextsCommand = commandString([
    'context',
    'ls',
    '--format',
    '{{.Name}}',
]);
const dockerPsCommand = commandString([
    '--host',
    `ssh://${target}`,
    'ps',
    '-a',
    '--format',
    '{{json .}}',
]);
const dockerInspectCommand = commandString([
    '--host',
    `ssh://${target}`,
    'inspect',
    mockContainers[0].ID,
    mockContainers[1].ID,
    '--format',
    '{{json .}}',
]);
const loadedHealth: HealthCheck = {
    host: { dependencies: [] },
    target: {
        destination: `ssh://${target}`,
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
        targetModel: TargetModel,
        containerCommands: ContainerCommands = dockerCommands,
    ): ContainersManager => {
        const manager = new ContainersManager(
            topoCli,
            containerCommands,
            targetModel,
        );
        containersManager = manager;
        return manager;
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetAllMocks();
        topoCli.health.mockResolvedValue(loadedHealth);
        containersManager = undefined;
    });

    afterEach(() => {
        containersManager?.dispose();
        vi.useRealTimers();
        vi.clearAllTimers();
    });

    it('getContainersData returns containers with runtime', async () => {
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                switch (commandString(args)) {
                    case dockerContextsCommand:
                        return defaultContextOutput;
                    case dockerPsCommand:
                        return defaultPsOutput;
                    case dockerInspectCommand:
                        return defaultInspectOutput;
                    default:
                        throw Error(
                            `Unexpected docker args: ${args.join(' ')}`,
                        );
                }
            },
        );
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const manager = createContainersManager(targetModel);
        manager.activate();

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
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                switch (commandString(args)) {
                    case dockerContextsCommand:
                        return defaultContextOutput;
                    case dockerPsCommand:
                        throw Error('ps error');
                    default:
                        throw Error(
                            `Unexpected docker args: ${args.join(' ')}`,
                        );
                }
            },
        );
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const manager = createContainersManager(targetModel);
        manager.activate();

        const result = await manager.getContainersData(target);
        expect(result).toEqual([]);
    });

    it('getContainersData returns empty array on parse error', async () => {
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                switch (commandString(args)) {
                    case dockerContextsCommand:
                        return defaultContextOutput;
                    case dockerPsCommand:
                        return {
                            stdout: 'not-json\n',
                            stderr: '',
                        };
                    default:
                        throw Error(
                            `Unexpected docker args: ${args.join(' ')}`,
                        );
                }
            },
        );
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const manager = createContainersManager(targetModel);

        manager.activate();

        const result = await manager.getContainersData(target);
        expect(result).toEqual([]);
    });

    it('getContainersData caches result after first call', async () => {
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                switch (commandString(args)) {
                    case dockerContextsCommand:
                        return defaultContextOutput;
                    case dockerPsCommand:
                        return defaultPsOutput;
                    case dockerInspectCommand:
                        return defaultInspectOutput;
                    default:
                        throw Error(
                            `Unexpected docker args: ${args.join(' ')}`,
                        );
                }
            },
        );
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const manager = createContainersManager(targetModel);
        manager.activate();

        const first = await manager.getContainersData(target);
        expect(first).toHaveLength(2);

        execFileMock.mockClear();
        const second = await manager.getContainersData(target);
        expect(second).toBe(first);
        expect(execFileMock).not.toHaveBeenCalled();
    });

    it('clears cached containers when the container engine becomes unhealthy', async () => {
        const unhealthyContainerEngine: HealthCheck = {
            host: { dependencies: [] },
            target: {
                destination: `ssh://${target}`,
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
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const containerCommands = mock<ContainerCommands>();
        containerCommands.getContainers.mockResolvedValue(mockContainers);
        containerCommands.inspectContainers.mockResolvedValue([]);
        const manager = createContainersManager(targetModel, containerCommands);
        manager.activate();
        await expect(manager.getContainersData(target)).resolves.toHaveLength(
            mockContainers.length,
        );

        containerCommands.getContainers.mockClear();
        await vi.advanceTimersByTimeAsync(3000);

        await expect(manager.getContainersData(target)).resolves.toEqual([]);
        expect(containerCommands.getContainers).not.toHaveBeenCalled();
    });

    it('startAutoRefresh and stopAutoRefresh manage timer and update data', async () => {
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                switch (commandString(args)) {
                    case dockerContextsCommand:
                        return defaultContextOutput;
                    case dockerPsCommand:
                        return defaultPsOutput;
                    case dockerInspectCommand:
                        return defaultInspectOutput;
                    default:
                        throw Error(
                            `Unexpected docker args: ${args.join(' ')}`,
                        );
                }
            },
        );
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const manager = createContainersManager(targetModel);
        manager.activate();

        const spy = vi.fn();
        manager.onDataUpdate(spy);
        expect(spy).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(4000);
        expect(spy).toHaveBeenCalled();
    });

    it('fires onDataUpdate event', async () => {
        execFileMock.mockImplementation(
            async (_command: string, args: string[]) => {
                switch (commandString(args)) {
                    case dockerContextsCommand:
                        return defaultContextOutput;
                    case dockerPsCommand:
                        return defaultPsOutput;
                    case dockerInspectCommand:
                        return defaultInspectOutput;
                    default:
                        throw Error(
                            `Unexpected docker args: ${args.join(' ')}`,
                        );
                }
            },
        );
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const manager = createContainersManager(targetModel);
        manager.activate();

        const spy = vi.fn();
        manager.onDataUpdate(spy);

        await vi.advanceTimersByTimeAsync(3000);
        expect(spy).toHaveBeenCalled();
    });

    it('getTargetStateSnapshot returns default state before health load completes', async () => {
        topoCli.health.mockReturnValueOnce(new Promise<HealthCheck>(() => {}));
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const containerCommands = mock<ContainerCommands>();
        containerCommands.getContainers.mockResolvedValue([]);
        containerCommands.inspectContainers.mockResolvedValue([]);
        const manager = createContainersManager(targetModel, containerCommands);

        manager.activate();
        await waitImmediate();

        expect(manager.getTargetStateSnapshot(target)).toEqual({
            health: undefined,
            status: 'disconnected',
        });
    });

    it('getTargetState waits for health load and updates the snapshot', async () => {
        let resolveHealth: (result: HealthCheck) => void;
        const pendingHealth = new Promise<HealthCheck>(
            (resolve) => (resolveHealth = resolve),
        );
        topoCli.health.mockReturnValueOnce(pendingHealth);
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const containerCommands = mock<ContainerCommands>();
        containerCommands.getContainers.mockResolvedValue([]);
        containerCommands.inspectContainers.mockResolvedValue([]);
        const manager = createContainersManager(targetModel, containerCommands);

        manager.activate();
        await waitImmediate();

        const targetStatePromise = manager.getTargetState(target);
        resolveHealth!(loadedHealth);

        await expect(targetStatePromise).resolves.toEqual({
            health: loadedHealth.target,
            status: 'connected',
        });
        expect(manager.getTargetStateSnapshot(target)).toEqual({
            health: loadedHealth.target,
            status: 'connected',
        });
    });

    it('updates when targetStore onChanged fires (re-queries selected target)', async () => {
        const newTarget = 'bob@other.local';
        execFileMock.mockResolvedValue(defaultInfoOutput);
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const manager = createContainersManager(targetModel);
        const dataUpdateSpy = vi.fn();
        manager.onDataUpdate(dataUpdateSpy);
        manager.activate();
        expect(dataUpdateSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

        targetModel.setSelected(newTarget);

        expect(dataUpdateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('refreshes the newly selected target after target change', async () => {
        const newTarget = 'bob@other.local';
        const onChangeEmitter = new vscode.EventEmitter<void>();
        const targetModel = new TargetModel();
        targetModel.setSelected(target);

        let resolveOldHealth: (result: HealthCheck) => void;
        const pendingOldHealth = new Promise<HealthCheck>(
            (resolve) => (resolveOldHealth = resolve),
        );
        topoCli.health.mockImplementation(async (ssh: string) => {
            if (ssh === target) {
                return pendingOldHealth;
            }

            return {
                host: { dependencies: [] },
                target: {
                    destination: `ssh://${ssh}`,
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
            targetModel,
        );

        manager.activate();
        await waitImmediate();
        targetModel.setSelected(newTarget);

        onChangeEmitter.fire();
        await waitImmediate();

        resolveOldHealth!({
            host: { dependencies: [] },
            target: {
                destination: `ssh://${target}`,
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
        await waitImmediate();

        topoCli.health.mockClear();

        await vi.advanceTimersByTimeAsync(9000);

        expect(topoCli.health).toHaveBeenCalled();
        expect(topoCli.health).toHaveBeenCalledWith(newTarget);
        expect(topoCli.health).not.toHaveBeenCalledWith(target);
    });
});
