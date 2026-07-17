import * as vscode from 'vscode';
import { CONFIG_TARGET_SETTINGS } from '../manifest';
import {
    getSettingsForTarget,
    resolveSettingsForTarget,
} from './targetSettings';
import { mock } from 'vitest-mock-extended';

describe('getSettingsForTarget', () => {
    const target = 'topo.local';

    it('reads target settings from workspace configuration', () => {
        const config = mock<vscode.WorkspaceConfiguration>({
            get: vi.fn().mockImplementation((key: string) => {
                if (key === CONFIG_TARGET_SETTINGS) {
                    return {
                        [target]: {
                            deploy: {
                                port: 5003,
                            },
                        },
                    };
                }
                return undefined;
            }),
        });
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config);

        const settings = getSettingsForTarget(target);

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: false,
            noRecreate: false,
        });
    });
});

describe('resolveSettingsForTarget', () => {
    const target = 'topo.local';

    it('returns defaults when target settings are not configured', () => {
        const settings = resolveSettingsForTarget(target, undefined);

        expect(settings).toEqual({
            forceRecreate: false,
            noRecreate: false,
        });
    });

    it('throws when target settings are malformed', () => {
        expect(() => resolveSettingsForTarget(target, 'not-an-object')).toThrow(
            'Invalid topo.targetSettings.deploy entry for "topo.local": Expected an object, but received: "not-an-object"',
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
        const settings = resolveSettingsForTarget(target, {
            [target]: {
                deploy: {
                    port: 5003,
                    forceRecreate: true,
                    noRecreate: false,
                },
            },
            ['other.local']: {
                deploy: {
                    port: '5004',
                    forceRecreate: 'yes',
                },
            },
        });

        expect(settings).toEqual({
            port: 5003,
            forceRecreate: true,
            noRecreate: false,
        });
    });

    it('defaults missing deploy fields', () => {
        const settings = resolveSettingsForTarget(target, {
            [target]: {
                deploy: {
                    port: 5003,
                },
            },
        });

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
            'Invalid topo.targetSettings.deploy entry for "topo.local": Expected an object, but received: "not-an-object"',
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
            'Invalid topo.targetSettings.deploy entry for "topo.local": Expected an object, but received: "not-an-object"',
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
            'Invalid topo.targetSettings.deploy entry for "topo.local": Expected a integer less than or equal to 65535 but received `65536`',
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
            'Invalid topo.targetSettings.deploy entry for "topo.local": `forceRecreate` and `noRecreate` cannot both be true.',
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
            'Invalid topo.targetSettings.deploy entry for "topo.local": Expected a value of type `never`, but received: `true`',
        );
    });
});
