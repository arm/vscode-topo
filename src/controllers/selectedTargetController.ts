import * as vscode from 'vscode';
import { TargetModel } from '../models/targetModel';
import { ContainerCommands } from '../target/containerCommands';
import { TopoCli } from '../topoCli';
import { ContainerItem, DockerInspectItem, DockerPsItem } from '../util/types';
import { showAndLogError } from '../util/showAndLogError';
import { logger } from '../util/logger';
import { errored, Loadable, loaded, loading } from '../util/loadable';
import { TargetHealthCheckResult } from '../topoCliSchema';
import { SelectedTargetModel } from '../models/selectedTargetModel';

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

async function loadTargetHealth(
    topoCli: TopoCli,
    target: string,
): Promise<Loadable<TargetHealthCheckResult>> {
    try {
        const health = await topoCli.health(target);
        if (health.target.connectivity.status === 'error') {
            return errored(
                health.target.connectivity.fix?.description ??
                    'Failed to connect',
            );
        }
        return loaded(health.target);
    } catch (err) {
        return errored(err);
    }
}

async function loadContainersData(
    containerCommands: ContainerCommands,
    target: string,
): Promise<Loadable<ContainerItem[]>> {
    try {
        const items = await containerCommands.getContainers(target);
        const ids = items.map((item) => item.ID);
        const inspectOutput = await containerCommands.inspectContainers(
            ids,
            target,
        );
        const containers: ContainerItem[] = [];
        for (const item of items) {
            const inspect = inspectOutput.find((el) =>
                el.Id.startsWith(item.ID),
            );
            containers.push(createContainerItem(item, inspect, target));
        }
        return loaded(containers);
    } catch (err: unknown) {
        return errored(err);
    }
}

export class SelectedTargetController implements vscode.Disposable {
    private currentRefreshAbortController: AbortController | undefined;

    constructor(
        private readonly model: SelectedTargetModel,
        private readonly targetModel: TargetModel,
        private readonly topoCli: TopoCli,
        private readonly containerCommands: ContainerCommands,
    ) {
        this.refreshCommandHandler();
    }

    public async refreshCommandHandler(): Promise<void> {
        this.abortCurrentRefresh();

        const target = this.targetModel.selected;
        if (!target) {
            this.model.clear();
            return;
        }

        const ab = new AbortController();
        this.currentRefreshAbortController = ab;

        try {
            await this.refresh(target, ab.signal);
        } catch (err) {
            if (!ab.signal.aborted) {
                return showAndLogError('Failed to refresh target data', err);
            }
        } finally {
            if (this.currentRefreshAbortController === ab) {
                this.currentRefreshAbortController = undefined;
            }
        }
    }

    public isRefreshing(): boolean {
        if (!this.currentRefreshAbortController) {
            return false;
        }
        return !this.currentRefreshAbortController.signal.aborted;
    }

    private abortCurrentRefresh(): void {
        this.currentRefreshAbortController?.abort();
        this.currentRefreshAbortController = undefined;
    }

    private async refresh(target: string, signal: AbortSignal): Promise<void> {
        logger.info(`Refreshing data for target ${target}`, this.model.health);
        this.model.setHealth(loading(this.model.health));
        const health = await loadTargetHealth(this.topoCli, target);
        signal.throwIfAborted();
        this.model.setHealth(health);

        if (health.status !== 'loaded') {
            this.model.setContainers(loaded([]));
            return;
        }

        const containerEngineDependency = health.data?.dependencies.find(
            (dep) => dep.name === 'Container Engine',
        );
        if (containerEngineDependency?.status === 'error') {
            const err =
                containerEngineDependency.fix?.description ??
                'Container engine unavailable';
            return this.model.setContainers(errored(err));
        }

        this.model.setContainers(loading(this.model.containers));
        const containers = await loadContainersData(
            this.containerCommands,
            target,
        );
        signal.throwIfAborted();
        this.model.setContainers(containers);
    }

    public dispose(): void {
        this.abortCurrentRefresh();
    }
}
