import * as vscode from 'vscode';
import { logger } from '../util/logger';
import type {
    TargetState,
    ContainerItem,
    DockerPsItem,
    TargetItem,
    DockerInspectItem,
    DockerStatsItem,
} from '../util/types';
import type { ContainerCommands } from './containerCommands';
import { TargetStore } from './targetStore';
import type { TopoCli } from '../topoCli';
import { isTargetReady } from '../util/targetState';
import { future, Future } from '../util/future';

const refreshInterval = 3000;

function createContainerItem(
    item: DockerPsItem,
    inspect: DockerInspectItem | undefined,
    stats: DockerStatsItem | undefined,
    target: TargetItem,
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
    targetSsh: undefined,
};

export class ContainersManager implements vscode.Disposable {
    private containers: Future<ContainerItem[]> | undefined;
    private targetState: Future<TargetState> | undefined;
    private readonly _onDataUpdate = new vscode.EventEmitter<void>();
    public readonly onDataUpdate = this._onDataUpdate.event;
    private refreshTimer: NodeJS.Timeout | undefined;
    private refreshSession: symbol | undefined;
    private target: TargetItem | undefined;
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

    private async updateTarget() {
        const selectedTarget = await this.targetStore.getSelectedTarget();
        this.unsetTarget();
        if (selectedTarget) {
            await this.setTarget(selectedTarget);
        }
        await this.startAutoRefresh();
    }

    private async setTarget(target: TargetItem) {
        this.target = target;
    }

    private unsetTarget(): void {
        this.stopAutoRefresh();
        this.containers = undefined;
        this.target = undefined;
        this.targetState = undefined;
        this._onDataUpdate.fire();
    }

    private async getTargetStateInfo(): Promise<TargetState> {
        const target = this.target;
        if (!target) {
            return {
                health: undefined,
                targetSsh: undefined,
            };
        }

        try {
            const health = await this.topoCli.health(target.ssh);
            return {
                health: health.target,
                targetSsh: target.ssh,
            };
        } catch (err) {
            logger.error(
                `Failed to check health for target ${target.ssh}`,
                err,
            );
            return {
                health: undefined,
                targetSsh: target.ssh,
            };
        }
    }

    public async getContainersData(): Promise<ContainerItem[]> {
        if (!this.containers) {
            this.containers = future(() => this.getContainersInfo());
        }
        return this.containers.promise;
    }

    public getTargetStateSnapshot(): TargetState {
        return this.targetState?.get() || defaultTargetState;
    }

    public async getTargetState(): Promise<TargetState> {
        if (!this.targetState) {
            this.targetState = future(() => this.getTargetStateInfo());
        }
        return this.targetState.promise;
    }

    private async getContainersInfo(): Promise<ContainerItem[]> {
        const target = this.target;
        if (!target) {
            return [];
        }

        try {
            const items = await this.containerCommands.getContainers(
                target.ssh,
            );
            const ids = items.map((item) => item.ID);
            const [inspectOutput, statsOutput] = await Promise.all([
                this.containerCommands.inspectContainers(ids, target.ssh),
                this.containerCommands.containerStats(ids, target.ssh),
            ]);

            const containers: ContainerItem[] = [];
            for (const item of items) {
                const inspect = inspectOutput.find((el) =>
                    el.Id.startsWith(item.ID),
                );
                const stats = statsOutput.find((el) =>
                    el.ID.startsWith(item.ID),
                );
                const container = createContainerItem(
                    item,
                    inspect,
                    stats,
                    target,
                );

                containers.push(container);
            }
            return containers;
        } catch (err: unknown) {
            const errorMsg =
                err instanceof Error ? err.message : 'Unknown error';
            logger.error(`Failed to get containers info: ${errorMsg}`);
            return this.containers?.get() || [];
        }
    }

    public async startAutoRefresh(): Promise<void> {
        if (this.refreshSession) {
            return;
        }
        const refreshSession = Symbol('refreshSession');
        this.refreshSession = refreshSession;
        const refresh = async () => {
            if (this.refreshSession !== refreshSession) {
                return;
            }

            this.targetState = future(() => this.getTargetStateInfo());
            const targetState = await this.targetState.promise;
            if (this.refreshSession !== refreshSession) {
                return;
            }

            if (isTargetReady(targetState)) {
                this.containers = future(() => this.getContainersInfo());
                await this.containers.promise;
                if (this.refreshSession !== refreshSession) {
                    return;
                }
            }

            this._onDataUpdate.fire();
            this.refreshTimer = setTimeout(refresh, refreshInterval);
        };
        await refresh();
    }

    public stopAutoRefresh(): void {
        this.refreshSession = undefined;
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    public async stopContainer(containerId: string): Promise<void> {
        const target = this.target;
        if (!target) {
            throw new Error(
                'Cannot stop container: no target is currently selected',
            );
        }
        return this.containerCommands.stopContainer(containerId, target.ssh);
    }

    public async startContainer(containerId: string): Promise<void> {
        const target = this.target;
        if (!target) {
            throw new Error(
                'Cannot start container: no target is currently selected',
            );
        }
        return this.containerCommands.startContainer(containerId, target.ssh);
    }

    public async deleteContainer(containerId: string): Promise<void> {
        const target = this.target;
        if (!target) {
            throw new Error(
                'Cannot delete container: no target is currently selected',
            );
        }
        return this.containerCommands.deleteContainer(containerId, target.ssh);
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
