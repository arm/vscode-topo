import * as vscode from 'vscode';
import { OpenSettings, openSettings } from './openSettings';
import { TargetStore } from '../services/targetStore';
import { mock } from 'vitest-mock-extended';
import { CONFIG_TARGET_DEPLOY_SETTINGS } from '../manifest';

describe('OpenSettings', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    function mockConfiguration(
        settings: Record<string, unknown> = {},
        globalSettings: Record<string, unknown> = settings,
    ) {
        const update = vi.fn();
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn((key: string) => settings[key]),
            inspect: vi.fn((key: string) => ({
                globalValue: globalSettings[key],
            })),
            update,
        } as unknown as vscode.WorkspaceConfiguration);
        return { update };
    }

    it('opens the Topo extension settings from the command handler', async () => {
        mockConfiguration();
        const targetStore = mock<TargetStore>();
        targetStore.getTargets.mockReturnValue(new Set(['root@192.0.2.1']));
        const action = new OpenSettings(targetStore);

        await action.openSettingsCommandHandler();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('opens the Topo extension settings', async () => {
        mockConfiguration();

        await openSettings([]);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('adds cached target entries before opening settings', async () => {
        const { update } = mockConfiguration({
            [CONFIG_TARGET_DEPLOY_SETTINGS]: {
                'root@192.0.2.1': {
                    port: '5000',
                    forceRecreate: true,
                },
            },
        });

        await openSettings(['user@topo.local', 'root@192.0.2.1']);

        expect(update).toHaveBeenCalledWith(
            CONFIG_TARGET_DEPLOY_SETTINGS,
            {
                'root@192.0.2.1': {
                    port: '5000',
                    forceRecreate: true,
                },
                'user@topo.local': {},
            },
            vscode.ConfigurationTarget.Global,
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'workbench.action.openSettings',
            '@ext:arm.topo',
        );
    });

    it('preserves malformed target entries when adding cached target entries', async () => {
        const malformedSettings = {
            port: 5000,
            forceRecreate: 'yes',
        };
        const { update } = mockConfiguration({
            [CONFIG_TARGET_DEPLOY_SETTINGS]: {
                'root@192.0.2.1': malformedSettings,
            },
        });

        await openSettings(['user@topo.local', 'root@192.0.2.1']);

        expect(update).toHaveBeenCalledWith(
            CONFIG_TARGET_DEPLOY_SETTINGS,
            {
                'root@192.0.2.1': malformedSettings,
                'user@topo.local': {},
            },
            vscode.ConfigurationTarget.Global,
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

        await openSettings(['root@192.0.2.1']);

        expect(update).not.toHaveBeenCalled();
    });
});
