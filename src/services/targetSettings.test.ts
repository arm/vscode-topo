import * as vscode from 'vscode';
import {
    CONFIG_TARGET_SETTINGS,
    CONFIG_TARGET_SETTINGS_DEPLOY,
} from '../manifest';
import {
    getSettingsForTarget,
    resolveSettingsForTarget,
} from './targetSettings';

describe('getSettingsForTarget', () => {
    const target = 'topo.local';

    function mockConfiguration(settings: Record<string, unknown>): void {
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn((key: string) => settings[key]),
        } as unknown as vscode.WorkspaceConfiguration);
    }

    function getTargetSettingsByTarget(
        settingsByTarget: Record<string, unknown>,
    ): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(settingsByTarget).map(
                ([targetName, deploySettings]) => [
                    targetName,
                    {
                        [CONFIG_TARGET_SETTINGS_DEPLOY]: deploySettings,
                    },
                ],
            ),
        );
    }

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('returns defaults when target settings are not configured', () => {
        const settings = resolveSettingsForTarget(target, undefined);

        expect(settings).toEqual({
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('reads target settings from workspace configuration', () => {
        mockConfiguration({
            [CONFIG_TARGET_SETTINGS]: getTargetSettingsByTarget({
                [target]: {
                    port: 5003,
                },
            }),
        });

        const settings = getSettingsForTarget(target);

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('throws when target settings are malformed', () => {
        expect(() => resolveSettingsForTarget(target, 'not-an-object')).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `deploy` must be an object.',
        );
    });

    it('returns defaults when the target has no deploy settings', () => {
        const settings = resolveSettingsForTarget(target, {
            [target]: {},
        });

        expect(settings).toEqual({
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('returns validated deploy settings for the selected target', () => {
        const settings = resolveSettingsForTarget(
            target,
            getTargetSettingsByTarget({
                [target]: {
                    port: 5003,
                    forceRecreate: true,
                    noRecreate: false,
                },
                'other.local': {
                    port: '5004',
                    forceRecreate: 'yes',
                },
            }),
        );

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: true,
            noRecreate: false,
        });
    });

    it('defaults missing deploy fields', () => {
        const settings = resolveSettingsForTarget(
            target,
            getTargetSettingsByTarget({
                [target]: {
                    port: 5003,
                },
            }),
        );

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('throws when the target entry is malformed', () => {
        expect(() =>
            resolveSettingsForTarget(target, {
                [target]: 'not-an-object',
            }),
        ).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `topo.local` is invalid: Expected an object, but received: "not-an-object".',
        );
    });

    it('throws when deploy settings are malformed', () => {
        expect(() =>
            resolveSettingsForTarget(
                target,
                getTargetSettingsByTarget({
                    [target]: 'not-an-object',
                }),
            ),
        ).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `deploy` must be an object.',
        );
    });

    it('throws when port is invalid', () => {
        expect(() =>
            resolveSettingsForTarget(
                target,
                getTargetSettingsByTarget({
                    [target]: {
                        port: 65536,
                    },
                }),
            ),
        ).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `port` must be an integer from 1 to 65535.',
        );
    });

    it('throws when recreate options conflict', () => {
        expect(() =>
            resolveSettingsForTarget(
                target,
                getTargetSettingsByTarget({
                    [target]: {
                        forceRecreate: true,
                        noRecreate: true,
                    },
                }),
            ),
        ).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `forceRecreate` and `noRecreate` cannot both be true.',
        );
    });

    it('throws when deploy settings contain an unknown field', () => {
        expect(() =>
            resolveSettingsForTarget(
                target,
                getTargetSettingsByTarget({
                    [target]: {
                        forceRecrate: true,
                    },
                }),
            ),
        ).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": `forceRecrate` is not a supported setting.',
        );
    });
});
