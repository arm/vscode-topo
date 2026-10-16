import * as vscode from 'vscode';
import { Config } from '../services/config';
import { CONTAINER_ENGINE_SETTINGS } from '../util/resolveContainerEngine';

export class SelectContainerEngine {
    constructor(private readonly config: Config) {}

    public async selectContainerEngineCommandHandler(): Promise<void> {
        const currentEngine = this.config.getContainerEngineSetting();
        const environmentEngine = process.env.TOPO_ENGINE?.trim();
        const selected = await vscode.window.showQuickPick(
            CONTAINER_ENGINE_SETTINGS.map((engine) => ({
                label: engine.charAt(0).toUpperCase() + engine.slice(1),
                description: engine === currentEngine ? '$(check)' : undefined,
                detail:
                    engine === 'auto'
                        ? 'TOPO_ENGINE env var (or docker if unset)'
                        : environmentEngine
                          ? `Override TOPO_ENGINE=${environmentEngine}`
                          : undefined,
                engine,
            })),
            { title: 'Select Container Engine' },
        );
        if (!selected || selected.engine === currentEngine) {
            return;
        }
        await this.config.setContainerEngine(selected.engine);
    }
}
