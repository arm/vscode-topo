import * as vscode from 'vscode';
import {
    boolean,
    create,
    defaulted,
    type,
    type Failure,
    Infer,
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

const portSchema = max(min(integer(), 1), 65_535);

const targetDeploySettingsSchema = refine(
    object({
        port: optional(portSchema),
        forceRecreate: defaulted(optional(boolean()), false),
        noRecreate: defaulted(optional(boolean()), false),
    }),
    'recreateOptions',
    (settings) => !(settings.forceRecreate && settings.noRecreate),
);

export type TargetDeploySettings = Infer<typeof targetDeploySettingsSchema>;

type RawTargetSettingsByTarget = Record<string, unknown>;

function getRawTargetSettingsConfiguration(
    config: vscode.WorkspaceConfiguration,
): RawTargetSettingsByTarget {
    const settings = config.get<unknown>(CONFIG_TARGET_SETTINGS);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {};
    }

    return settings as RawTargetSettingsByTarget;
}

function getSettingPath(path: Failure['path']): string {
    return path.length > 0 ? path.join('.') : 'value';
}

function getDeploySettingsFailurePath(
    failure: Failure,
    target: string,
): Failure['path'] {
    if (
        failure.path[0] === target &&
        failure.path[1] === CONFIG_TARGET_SETTINGS_DEPLOY
    ) {
        return failure.path.slice(2);
    }
    return failure.path;
}

function getTargetDeploySettingsValidationMessage(
    failure: Failure,
    target: string,
): string {
    const deploySettingsFailurePath = getDeploySettingsFailurePath(
        failure,
        target,
    );
    const settingPath = getSettingPath(deploySettingsFailurePath);
    if (failure.refinement === 'recreateOptions') {
        return '`forceRecreate` and `noRecreate` cannot both be true.';
    }

    if (deploySettingsFailurePath[0] === 'port') {
        return '`port` must be an integer from 1 to 65535.';
    }

    if (failure.type === 'never') {
        return `\`${settingPath}\` is not a supported setting.`;
    }

    if (deploySettingsFailurePath.length === 0) {
        return '`deploy` must be an object.';
    }

    return `\`${settingPath}\` is invalid: ${failure.message}.`;
}

export function getTargetDeploySettingsForTarget(
    target: string,
): TargetDeploySettings {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const settingsByTarget = getRawTargetSettingsConfiguration(config);
    const guardSchema = optional(
        type({
            [target]: optional(
                object({
                    [CONFIG_TARGET_SETTINGS_DEPLOY]: optional(
                        targetDeploySettingsSchema,
                    ),
                }),
            ),
        }),
    );

    const [validationError, validSettingsByTarget] = validate(
        settingsByTarget,
        guardSchema,
        { coerce: true },
    );
    if (validationError) {
        const failure = validationError.failures()[0];
        if (failure.path[0] === target && failure.path.length === 1) {
            throw new Error(
                `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS} entry for "${target}": The target entry must be an object.`,
            );
        }

        const validationMessage = getTargetDeploySettingsValidationMessage(
            failure,
            target,
        );
        throw new Error(
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS}.${CONFIG_TARGET_SETTINGS_DEPLOY} entry for "${target}": ${validationMessage}`,
        );
    }

    return (
        validSettingsByTarget?.[target]?.[CONFIG_TARGET_SETTINGS_DEPLOY] ??
        create({}, targetDeploySettingsSchema)
    );
}
