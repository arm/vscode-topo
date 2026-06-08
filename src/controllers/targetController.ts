import { TargetModel } from '../models/targetModel';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { isWrappedError } from '../errors/wrappedError';
import { logger } from '../util/logger';
import { logError, showAndLogError } from '../util/showAndLogError';
import { defaultSshConfigPath, getHosts } from '../util/ssh';
import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';

const corruptedDataMessage = 'The local data saved by Topo looks corrupted';
const targetDataIssueContextKey = `${PACKAGE_NAME}.targetDataIssue`;

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

export class TargetController {
    constructor(
        private readonly model: TargetModel,
        private readonly targetStore: TargetStore,
    ) {
        this.updateFromStore();
    }

    public updateFromStore(): void {
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
            this.syncTargetDataIssueContext();
            vscode.window.showInformationMessage(
                'Topo local data has been reset.',
            );
        } catch (err) {
            showAndLogError('Failed to reset Topo local data', err);
        }
    }

    public async selectCommandHandler(treeNode?: unknown): Promise<void> {
        if (!isTargetTreeItem(treeNode)) {
            return;
        }

        await this.targetStore.setSelected(treeNode.target);
        this.updateFromStore();
    }

    public async removeCommandHandler(treeNode?: unknown): Promise<void> {
        if (!isTargetTreeItem(treeNode)) {
            return;
        }

        try {
            await this.targetStore.deleteTarget(treeNode.target);
            this.updateFromStore();
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
        this.updateFromStore();
    }
}
