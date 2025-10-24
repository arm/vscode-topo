import * as vscode from 'vscode';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TopoCli } from './topoCli';
import * as fs from 'fs';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
}));
jest.mock('vscode');

describe('TopoCliVersionChecker', () => {
    let topoCli: Pick<TopoCli, 'getVersion'>;
    const extensionPath = '/fake/extension/path';

    beforeEach(() => {
        topoCli = {
            getVersion: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('returns true if versions match', () => {
        (topoCli.getVersion as jest.Mock).mockReturnValue('1.2.3');
        (fs.readFileSync as jest.Mock).mockReturnValue(
            JSON.stringify({ 'topo': { version: '1.2.3' } })
        );
        const checker = new TopoCliVersionChecker(topoCli, extensionPath);
        const result = checker.checkTopoCliVersion();
        expect(result).toBe(true);
    });

    it('shows error and returns false if version mismatches', () => {
        (topoCli.getVersion as jest.Mock).mockReturnValue('1.2.3');
        (fs.readFileSync as jest.Mock).mockReturnValue(
            JSON.stringify({ 'topo': { version: '2.0.0' } })
        );
        const checker = new TopoCliVersionChecker(topoCli, extensionPath);
        const showError = vscode.window.showErrorMessage as jest.Mock;
        showError.mockClear();

        const result = checker.checkTopoCliVersion();

        expect(result).toBe(false);
        expect(showError).toHaveBeenCalledWith(
            expect.stringContaining('version mismatch')
        );
    });

    it('shows error and returns false if expected version missing', () => {
        (topoCli.getVersion as jest.Mock).mockReturnValue('1.2.3');
        (fs.readFileSync as jest.Mock).mockReturnValue('{}');
        const checker = new TopoCliVersionChecker(topoCli, extensionPath);
        const showError = vscode.window.showErrorMessage as jest.Mock;
        showError.mockClear();

        const result = checker.checkTopoCliVersion();

        expect(result).toBe(false);
        expect(showError).toHaveBeenCalledWith(
            expect.stringContaining('expected version not specified')
        );
    });
});
