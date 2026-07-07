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
import { CONFIG_TARGET_DEPLOY_SETTINGS, PACKAGE_NAME } from '../manifest';

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
    (settings) =>
        !(settings.forceRecreate === true && settings.noRecreate === true),
);

export type TargetDeploySettings = Infer<typeof targetDeploySettingsSchema>;

export type TargetDeploySettingsByTarget = Record<string, TargetDeploySettings>;
type RawTargetDeploySettingsByTarget = Record<string, unknown>;

const defaultTargetDeploySettings: Required<TargetDeploySettings> = {
    port: '',
    forceRecreate: false,
    noRecreate: false,
};

function getRawTargetDeploySettingsConfiguration(
    config: vscode.WorkspaceConfiguration,
): RawTargetDeploySettingsByTarget {
    const settings = config.get<unknown>(CONFIG_TARGET_DEPLOY_SETTINGS);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {};
    }

    return settings as RawTargetDeploySettingsByTarget;
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
        return 'The target entry must be an object.';
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
    const settingsByTarget = getRawTargetDeploySettingsConfiguration(config);
    const targetSettings = settingsByTarget[target];
    if (targetSettings === undefined) {
        return defaultTargetDeploySettings;
    }

    const [validationError, validTargetSettings] = validate(
        targetSettings,
        targetDeploySettingsSchema,
    );
    if (validationError) {
        const validationMessage = getTargetDeploySettingsValidationMessage(
            validationError.failures()[0],
        );
        throw new Error(
            `Invalid ${PACKAGE_NAME}.${CONFIG_TARGET_DEPLOY_SETTINGS} entry for "${target}": ${validationMessage}`,
        );
    }

    return mergeTargetDeploySettings(
        defaultTargetDeploySettings,
        validTargetSettings,
    );
}
