import * as vscode from 'vscode';
import {
    boolean,
    create,
    defaulted,
    type,
    type Failure,
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
        (settings) => !(settings.forceRecreate && settings.noRecreate),
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

function getTargetSettingsValidationMessage(
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
        if (failure.path.length === 0) {
            throw new Error(
                `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS} entry: \`${CONFIG_TARGET_SETTINGS}\` must be an object.`,
            );
        }

        if (failure.path[0] === target && failure.path.length === 1) {
            throw new Error(
                `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS} entry for "${target}": The target entry must be an object.`,
            );
        }

        const validationMessage = getTargetSettingsValidationMessage(
            failure,
            target,
        );
        throw new Error(
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS}.${CONFIG_TARGET_SETTINGS_DEPLOY} entry for "${target}": ${validationMessage}`,
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
