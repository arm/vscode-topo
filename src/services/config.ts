import * as vscode from 'vscode';
import {
    CONFIG_CONTAINER_ENGINE,
    CONFIG_TARGET_SETTINGS,
    PACKAGE_NAME,
    type ContainerEngine,
} from '../manifest';
import {
    resolveSettingsForTarget,
    TargetSettings,
} from '../util/targetSettings';

export class Config {
    public getContainerEngine(): ContainerEngine {
        const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
        return config.get<ContainerEngine>(CONFIG_CONTAINER_ENGINE) === 'podman'
            ? 'podman'
            : 'docker';
    }

    public async setContainerEngine(engine: ContainerEngine): Promise<void> {
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
