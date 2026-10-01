import * as vscode from 'vscode';
import type { Result } from '../util/result';
import { CONFIG_TARGET_SETTINGS, PACKAGE_NAME } from '../manifest';
import {
    resolveSettingsForTarget,
    TargetSettings,
} from '../util/targetSettings';

export class Config {
    public getTargetSettings(target: string): Result<TargetSettings> {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const settingsByTarget = config.get<unknown>(CONFIG_TARGET_SETTINGS);
        return resolveSettingsForTarget(target, settingsByTarget);
    }
}
