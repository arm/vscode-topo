import * as vscode from 'vscode';
import { logger } from '../util/logger';
import type {
    TargetState,
    ContainerItem,
    DockerPsItem,
    DockerInspectItem,
    DockerStatsItem,
} from '../util/types';
import type { ContainerCommands } from './containerCommands';
import { TargetStore } from './targetStore';
import type { TopoCli } from '../topoCli';
import { future, type Future } from '../util/future';
import { RefreshLoop } from '../util/refreshLoop';

const refreshInterval = 3000;

function hasHealthyDependency(
    state: TargetState,
    dependencyName: string,
): boolean {
    return (
        state.health?.dependencies.some(
            (dep) => dep.name === dependencyName && dep.status === 'ok',
        ) ?? false
    );
}

function createContainerItem(
    item: DockerPsItem,
    inspect: DockerInspectItem | undefined,
    stats: DockerStatsItem | undefined,
    target: string,
): ContainerItem {
    const cpuUsage = stats?.CPUPerc || '';
    const memUsage = stats?.MemUsage || '';
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
        cpuUsage,
        memUsage,
        target,
    };
}

const defaultTargetState: TargetState = {
    health: undefined,
    status: 'disconnected',
};

export class ContainersManager implements vscode.Disposable {
    private readonly containersMap = new Map<
        string,
        Promise<ContainerItem[]>
    >();
    private readonly targetStateMap = new Map<string, Future<TargetState>>();
    private refreshLoop: RefreshLoop | undefined;

    private readonly _onDataUpdate = new vscode.EventEmitter<void>();
    public readonly onDataUpdate = this._onDataUpdate.event;

    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly topoCli: TopoCli,
        private readonly containerCommands: ContainerCommands,
        private readonly targetStore: TargetStore,
    ) {
        const onChangedDisposable = this.targetStore.onChanged(async () => {
            await this.updateTarget().catch((err) => {
                logger.error(`Failed to update the target`, err);
            });
        });
        this.disposables.push(this._onDataUpdate, onChangedDisposable);
    }

    public async activate(): Promise<void> {
        await this.updateTarget();
    }

    private async updateTarget(): Promise<void> {
        const selectedTarget = await this.targetStore.getSelectedTarget();
        this.unsetTarget();
        if (selectedTarget) {
            await this.startAutoRefresh(selectedTarget);
        }
    }

    private unsetTarget(): void {
        this.stopAutoRefresh();
        this.targetStateMap.clear();
        this.containersMap.clear();
        this._onDataUpdate.fire();
    }

    private loadTargetState(target: string): Future<TargetState> {
        return future(async () => {
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
                logger.error(
                    `Failed to check health for target ${target}`,
                    err,
                );
                return {
                    health: undefined,
                    status: 'error',
                };
            }
        });
    }

    public async getContainersData(target: string): Promise<ContainerItem[]> {
        if (!this.containersMap.has(target)) {
            this.containersMap.set(target, this.loadContainersData(target));
        }
        return this.containersMap.get(target)!;
    }

    public async getTargetState(target: string): Promise<TargetState> {
        if (!this.targetStateMap.has(target)) {
            this.targetStateMap.set(target, this.loadTargetState(target));
        }
        return this.targetStateMap.get(target)!.promise;
    }

    public getTargetStateSnapshot(target: string): TargetState {
        return this.targetStateMap.get(target)?.get() ?? defaultTargetState;
    }

    private async loadContainersData(target: string): Promise<ContainerItem[]> {
        try {
            const items = await this.containerCommands.getContainers(target);
            const ids = items.map((item) => item.ID);
            const [inspectOutput, statsOutput] = await Promise.all([
                this.containerCommands.inspectContainers(ids, target),
                this.containerCommands.containerStats(ids, target),
            ]);

            const containers: ContainerItem[] = [];
            for (const item of items) {
                const inspect = inspectOutput.find((el) =>
                    el.Id.startsWith(item.ID),
                );
                const stats = statsOutput.find((el) =>
                    el.ID.startsWith(item.ID),
                );
                containers.push(
                    createContainerItem(item, inspect, stats, target),
                );
            }
            return containers;
        } catch (err: unknown) {
            const errorMsg =
                err instanceof Error ? err.message : 'Unknown error';
            logger.error(`Failed to get containers info: ${errorMsg}`);
            return [];
        }
    }

    private async startAutoRefresh(target: string): Promise<void> {
        this.refreshLoop = new RefreshLoop(async () => {
            const targetStateFuture = this.loadTargetState(target);
            const targetState = await targetStateFuture.promise;
            this.targetStateMap.set(target, targetStateFuture);

            if (targetState.status === 'connected') {
                if (hasHealthyDependency(targetState, 'Container Engine')) {
                    const containersPromise = this.loadContainersData(target);
                    await containersPromise;
                    this.containersMap.set(target, containersPromise);
                } else {
                    this.containersMap.set(target, Promise.resolve([]));
                }
            }

            this._onDataUpdate.fire();
        }, refreshInterval);
        await this.refreshLoop.start();
    }

    private stopAutoRefresh(): void {
        if (this.refreshLoop) {
            this.refreshLoop.stop();
            this.refreshLoop = undefined;
        }
    }

    public dispose(): void {
        this.stopAutoRefresh();
        [...this.disposables].reverse().forEach((d) => {
            try {
                d.dispose();
            } catch (error) {
                logger.error(`Error disposing resource`, error);
            }
        });
        this.disposables = [];
    }
}
