import * as vscode from 'vscode';
import {
    boolean,
    type Failure,
    Infer,
    object,
    optional,
    refine,
    string,
    validate,
} from 'superstruct';
import {
    CONFIG_TARGET_SETTINGS,
    CONFIG_TARGET_SETTINGS_DEPLOY,
    PACKAGE_NAME,
} from '../manifest';

const portSchema = refine(string(), 'port', (value) => {
    const trimmedPort = value.trim();
    if (!trimmedPort) {
        return true;
    }

    const port = Number(trimmedPort);
    return (
        Number.isInteger(port) &&
        String(port) === trimmedPort &&
        port >= 1 &&
        port <= 65_535
    );
});

const targetDeploySettingsSchema = refine(
    object({
        port: optional(portSchema),
        forceRecreate: optional(boolean()),
        noRecreate: optional(boolean()),
    }),
    'recreateOptions',
    (settings) => !(settings.forceRecreate && settings.noRecreate),
);

export type TargetDeploySettings = Infer<typeof targetDeploySettingsSchema>;

export type TargetDeploySettingsByTarget = Record<string, TargetDeploySettings>;
type RawTargetSettingsByTarget = Record<string, unknown>;
type RawTargetSettings = Record<string, unknown>;

const defaultTargetDeploySettings: Required<TargetDeploySettings> = {
    port: '',
    forceRecreate: false,
    noRecreate: false,
};

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

    if (failure.refinement === 'port') {
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

function mergeTargetDeploySettings(
    defaultSettings: TargetDeploySettings,
    targetSettings: TargetDeploySettings | undefined,
): TargetDeploySettings {
    return {
        ...defaultSettings,
        ...targetSettings,
    };
}

export function getTargetDeploySettingsForTarget(
    target: string,
): TargetDeploySettings {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const settingsByTarget = getRawTargetSettingsConfiguration(config);
    const targetSettings = settingsByTarget[target];
    if (targetSettings === undefined) {
        return defaultTargetDeploySettings;
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
        return defaultTargetDeploySettings;
    }

    const [validationError, validTargetSettings] = validate(
        targetDeploySettings,
        targetDeploySettingsSchema,
    );
    if (validationError) {
        const validationMessage = getTargetDeploySettingsValidationMessage(
            validationError.failures()[0],
        );
        throw new Error(
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_SETTINGS}.${CONFIG_TARGET_SETTINGS_DEPLOY} entry for "${target}": ${validationMessage}`,
        );
    }

    return mergeTargetDeploySettings(
        defaultTargetDeploySettings,
        validTargetSettings,
    );
}
