import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { Config } from './config';

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

    it('returns settings for the requested target', () => {
        getConfigurationMock.mockReturnValue({
            'topo.local': {
                deploy: { port: 5000 },
            },
        });

        const settings = new Config().getTargetSettings('topo.local');

        expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('topo');
        expect(getConfigurationMock).toHaveBeenCalledWith('targetSettings');
        expect(settings).toEqual({ deploy: { port: 5000 } });
    });

    it('returns empty settings when target settings are absent', () => {
        getConfigurationMock.mockReturnValue(undefined);

        const settings = new Config().getTargetSettings('topo.local');

        expect(settings).toEqual({});
    });
});
