import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getHosts } from './ssh';

let tmpDir: string;
let sshDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-test-'));
    sshDir = path.join(tmpDir, '.ssh');
    fs.mkdirSync(sshDir, { recursive: true });
    vi.spyOn(os, 'homedir').mockReturnValue(tmpDir);
});

afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeSSH(relativePath: string, lines: string[]): string {
    const fullPath = path.join(sshDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, lines.join('\n'));
    return fullPath;
}

describe('getHosts', () => {
    it('parses hosts from a single file', async () => {
        const file = writeSSH('config', ['Host foo', 'Host bar']);

        const hosts = await getHosts(file);

        expect(hosts).toEqual(['foo', 'bar']);
    });

    it('deduplicates hosts', async () => {
        const file = writeSSH('config', ['Host foo', 'Host bar', 'Host foo']);

        const hosts = await getHosts(file);

        expect(hosts).toEqual(['foo', 'bar']);
    });

    it('follows Include with a relative path', async () => {
        writeSSH('extra.conf', ['Host from-include']);
        const file = writeSSH('config', ['Include extra.conf', 'Host main']);

        const hosts = await getHosts(file);

        expect(hosts).toEqual(['main', 'from-include']);
    });

    it('follows Include with an absolute path', async () => {
        const includedPath = writeSSH('abs.conf', ['Host absolute']);
        const file = writeSSH('config', [
            `Include ${includedPath}`,
            'Host main',
        ]);

        const hosts = await getHosts(file);

        expect(hosts).toEqual(['main', 'absolute']);
    });

    it('follows Include with a glob pattern', async () => {
        writeSSH('conf.d/a.conf', ['Host alpha']);
        writeSSH('conf.d/b.conf', ['Host beta']);
        const file = writeSSH('config', ['Include conf.d/*.conf', 'Host main']);

        const hosts = await getHosts(file);

        expect(hosts).toEqual(['main', 'alpha', 'beta']);
    });

    it('does not visit the same file twice (cycle protection)', async () => {
        const file = path.join(sshDir, 'config');
        writeSSH('config', ['Include config', 'Host solo']);

        const hosts = await getHosts(file);

        expect(hosts).toEqual(['solo']);
    });

    it('skips non-existent included files gracefully', async () => {
        const file = writeSSH('config', [
            'Include nonexistent.conf',
            'Host ok',
        ]);

        const hosts = await getHosts(file);

        expect(hosts).toEqual(['ok']);
    });

    it('ignores hosts containing wildcard characters', async () => {
        const file = writeSSH('config', [
            'Host *.co.uk',
            'Host 192.168.0.?',
            'Host !*.dialup.example.com',
            'Host ok',
            'Host !ok',
        ]);

        const hosts = await getHosts(file);

        expect(hosts).toEqual(['ok']);
    });
});
