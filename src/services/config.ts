import * as vscode from 'vscode';
import {
    CONFIG_CONTAINER_ENGINE,
    CONFIG_TARGET_SETTINGS,
    PACKAGE_NAME,
} from '../manifest';
import type { ContainerEngineSetting } from '../util/resolveContainerEngine';
import {
    resolveSettingsForTarget,
    TargetSettings,
} from '../util/targetSettings';

export class Config {
    public getContainerEngineSetting(): ContainerEngineSetting {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        return config.get<ContainerEngineSetting>(
            CONFIG_CONTAINER_ENGINE,
            'auto',
        );
    }

    public getTargetSettings(target: string): TargetSettings {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const settingsByTarget = config.get<unknown>(CONFIG_TARGET_SETTINGS);
        return resolveSettingsForTarget(target, settingsByTarget);
    }
}
