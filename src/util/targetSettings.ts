import {
    boolean,
    enums,
    type,
    integer,
    intersection,
    max,
    min,
    optional,
    record,
    refine,
    Struct,
    unknown,
    validate,
    Infer,
} from 'superstruct';
import { WrappedError } from '../errors/wrappedError';
import { CONFIG_TARGET_SETTINGS, PACKAGE_NAME } from '../manifest';

function withEnumeratedKeys<T, S extends object>(
    schema: Struct<T, S>,
): Struct<T, null> {
    const knownKeys = record(enums(Object.keys(schema.schema)), unknown());
    return intersection([schema, knownKeys]) as Struct<T, null>;
}

const targetDeploySettingsSchema = refine(
    withEnumeratedKeys(
        type({
            port: optional(max(min(integer(), 1), 65_535)),
            forceRecreate: optional(boolean()),
            noRecreate: optional(boolean()),
        }),
    ),
    'recreateOptions',
    (settings) => {
        if (settings.forceRecreate && settings.noRecreate) {
            return '`forceRecreate` and `noRecreate` cannot both be true.';
        }
        return true;
    },
);
export type TargetDeploySettings = Infer<typeof targetDeploySettingsSchema>;

const targetSettingsSchema = withEnumeratedKeys(
    type({
        deploy: optional(targetDeploySettingsSchema),
    }),
);
export type TargetSettings = Infer<typeof targetSettingsSchema>;

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
        throw new WrappedError(
            'CONFIG',
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS} entry for "${target}": ${validationError.message}`,
            [],
            { cause: validationError },
        );
    }

    return validSettingsByTarget?.[target] ?? {};
}
