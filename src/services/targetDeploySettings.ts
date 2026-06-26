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
type RawTargetDeploySettingsByTarget = Record<string, unknown>;
type TargetDeploySettingsKey = keyof TargetDeploySettings;

export interface DeployOptions {
    customRegistryPort?: string;
    forceRecreate?: boolean;
}

const defaultTargetDeploySettings: TargetDeploySettings = {
    port: '',
    forceRecreate: false,
};

const targetDeploySettingsKeys = new Set<TargetDeploySettingsKey>([
    'port',
    'forceRecreate',
]);

function isTargetDeploySettingsKey(
    key: string,
): key is TargetDeploySettingsKey {
    return targetDeploySettingsKeys.has(key as TargetDeploySettingsKey);
}

function isPortSetting(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }

    const trimmedPort = value.trim();
    if (!trimmedPort) {
        return true;
    }

    if (!/^[1-9][0-9]*$/.test(trimmedPort)) {
        return false;
    }

    const port = Number(trimmedPort);
    return port <= 65_535;
}

function isTargetDeploySettings(value: unknown): value is TargetDeploySettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const { port, forceRecreate } = value as Record<string, unknown>;
    return (
        Object.keys(value).every(isTargetDeploySettingsKey) &&
        (port === undefined || isPortSetting(port)) &&
        (forceRecreate === undefined || typeof forceRecreate === 'boolean')
    );
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

function getRawTargetDeploySettingsConfiguration(
    config: vscode.WorkspaceConfiguration,
): RawTargetDeploySettingsByTarget {
    const settings = config.get<unknown>(CONFIG_TARGET_DEPLOY_SETTINGS);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {};
    }

    return settings as RawTargetDeploySettingsByTarget;
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
    const currentSettings = getRawTargetDeploySettingsConfiguration(config);
    const targetNames = [...new Set(targets)].sort();
    const missingTarget = targetNames.find(
        (target) => currentSettings[target] === undefined,
    );
    if (!missingTarget) {
        return;
    }

    const nextSettings: RawTargetDeploySettingsByTarget = {
        ...currentSettings,
    };
    for (const target of targetNames) {
        nextSettings[target] = nextSettings[target] ?? {};
    }

    await config.update(
        CONFIG_TARGET_DEPLOY_SETTINGS,
        nextSettings,
        vscode.ConfigurationTarget.Global,
    );
}
