import * as vscode from 'vscode';
import {
    CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS,
    CONFIG_TARGET_DEPLOY_SETTINGS,
    PACKAGE_NAME,
} from '../manifest';

export interface TargetDeploySettings {
    port?: string;
    forceRecreate?: boolean;
    noRecreate?: boolean;
}

export type TargetDeploySettingsByTarget = Record<string, TargetDeploySettings>;
type RawTargetDeploySettingsByTarget = Record<string, unknown>;
type RawTargetDeploySettings = Record<string, unknown>;
type TargetDeploySettingsKey = keyof TargetDeploySettings;

export interface DeployOptions {
    customRegistryPort?: string;
    forceRecreate?: boolean;
    noRecreate?: boolean;
}

const fallbackTargetDeploySettings: TargetDeploySettings = {
    port: '',
    forceRecreate: false,
    noRecreate: false,
};

const targetDeploySettingsKeys = new Set<TargetDeploySettingsKey>([
    'port',
    'forceRecreate',
    'noRecreate',
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

    const { port, forceRecreate, noRecreate } = value as Record<
        string,
        unknown
    >;
    return (
        Object.keys(value).every(isTargetDeploySettingsKey) &&
        (port === undefined || isPortSetting(port)) &&
        (forceRecreate === undefined || typeof forceRecreate === 'boolean') &&
        (noRecreate === undefined || typeof noRecreate === 'boolean') &&
        !(forceRecreate === true && noRecreate === true)
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

function getRawDefaultTargetDeploySettingsConfiguration(
    config: vscode.WorkspaceConfiguration,
): RawTargetDeploySettings {
    const settings = config.inspect<unknown>(
        CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS,
    )?.globalValue;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {};
    }

    return settings as RawTargetDeploySettings;
}

function toDeployOptions(settings: TargetDeploySettings): DeployOptions {
    const trimmedPort = settings.port?.trim();
    return {
        customRegistryPort: trimmedPort || undefined,
        forceRecreate: settings.forceRecreate,
        noRecreate: settings.noRecreate,
    };
}

function mergeTargetDeploySettings(
    defaultSettings: TargetDeploySettings,
    targetSettings: TargetDeploySettings | undefined,
): TargetDeploySettings {
    const hasTargetRecreateSettings =
        targetSettings?.forceRecreate !== undefined ||
        targetSettings?.noRecreate !== undefined;

    return {
        port: targetSettings?.port ?? defaultSettings.port,
        forceRecreate: hasTargetRecreateSettings
            ? (targetSettings.forceRecreate ?? false)
            : defaultSettings.forceRecreate,
        noRecreate: hasTargetRecreateSettings
            ? (targetSettings.noRecreate ?? false)
            : defaultSettings.noRecreate,
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
            fallbackTargetDeploySettings,
            configured,
        );
    }

    return fallbackTargetDeploySettings;
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

export async function ensureDefaultTargetDeploySettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    const currentSettings =
        getRawDefaultTargetDeploySettingsConfiguration(config);
    const nextSettings: RawTargetDeploySettings = {
        ...fallbackTargetDeploySettings,
        ...currentSettings,
    };

    const needsUpdate = Object.keys(fallbackTargetDeploySettings).some(
        (key) => currentSettings[key] === undefined,
    );
    if (!needsUpdate) {
        return;
    }

    await config.update(
        CONFIG_DEFAULT_TARGET_DEPLOY_SETTINGS,
        nextSettings,
        vscode.ConfigurationTarget.Global,
    );
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
