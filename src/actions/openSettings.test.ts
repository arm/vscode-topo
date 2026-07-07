import * as vscode from 'vscode';
import { OpenSettings, openSettings } from './openSettings';

describe('OpenSettings', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('opens the Topo extension settings from the command handler', async () => {
        const action = new OpenSettings();

        await action.openSettingsCommandHandler();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('opens the Topo extension settings', async () => {
        await openSettings();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });
});
