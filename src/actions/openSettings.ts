import * as vscode from 'vscode';
import { PACKAGE_NAME, REGISTRY_NAME } from '../manifest';
import { TargetStore } from '../services/targetStore';
import { ensureCachedTargetDeploySettings } from '../services/targetDeploySettings';
import { showAndLogError } from '../util/showAndLogError';

const TOPO_EXTENSION_SETTINGS_FILTER = `@ext:${REGISTRY_NAME}.${PACKAGE_NAME}`;

export class OpenSettings {
    constructor(private readonly targetStore: TargetStore) {}

    public async openSettingsCommandHandler(): Promise<void> {
        try {
            await openSettings(this.targetStore.getTargets());
        } catch (err) {
            showAndLogError('Failed to open target deploy settings', err);
        }
    }
}

export async function openSettings(
    cachedTargets: Iterable<string> = [],
): Promise<void> {
    await ensureCachedTargetDeploySettings(cachedTargets);
    await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        TOPO_EXTENSION_SETTINGS_FILTER,
    );
}
