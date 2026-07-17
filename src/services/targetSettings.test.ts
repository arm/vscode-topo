import * as vscode from 'vscode';
import { CONFIG_TARGET_SETTINGS } from '../manifest';
import {
    getSettingsForTarget,
    resolveSettingsForTarget,
    TargetSettings,
} from './targetSettings';
import { mock } from 'vitest-mock-extended';

describe('getSettingsForTarget', () => {
    const target = 'topo.local';

    it('reads target settings from workspace configuration', () => {
        const targetSettings: TargetSettings = {
            deploy: {
                port: 5003,
            },
        };
        const config = mock<vscode.WorkspaceConfiguration>({
            get: vi.fn().mockImplementation((key: string) => {
                if (key === CONFIG_TARGET_SETTINGS) {
                    return {
                        [target]: targetSettings,
                    };
                }
                return undefined;
            }),
        });
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config);

        const settings = getSettingsForTarget(target);

        expect(settings).toEqual(targetSettings);
    });
});

describe('resolveSettingsForTarget', () => {
    const target = 'topo.local';

    it('accepts undefined target settings', () => {
        const settings = resolveSettingsForTarget(target, undefined);

        expect(settings).toEqual({});
    });

    it('accepts empty target settings', () => {
        const settings = resolveSettingsForTarget(target, {
            [target]: {},
        });

        expect(settings).toEqual({});
    });

    it('throws when target settings are malformed', () => {
        expect(() => resolveSettingsForTarget(target, 'not-an-object')).toThrow(
            'Invalid topo.targetSettings entry for "topo.local": Expected an object, but received: "not-an-object"',
        );
    });

    it('returns validated deploy settings for the selected target', () => {
        const targetSettings: TargetSettings = {
            deploy: {
                port: 5003,
                forceRecreate: true,
                noRecreate: false,
            },
        };
        const settings = resolveSettingsForTarget(target, {
            [target]: targetSettings,
            ['other.local']: {
                deploy: {
                    port: '5004',
                    forceRecreate: 'yes',
                },
            },
        });

        expect(settings).toEqual(targetSettings);
    });

    it('throws when the target entry is malformed', () => {
        expect(() =>
            resolveSettingsForTarget(target, {
                [target]: 'not-an-object',
            }),
        ).toThrow(
            'Invalid topo.targetSettings entry for "topo.local": At path: topo.local -- Expected an object, but received: "not-an-object"',
        );
    });

    it('throws when deploy settings are malformed', () => {
        expect(() =>
            resolveSettingsForTarget(target, {
                [target]: {
                    deploy: 'not-an-object',
                },
            }),
        ).toThrow(
            'Invalid topo.targetSettings entry for "topo.local": At path: topo.local.deploy -- Expected an object, but received: "not-an-object"',
        );
    });

    it('throws when deploy port is invalid', () => {
        expect(() =>
            resolveSettingsForTarget(target, {
                [target]: {
                    deploy: {
                        port: 65536,
                    },
                },
            }),
        ).toThrow(
            'Invalid topo.targetSettings entry for "topo.local": At path: topo.local.deploy.port -- Expected a integer less than or equal to 65535 but received `65536`',
        );
    });

    it('throws when deploy recreate options conflict', () => {
        expect(() =>
            resolveSettingsForTarget(target, {
                [target]: {
                    deploy: {
                        forceRecreate: true,
                        noRecreate: true,
                    },
                },
            }),
        ).toThrow(
            'Invalid topo.targetSettings entry for "topo.local": At path: topo.local.deploy -- `forceRecreate` and `noRecreate` cannot both be true.',
        );
    });

    it('throws when deploy settings contain an unknown field', () => {
        expect(() =>
            resolveSettingsForTarget(target, {
                [target]: {
                    deploy: {
                        unknownField: true,
                    },
                },
            }),
        ).toThrow(
            'Invalid topo.targetSettings entry for "topo.local": At path: topo.local.deploy.unknownField -- Expected a value of type `never`, but received: `true`',
        );
    });
});
