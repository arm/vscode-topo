import * as vscode from 'vscode';
import { OpenTopoSettings, openTopoSettings } from './openTopoSettings';

describe('OpenTopoSettings', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('opens the Topo extension settings from the command handler', async () => {
        const action = new OpenTopoSettings();

        await action.openTopoSettingsCommandHandler();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('opens the Topo extension settings', async () => {
        await openTopoSettings();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });
});
