import { mock } from 'vitest-mock-extended';
import { Config } from './config';
import { ContainerCommands } from './containerCommands';
import { ContainerEngineCommands } from './containerEngineCommands';

describe('ContainerEngineCommands', () => {
    const config = mock<Config>();
    const docker = mock<ContainerCommands>();
    const podman = mock<ContainerCommands>();
    const commands = new ContainerEngineCommands(config, docker, podman);

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetAllMocks();
    });

    it('routes container actions using the current setting', async () => {
        config.getContainerEngineSetting.mockReturnValue('docker');
        await commands.stopContainer('cid', 'target');

        expect(docker.stopContainer).toHaveBeenCalledWith('cid', 'target');

        config.getContainerEngineSetting.mockReturnValue('podman');
        await commands.stopContainer('cid', 'target');

        expect(podman.stopContainer).toHaveBeenCalledWith('cid', 'target');
    });

    it('uses the environment engine for shells in auto mode', () => {
        config.getContainerEngineSetting.mockReturnValue('auto');
        vi.stubEnv('TOPO_ENGINE', 'podman');
        podman.getAttachShellCommand.mockReturnValue(['podman', 'exec']);

        expect(commands.getAttachShellCommand('cid', 'target')).toEqual([
            'podman',
            'exec',
        ]);
    });
});
