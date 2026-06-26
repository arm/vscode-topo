import * as vscode from 'vscode';
import { PACKAGE_NAME, REGISTRY_NAME } from '../manifest';
import { TargetStore } from '../services/targetStore';
import { ensureCachedTargetDeploySettings } from '../services/targetDeploySettings';
import { showAndLogError } from '../util/showAndLogError';

const TOPO_EXTENSION_SETTINGS_FILTER = `@ext:${REGISTRY_NAME}.${PACKAGE_NAME}`;

export class OpenTopoSettings {
    constructor(private readonly targetStore: TargetStore) {}

    public async openTopoSettingsCommandHandler(): Promise<void> {
        try {
            await openTopoSettings(this.targetStore.getTargets());
        } catch (err) {
            showAndLogError('Failed to open target settings', err);
        }
    }
}

export async function openTopoSettings(
    cachedTargets: Iterable<string> = [],
): Promise<void> {
    await ensureCachedTargetDeploySettings(cachedTargets);
    await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        TOPO_EXTENSION_SETTINGS_FILTER,
    );
}
