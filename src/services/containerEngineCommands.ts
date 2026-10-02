import { Config } from './config';
import { ContainerCommands } from './containerCommands';
import { resolveContainerEngine } from '../util/resolveContainerEngine';

export class ContainerEngineCommands implements ContainerCommands {
    constructor(
        private readonly config: Config,
        private readonly dockerCommands: ContainerCommands,
        private readonly podmanCommands: ContainerCommands,
    ) {}

    public startContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        return this.getCommands().startContainer(
            containerId,
            targetSshConnection,
        );
    }

    public stopContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        return this.getCommands().stopContainer(
            containerId,
            targetSshConnection,
        );
    }

    public deleteContainer(
        containerId: string,
        targetSshConnection: string,
    ): Promise<void> {
        return this.getCommands().deleteContainer(
            containerId,
            targetSshConnection,
        );
    }

    public getAttachShellCommand(
        containerId: string,
        targetSshConnection: string,
    ): string[] {
        return this.getCommands().getAttachShellCommand(
            containerId,
            targetSshConnection,
        );
    }

    private getCommands(): ContainerCommands {
        const engine = resolveContainerEngine(
            this.config.getContainerEngineSetting(),
            process.env.TOPO_ENGINE,
        );
        return engine === 'podman' ? this.podmanCommands : this.dockerCommands;
    }
}
