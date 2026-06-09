import { mock } from 'vitest-mock-extended';
import { TargetModel } from '../models/targetModel';
import { SelectedTargetModel } from '../models/selectedTargetModel';
import { ContainerCommands } from '../target/containerCommands';
import { TopoCli } from '../topoCli';
import { DockerInspectItem, DockerPsItem } from '../util/types';
import { loaded } from '../util/loadable';
import { SelectedTargetController } from './selectedTargetController';
import { HealthCheck } from '../topoCliSchema';

vi.mock('../util/logger');

const target = 'user@target';
const health: HealthCheck = {
    host: {
        dependencies: [],
    },
    target: {
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

describe('SelectedTargetController', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('clears selected target data when no target is selected', () => {
        const model = new SelectedTargetModel();
        const targetModel = new TargetModel();
        const topoCli = mock<TopoCli>();
        const containerCommands = mock<ContainerCommands>();
        model.setHealth(loaded(health.target));
        model.setContainers(loaded([]));

        new SelectedTargetController(
            model,
            targetModel,
            topoCli,
            containerCommands,
        );

        expect(model.health).toEqual(loaded(undefined));
        expect(model.containers).toEqual(loaded([]));
        expect(topoCli.health).not.toHaveBeenCalled();
        expect(containerCommands.getContainers).not.toHaveBeenCalled();
    });

    it('loads health and containers for the selected target', async () => {
        const model = new SelectedTargetModel();
        const targetModel = new TargetModel();
        const topoCli = mock<TopoCli>({
            health: vi.fn().mockResolvedValue(health),
        });
        const containerCommands = mock<ContainerCommands>({
            getContainers: vi.fn().mockResolvedValue([dockerPsItem]),
            inspectContainers: vi.fn().mockResolvedValue([dockerInspectItem]),
        });
        targetModel.setSelected(target);

        new SelectedTargetController(
            model,
            targetModel,
            topoCli,
            containerCommands,
        );

        await vi.waitFor(() => {
            expect(model.containers).toStrictEqual(
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
        });
        expect(model.health).toStrictEqual(loaded(health.target));
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
        const model = new SelectedTargetModel();
        const targetModel = new TargetModel();
        const topoCli = mock<TopoCli>({
            health: vi.fn().mockResolvedValue(unhealthyContainerEngineHealth),
        });
        const containerCommands = mock<ContainerCommands>();
        targetModel.setSelected(target);

        new SelectedTargetController(
            model,
            targetModel,
            topoCli,
            containerCommands,
        );

        await vi.waitFor(() => {
            expect(model.containers).toStrictEqual({
                status: 'errored',
                error: new Error('Install container engine'),
                loading: false,
            });
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
        const model = new SelectedTargetModel();
        const targetModel = new TargetModel();
        const topoCli = mock<TopoCli>({
            health: vi.fn().mockResolvedValue(disconnectedHealth),
        });
        const containerCommands = mock<ContainerCommands>();
        targetModel.setSelected(target);

        new SelectedTargetController(
            model,
            targetModel,
            topoCli,
            containerCommands,
        );

        await vi.waitFor(() => {
            const healthState = model.health;

            expect(healthState.status).toBe('errored');
            if (healthState.status !== 'errored') {
                throw new Error('Expected disconnected target health to error');
            }
            expect(healthState.error.message).toBe('Connect the target');
            expect(model.containers).toStrictEqual(loaded([]));
        });
        expect(containerCommands.getContainers).not.toHaveBeenCalled();
    });
});
