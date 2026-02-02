import * as vscode from 'vscode';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TopoCli } from './topoCli';
import * as fs from 'fs';
import * as manifest from './manifest';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
}));
jest.mock('vscode');

describe('TopoCliVersionChecker', () => {
    let topoCli: Pick<TopoCli, 'getVersion'>;
    const extensionPath = '/fake/extension/path';
    const showError = jest.mocked(vscode.window.showErrorMessage);

    beforeEach(() => {
        topoCli = {
            getVersion: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('returns true if versions match', () => {
        jest.mocked(topoCli.getVersion).mockReturnValue({
            version: '1.2.3',
            commit: 'abcd',
        });
        jest.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({ [manifest.TOPO_CLI]: { version: '1.2.3' } }),
        );
        const checker = new TopoCliVersionChecker(topoCli, extensionPath);
        const result = checker.checkTopoCliVersion();
        expect(result).toBe(true);
    });

    it('shows error and returns false if version mismatches', () => {
        jest.mocked(topoCli.getVersion).mockReturnValue({
            version: '1.2.3',
            commit: 'abcd',
        });
        jest.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({ [manifest.TOPO_CLI]: { version: '2.0.0' } }),
        );
        const checker = new TopoCliVersionChecker(topoCli, extensionPath);

        const result = checker.checkTopoCliVersion();

        expect(result).toBe(false);
        expect(showError).toHaveBeenCalledWith(
            expect.stringContaining('version mismatch'),
        );
    });

    it('shows error and returns false if expected version missing', () => {
        jest.mocked(topoCli.getVersion).mockReturnValue({
            version: '1.2.3',
            commit: 'abcd',
        });
        jest.mocked(fs.readFileSync).mockReturnValue('{}');
        const checker = new TopoCliVersionChecker(topoCli, extensionPath);

        const result = checker.checkTopoCliVersion();

        expect(result).toBe(false);
        expect(showError).toHaveBeenCalledWith(
            expect.stringContaining('expected version not specified'),
        );
    });
});
