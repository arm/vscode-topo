import * as vscode from 'vscode';
import {
    boolean,
    create,
    defaulted,
    type Failure,
    Infer,
    object,
    optional,
    pattern,
    refine,
    string,
    validate,
} from 'superstruct';
import {
    CONFIG_TARGET_SETTINGS,
    CONFIG_TARGET_SETTINGS_DEPLOY,
    PACKAGE_NAME,
} from '../manifest';

const portSchema = pattern(
    string(),
    /^\s*(?:|[1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])\s*$/,
);

const targetDeploySettingsSchema = refine(
    object({
        port: defaulted(optional(portSchema), ''),
        forceRecreate: defaulted(optional(boolean()), false),
        noRecreate: defaulted(optional(boolean()), false),
    }),
    'recreateOptions',
    (settings) => !(settings.forceRecreate && settings.noRecreate),
);

export type TargetDeploySettings = Infer<typeof targetDeploySettingsSchema>;

export type TargetDeploySettingsByTarget = Record<string, TargetDeploySettings>;
type RawTargetSettingsByTarget = Record<string, unknown>;
type RawTargetSettings = Record<string, unknown>;

function getRawTargetSettingsConfiguration(
    config: vscode.WorkspaceConfiguration,
): RawTargetSettingsByTarget {
    const settings = config.get<unknown>(CONFIG_TARGET_SETTINGS);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {};
    }

    return settings as RawTargetSettingsByTarget;
}

function getSettingPath(failure: Failure): string {
    return failure.path.length > 0 ? failure.path.join('.') : 'value';
}

function getTargetDeploySettingsValidationMessage(failure: Failure): string {
    const settingPath = getSettingPath(failure);
    if (failure.refinement === 'recreateOptions') {
        return '`forceRecreate` and `noRecreate` cannot both be true.';
    }

    if (failure.refinement === 'pattern' && failure.path[0] === 'port') {
        return '`port` must be empty or an integer from 1 to 65535.';
    }

    if (failure.type === 'never') {
        return `\`${settingPath}\` is not a supported setting. Use only \`port\`, \`forceRecreate\`, or \`noRecreate\`.`;
    }

    if (failure.path.length === 0) {
        return '`deploy` must be an object.';
    }

    return `\`${settingPath}\` is invalid: ${failure.message}.`;
}

export function getTargetDeploySettingsForTarget(
    target: string,
): TargetDeploySettings {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const settingsByTarget = getRawTargetSettingsConfiguration(config);
    const targetSettings = settingsByTarget[target];
    if (targetSettings === undefined) {
        return create({}, targetDeploySettingsSchema);
    }

    if (
        !targetSettings ||
        typeof targetSettings !== 'object' ||
        Array.isArray(targetSettings)
    ) {
        throw new Error(
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS} entry for "${target}": The target entry must be an object.`,
        );
    }

    const targetDeploySettings = (targetSettings as RawTargetSettings)[
        CONFIG_TARGET_SETTINGS_DEPLOY
    ];
    if (targetDeploySettings === undefined) {
        return create({}, targetDeploySettingsSchema);
    }

    const [validationError, validTargetSettings] = validate(
        targetDeploySettings,
        targetDeploySettingsSchema,
        { coerce: true },
    );
    if (validationError) {
        const validationMessage = getTargetDeploySettingsValidationMessage(
            validationError.failures()[0],
        );
        throw new Error(
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS}.${CONFIG_TARGET_SETTINGS_DEPLOY} entry for "${target}": ${validationMessage}`,
        );
    }

    return validTargetSettings;
}
