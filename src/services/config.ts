import * as vscode from 'vscode';
import { CONFIG_TARGET_SETTINGS, PACKAGE_NAME } from '../manifest';
import {
    resolveSettingsForTarget,
    TargetSettings,
} from '../util/targetSettings';

export class Config {
    private config = vscode.workspace.getConfiguration(PACKAGE_NAME);

    public getTargetSettings(target: string): TargetSettings {
        const settingsByTarget = this.config.get<unknown>(
            CONFIG_TARGET_SETTINGS,
        );
        return resolveSettingsForTarget(target, settingsByTarget);
    }
}
