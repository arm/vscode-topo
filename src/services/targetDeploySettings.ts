import * as vscode from 'vscode';
import {
    boolean,
    Infer,
    is,
    object,
    optional,
    refine,
    string,
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

const defaultTargetDeploySettings: Required<TargetDeploySettings> = {
    port: '',
    forceRecreate: false,
    noRecreate: false,
};

function isTargetDeploySettings(value: unknown): value is TargetDeploySettings {
    return is(value, targetDeploySettingsSchema);
}

function getTargetDeploySettingsConfiguration(
    config: vscode.WorkspaceConfiguration,
): TargetDeploySettingsByTarget {
    const settings = config.get<unknown>(CONFIG_TARGET_DEPLOY_SETTINGS);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(settings).filter(([, value]) =>
            isTargetDeploySettings(value),
        ),
    );
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
    const settingsByTarget = getTargetDeploySettingsConfiguration(config);
    return mergeTargetDeploySettings(
        defaultTargetDeploySettings,
        settingsByTarget[target],
    );
}
