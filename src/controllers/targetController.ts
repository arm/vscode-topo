import { TargetModel } from '../models/targetModel';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { isWrappedError } from '../errors/wrappedError';
import { logger } from '../util/logger';
import { logError, showAndLogError } from '../util/showAndLogError';
import { defaultSshConfigPath, getHosts } from '../util/ssh';
import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TopoCli } from '../topoCli';
import { ContainerCommands } from '../target/containerCommands';
import { errored, Loadable, loaded, loading } from '../util/loadable';
import { ContainerItem, DockerInspectItem, DockerPsItem } from '../util/types';
import { HealthCheck, TargetHealthCheck } from '../topoCliSchema';
import { LatestAbortableWork } from '../util/latestAbortableWork';
import { DisposableCollector } from '../util/disposableCollector';

const corruptedDataMessage = 'The local data saved by Topo looks corrupted';
const targetDataIssueContextKey = `${PACKAGE_NAME}.targetDataIssue`;

type TargetPromptResult =
    | { readonly kind: 'select'; readonly target: string }
    | { readonly kind: 'remove'; readonly target: string };

type TargetQuickPickItem = vscode.QuickPickItem & {
    readonly target: string;
};

const removeTargetQuickPickButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('trash'),
    tooltip: 'Remove Target',
};

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
    selectedTarget: string | undefined,
): Promise<TargetPromptResult | undefined> {
    const sshHosts = await getHosts(defaultSshConfigPath);

    const quickPick = vscode.window.createQuickPick<TargetQuickPickItem>();
    quickPick.title = 'Select a target';
    quickPick.placeholder =
        'Select a host or type a connection string (e.g. root@192.168.1.1)';
    quickPick.items = buildQuickPickItems(
        sshHosts,
        '',
        currentTargets,
        selectedTarget,
    );

    quickPick.onDidChangeValue((value) => {
        quickPick.items = buildQuickPickItems(
            sshHosts,
            value,
            currentTargets,
            selectedTarget,
        );
    });

    return new Promise<TargetPromptResult | undefined>((resolve) => {
        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0]?.target.trim();
            resolve(
                selected ? { kind: 'select', target: selected } : undefined,
            );
            quickPick.hide();
        });

        quickPick.onDidTriggerItemButton((event) => {
            if (event.button !== removeTargetQuickPickButton) {
                return;
            }

            resolve({ kind: 'remove', target: event.item.target });
            quickPick.hide();
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
    currentTargets: string[] = [],
    selectedTarget?: string,
): TargetQuickPickItem[] {
    const availableHostsByLowerCase = new Set(
        availableHosts.map((host) => host.toLowerCase()),
    );
    const knownTargets = [
        ...currentTargets,
        ...availableHosts.filter(
            (host) =>
                !currentTargets.some(
                    (target) => target.toLowerCase() === host.toLowerCase(),
                ),
        ),
    ];
    const targetItems: TargetQuickPickItem[] = knownTargets.map((target) => {
        const isSelected =
            target.toLowerCase() === selectedTarget?.toLowerCase();
        return {
            label: target,
            target,
            ...(isSelected ? { description: '$(target)' } : {}),
            buttons:
                currentTargets.includes(target) &&
                !availableHostsByLowerCase.has(target.toLowerCase())
                    ? [removeTargetQuickPickButton]
                    : undefined,
        };
    });
    const trimmed = filter.trim();
    const isNovelEntry =
        trimmed.length > 0 &&
        !knownTargets.some((h) => h.toLowerCase() === trimmed.toLowerCase());
    const manualItem: TargetQuickPickItem | undefined = isNovelEntry
        ? {
              label: trimmed,
              target: trimmed,
              description: 'Add new SSH target',
          }
        : undefined;
    return [...(manualItem ? [manualItem] : []), ...targetItems];
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
    private readonly disposables = new DisposableCollector();
    private readonly selectedTargetDataRefresh = new LatestAbortableWork();

    constructor(
        private readonly model: TargetModel,
        private readonly targetStore: TargetStore,
        private readonly topoCli: TopoCli,
        private readonly containerCommands: ContainerCommands,
    ) {
        this.disposables.collect(this.selectedTargetDataRefresh);
    }

    public updateTargetsFromStore(): void {
        let targets: Set<string>;
        try {
            targets = this.targetStore.getTargets();
        } catch (err) {
            if (!isWrappedError(err, ['STORAGE'])) {
                throw err;
            }
            this.setCorruptedDataIssue(err);
            return;
        }

        const selectedTarget = this.targetStore.getSelectedTarget();
        this.model.setTargets([...targets]);
        this.model.setSelected(selectedTarget);
        this.syncTargetDataIssueContext();
    }

    public async resetExtensionDataCommandHandler(): Promise<void> {
        await this.resetExtensionData();
    }

    private setCorruptedDataIssue(err: unknown): void {
        if (!this.model.dataIssue) {
            logError(corruptedDataMessage, err);
        }
        this.model.setDataIssue(true);
        this.syncTargetDataIssueContext();
    }

    private syncTargetDataIssueContext(): void {
        void vscode.commands.executeCommand(
            'setContext',
            targetDataIssueContextKey,
            this.model.dataIssue,
        );
    }

    private async resetExtensionData(): Promise<void> {
        try {
            await this.targetStore.resetExtensionData();
            this.model.setTargets([]);
            this.model.setSelected(undefined);
            this.model.clearSelectedTargetData();
            this.syncTargetDataIssueContext();
            vscode.window.showInformationMessage(
                'Topo local data has been reset.',
            );
        } catch (err) {
            showAndLogError('Failed to reset Topo local data', err);
        }
    }

    public async selectCommandHandler(): Promise<void> {
        await this.promptAndSelectTarget();
    }

    public async unselectCommandHandler(treeNode?: unknown): Promise<void> {
        if (!isTargetTreeItem(treeNode)) {
            return;
        }

        await this.targetStore.setSelected(undefined);
        this.updateTargetsFromStore();
    }

    private async removeTarget(target: string): Promise<void> {
        try {
            await this.targetStore.deleteTarget(target);
            this.updateTargetsFromStore();
        } catch (err) {
            const errorMessage = `Failed to remove target`;
            showAndLogError(errorMessage, err);
        }
    }

    private async confirmSelectedTargetRemoval(
        target: string,
    ): Promise<boolean> {
        const remove = 'Remove Target';
        const response = await vscode.window.showWarningMessage(
            `Remove the selected target "${target}"?`,
            { modal: true },
            remove,
        );
        return response === remove;
    }

    private async promptAndSelectTarget(): Promise<void> {
        const result = await promptForSshTarget(
            this.model.targets,
            this.model.selected,
        );

        switch (result?.kind) {
            case 'remove':
                if (
                    result.target.toLowerCase() ===
                        this.model.selected?.toLowerCase() &&
                    !(await this.confirmSelectedTargetRemoval(result.target))
                ) {
                    return;
                }
                await this.removeTarget(result.target);
                return;
            case 'select':
            case undefined:
                break;
        }

        const target = result?.target.trim();
        if (!target) {
            return;
        }

        if (!this.model.targets.includes(target)) {
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
        }
        await this.targetStore.setSelected(target);
        this.updateTargetsFromStore();
    }

    public async refreshSelectedTargetDataCommandHandler(): Promise<void> {
        const target = this.model.selected;
        if (!target) {
            this.selectedTargetDataRefresh.abort();
            return;
        }

        try {
            await this.selectedTargetDataRefresh.run((signal) =>
                this.refreshSelectedTargetData(target, signal),
            );
        } catch (err) {
            showAndLogError('Failed to refresh target data', err);
        }
    }

    public isRefreshingSelectedTargetData(): boolean {
        return this.selectedTargetDataRefresh.isRunning();
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
        this.model.setSelectedTargetContainers(
            loading(this.model.selectedTargetContainers),
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

        const containers = await loadContainersData(
            this.containerCommands,
            target,
        );
        signal.throwIfAborted();
        this.model.setSelectedTargetContainers(containers);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
