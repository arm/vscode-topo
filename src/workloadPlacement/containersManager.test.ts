import { ContainersManager } from './containersManager';
import * as manifest from '../manifest';
import { exec } from '../util/exec';
import { BOARD_DOCKER_CONTEXT } from '../manifest';
import { DockerCommands } from './dockerCommands';
import { DockerPsItem } from './containerCommands';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../util/exec', () => ({
    exec: jest.fn()
}));
jest.mock('../util/logger');

const webServerPortInfo = {
    "80/tcp": [
        { HostIp: "0.0.0.0", HostPort: "8080" },
        { HostIp: "::", HostPort: "8080" }
    ]
};
const serializedWebServerPortInfo = JSON.stringify(webServerPortInfo);
const dockerCommands = new DockerCommands();

describe('ContainersManager', () => {
    const mockContainers: DockerPsItem[] = [
        {
            ID: 'id1',
            Names: 'cont1',
            Image: 'img1',
            State: 'running',
            Status: 'Up 4 days',
            Labels: 'foo=bar',
            RunningFor: '1h',
            CreatedAt: '2024-01-01T00:00:00Z'
        },
        {
            ID: 'id2',
            Names: 'cont2',
            Image: 'img2',
            State: 'exited',
            Status: 'Exited (0) 2 hours ago',
            Labels: 'baz=qux',
            RunningFor: '2h',
            CreatedAt: '2024-01-02T00:00:00Z'
        }
    ];

    beforeEach(async () => {
        jest.clearAllMocks();
    });

    it('getContainersData returns containers with runtime', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockResolvedValueOnce(
                {
                    stdout: mockContainers.map(c => JSON.stringify(c)).join('\n'),
                    stderr: ''
                }
            )
            .mockResolvedValueOnce(
                {
                    stdout: [
                        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
                        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`
                    ].join('\n'),
                    stderr: ''
                }
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();

        const result = await manager.getContainersData();

        const hostContainer = {
            id: mockContainers[0].ID,
            name: mockContainers[0].Names,
            image: mockContainers[0].Image,
            state: mockContainers[0].State,
            status: mockContainers[0].Status,
            labels: mockContainers[0].Labels,
            runningFor: mockContainers[0].RunningFor,
            createdAt: mockContainers[0].CreatedAt,
            runtime: manifest.BOARD_HOST_RUNTIME,
            ports: ['8080:80']
        };
        const ambientContainer = {
            id: mockContainers[1].ID,
            name: mockContainers[1].Names,
            image: mockContainers[1].Image,
            state: mockContainers[1].State,
            status: mockContainers[1].Status,
            labels: mockContainers[1].Labels,
            runningFor: mockContainers[1].RunningFor,
            createdAt: mockContainers[1].CreatedAt,
            runtime: manifest.BOARD_AMBIENT_RUNTIME,
            ports: []
        };
        const expectedContainers = [hostContainer, ambientContainer];
        expect(result).toStrictEqual(expectedContainers);
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('getContainersData returns empty array on ps error', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockImplementationOnce((_cmd, cb) => 
                cb(new Error('fail'), '', 'fail')
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();

        const result = await manager.getContainersData();
        expect(result).toEqual([]);
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('getContainersData returns empty array on parse error', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockImplementationOnce((_cmd, cb) => 
                cb(null, 'not-json\n', '')
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);

        await manager.activate();

        const result = await manager.getContainersData();
        expect(result).toEqual([]);
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('getContainersData caches result after first call', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockResolvedValueOnce(
                {
                    stdout: mockContainers.map(c => JSON.stringify(c)).join('\n'),
                    stderr: ''
                }
            )
            .mockResolvedValueOnce(
                {
                    stdout: [
                        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
                        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`
                    ].join('\n'),
                    stderr: ''
                }
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();

        const first = await manager.getContainersData();
        expect(first).toHaveLength(2);

        execMock.mockClear();
        const second = await manager.getContainersData();
        expect(second).toBe(first);
        expect(execMock).not.toHaveBeenCalled();
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('startAutoRefresh and stopAutoRefresh manage timer and update data', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockResolvedValueOnce(
                {
                    stdout: mockContainers.map(c => JSON.stringify(c)).join('\n'),
                    stderr: ''
                }
            )
            .mockResolvedValueOnce(
                {
                    stdout: [
                        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
                        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`
                    ].join('\n'),
                    stderr: ''
                }
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();

        const spy = jest.fn();
        manager.onDataUpdate(spy);
        expect(spy).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(4000);
        expect(spy).toHaveBeenCalled();

        await manager.stopAutoRefresh();
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('fires onDataUpdate event', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockResolvedValueOnce(
                {
                    stdout: mockContainers.map(c => JSON.stringify(c)).join('\n'),
                    stderr: ''
                }
            )
            .mockResolvedValueOnce(
                {
                    stdout: [
                        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
                        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`
                    ].join('\n'),
                    stderr: ''
                }
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();

        const spy = jest.fn();
        manager.onDataUpdate(spy);

        await manager.startAutoRefresh();
        await jest.advanceTimersByTimeAsync(3000);
        expect(spy).toHaveBeenCalled();
        await manager.stopAutoRefresh();
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('resolves when docker stop succeeds', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockResolvedValueOnce(
                {
                    stdout: mockContainers.map(c => JSON.stringify(c)).join('\n'),
                    stderr: ''
                }
            )
            .mockResolvedValueOnce(
                {
                    stdout: [
                        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
                        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`
                    ].join('\n'),
                    stderr: ''
                }
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();

        execMock.mockResolvedValueOnce({
            stdout: 'Stopped',
            stderr: ''
        });

        await expect(manager.stopContainer('abc123')).resolves.toBeUndefined();

        expect(exec).toHaveBeenCalledWith(
            `docker --context ${BOARD_DOCKER_CONTEXT} stop abc123`
        );
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('rejects when docker stop fails', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockResolvedValueOnce(
                {
                    stdout: mockContainers.map(c => JSON.stringify(c)).join('\n'),
                    stderr: ''
                }
            )
            .mockResolvedValueOnce(
                {
                    stdout: [
                        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
                        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`
                    ].join('\n'),
                    stderr: ''
                }
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();
        execMock.mockRejectedValueOnce({
            stderr: 'fail'
        });

        await expect(manager.stopContainer('abc123')).rejects.toThrow('Failed to stop service');
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('resolves when docker start succeeds', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockResolvedValueOnce(
                {
                    stdout: mockContainers.map(c => JSON.stringify(c)).join('\n'),
                    stderr: ''
                }
            )
            .mockResolvedValueOnce(
                {
                    stdout: [
                        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
                        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`
                    ].join('\n'),
                    stderr: ''
                }
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();
        execMock.mockResolvedValueOnce({
            stdout: 'Started',
            stderr: ''
        });

        await expect(manager.startContainer('abc123')).resolves.toBeUndefined();

        expect(exec).toHaveBeenCalledWith(
            `docker --context ${BOARD_DOCKER_CONTEXT} start abc123`,
        );
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    it('rejects when docker start fails', async () => {
        jest.useFakeTimers();
        const execMock = exec as unknown as jest.Mock;
        execMock
            .mockResolvedValueOnce(
                {
                    stdout: 'default\ntopo\n',
                    stderr: ''
                }
            ).mockResolvedValueOnce(
                {
                    stdout: mockContainers.map(c => JSON.stringify(c)).join('\n'),
                    stderr: ''
                }
            )
            .mockResolvedValueOnce(
                {
                    stdout: [
                        `${mockContainers[0].ID};${serializedWebServerPortInfo};${manifest.BOARD_HOST_RUNTIME}`,
                        `${mockContainers[1].ID};{};${manifest.BOARD_AMBIENT_RUNTIME}`
                    ].join('\n'),
                    stderr: ''
                }
            );
        const boardConnectionChecker = {
            isBoardSshPortOpen: jest.fn().mockResolvedValue(true),
        };
        const manager = new ContainersManager(boardConnectionChecker, dockerCommands);
        await manager.activate();
        execMock.mockRejectedValueOnce({
            stderr: 'fail'
        });

        await expect(manager.startContainer('abc123')).rejects.toThrow('Failed to start service');
        jest.useRealTimers();
        jest.clearAllTimers();
    });
});
