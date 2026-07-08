import * as vscode from 'vscode';
import {
    CONFIG_TARGET_SETTINGS,
    CONFIG_TARGET_SETTINGS_DEPLOY,
} from '../manifest';
import { getTargetDeploySettingsForTarget } from './targetDeploySettings';

describe('getTargetDeploySettingsForTarget', () => {
    const target = 'topo.local';

    function mockConfiguration(settings: Record<string, unknown>): void {
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn((key: string) => settings[key]),
        } as unknown as vscode.WorkspaceConfiguration);
    }

    function mockTargetSettings(
        settingsByTarget: Record<string, unknown>,
    ): void {
        mockConfiguration({
            [CONFIG_TARGET_SETTINGS]: settingsByTarget,
        });
    }

    function mockTargetDeploySettings(
        deploySettingsByTarget: Record<string, unknown>,
    ): void {
        const targetSettings = Object.fromEntries(
            Object.entries(deploySettingsByTarget).map(
                ([targetName, deploySettings]) => [
                    targetName,
                    {
                        [CONFIG_TARGET_SETTINGS_DEPLOY]: deploySettings,
                    },
                ],
            ),
        );

        mockTargetSettings(targetSettings);
    }

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('returns defaults when target settings are not configured', () => {
        mockConfiguration({});

        const settings = getTargetDeploySettingsForTarget(target);

        expect(settings).toEqual({
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('returns defaults when the target has no deploy settings', () => {
        mockTargetSettings({
            [target]: {},
        });

        const settings = getTargetDeploySettingsForTarget(target);

        expect(settings).toEqual({
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('returns validated deploy settings for the selected target', () => {
        mockTargetDeploySettings({
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

        const settings = getTargetDeploySettingsForTarget(target);

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: true,
            noRecreate: false,
        });
    });

    it('defaults missing deploy fields', () => {
        mockTargetDeploySettings({
            [target]: {
                port: 5003,
            },
        });

        const settings = getTargetDeploySettingsForTarget(target);

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('throws when the target entry is malformed', () => {
        mockTargetSettings({
            [target]: 'not-an-object',
        });

        expect(() => getTargetDeploySettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings entry for "topo.local": The target entry must be an object.',
        );
    });

    it('throws when deploy settings are malformed', () => {
        mockTargetDeploySettings({
            [target]: 'not-an-object',
        });

        expect(() => getTargetDeploySettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `deploy` must be an object.',
        );
    });

    it('throws when port is invalid', () => {
        mockTargetDeploySettings({
            [target]: {
                port: 65536,
            },
        });

        expect(() => getTargetDeploySettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `port` must be an integer from 1 to 65535.',
        );
    });

    it('throws when recreate options conflict', () => {
        mockTargetDeploySettings({
            [target]: {
                forceRecreate: true,
                noRecreate: true,
            },
        });

        expect(() => getTargetDeploySettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `forceRecreate` and `noRecreate` cannot both be true.',
        );
    });

    it('throws when deploy settings contain an unknown field', () => {
        mockTargetDeploySettings({
            [target]: {
                forceRecrate: true,
            },
        });

        expect(() => getTargetDeploySettingsForTarget(target)).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `forceRecrate` is not a supported setting. Use only `port`, `forceRecreate`, or `noRecreate`.',
        );
    });
});
