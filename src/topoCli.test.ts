import * as path from 'path';
import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { TopoCli, CloneRemoteSource, CloneLocalSource } from './topoCli';
import { ProjectDescription, TemplateDescription } from './util/types';
import * as manifest from './manifest';

jest.mock('child_process');
jest.mock('fs');
jest.mock('process');

const execSyncMock = childProcess.execFileSync as jest.Mock;
const execMock = childProcess.execFile as unknown as jest.Mock;

describe('TopoCli', () => {
    const ext = '/fake/ext';
    const env = {} as vscode.EnvironmentVariableCollection;
    let topoCli: TopoCli;
    let origPlatform: string;

    beforeAll(() => {
        origPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        jest.resetModules();
        process.env = {};
    });
    afterAll(() => {
        Object.defineProperty(process, 'platform', { value: origPlatform });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        topoCli = new TopoCli(ext, env);
    });

    it('getBinaryPath builds correct path', () => {
        expect(topoCli.getBinaryPath()).toBe(path.join(ext, 'resources', manifest.TOPO_CLI));
    });

    it('getVersion parses stdout from version', () => {
        execSyncMock.mockReturnValue('topo version 1.2.3 (commit: abcd)\n');
        const v = topoCli.getVersion();
        expect(execSyncMock).toHaveBeenCalledWith(
            path.join(ext, 'resources', manifest.TOPO_CLI), ['--version'], { encoding: 'utf8' }
        );
        expect(v).toEqual({
            version: '1.2.3',
            commit: 'abcd',
        });
    });

    it('listTemplates parses JSON output', () => {
        const list: TemplateDescription[] = [{
            id: 't',
            url: 'u',
            subsystem: 'Host',
            ports: ["8080:80"],
        }];
        execSyncMock.mockReturnValue(JSON.stringify(list));
        expect(topoCli.listTemplates()).toEqual(list);
    });

    it('getProject parses JSON output', () => {
        const list: ProjectDescription = {
            name: 'p',
            services: {
                text: {
                    build: {
                        context:'./test'
                    },
                    containerName: 'test-container'
                }
            }
        };
        execSyncMock.mockReturnValue(JSON.stringify(list));
        expect(topoCli.getProject('p')).toEqual(list);
    });

    it('init resolves promise on success', async () => {
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb(null, '', '');
        });
        const workspacePath = '/fake/workspace';
        await expect(topoCli.init(workspacePath)).resolves.toBeUndefined();
        const expectedArgs = ['init'];
        expect(execMock).toHaveBeenCalledWith(topoCli.getBinaryPath(), expectedArgs, { cwd: workspacePath, env: {} }, expect.any(Function));
    });

    it('init rejects promise on error', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => cb(new Error('fail'), '', 'err'));
        await expect(topoCli.init('t')).rejects.toThrow('err');
    });

    it('deploy spawns a child process and returns it', () => {
        const fakeProc = { pid: 1234 } as unknown as childProcess.ChildProcessWithoutNullStreams;
        (childProcess.spawn as jest.Mock).mockReturnValue(fakeProc);

        const result = topoCli.deploy('/fake/project');

        expect(childProcess.spawn).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['deploy'],
            { cwd: '/fake/project', env: expect.any(Object), detached: true }
        );
        expect(result).toBe(fakeProc);
    });

    it('deploy includes --target and sets env when ssh target provided', () => {
        const fakeProc = { pid: 4321 } as unknown as childProcess.ChildProcessWithoutNullStreams;
        (childProcess.spawn as jest.Mock).mockReturnValue(fakeProc);

        const result = topoCli.deploy('/fake/project', 'me@example.com');

        expect(childProcess.spawn).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['deploy', '--target', 'me@example.com'],
            { cwd: '/fake/project', env: expect.any(Object), detached: true }
        );
        expect(result).toBe(fakeProc);
    });

    it('builds clone command for git source', () => {
        const src: CloneRemoteSource = { type: 'git', url: 'https://example.com/repo.git' };

        const cmd = topoCli.getCloneCommand('/tmp/myproj', src);

        const expected = 'topo clone /tmp/myproj git:https://example.com/repo.git'.split(' ');
        expect(cmd).toEqual(expected);
    });

    it('builds clone command for local source', () => {
        const src: CloneLocalSource = { type: 'local', path: '/path/to/source' };

        const cmd = topoCli.getCloneCommand('myproject', src);

        const expected = 'topo clone myproject dir:/path/to/source'.split(' ');
        expect(cmd).toEqual(expected);
    });

    describe('getBinaryPath on Windows', () => {
        const topoCliPath = path.join(ext, 'resources', manifest.TOPO_CLI_WINDOWS);
        let origPlatform: string;

        beforeAll(() => {
            origPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });
        });
        afterAll(() => {
            Object.defineProperty(process, 'platform', { value: origPlatform });
        });

        it('always returns the .exe variant on win32', () => {
            expect(topoCli.getBinaryPath()).toBe(topoCliPath);
        });
    });
});
