import * as vscode from 'vscode';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TopoCli } from './topoCli';
import * as fs from 'fs';
import * as manifest from './manifest';
import { mock, MockProxy } from 'jest-mock-extended';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
}));
jest.mock('vscode');

describe('TopoCliVersionChecker', () => {
    let topoCli: MockProxy<TopoCli>;
    const extensionPath = '/fake/extension/path';
    const showError = jest.mocked(vscode.window.showErrorMessage);

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        jest.clearAllMocks();
    });

    it('returns true if versions match', () => {
        topoCli.getVersion.mockReturnValue({
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
        topoCli.getVersion.mockReturnValue({
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
        topoCli.getVersion.mockReturnValue({
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
