import { ContainerItem, ContainersManager } from './containersManager';
import * as manifest from '../manifest';
import { exec } from '../util/exec';
import { DockerCommands } from './dockerCommands';
import { DockerPsItem } from './containerCommands';
import { Target } from './target';
import * as vscode from 'vscode';

/* eslint-disable @typescript-eslint/no-explicit-any */

const waitImmediate = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

jest.mock('../util/exec', () => ({
    exec: jest.fn(),
}));
jest.mock('../util/logger');
jest.mock('vscode');

const webServerPortInfo = {
    '80/tcp': [
        { HostIp: '0.0.0.0', HostPort: '8080' },
        { HostIp: '::', HostPort: '8080' },
    ],
};
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
const serializedWebServerPortInfo = JSON.stringify(webServerPortInfo);
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
        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`,
    ].join('\n'),
    stderr: '',
};
const defaultStatsOutput = {
    stdout: [
        `${mockContainers[0].ID};2.5%;50MiB / 1GiB`,
        `${mockContainers[1].ID};0.0%;0B / 1GiB`,
    ].join('\n'),
    stderr: '',
};
const defaultInfoOutput = {
    stdout: 'Server Version: 8',
    stderr: '',
};
const execMock = exec as unknown as jest.Mock;
const target = new Target('topo', 'user@topo.local');

describe('ContainersManager', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('getContainersData returns containers with runtime', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target.ssh} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`:
                    return defaultInspectOutput;
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();

        const result = await manager.getContainersData();

        const hostContainer: ContainerItem = {
            id: mockContainers[0].ID,
            name: mockContainers[0].Names,
            image: mockContainers[0].Image,
            state: mockContainers[0].State,
            status: mockContainers[0].Status,
            labels: mockContainers[0].Labels,
            runningFor: mockContainers[0].RunningFor,
            createdAt: mockContainers[0].CreatedAt,
            runtime: manifest.BOARD_HOST_RUNTIME,
            ports: ['8080:80'],
            cpuUsage: '2.5%',
            memUsage: '50MiB / 1GiB',
            target,
        };
        const ambientContainer: ContainerItem = {
            id: mockContainers[1].ID,
            name: mockContainers[1].Names,
            image: mockContainers[1].Image,
            state: mockContainers[1].State,
            status: mockContainers[1].Status,
            labels: mockContainers[1].Labels,
            runningFor: mockContainers[1].RunningFor,
            createdAt: mockContainers[1].CreatedAt,
            runtime: manifest.BOARD_AMBIENT_RUNTIME,
            ports: [],
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
            target,
        };
        const expectedContainers = [hostContainer, ambientContainer];
        expect(result).toStrictEqual(expectedContainers);
    });

    it('getContainersData returns empty array on ps error', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    throw Error('ps error');
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();

        const result = await manager.getContainersData();
        expect(result).toEqual([]);
    });

    it('getContainersData returns empty array on parse error', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return {
                        stdout: 'not-json\n',
                        stderr: '',
                    };
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );

        await manager.activate();

        const result = await manager.getContainersData();
        expect(result).toEqual([]);
    });

    it('getContainersData caches result after first call', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target.ssh} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`:
                    return defaultInspectOutput;
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();

        const first = await manager.getContainersData();
        expect(first).toHaveLength(2);

        execMock.mockClear();
        const second = await manager.getContainersData();
        expect(second).toBe(first);
        expect(execMock).not.toHaveBeenCalled();
    });

    it('startAutoRefresh and stopAutoRefresh manage timer and update data', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target.ssh} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`:
                    return defaultInspectOutput;
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();

        const spy = jest.fn();
        manager.onDataUpdate(spy);
        expect(spy).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(4000);
        expect(spy).toHaveBeenCalled();

        await manager.stopAutoRefresh();
    });

    it('fires onDataUpdate event', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target.ssh} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`:
                    return defaultInspectOutput;
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();

        const spy = jest.fn();
        manager.onDataUpdate(spy);

        await manager.startAutoRefresh();
        await jest.advanceTimersByTimeAsync(3000);
        expect(spy).toHaveBeenCalled();
        await manager.stopAutoRefresh();
    });

    it('resolves when docker stop succeeds', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target.ssh} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`:
                    return defaultInspectOutput;
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();

        execMock.mockResolvedValueOnce({
            stdout: 'Stopped',
            stderr: '',
        });

        await expect(manager.stopContainer('abc123')).resolves.toBeUndefined();

        expect(exec).toHaveBeenCalledWith(
            `docker --host ssh://${target.ssh} stop abc123`,
        );
    });

    it('rejects when docker stop fails', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target.ssh} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`:
                    return defaultInspectOutput;
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();
        execMock.mockRejectedValueOnce(new Error('fail'));

        const stopOperation = manager.stopContainer('abc123');

        await expect(stopOperation).rejects.toThrow('fail');
    });

    it('resolves when docker start succeeds', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target.ssh} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`:
                    return defaultInspectOutput;
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();
        execMock.mockResolvedValueOnce({
            stdout: 'Started',
            stderr: '',
        });

        await expect(manager.startContainer('abc123')).resolves.toBeUndefined();

        expect(exec).toHaveBeenCalledWith(
            `docker --host ssh://${target.ssh} start abc123`,
        );
    });

    it('rejects when docker start fails', async () => {
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case "docker context ls --format '{{.Name}}'":
                    return defaultContextOutput;
                case `docker --host ssh://${target.ssh} ps -a --format "{{json .}}"`:
                    return defaultPsOutput;
                case `docker --host ssh://${target.ssh} inspect ${mockContainers[0].ID} ${mockContainers[1].ID} --format '{{.Id}};{{json .NetworkSettings.Ports}};{{.HostConfig.Runtime}}'`:
                    return defaultInspectOutput;
                case `docker --host ssh://${target.ssh} stats ${mockContainers[0].ID} ${mockContainers[1].ID} --no-stream --no-trunc --format '{{.ID}};{{.CPUPerc}};{{.MemUsage}}'`:
                    return defaultStatsOutput;
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: jest.fn(),
            getSelectedTarget: jest.fn().mockResolvedValue(target),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();
        execMock.mockRejectedValueOnce(new Error('fail'));

        const startOperation = manager.startContainer('abc123');

        await expect(startOperation).rejects.toThrow('fail');
    });

    it('updates when targetStore onChanged fires (re-queries selected target)', async () => {
        const newTarget = new Target('other-id', 'bob@other.local');
        execMock.mockImplementation(async (command: string) => {
            switch (command) {
                case `ssh ${target.ssh} 'docker info'`:
                    return defaultInfoOutput;
                case `ssh ${newTarget.ssh} 'docker info'`:
                    return defaultInfoOutput;
                default:
                    throw Error(`Unexpected command: ${command}`);
            }
        });
        let currentSelected: Target | null = target;
        const onChangeEmitter = new vscode.EventEmitter<void>();
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const targetStore = {
            onChanged: onChangeEmitter.event,
            getSelectedTarget: jest
                .fn()
                .mockImplementation(async () => currentSelected),
        };
        const manager = new ContainersManager(
            boardConnectionChecker,
            dockerCommands,
            targetStore,
        );
        await manager.activate();
        expect(
            (targetStore.getSelectedTarget as jest.Mock).mock.calls.length,
        ).toBeGreaterThanOrEqual(1);
        const dataUpdateSpy = jest.fn();
        manager.onDataUpdate(dataUpdateSpy);
        currentSelected = newTarget;

        onChangeEmitter.fire();
        await waitImmediate();

        expect(
            (targetStore.getSelectedTarget as jest.Mock).mock.calls.length,
        ).toBeGreaterThanOrEqual(2);
    });
});
