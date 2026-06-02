import { TargetModel } from '../models/targetModel';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { getErrorMessage } from '../util/getErrorMessage';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { defaultSshConfigPath, getHosts } from '../util/ssh';
import * as vscode from 'vscode';

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
        this.model.setTargets([...this.targetStore.getTargets()]);
        this.model.setSelected(this.targetStore.getSelectedTarget());
    }

    public async select(treeNode?: unknown): Promise<void> {
        if (!isTargetTreeItem(treeNode)) {
            return;
        }

        await this.targetStore.setSelected(treeNode.target);
        this.updateFromStore();
    }

    public async remove(treeNode?: unknown): Promise<void> {
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

    public async promptToAdd(): Promise<void> {
        const target = await promptForSshTarget(this.model.targets);
        if (!target) {
            return;
        }

        try {
            await this.targetStore.addTarget(target);
        } catch (error) {
            const errorMsg = `Failed to add target: ${getErrorMessage(error)}`;
            logger.warn(errorMsg, error);
            vscode.window.showWarningMessage(errorMsg);
            return;
        }
        await this.targetStore.setSelected(target);
        this.updateFromStore();
    }
}
