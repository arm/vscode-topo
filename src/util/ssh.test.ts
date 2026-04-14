import fs from 'fs';
import path from 'path';
import os from 'os';
import { getHosts } from './ssh';

let tmpDir: string;
let sshDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-test-'));
    sshDir = path.join(tmpDir, '.ssh');
    fs.mkdirSync(sshDir, { recursive: true });
    jest.spyOn(os, 'homedir').mockReturnValue(tmpDir);
});

afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeSSH(relativePath: string, lines: string[]): string {
    const fullPath = path.join(sshDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, lines.join('\n'));
    return fullPath;
}

describe('getHosts', () => {
    it('parses hosts from a single file', () => {
        const file = writeSSH('config', ['Host foo', 'Host bar']);

        expect(getHosts(file)).toEqual(['foo', 'bar']);
    });

    it('deduplicates hosts', () => {
        const file = writeSSH('config', ['Host foo', 'Host bar', 'Host foo']);

        expect(getHosts(file)).toEqual(['foo', 'bar']);
    });

    it('follows Include with a relative path', () => {
        writeSSH('extra.conf', ['Host from-include']);
        const file = writeSSH('config', ['Include extra.conf', 'Host main']);

        const hosts = getHosts(file).sort();

        expect(hosts).toEqual(['from-include', 'main']);
    });

    it('follows Include with an absolute path', () => {
        const includedPath = writeSSH('abs.conf', ['Host absolute']);
        const file = writeSSH('config', [
            `Include ${includedPath}`,
            'Host main',
        ]);

        const hosts = getHosts(file).sort();

        expect(hosts).toEqual(['absolute', 'main']);
    });

    it('follows Include with a glob pattern', () => {
        writeSSH('conf.d/a.conf', ['Host alpha']);
        writeSSH('conf.d/b.conf', ['Host beta']);
        const file = writeSSH('config', ['Include conf.d/*.conf', 'Host main']);

        const hosts = getHosts(file);

        expect(hosts).toEqual(['main', 'alpha', 'beta']);
    });

    it('does not visit the same file twice (cycle protection)', () => {
        const configPath = path.join(sshDir, 'config');
        writeSSH('config', ['Include config', 'Host solo']);

        expect(getHosts(configPath)).toEqual(['solo']);
    });

    it('skips non-existent included files gracefully', () => {
        const file = writeSSH('config', [
            'Include nonexistent.conf',
            'Host ok',
        ]);

        expect(getHosts(file)).toEqual(['ok']);
    });
});
