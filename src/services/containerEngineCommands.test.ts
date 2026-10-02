import { mock } from 'vitest-mock-extended';
import { Config } from './config';
import { ContainerCommands } from './containerCommands';
import { ContainerEngineCommands } from './containerEngineCommands';

describe('ContainerEngineCommands', () => {
    it('uses the current engine for container actions and shells', async () => {
        const config = mock<Config>();
        const docker = mock<ContainerCommands>();
        const podman = mock<ContainerCommands>();
        const commands = new ContainerEngineCommands(config, docker, podman);
        docker.getAttachShellCommand.mockReturnValue(['docker', 'exec']);
        podman.getAttachShellCommand.mockReturnValue(['podman', 'exec']);

        config.getContainerEngine.mockReturnValue('docker');
        await commands.stopContainer('cid', 'target');

        expect(docker.stopContainer).toHaveBeenCalledWith('cid', 'target');
        expect(commands.getAttachShellCommand('cid', 'target')).toEqual([
            'docker',
            'exec',
        ]);

        config.getContainerEngine.mockReturnValue('podman');
        await commands.stopContainer('cid', 'target');

        expect(podman.stopContainer).toHaveBeenCalledWith('cid', 'target');
        expect(commands.getAttachShellCommand('cid', 'target')).toEqual([
            'podman',
            'exec',
        ]);
    });
});
