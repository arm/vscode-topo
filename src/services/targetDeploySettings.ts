import * as vscode from 'vscode';
import {
    CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS,
    CONFIG_TARGET_DEPLOY_SETTINGS,
    PACKAGE_NAME,
} from '../manifest';

export interface TargetDeploySettings {
    port?: string;
    forceRecreate?: boolean;
}

export type TargetDeploySettingsByTarget = Record<string, TargetDeploySettings>;

export interface DeployOptions {
    customRegistryPort?: string;
    forceRecreate?: boolean;
}

const defaultTargetDeploySettings: TargetDeploySettings = {
    port: '',
    forceRecreate: false,
};

function isTargetDeploySettings(value: unknown): value is TargetDeploySettings {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function toDeployOptions(settings: TargetDeploySettings): DeployOptions {
    const trimmedPort = settings.port?.trim();
    return {
        customRegistryPort: trimmedPort || undefined,
        forceRecreate: settings.forceRecreate,
    };
}

function mergeTargetDeploySettings(
    defaultSettings: TargetDeploySettings,
    targetSettings: TargetDeploySettings | undefined,
): TargetDeploySettings {
    return {
        port: targetSettings?.port ?? defaultSettings.port,
        forceRecreate:
            targetSettings?.forceRecreate ?? defaultSettings.forceRecreate,
    };
}

function getDefaultTargetDeploySettings(
    config: vscode.WorkspaceConfiguration,
): TargetDeploySettings {
    const configured = config.get<unknown>(
        CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS,
    );
    if (isTargetDeploySettings(configured)) {
        return mergeTargetDeploySettings(
            defaultTargetDeploySettings,
            configured,
        );
    }

    return defaultTargetDeploySettings;
}

export function getDeployOptionsForTarget(target: string): DeployOptions {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const settingsByTarget = getTargetDeploySettingsConfiguration(config);
    const defaultSettings = getDefaultTargetDeploySettings(config);
    const settings = mergeTargetDeploySettings(
        defaultSettings,
        settingsByTarget[target],
    );

    return toDeployOptions(settings);
}

export async function ensureCachedTargetDeploySettings(
    targets: Iterable<string>,
): Promise<void> {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const currentSettings = getTargetDeploySettingsConfiguration(config);
    const defaultSettings = getDefaultTargetDeploySettings(config);
    const targetNames = [...new Set(targets)].sort();
    const missingTarget = targetNames.find(
        (target) => currentSettings[target] === undefined,
    );
    if (!missingTarget) {
        return;
    }

    const nextSettings: TargetDeploySettingsByTarget = { ...currentSettings };
    for (const target of targetNames) {
        nextSettings[target] = nextSettings[target] ?? {
            ...defaultSettings,
        };
    }

    await config.update(
        CONFIG_TARGET_DEPLOY_SETTINGS,
        nextSettings,
        vscode.ConfigurationTarget.Global,
    );
}
