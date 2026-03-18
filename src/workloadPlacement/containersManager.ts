import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { Deferred } from '../util/deferred';
import type {
    TargetState,
    ContainerItem,
    DockerPorts,
    DockerPsItem,
    TargetItem,
} from '../util/types';
import type { ContainerCommands } from './containerCommands';
import { TargetStore } from './targetStore';
import type { TopoCli } from '../topoCli';
import { isTargetReady } from '../util/targetState';

const refreshInterval = 3000;

export class ContainersManager implements vscode.Disposable {
    private containersDataDeferred: Deferred<void> | undefined = undefined;
    private targetStateDeferred: Deferred<void> | undefined = undefined;
    private containersDataInitialised = false;
    private targetStateInitialised = false;
    private readonly _onDataUpdate = new vscode.EventEmitter<void>();
    public readonly onDataUpdate = this._onDataUpdate.event;
    private readonly defaultTargetState: TargetState = {
        health: undefined,
        targetId: undefined,
    };
    private refreshTimer: NodeJS.Timeout | undefined;
    private shouldAutoRefresh = false;
    private containersData: ContainerItem[] = [];
    private targetState: TargetState = this.defaultTargetState;
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
        const containersDataDeferred = this.containersDataDeferred;
        const targetStateDeferred = this.targetStateDeferred;
        this.containersDataDeferred = undefined;
        this.targetStateDeferred = undefined;
        this.target = undefined;
        this.containersData = [];
        this.containersDataInitialised = false;
        this.targetState = this.defaultTargetState;
        this.targetStateInitialised = false;
        containersDataDeferred?.resolve();
        targetStateDeferred?.resolve();
        this._onDataUpdate.fire();
    }

    private async getTargetStateInfo(): Promise<TargetState> {
        const target = this.target;
        if (!target) {
            return {
                health: undefined,
                targetId: undefined,
            };
        }

        try {
            const health = await this.topoCli.health(target.ssh);
            return {
                health: health.target,
                targetId: target.id,
            };
        } catch (err) {
            logger.error(`Failed to check health for target ${target.id}`, err);
            return {
                health: undefined,
                targetId: target.id,
            };
        }
    }

    public async getContainersData(): Promise<ContainerItem[]> {
        if (!this.containersDataInitialised) {
            await this.loadContainersData();
        }
        return this.containersData;
    }

    private async loadContainersData(): Promise<void> {
        if (this.containersDataDeferred) {
            return this.containersDataDeferred.promise;
        }
        const deferred = new Deferred<void>();
        this.containersDataDeferred = deferred;
        (async () => {
            try {
                const containersData = await this.getContainersInfo();
                if (this.containersDataDeferred !== deferred) {
                    deferred.resolve();
                    return;
                }

                this.containersData = containersData;
                this.containersDataInitialised = true;
                deferred.resolve();
            } catch (err) {
                if (this.containersDataDeferred === deferred) {
                    deferred.reject(err);
                } else {
                    deferred.resolve();
                }
            } finally {
                if (this.containersDataDeferred === deferred) {
                    this.containersDataDeferred = undefined;
                }
            }
        })();
        return deferred.promise;
    }

    public async getTargetState(): Promise<TargetState> {
        if (!this.targetStateInitialised) {
            await this.loadTargetState();
        }
        return this.targetState;
    }

    private loadTargetState(): Promise<void> {
        if (this.targetStateDeferred) {
            return this.targetStateDeferred.promise;
        }
        const deferred = new Deferred<void>();
        this.targetStateDeferred = deferred;
        (async () => {
            try {
                const targetState = await this.getTargetStateInfo();
                if (this.targetStateDeferred !== deferred) {
                    deferred.resolve();
                    return;
                }

                this.targetState = targetState;
                this.targetStateInitialised = true;
                deferred.resolve();
            } catch (err) {
                if (this.targetStateDeferred === deferred) {
                    deferred.reject(err);
                } else {
                    deferred.resolve();
                }
            } finally {
                if (this.targetStateDeferred === deferred) {
                    this.targetStateDeferred = undefined;
                }
            }
        })();
        return deferred.promise;
    }

    private async getContainersInfo(): Promise<ContainerItem[]> {
        try {
            const target = this.target;
            if (!target) {
                return [];
            }
            const items = await this.containerCommands.getContainers(
                target.ssh,
            );
            const ids = items.map((item) => item.ID);
            const inspectOutput =
                await this.containerCommands.inspectContainers(ids, target.ssh);
            const statsOutput = await this.containerCommands.containerStats(
                ids,
                target.ssh,
            );
            const statsLines = statsOutput.trim().split(/\r?\n/);
            const parsedStatsLines = statsLines.map((line) => line.split(';'));
            const containersData = items.reduce<ContainerItem[]>(
                (acc, item) => {
                    const containerInspectElement = inspectOutput.find(
                        (inspectElement) =>
                            inspectElement.Id.slice(0, 12) === item.ID,
                    );
                    const containerStatsLine = parsedStatsLines.find(
                        (stat) => stat[0].slice(0, 12) === item.ID,
                    );
                    const cpuUsage = containerStatsLine?.[1] || '';
                    const memUsage = containerStatsLine?.[2] || '';
                    const runtime =
                        containerInspectElement?.HostConfig.Runtime || '';
                    const annotations =
                        containerInspectElement?.HostConfig.Annotations || {};
                    const ports =
                        containerInspectElement?.NetworkSettings.Ports || {};
                    acc.push(
                        this.createContainerItem(
                            item,
                            runtime,
                            annotations,
                            ports,
                            cpuUsage,
                            memUsage,
                            target,
                        ),
                    );
                    return acc;
                },
                [],
            );
            return containersData;
        } catch (err: unknown) {
            const errorMsg =
                err instanceof Error ? err.message : 'Unknown error';
            logger.error(`Failed to get containers info: ${errorMsg}`);
            return this.containersData;
        }
    }

    public async startAutoRefresh(): Promise<void> {
        if (this.refreshTimer) {
            return;
        }
        this.shouldAutoRefresh = true;
        const refresh = async () => {
            if (this.shouldAutoRefresh) {
                await this.loadTargetState();
                if (isTargetReady(this.targetState)) {
                    await this.loadContainersData();
                }
                this._onDataUpdate.fire();
                this.refreshTimer = setTimeout(refresh, refreshInterval);
            }
        };
        await refresh();
    }

    public stopAutoRefresh(): void {
        this.shouldAutoRefresh = false;
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

    private createContainerItem(
        item: DockerPsItem,
        runtime: string,
        annotations: Record<string, string>,
        ports: DockerPorts,
        cpuUsage: string,
        memUsage: string,
        target: TargetItem,
    ): ContainerItem {
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
