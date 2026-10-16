import { mock } from 'vitest-mock-extended';
import { ContainerCommands } from './containerCommands';
import { ContainerEngineCommands } from './containerEngineCommands';

describe('ContainerEngineCommands', () => {
    const docker = mock<ContainerCommands>();
    const podman = mock<ContainerCommands>();
    const commands = new ContainerEngineCommands(docker, podman);

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetAllMocks();
    });

    it('routes container actions using TOPO_ENGINE, defaulting to Docker', async () => {
        vi.stubEnv('TOPO_ENGINE', undefined);
        await commands.stopContainer('cid', 'target');

        expect(docker.stopContainer).toHaveBeenCalledWith('cid', 'target');

        vi.stubEnv('TOPO_ENGINE', 'podman');
        await commands.stopContainer('cid', 'target');

        expect(podman.stopContainer).toHaveBeenCalledWith('cid', 'target');
    });

    it('uses the environment engine for shells', () => {
        vi.stubEnv('TOPO_ENGINE', 'podman');
        podman.getAttachShellCommand.mockReturnValue(['podman', 'exec']);

        expect(commands.getAttachShellCommand('cid', 'target')).toEqual([
            'podman',
            'exec',
        ]);
    });
});
