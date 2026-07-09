import * as vscode from 'vscode';
import {
    boolean,
    create,
    defaulted,
    type,
    integer,
    max,
    min,
    object,
    optional,
    refine,
    validate,
} from 'superstruct';
import {
    CONFIG_TARGET_SETTINGS,
    CONFIG_TARGET_SETTINGS_DEPLOY,
    PACKAGE_NAME,
} from '../manifest';

export type TargetSettings = {
    port?: number;
    forceRecreate?: boolean;
    noRecreate?: boolean;
};

function getTargetDeploySchema() {
    return refine(
        object({
            port: optional(max(min(integer(), 1), 65_535)),
            forceRecreate: defaulted(optional(boolean()), false),
            noRecreate: defaulted(optional(boolean()), false),
        }),
        'recreateOptions',
        (settings) => {
            if (settings.forceRecreate && settings.noRecreate) {
                return '`forceRecreate` and `noRecreate` cannot both be true.';
            }
            return true;
        },
    );
}

function getTargetSchema(target: string) {
    return optional(
        type({
            [target]: optional(
                object({
                    [CONFIG_TARGET_SETTINGS_DEPLOY]: optional(
                        getTargetDeploySchema(),
                    ),
                }),
            ),
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
        { coerce: true },
    );
    if (validationError) {
        const failure = validationError.failures()[0];
        throw new Error(
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS}.${CONFIG_TARGET_SETTINGS_DEPLOY} entry for "${target}": ${failure.message}`,
            { cause: validationError },
        );
    }

    return (
        validSettingsByTarget?.[target]?.[CONFIG_TARGET_SETTINGS_DEPLOY] ??
        create({}, getTargetDeploySchema())
    );
}

export function getSettingsForTarget(target: string): TargetSettings {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    return resolveSettingsForTarget(
        target,
        config.get<unknown>(CONFIG_TARGET_SETTINGS),
    );
}
