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

    it('returns the configured telemetry setting', () => {
        getConfigurationMock.mockReturnValue('off');

        expect(new Config().getTelemetry()).toBe('off');
        expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('topo');
        expect(getConfigurationMock).toHaveBeenCalledWith('telemetry');
    });

    it('defaults telemetry to auto when the setting is absent', () => {
        getConfigurationMock.mockReturnValue(undefined);

        expect(new Config().getTelemetry()).toBe('auto');
    });
});
