import {
    boolean,
    type,
    integer,
    max,
    min,
    object,
    optional,
    refine,
    StructError,
    validate,
    Infer,
} from 'superstruct';
import { WrappedError } from '../errors/wrappedError';
import { CONFIG_TARGET_SETTINGS, PACKAGE_NAME } from '../manifest';

const targetDeploySettingsSchema = refine(
    object({
        port: optional(max(min(integer(), 1), 65_535)),
        forceRecreate: optional(boolean()),
        noRecreate: optional(boolean()),
    }),
    'recreateOptions',
    (settings) => {
        if (settings.forceRecreate && settings.noRecreate) {
            return '`forceRecreate` and `noRecreate` cannot both be true.';
        }
        return true;
    },
);
export type TargetDeploySettings = Infer<typeof targetDeploySettingsSchema>;

const targetSettingsSchema = object({
    deploy: optional(targetDeploySettingsSchema),
});
export type TargetSettings = Infer<typeof targetSettingsSchema>;

const supportedSettingsByPath: Readonly<Record<string, readonly string[]>> = {
    '': ['deploy'],
    deploy: ['port', 'forceRecreate', 'noRecreate'],
};

function formatTargetSettingsError(target: string, error: StructError): string {
    const settingPath = (
        error.path[0] === target ? error.path.slice(1) : error.path
    ).map(String);
    const setting = settingPath.join('.');

    if (error.type === 'never') {
        const parent = settingPath.slice(0, -1).join('.');
        const supported = supportedSettingsByPath[parent] ?? [];
        const supportedMessage = supported.length
            ? ` Supported settings: ${supported.map((key) => `"${key}"`).join(', ')}.`
            : '';
        return `Unknown setting "${setting}".${supportedMessage}`;
    }

    if (error.refinement === 'recreateOptions') {
        return error.failures()[0].message;
    }

    if (error.type === 'type' && error.path.length === 0) {
        return 'Target settings must be an object.';
    }

    if (error.type === 'object') {
        return setting
            ? `"${setting}" must be an object.`
            : `Settings for target "${target}" must be an object.`;
    }

    return error.message;
}

function getTargetSchema(target: string) {
    return optional(
        type({
            [target]: optional(targetSettingsSchema),
        }),
    );
}

export function resolveSettingsForTarget(
    target: string,
    settingsByTarget: unknown,
): TargetSettings {
    const [validationError, validSettingsByTarget] = validate(
        settingsByTarget ?? {},
        getTargetSchema(target),
    );
    if (validationError) {
        const detail = formatTargetSettingsError(target, validationError);
        throw new WrappedError(
            'CONFIG',
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS} entry for "${target}": ${detail}`,
            [],
            { cause: validationError },
        );
    }

    return validSettingsByTarget?.[target] ?? {};
}
