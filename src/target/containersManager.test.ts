import { mock, MockProxy } from 'jest-mock-extended';
import { ContainersManager } from './containersManager';
import type { ContainerCommands } from './containerCommands';
import type { TopoCli } from '../topoCli';
import type {
    DockerInspectItem,
    DockerPsItem,
    TargetState,
} from '../util/types';
import type { HealthCheckResult, HealthCheckStatus } from '../topoCliSchema';

jest.mock('../util/logger');

const target = 'user@topo.local';

type ContainersManagerTestContext = {
    topoCli: MockProxy<TopoCli>;
    containerCommands: MockProxy<ContainerCommands>;
    manager: ContainersManager;
};

const createTestContext = (): ContainersManagerTestContext => {
    const topoCli = mock<TopoCli>();
    const containerCommands = mock<ContainerCommands>();
    const manager = new ContainersManager(topoCli, containerCommands);

    return { topoCli, containerCommands, manager };
};

const createHealth = (
    connectivityStatus: HealthCheckStatus,
): HealthCheckResult => ({
    host: { dependencies: [] },
    target: {
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: connectivityStatus,
            value: '',
        },
        dependencies: [],
        subsystemDriver: {
            name: 'Subsystem Driver',
            status: 'ok',
            value: '',
        },
    },
});

const createDockerPsItem = (): DockerPsItem => ({
    ID: 'abc123',
    Names: 'container-a',
    Image: 'image-a',
    State: 'running',
    Status: 'Up 1 minute',
    Labels: 'label=value',
    RunningFor: '1 minute',
    CreatedAt: '2026-01-01 00:00:00 +0000 UTC',
});

const createDockerInspectItem = (): DockerInspectItem => ({
    Id: 'abc123def456',
    NetworkSettings: {
        Ports: {
            '8080/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }],
        },
    },
    HostConfig: {
        Runtime: 'io.containerd.runc.v2',
        Annotations: { 'remoteproc.name': 'imx-rproc' },
    },
});

describe('ContainersManager', () => {
    it('caches target state until cleared', async () => {
        const { topoCli, manager } = createTestContext();
        topoCli.health.mockResolvedValue(createHealth('ok'));

        await manager.getTargetState(target);
        await manager.getTargetState(target);
        manager.clear();
        await manager.getTargetState(target);

        expect(topoCli.health).toHaveBeenCalledTimes(2);
    });

    it('maps ok connectivity to connected target state', async () => {
        const { topoCli, manager } = createTestContext();
        const health = createHealth('ok');
        topoCli.health.mockResolvedValue(health);

        const state = await manager.getTargetState(target);

        expect(state.status).toBe('connected');
        expect(state.health).toEqual(health.target);
    });

    it('maps non-ok connectivity to error target state', async () => {
        const { topoCli, manager } = createTestContext();
        topoCli.health.mockResolvedValue(createHealth('error'));

        const state = await manager.getTargetState(target);

        expect(state.status).toBe('error');
    });

    it('returns an error target state when health loading fails', async () => {
        const { topoCli, manager } = createTestContext();
        topoCli.health.mockRejectedValue(new Error('health failed'));

        const state = await manager.getTargetState(target);

        expect(state).toEqual<TargetState>({
            health: undefined,
            status: 'error',
        });
    });

    it('caches container data until containers are cleared', async () => {
        const { containerCommands, manager } = createTestContext();
        containerCommands.getContainers.mockResolvedValue([
            createDockerPsItem(),
        ]);
        containerCommands.inspectContainers.mockResolvedValue([
            createDockerInspectItem(),
        ]);

        await manager.getContainersData(target);
        await manager.getContainersData(target);
        manager.clearContainers();
        await manager.getContainersData(target);

        expect(containerCommands.getContainers).toHaveBeenCalledTimes(2);
    });

    it('maps docker output to container items', async () => {
        const { containerCommands, manager } = createTestContext();
        const dockerPsItem = createDockerPsItem();
        const dockerInspectItem = createDockerInspectItem();
        containerCommands.getContainers.mockResolvedValue([dockerPsItem]);
        containerCommands.inspectContainers.mockResolvedValue([
            dockerInspectItem,
        ]);

        const containers = await manager.getContainersData(target);

        expect(containers).toEqual([
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
        ]);
    });

    it('uses defaults when inspect data is missing', async () => {
        const { containerCommands, manager } = createTestContext();
        containerCommands.getContainers.mockResolvedValue([
            createDockerPsItem(),
        ]);
        containerCommands.inspectContainers.mockResolvedValue([]);

        const containers = await manager.getContainersData(target);

        expect(containers[0]).toMatchObject({
            runtime: '',
            annotations: {},
            ports: {},
        });
    });

    it('returns no containers when container loading fails', async () => {
        const { containerCommands, manager } = createTestContext();
        containerCommands.getContainers.mockRejectedValue(
            new Error('container load failed'),
        );

        const containers = await manager.getContainersData(target);

        expect(containers).toEqual([]);
    });
});
