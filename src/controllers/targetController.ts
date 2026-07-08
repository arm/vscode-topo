import { TargetModel } from '../models/targetModel';
import { TargetStore } from '../services/targetStore';
import { isWrappedError } from '../errors/wrappedError';
import { logger } from '../util/logger';
import { logError, showAndLogError } from '../util/showAndLog';
import { defaultSshConfigPath, getHosts } from '../util/ssh';
import * as vscode from 'vscode';
import { TopoCli } from '../services/topoCli';
import { HealthReport, TargetHealthReport } from '../services/topoCliSchema';
import { errored, Loadable, loaded, loading } from '../util/loadable';
import { TargetDescription } from '../util/types';
import { LatestAbortableWork } from '../util/latestAbortableWork';
import { DisposableCollector } from '../util/disposableCollector';

const corruptedDataMessage =
    'The local target data saved by Topo looks corrupted';

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
    discoveredTargets: string[],
    filter: string,
    savedTargets: string[] = [],
    selectedTarget?: string,
): TargetQuickPickItem[] {
    const discoveredTargetsSet = new Set(discoveredTargets);
    const allTargets = new Set([...savedTargets, ...discoveredTargets]);
    const targetItems: TargetQuickPickItem[] = [...allTargets].map((target) => {
        return {
            label: target,
            target,
            description: target === selectedTarget ? '$(target)' : undefined,
            buttons: !discoveredTargetsSet.has(target)
                ? [removeTargetQuickPickButton]
                : undefined,
        };
    });
    const trimmed = filter.trim();
    const isNovelEntry = trimmed.length > 0 && !allTargets.has(trimmed);
    const manualItem: TargetQuickPickItem | undefined = isNovelEntry
        ? {
              label: trimmed,
              target: trimmed,
              description: 'Add new SSH target',
          }
        : undefined;
    return [...(manualItem ? [manualItem] : []), ...targetItems];
}

async function loadTargetHealth(
    topoCli: TopoCli,
    target: string,
): Promise<Loadable<TargetHealthReport>> {
    let health: HealthReport;
    try {
        health = await topoCli.health(target);
    } catch (err) {
        return errored(err);
    }

    return loaded(health.target);
}

async function loadTargetDescription(
    topoCli: TopoCli,
    target: string,
): Promise<Loadable<TargetDescription>> {
    let desc: TargetDescription;
    try {
        desc = await topoCli.describe(target);
    } catch (err) {
        return errored(err);
    }

    return loaded(desc);
}

export class TargetController {
    private readonly disposables = new DisposableCollector();
    private readonly selectedTargetHealthRefresh = new LatestAbortableWork();
    private readonly selectedTargetDescriptionLoad = new LatestAbortableWork();

    constructor(
        private readonly model: TargetModel,
        private readonly targetStore: TargetStore,
        private readonly topoCli: TopoCli,
    ) {
        this.disposables.collect(
            this.selectedTargetHealthRefresh,
            this.selectedTargetDescriptionLoad,
        );
    }

    public updateTargetsFromStore(): void {
        let targets: Set<string>;
        try {
            targets = this.targetStore.getTargets();
        } catch (err) {
            if (!isWrappedError(err, ['STORAGE'])) {
                throw err;
            }
            if (this.model.targets.status !== 'errored') {
                logError(corruptedDataMessage, err);
            }
            this.model.setTargets(errored(err));
            return;
        }

        const selectedTarget = this.targetStore.getSelectedTarget();
        this.model.setTargets(loaded([...targets]));
        this.model.setSelected(selectedTarget);
    }

    public async resetExtensionDataCommandHandler(): Promise<void> {
        await this.targetStore.resetExtensionData();
        this.model.clear();
        vscode.window.showInformationMessage('Topo local data has been reset.');
    }

    public async selectCommandHandler(): Promise<void> {
        await this.promptAndSelectTarget();
    }

    public async clearSelectionCommandHandler(): Promise<void> {
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
        const currentTargets =
            this.model.targets.status === 'loaded'
                ? this.model.targets.data
                : [];
        const result = await promptForSshTarget(
            currentTargets,
            this.model.selected,
        );

        switch (result?.kind) {
            case 'remove':
                if (
                    result.target === this.model.selected &&
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

        if (!currentTargets.includes(target)) {
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

    public async refreshSelectedTargetHealthCommandHandler(): Promise<void> {
        const target = this.model.selected;
        if (!target) {
            this.selectedTargetHealthRefresh.abort();
            return;
        }

        try {
            await this.selectedTargetHealthRefresh.run((signal) =>
                this.refreshSelectedTargetHealth(target, signal),
            );
        } catch (err) {
            showAndLogError('Failed to refresh target health', err);
        }
    }

    public async loadSelectedTargetDescriptionCommandHandler(): Promise<void> {
        const target = this.model.selected;
        if (!target) {
            this.selectedTargetDescriptionLoad.abort();
            return;
        }

        try {
            await this.selectedTargetDescriptionLoad.run((signal) =>
                this.loadSelectedTargetDescription(target, signal),
            );
        } catch (err) {
            showAndLogError('Failed to load target description', err);
        }
    }

    public isRefreshingSelectedTargetHealth(): boolean {
        return this.selectedTargetHealthRefresh.isRunning();
    }

    private async loadSelectedTargetDescription(
        target: string,
        signal: AbortSignal,
    ): Promise<void> {
        this.model.setSelectedTargetDescription(
            loading(this.model.selectedTargetDescription),
        );
        const description = await loadTargetDescription(this.topoCli, target);
        signal.throwIfAborted();
        this.model.setSelectedTargetDescription(description);
    }

    private async refreshSelectedTargetHealth(
        target: string,
        signal: AbortSignal,
    ): Promise<void> {
        logger.info(
            `Refreshing health for target ${target}`,
            this.model.selectedTargetHealth,
        );
        this.model.setSelectedTargetHealth(
            loading(this.model.selectedTargetHealth),
        );

        const health = await loadTargetHealth(this.topoCli, target);
        signal.throwIfAborted();
        this.model.setSelectedTargetHealth(health);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
