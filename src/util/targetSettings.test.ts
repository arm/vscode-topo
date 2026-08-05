import { WrappedError } from '../errors/wrappedError';
import { resolveSettingsForTarget, TargetSettings } from './targetSettings';

describe('resolveSettingsForTarget', () => {
    const target = 'topo.local';

    function expectInvalidTargetSettings(
        settingsByTarget: unknown,
        detail: string,
    ): void {
        expect(() =>
            resolveSettingsForTarget(target, settingsByTarget),
        ).toThrow(
            new WrappedError(
                'CONFIG',
                `Invalid topo.targetSettings entry for "topo.local": ${detail}`,
            ),
        );
    }

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

    it('throws a WrappedError with CONFIG tag when target settings are malformed', () => {
        expectInvalidTargetSettings(
            'not-an-object',
            'Expected an object, but received: "not-an-object"',
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
        expectInvalidTargetSettings(
            {
                [target]: 'not-an-object',
            },
            'At path: topo.local -- Expected an object, but received: "not-an-object"',
        );
    });

    it('throws when deploy settings are malformed', () => {
        expectInvalidTargetSettings(
            {
                [target]: {
                    deploy: 'not-an-object',
                },
            },
            'At path: topo.local.deploy -- Expected an object, but received: "not-an-object"',
        );
    });

    it('throws when deploy port is invalid', () => {
        expectInvalidTargetSettings(
            {
                [target]: {
                    deploy: {
                        port: 65536,
                    },
                },
            },
            'At path: topo.local.deploy.port -- Expected a integer less than or equal to 65535 but received `65536`',
        );
    });

    it('throws a clear error when a deploy boolean is invalid', () => {
        expectInvalidTargetSettings(
            {
                [target]: {
                    deploy: {
                        forceRecreate: 'yes',
                    },
                },
            },
            'At path: topo.local.deploy.forceRecreate -- Expected a value of type `boolean`, but received: `"yes"`',
        );
    });

    it('throws when deploy recreate options conflict', () => {
        expectInvalidTargetSettings(
            {
                [target]: {
                    deploy: {
                        forceRecreate: true,
                        noRecreate: true,
                    },
                },
            },
            'At path: topo.local.deploy -- `forceRecreate` and `noRecreate` cannot both be true.',
        );
    });

    it('throws a clear error for an unknown target setting', () => {
        expectInvalidTargetSettings(
            {
                [target]: {
                    test: {},
                },
            },
            'At path: topo.local.test -- Expected one of `"deploy"`, but received: "test"',
        );
    });

    it('throws when deploy settings contain an unknown field', () => {
        expectInvalidTargetSettings(
            {
                [target]: {
                    deploy: {
                        unknownField: true,
                    },
                },
            },
            'At path: topo.local.deploy.unknownField -- Expected one of `"port","forceRecreate","noRecreate"`, but received: "unknownField"',
        );
    });
});
