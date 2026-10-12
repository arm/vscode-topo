import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { Config } from './config';
import { TargetSettings } from '../util/targetSettings';

const getConfigurationMock = vi.fn();

describe('Config', () => {
    beforeEach(() => {
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
            mock<vscode.WorkspaceConfiguration>({
                get: getConfigurationMock,
            }),
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('reads the configured container engine', () => {
        getConfigurationMock.mockReturnValue('podman');

        expect(new Config().getContainerEngineSetting()).toBe('podman');
        expect(getConfigurationMock).toHaveBeenCalledWith(
            'containerEngine',
            'auto',
        );
    });

    it('updates an existing workspace engine setting', async () => {
        const configuration = vscode.workspace.getConfiguration('topo');
        vi.mocked(configuration.inspect).mockReturnValue({
            key: 'topo.containerEngine',
            workspaceValue: 'docker',
        });

        await new Config().setContainerEngine('auto');

        expect(configuration.update).toHaveBeenCalledWith(
            'containerEngine',
            'auto',
            vscode.ConfigurationTarget.Workspace,
        );
    });

    it('returns settings for the requested target', () => {
        const targetSettings: TargetSettings = {
            deploy: { port: 5000 },
        };
        getConfigurationMock.mockReturnValue({
            'topo.local': targetSettings,
        });

        const settings = new Config().getTargetSettings('topo.local');

        expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('topo');
        expect(getConfigurationMock).toHaveBeenCalledWith('targetSettings');
        expect(settings).toEqual(targetSettings);
    });

    it('returns empty settings when target settings are absent', () => {
        getConfigurationMock.mockReturnValue(undefined);

        const settings = new Config().getTargetSettings('topo.local');

        expect(settings).toEqual({});
    });
});
