import * as vscode from 'vscode';
import { OpenSettings } from './openSettings';

describe('OpenSettings', () => {
    it('opens the Topo extension settings from the command handler', async () => {
        const action = new OpenSettings();

        await action.openSettingsCommandHandler();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('opens only the container engine setting', async () => {
        const action = new OpenSettings();

        await action.openContainerEngineSettingsCommandHandler();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@id:topo.containerEngine',
        );
    });
});
