import * as vscode from 'vscode';
import {
    CONFIG_TARGET_SETTINGS,
    CONFIG_TELEMETRY,
    PACKAGE_NAME,
} from '../manifest';
import {
    resolveSettingsForTarget,
    TargetSettings,
} from '../util/targetSettings';

export type TelemetrySetting = 'auto' | 'on' | 'off';

export class Config {
    public getTelemetry(): TelemetrySetting {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        return config.get<TelemetrySetting>(CONFIG_TELEMETRY) ?? 'auto';
    }

    public getTargetSettings(target: string): TargetSettings {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const settingsByTarget = config.get<unknown>(CONFIG_TARGET_SETTINGS);
        return resolveSettingsForTarget(target, settingsByTarget);
    }
}
