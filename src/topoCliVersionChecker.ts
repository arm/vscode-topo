import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import path from 'path';
import * as fs from 'fs';
import * as manifest from './manifest';

export class TopoCliVersionChecker {

    constructor(
        private readonly topoCli: Pick<TopoCli, 'getVersion'>,
    private readonly extensionPath: string,
    ) {
    }

    public checkTopoCliVersion(): boolean {
        try {
            this.verifyVersion();
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(
                `topo version check failed: ${message}`
            );
            return false;
        }
    }

    private getExpectedVersion(): string | undefined {
        const pkgPath = path.join(this.extensionPath, 'package.json');
        const text = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(text);
        return pkg[manifest.TOPO_CLI]?.version;
    }

    private verifyVersion(): void {
        const actual = this.topoCli.getVersion();
        const expected = this.getExpectedVersion();
        if (!expected) {
            throw new Error('expected version not specified in package.json');
        }
        if (actual !== expected) {
            throw new Error(`version mismatch: binary=${actual} expected=${expected}`);
        }
    }
}
