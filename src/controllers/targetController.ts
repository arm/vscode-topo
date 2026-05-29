import { TargetModel } from '../models/targetModel';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
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
    existingTargets: Set<string>,
): Promise<string | undefined> {
    const sshHosts = await getHosts(defaultSshConfigPath);
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

    private loadTargetsSafe(): Set<string> | undefined {
        try {
            const v = this.targetStore.loadTargets();
            logger.info(`Loaded targets:`, [...v]);
            return v;
        } catch (error) {
            showAndLogError(`Failed to load targets`, error);
            return undefined;
        }
    }

    public updateFromStore(): void {
        const targets = this.loadTargetsSafe();
        if (targets) {
            this.model.setTargets([...targets]);
        }

        const selected = this.targetStore.loadSelected();
        this.model.setSelected(selected);
    }

    public async select(treeNode?: unknown): Promise<void> {
        if (!isTargetTreeItem(treeNode)) {
            return;
        }

        const target = treeNode.target;
        await this.targetStore.saveSelected(target);
        this.model.setSelected(target);
    }

    public async remove(treeNode?: unknown): Promise<void> {
        if (!isTargetTreeItem(treeNode)) {
            return;
        }

        const target = treeNode.target;
        const targets = this.loadTargetsSafe();
        if (!targets) {
            return;
        }
        if (!targets.has(target)) {
            logger.warn(`Attempted to remove non-existent target: ${target}`);
            return;
        }
        targets.delete(target);
        await this.targetStore.saveTargets(targets);
        this.model.setTargets([...targets]);
        if (this.model.selected === target) {
            const newSelected = targets.size > 0 ? [...targets][0] : undefined;
            await this.targetStore.saveSelected(newSelected);
            this.model.setSelected(newSelected);
        }
    }

    public async promptToAdd(): Promise<void> {
        const targets = this.loadTargetsSafe();
        if (!targets) {
            return;
        }
        const target = await promptForSshTarget(targets);
        if (!target || targets.has(target)) {
            return;
        }

        await this.targetStore.saveTargets(new Set([...targets, target]));
        this.model.setTargets([...targets, target]);

        await this.targetStore.saveSelected(target);
        this.model.setSelected(target);
    }
}
