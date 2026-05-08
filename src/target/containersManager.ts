import { logger } from '../util/logger';
import type {
    TargetState,
    ContainerItem,
    DockerPsItem,
    DockerInspectItem,
} from '../util/types';
import type { ContainerCommands } from './containerCommands';
import type { TopoCli } from '../topoCli';

function createContainerItem(
    item: DockerPsItem,
    inspect: DockerInspectItem | undefined,
    target: string,
): ContainerItem {
    const runtime = inspect?.HostConfig.Runtime || '';
    const annotations = inspect?.HostConfig.Annotations || {};
    const ports = inspect?.NetworkSettings.Ports || {};
    return {
        id: item.ID,
        name: item.Names,
        image: item.Image,
        state: item.State,
        status: item.Status,
        labels: item.Labels,
        runningFor: item.RunningFor,
        createdAt: item.CreatedAt,
        runtime,
        annotations,
        ports,
        target,
    };
}

// TODO write new test suite for this
export class ContainersManager {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly containerCommands: ContainerCommands,
    ) {}

    public async getTargetState(target: string): Promise<TargetState> {
        try {
            const health = await this.topoCli.health(target);
            const status =
                health.target?.connectivity.status === 'ok'
                    ? 'connected'
                    : 'error';
            return {
                health: health.target,
                status,
            };
        } catch (err) {
            logger.error(`Failed to check health for target ${target}`, err);
            return {
                health: undefined,
                status: 'error',
            };
        }
    }

    public async getContainersData(target: string): Promise<ContainerItem[]> {
        try {
            const items = await this.containerCommands.getContainers(target);
            const ids = items.map((item) => item.ID);
            const inspectOutput =
                await this.containerCommands.inspectContainers(ids, target);
            const containers: ContainerItem[] = [];
            for (const item of items) {
                const inspect = inspectOutput.find((el) =>
                    el.Id.startsWith(item.ID),
                );
                containers.push(createContainerItem(item, inspect, target));
            }
            return containers;
        } catch (err: unknown) {
            const errorMsg =
                err instanceof Error ? err.message : 'Unknown error';
            logger.error(`Failed to get containers info: ${errorMsg}`);
            return [];
        }
    }
}
