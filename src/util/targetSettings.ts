import {
    boolean,
    type,
    integer,
    max,
    min,
    object,
    optional,
    refine,
    Struct,
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

type StructObjectSchema = Record<string, Struct>;

function isObjectSchema(value: unknown): value is StructObjectSchema {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every((child) => child instanceof Struct)
    );
}

function getSupportedSettings(parentPath: readonly string[]): string[] {
    let schema: unknown = targetSettingsSchema.schema;

    for (const key of parentPath) {
        if (!isObjectSchema(schema)) {
            return [];
        }

        const child = schema[key];
        if (!child) {
            return [];
        }

        schema = child.schema;
    }

    return isObjectSchema(schema) ? Object.keys(schema) : [];
}

function formatTargetSettingsError(target: string, error: StructError): string {
    if (error.type !== 'never') {
        return error.message;
    }

    const settingPath = (
        error.path[0] === target ? error.path.slice(1) : error.path
    ).map(String);
    const setting = settingPath.join('.');
    const parentPath = settingPath.slice(0, -1);
    const supported = getSupportedSettings(parentPath);
    const supportedMessage = supported.length
        ? ` Supported settings: ${supported.map((key) => `"${key}"`).join(', ')}.`
        : '';

    return `Unknown setting "${setting}".${supportedMessage}`;
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
