import * as vscode from 'vscode';
import {
    CONFIG_CONTAINER_ENGINE,
    CONFIG_TARGET_SETTINGS,
    PACKAGE_NAME,
    type ContainerEngineSetting,
} from '../manifest';
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

    public async setContainerEngine(
        engine: ContainerEngineSetting,
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const target =
            config.inspect(CONFIG_CONTAINER_ENGINE)?.workspaceValue !==
            undefined
                ? vscode.ConfigurationTarget.Workspace
                : vscode.ConfigurationTarget.Global;
        await config.update(CONFIG_CONTAINER_ENGINE, engine, target);
    }

    public getTargetSettings(target: string): TargetSettings {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        const settingsByTarget = config.get<unknown>(CONFIG_TARGET_SETTINGS);
        return resolveSettingsForTarget(target, settingsByTarget);
    }
}
