import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { logger } from '../util/logger';
import { defaultSshConfigPath, getHosts } from '../util/ssh';
import { TargetStore } from '../target/targetStore';

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

export class AddTarget implements vscode.Disposable {
    public static readonly addTargetCommand = `${manifest.PACKAGE_NAME}.addTarget`;
    private disposables: vscode.Disposable[] = [];

    constructor(private readonly targetStore: TargetStore) {}

    public activate(): void {
        this.disposables.push(
            vscode.commands.registerCommand(AddTarget.addTargetCommand, () =>
                this.addTarget(),
            ),
        );
    }

    private async promptForSshTarget(): Promise<string | undefined> {
        const sshHosts = await getHosts(defaultSshConfigPath);
        const existingTargets = new Set(this.targetStore.getTargets());
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

    private async addTarget(): Promise<string | undefined> {
        const target = await this.promptForSshTarget();
        if (!target) {
            return;
        }

        try {
            await this.targetStore.addTarget(target);
        } catch (error) {
            const errorMsg = `Failed to add target`;
            logger.warn(errorMsg, error);
            vscode.window.showWarningMessage(errorMsg);
            return;
        }
        await this.targetStore.setSelected(target);
        return target;
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
