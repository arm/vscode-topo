import {
    boolean,
    type,
    integer,
    max,
    min,
    object,
    optional,
    refine,
    validate,
    Infer,
} from 'superstruct';
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
        throw new Error(
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS} entry for "${target}": ${validationError.message}`,
            { cause: validationError },
        );
    }

    return validSettingsByTarget?.[target] ?? {};
}
