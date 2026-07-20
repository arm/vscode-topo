import * as vscode from 'vscode';
import { CONFIG_TARGET_SETTINGS, PACKAGE_NAME } from '../manifest';
import {
    resolveSettingsForTarget,
    TargetSettings,
} from '../util/targetSettings';

export class Config {
    public getTargetSettings(target: string): TargetSettings {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const settingsByTarget = config.get<unknown>(CONFIG_TARGET_SETTINGS);
        return resolveSettingsForTarget(target, settingsByTarget);
    }
}
