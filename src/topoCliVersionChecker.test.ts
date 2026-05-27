import * as vscode from 'vscode';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TopoCli } from './topoCli';
import * as fs from 'node:fs';
import * as manifest from './manifest';
import { mock, MockProxy } from 'vitest-mock-extended';

vi.mock('node:fs', () => ({
    readFileSync: vi.fn(),
}));

describe('TopoCliVersionChecker', () => {
    let topoCli: MockProxy<TopoCli>;
    const extensionPath = '/fake/extension/path';
    const showError = vi.mocked(vscode.window.showErrorMessage);

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        vi.clearAllMocks();
    });

    it('returns true if versions match', () => {
        topoCli.getVersion.mockReturnValue({
            version: '1.2.3',
            commit: 'abcd',
        });
        vi.mocked(fs.readFileSync).mockReturnValue(
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
        vi.mocked(fs.readFileSync).mockReturnValue(
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
        vi.mocked(fs.readFileSync).mockReturnValue('{}');
        const checker = new TopoCliVersionChecker(topoCli, extensionPath);

        const result = checker.checkTopoCliVersion();

        expect(result).toBe(false);
        expect(showError).toHaveBeenCalledWith(
            expect.stringContaining('expected version not specified'),
        );
    });

    it('handles v-prefixed versions in package.json', () => {
        topoCli.getVersion.mockReturnValue({
            version: '1.2.3',
            commit: 'abcd',
        });
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({ [manifest.TOPO_CLI]: { version: 'v1.2.3' } }),
        );
        const checker = new TopoCliVersionChecker(topoCli, extensionPath);

        const result = checker.checkTopoCliVersion();

        expect(result).toBe(true);
    });
});
