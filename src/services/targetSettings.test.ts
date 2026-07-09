import * as vscode from 'vscode';
import {
    CONFIG_TARGET_SETTINGS,
    CONFIG_TARGET_SETTINGS_DEPLOY,
} from '../manifest';
import { getSettingsForTarget } from './targetSettings';

describe('getSettingsForTarget', () => {
    const target = 'topo.local';

    function mockConfiguration(settings: Record<string, unknown>): void {
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn((key: string) => settings[key]),
        } as unknown as vscode.WorkspaceConfiguration);
    }

    function mockTargetSettingsByTarget(
        settingsByTarget: Record<string, unknown>,
    ): void {
        mockConfiguration({
            [CONFIG_TARGET_SETTINGS]: settingsByTarget,
        });
    }

    function mockTargetSettings(
        settingsByTarget: Record<string, unknown>,
    ): void {
        const targetSettings = Object.fromEntries(
            Object.entries(settingsByTarget).map(
                ([targetName, deploySettings]) => [
                    targetName,
                    {
                        [CONFIG_TARGET_SETTINGS_DEPLOY]: deploySettings,
                    },
                ],
            ),
        );

        mockTargetSettingsByTarget(targetSettings);
    }

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('returns defaults when target settings are not configured', () => {
        mockConfiguration({});

        const settings = getSettingsForTarget(target);

        expect(settings).toEqual({
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('throws when target settings are malformed', () => {
        mockConfiguration({
            [CONFIG_TARGET_SETTINGS]: 'not-an-object',
        });

        expect(() => getSettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings entry: `targetSettings` must be an object.',
        );
    });

    it('returns defaults when the target has no deploy settings', () => {
        mockTargetSettingsByTarget({
            [target]: {},
        });

        const settings = getSettingsForTarget(target);

        expect(settings).toEqual({
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('returns validated deploy settings for the selected target', () => {
        mockTargetSettings({
            [target]: {
                port: 5003,
                forceRecreate: true,
                noRecreate: false,
            },
            'other.local': {
                port: '5004',
                forceRecreate: 'yes',
            },
        });

        const settings = getSettingsForTarget(target);

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: true,
            noRecreate: false,
        });
    });

    it('defaults missing deploy fields', () => {
        mockTargetSettings({
            [target]: {
                port: 5003,
            },
        });

        const settings = getSettingsForTarget(target);

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('throws when the target entry is malformed', () => {
        mockTargetSettingsByTarget({
            [target]: 'not-an-object',
        });

        expect(() => getSettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings entry for "topo.local": The target entry must be an object.',
        );
    });

    it('throws when deploy settings are malformed', () => {
        mockTargetSettings({
            [target]: 'not-an-object',
        });

        expect(() => getSettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `deploy` must be an object.',
        );
    });

    it('throws when port is invalid', () => {
        mockTargetSettings({
            [target]: {
                port: 65536,
            },
        });

        expect(() => getSettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `port` must be an integer from 1 to 65535.',
        );
    });

    it('throws when recreate options conflict', () => {
        mockTargetSettings({
            [target]: {
                forceRecreate: true,
                noRecreate: true,
            },
        });

        expect(() => getSettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `forceRecreate` and `noRecreate` cannot both be true.',
        );
    });

    it('throws when deploy settings contain an unknown field', () => {
        mockTargetSettings({
            [target]: {
                forceRecrate: true,
            },
        });

        expect(() => getSettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `forceRecrate` is not a supported setting.',
        );
    });
});
