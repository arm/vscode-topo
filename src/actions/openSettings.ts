import * as vscode from 'vscode';
import { PACKAGE_NAME, REGISTRY_NAME } from '../manifest';

const TOPO_EXTENSION_SETTINGS_FILTER = `@ext:${REGISTRY_NAME}.${PACKAGE_NAME}`;

export class OpenSettings {
    public async openSettingsCommandHandler(): Promise<void> {
        await openSettings();
    }
}

export async function openSettings(): Promise<void> {
    await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        TOPO_EXTENSION_SETTINGS_FILTER,
    );
}
