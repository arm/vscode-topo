import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { Config } from '../services/config';
import { SelectContainerEngine } from './selectContainerEngine';

describe('SelectContainerEngine', () => {
    const config = mock<Config>();
    const picker = vi.mocked(vscode.window.showQuickPick);
    const action = new SelectContainerEngine(config);

    beforeEach(() => {
        vi.stubEnv('TOPO_ENGINE', undefined);
        config.getContainerEngineSetting.mockReturnValue('docker');
        picker.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('shows the current setting and environment descriptions in the picker', async () => {
        config.getContainerEngineSetting.mockReturnValue('auto');
        vi.stubEnv('TOPO_ENGINE', 'podman');

        await action.selectContainerEngineCommandHandler();

        const [items] = picker.mock.calls[0];
        expect(await items).toMatchObject([
            {
                label: 'auto',
                description: 'Current',
                detail: 'TOPO_ENGINE env var (or docker if unset)',
            },
            {
                label: 'docker',
                detail: 'Override TOPO_ENGINE=podman',
            },
            { label: 'podman' },
        ]);
    });

    it('saves an explicitly selected engine', async () => {
        config.getContainerEngineSetting.mockReturnValue('auto');
        vi.stubEnv('TOPO_ENGINE', 'podman');
        picker.mockImplementationOnce(async (items) => (await items)[2]);

        await action.selectContainerEngineCommandHandler();

        expect(config.setContainerEngine).toHaveBeenCalledExactlyOnceWith(
            'podman',
        );
    });

    it('does not save a cancelled selection', async () => {
        await action.selectContainerEngineCommandHandler();

        expect(config.setContainerEngine).not.toHaveBeenCalled();
    });

    it('propagates a failed settings update', async () => {
        picker.mockImplementationOnce(async (items) => (await items)[2]);
        const error = new Error('Failed to update settings');
        config.setContainerEngine.mockRejectedValueOnce(error);

        await expect(action.selectContainerEngineCommandHandler()).rejects.toBe(
            error,
        );
    });
});
