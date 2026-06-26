import * as vscode from 'vscode';
import { OpenTopoSettings, openTopoSettings } from './openTopoSettings';
import { TargetStore } from '../services/targetStore';
import { mock } from 'vitest-mock-extended';
import {
    CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS,
    CONFIG_TARGET_DEPLOY_SETTINGS,
} from '../manifest';

describe('OpenTopoSettings', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    function mockConfiguration(settings: Record<string, unknown> = {}) {
        const update = vi.fn();
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn((key: string) => settings[key]),
            update,
        } as unknown as vscode.WorkspaceConfiguration);
        return { update };
    }

    it('opens the Topo extension settings from the command handler', async () => {
        mockConfiguration();
        const targetStore = mock<TargetStore>();
        targetStore.getTargets.mockReturnValue(new Set(['root@192.0.2.1']));
        const action = new OpenTopoSettings(targetStore);

        await action.openTopoSettingsCommandHandler();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('opens the Topo extension settings', async () => {
        mockConfiguration();

        await openTopoSettings([]);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('adds cached target entries before opening settings', async () => {
        const { update } = mockConfiguration({
            [CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS]: {
                port: '6000',
                forceRecreate: true,
            },
            [CONFIG_TARGET_DEPLOY_SETTINGS]: {
                'root@192.0.2.1': {
                    port: '5000',
                    forceRecreate: true,
                },
            },
        });

        await openTopoSettings(['user@topo.local', 'root@192.0.2.1']);

        expect(update).toHaveBeenCalledWith(
            CONFIG_TARGET_DEPLOY_SETTINGS,
            {
                'root@192.0.2.1': {
                    port: '5000',
                    forceRecreate: true,
                },
                'user@topo.local': {
                    port: '6000',
                    forceRecreate: true,
                },
            },
            vscode.ConfigurationTarget.Global,
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('does not rewrite settings when all cached targets already have entries', async () => {
        const { update } = mockConfiguration({
            [CONFIG_TARGET_DEPLOY_SETTINGS]: {
                'root@192.0.2.1': {
                    port: '5000',
                    forceRecreate: true,
                },
            },
        });

        await openTopoSettings(['root@192.0.2.1']);

        expect(update).not.toHaveBeenCalled();
    });
});
