import { TargetModel } from '../models/targetModel';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { isWrappedError } from '../errors/wrappedError';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { defaultSshConfigPath, getHosts } from '../util/ssh';
import * as vscode from 'vscode';
import { TopoCli } from '../topoCli';
import { ContainerCommands } from '../target/containerCommands';
import { errored, Loadable, loaded, loading } from '../util/loadable';
import { ContainerItem, DockerInspectItem, DockerPsItem } from '../util/types';
import { HealthCheck, TargetHealthCheck } from '../topoCliSchema';

function isTargetTreeItem(node: unknown): node is TargetTreeItem {
    if (node instanceof TargetTreeItem) {
        return true;
    }

    const errMsg = `Invalid target type: expected TargetTreeItem but received:`;
    logger.error(errMsg, node);
    return false;
}

async function promptForSshTarget(
    currentTargets: string[],
): Promise<string | undefined> {
    const sshHosts = await getHosts(defaultSshConfigPath);
    const existingTargets = new Set(currentTargets);
    const availableHosts = sshHosts.filter(
        (host) => !existingTargets.has(host),
    );

    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Add new target';
    quickPick.placeholder =
        'Select a host or type a connection string (e.g. root@192.168.1.1)';
    quickPick.items = buildQuickPickItems(availableHosts, '');

    quickPick.onDidChangeValue((value) => {
        quickPick.items = buildQuickPickItems(availableHosts, value);
    });

    return new Promise<string | undefined>((resolve) => {
        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0]?.label?.trim();
            quickPick.hide();
            resolve(selected);
        });

        quickPick.onDidHide(() => {
            resolve(undefined);
        });

        quickPick.show();
    }).finally(() => quickPick.dispose());
}

export function buildQuickPickItems(
    availableHosts: string[],
    filter: string,
): vscode.QuickPickItem[] {
    const hostItems: vscode.QuickPickItem[] = availableHosts.map((host) => ({
        label: host,
    }));
    const trimmed = filter.trim();
    const isNovelEntry =
        trimmed.length > 0 &&
        !availableHosts.some((h) => h.toLowerCase() === trimmed.toLowerCase());
    const manualItem: vscode.QuickPickItem | undefined = isNovelEntry
        ? { label: trimmed, description: 'Add new SSH target' }
        : undefined;
    return [...(manualItem ? [manualItem] : []), ...hostItems];
}

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
): Promise<Loadable<TargetHealthCheck>> {
    let health: HealthCheck;
    try {
        health = await topoCli.health(target);
    } catch (err) {
        return errored(err);
    }

    return loaded(health.target);
}

async function loadContainersData(
    containerCommands: ContainerCommands,
    target: string,
): Promise<Loadable<ContainerItem[]>> {
    let items: DockerPsItem[];
    let inspectOutput: DockerInspectItem[];
    try {
        items = await containerCommands.getContainers(target);
        const ids = items.map((item) => item.ID);
        inspectOutput = await containerCommands.inspectContainers(ids, target);
    } catch (err: unknown) {
        return errored(err);
    }

    const containers: ContainerItem[] = [];
    for (const item of items) {
        const inspect = inspectOutput.find((el) => el.Id.startsWith(item.ID));
        containers.push(createContainerItem(item, inspect, target));
    }
    return loaded(containers);
}

export class TargetController {
    private currentRefreshAbortController: AbortController | undefined;

    constructor(
        private readonly model: TargetModel,
        private readonly targetStore: TargetStore,
        private readonly topoCli: TopoCli,
        private readonly containerCommands: ContainerCommands,
    ) {}

    public activate(): void {
        this.updateFromTargetStore();
        this.refreshSelectedTargetDataCommandHandler();
    }

    public updateFromTargetStore(): void {
        this.model.setTargets([...this.targetStore.getTargets()]);

        const prevSelected = this.model.selected;
        this.model.setSelected(this.targetStore.getSelectedTarget());
        if (prevSelected && prevSelected !== this.model.selected) {
            this.refreshSelectedTargetDataCommandHandler();
        }
    }

    public async selectCommandHandler(treeNode?: unknown): Promise<void> {
        if (!isTargetTreeItem(treeNode)) {
            return;
        }

        await this.targetStore.setSelected(treeNode.target);
        this.updateFromTargetStore();
    }

    public async removeCommandHandler(treeNode?: unknown): Promise<void> {
        if (!isTargetTreeItem(treeNode)) {
            return;
        }

        try {
            await this.targetStore.deleteTarget(treeNode.target);
            this.updateFromTargetStore();
        } catch (err) {
            const errorMessage = `Failed to remove target`;
            showAndLogError(errorMessage, err);
        }
    }

    public async addCommandHandler(): Promise<void> {
        const selectedTarget = await promptForSshTarget(this.model.targets);
        const target = selectedTarget?.trim();
        if (!target) {
            return;
        }

        try {
            await this.targetStore.addTarget(target);
        } catch (error) {
            if (isWrappedError(error, ['INVALID_SSH_DESTINATION'])) {
                showAndLogError(
                    'Cannot add target. Enter a valid SSH destination',
                    error,
                );
                return;
            }
            throw error;
        }
        await this.targetStore.setSelected(target);
        this.updateFromTargetStore();
    }

    public async refreshSelectedTargetDataCommandHandler(): Promise<void> {
        this.abortCurrentTargetDataRefresh();

        const target = this.model.selected;
        if (!target) {
            this.model.setSelectedTargetHealth(loaded(undefined));
            this.model.setSelectedTargetContainers(loaded([]));
            return;
        }

        const ab = new AbortController();
        this.currentRefreshAbortController = ab;

        try {
            await this.refreshSelectedTargetData(target, ab.signal);
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

    public isRefreshingSelectedTargetData(): boolean {
        if (!this.currentRefreshAbortController) {
            return false;
        }
        return !this.currentRefreshAbortController.signal.aborted;
    }

    private abortCurrentTargetDataRefresh(): void {
        this.currentRefreshAbortController?.abort();
        this.currentRefreshAbortController = undefined;
    }

    private async refreshSelectedTargetData(
        target: string,
        signal: AbortSignal,
    ): Promise<void> {
        logger.info(
            `Refreshing data for target ${target}`,
            this.model.selectedTargetHealth,
        );
        this.model.setSelectedTargetHealth(
            loading(this.model.selectedTargetHealth),
        );
        const health = await loadTargetHealth(this.topoCli, target);
        signal.throwIfAborted();
        this.model.setSelectedTargetHealth(health);

        if (
            health.status !== 'loaded' ||
            health.data?.connectivity.status !== 'ok'
        ) {
            this.model.setSelectedTargetContainers(loaded([]));
            return;
        }

        const containerEngineDependency = health.data.dependencies.find(
            (dep) => dep.name === 'Container Engine',
        );
        if (containerEngineDependency?.status === 'error') {
            const err =
                containerEngineDependency.fix?.description ??
                'Container engine unavailable';
            return this.model.setSelectedTargetContainers(errored(err));
        }

        this.model.setSelectedTargetContainers(
            loading(this.model.selectedTargetContainers),
        );
        const containers = await loadContainersData(
            this.containerCommands,
            target,
        );
        signal.throwIfAborted();
        this.model.setSelectedTargetContainers(containers);
    }

    public dispose(): void {
        this.abortCurrentTargetDataRefresh();
    }
}
