import * as vscode from 'vscode';
import { PACKAGE_NAME, REGISTRY_NAME } from '../manifest';
import { showAndLogError } from '../util/showAndLogError';

const TOPO_EXTENSION_SETTINGS_FILTER = `@ext:${REGISTRY_NAME}.${PACKAGE_NAME}`;

export class OpenSettings {
    public async openSettingsCommandHandler(): Promise<void> {
        try {
            await openSettings();
        } catch (err) {
            showAndLogError('Failed to open target deploy settings', err);
        }
    }
}

export async function openSettings(): Promise<void> {
    await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        TOPO_EXTENSION_SETTINGS_FILTER,
    );
}
