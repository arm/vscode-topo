import * as vscode from 'vscode';
import {
    CONFIG_CONTAINER_ENGINE,
    PACKAGE_NAME,
    REGISTRY_NAME,
} from '../manifest';

const TOPO_EXTENSION_SETTINGS_FILTER = `@ext:${REGISTRY_NAME}.${PACKAGE_NAME}`;

export class OpenSettings {
    public async openSettingsCommandHandler(): Promise<void> {
        await openSettings();
    }

    public async openContainerEngineSettingsCommandHandler(): Promise<void> {
        await openSettings(`@id:${PACKAGE_NAME}.${CONFIG_CONTAINER_ENGINE}`);
    }
}

export async function openSettings(
    filter = TOPO_EXTENSION_SETTINGS_FILTER,
): Promise<void> {
    await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        filter,
    );
}
