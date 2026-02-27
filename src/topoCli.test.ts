import * as path from 'path';
import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import {
    TopoCli,
    CloneRemoteSource,
    CloneLocalSource,
    targetDescriptionFileName,
} from './topoCli';
import { Mutable } from './util/types';
import * as manifest from './manifest';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { mock } from 'jest-mock-extended';
import {
    HealthCheckResult,
    ProjectDescription,
    TemplateDescription,
} from './topoCliSchema';

jest.mock('child_process');
jest.mock('fs');
jest.mock('process');

const execSyncMock = jest.mocked(childProcess.execFileSync);
const execMock = jest.mocked(childProcess.execFile);
const spawnMock = jest.mocked(childProcess.spawn);

describe('TopoCli', () => {
    const ext = '/fake/ext';
    const env = {} as vscode.EnvironmentVariableCollection;
    let topoCli: TopoCli;
    let origPlatform: string;
    let cp: Mutable<ChildProcessWithoutNullStreams>;

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
        cp = mock<ChildProcessWithoutNullStreams>();
    });

    it('getBinaryPath builds correct path', () => {
        expect(topoCli.getBinaryPath()).toBe(
            path.join(ext, 'resources', manifest.TOPO_CLI),
        );
    });

    it('getVersion parses stdout from version', () => {
        execSyncMock.mockReturnValue('topo version 1.2.3 (commit: abcd)\n');
        const v = topoCli.getVersion();
        expect(execSyncMock).toHaveBeenCalledWith(
            path.join(ext, 'resources', manifest.TOPO_CLI),
            ['--version'],
            { encoding: 'utf8' },
        );
        expect(v).toEqual({
            version: '1.2.3',
            commit: 'abcd',
        });
    });

    it('listTemplates parses JSON output', () => {
        const list: TemplateDescription[] = [
            {
                id: 't',
                url: 'u',
                features: [],
                description: 'catty template description',
                ref: 'r',
            },
        ];
        execSyncMock.mockReturnValue(JSON.stringify(list));
        expect(topoCli.listTemplates()).toEqual(list);
        expect(execSyncMock).toHaveBeenCalledWith(
            path.join(ext, 'resources', manifest.TOPO_CLI),
            ['templates', '-o', 'json'],
            { encoding: 'utf8' },
        );
    });

    it('listTemplates throws error on invalid JSON output', () => {
        execSyncMock.mockReturnValue('invalid json');

        expect(() => topoCli.listTemplates()).toThrow();
    });

    it('getProject parses JSON output', () => {
        const list: ProjectDescription = {
            name: 'p',
            services: {
                text: {
                    build: {
                        context: './test',
                    },
                    containerName: 'test-container',
                },
            },
        };
        execSyncMock.mockReturnValue(JSON.stringify(list));
        expect(topoCli.getProject('p')).toEqual(list);
    });

    it('getProject throws error on invalid JSON output', () => {
        execSyncMock.mockReturnValue('invalid json');

        expect(() => topoCli.getProject('p')).toThrow();
    });

    it('describe resolves and runs topo describe with --target in provided cwd', async () => {
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb!(null, '', '');
            return cp;
        });

        const outputDirectory = '/fake/workspace';
        const target = 'user@topo.local';

        await expect(topoCli.describe(outputDirectory, target)).resolves.toBe(
            path.join(outputDirectory, targetDescriptionFileName),
        );

        expect(execMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['describe', '--target', target],
            { cwd: outputDirectory, env: {} },
            expect.any(Function),
        );
    });

    it('describe rejects when topo describe fails', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => {
            cb!(new Error('fail'), '', 'err');
            return cp;
        });

        await expect(
            topoCli.describe('/tmp/out', 'user@topo.local'),
        ).rejects.toThrow('Failed to describe target: fail');
    });

    it('init resolves promise on success', async () => {
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb!(null, '', '');
            return cp;
        });
        const workspacePath = '/fake/workspace';
        await expect(topoCli.init(workspacePath)).resolves.toBeUndefined();
        const expectedArgs = ['init'];
        expect(execMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            expectedArgs,
            { cwd: workspacePath, env: {} },
            expect.any(Function),
        );
    });

    it('init rejects promise on error', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => {
            cb!(new Error('fail'), '', 'err');
            return cp;
        });
        await expect(topoCli.init('t')).rejects.toThrow('err');
    });

    it('deploy spawns a child process and returns it', () => {
        const fakeProc = mock<Mutable<ChildProcessWithoutNullStreams>>();
        fakeProc.pid = 1234;

        spawnMock.mockReturnValue(fakeProc);

        const result = topoCli.deploy('/fake/project');

        expect(childProcess.spawn).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['deploy'],
            { cwd: '/fake/project', env: expect.any(Object), detached: true },
        );
        expect(result).toBe(fakeProc);
    });

    it('deploy includes --target and sets env when ssh target provided', () => {
        const fakeProc = mock<Mutable<ChildProcessWithoutNullStreams>>();
        fakeProc.pid = 4321;

        spawnMock.mockReturnValue(fakeProc);

        const result = topoCli.deploy('/fake/project', 'me@example.com');

        expect(childProcess.spawn).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['deploy', '--target', 'me@example.com'],
            { cwd: '/fake/project', env: expect.any(Object), detached: true },
        );
        expect(result).toBe(fakeProc);
    });

    it('builds clone command for git source', () => {
        const src: CloneRemoteSource = {
            type: 'git',
            url: 'https://example.com/repo.git',
        };

        const cmd = topoCli.getCloneCommand('/tmp/myproj', src);

        const expected =
            'topo clone /tmp/myproj git:https://example.com/repo.git'.split(
                ' ',
            );
        expect(cmd).toEqual(expected);
    });

    it('builds clone command for local source', () => {
        const src: CloneLocalSource = {
            type: 'local',
            path: '/path/to/source',
        };

        const cmd = topoCli.getCloneCommand('myproject', src);

        const expected = 'topo clone myproject dir:/path/to/source'.split(' ');
        expect(cmd).toEqual(expected);
    });

    it('health parses JSON output', async () => {
        const want: HealthCheckResult = {
            Host: { Dependencies: [] },
            Target: {
                IsLocalHost: false,
                Dependencies: [
                    {
                        Name: 'Container Engine',
                        Healthy: true,
                        Value: 'docker',
                    },
                ],
                Connectivity: {
                    Name: 'Connected',
                    Healthy: true,
                    Value: '',
                },
                SubsystemDriver: {
                    Name: 'Subsystem Driver (remoteproc)',
                    Healthy: true,
                    Value: 'driver-x',
                },
            },
        };
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb!(null, JSON.stringify(want), '');
            return cp;
        });

        expect(topoCli.health('hostname')).resolves.toEqual(want);
        expect(execMock).toHaveBeenCalledTimes(1);
        expect(execMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['health', '--target', 'hostname', '-o', 'json'],
            expect.any(Object),
            expect.any(Function),
        );
    });

    it('health throws error when JSON output is invalid', async () => {
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb!(null, 'invalid json', '');
            return cp;
        });

        await expect(topoCli.health('hostname')).rejects.toThrow();
    });

    describe('getBinaryPath on Windows', () => {
        const topoCliPath = path.join(
            ext,
            'resources',
            manifest.TOPO_CLI_WINDOWS,
        );
        let origPlatform: string;

        beforeAll(() => {
            origPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });
        });
        afterAll(() => {
            Object.defineProperty(process, 'platform', {
                value: origPlatform,
            });
        });

        it('always returns the .exe variant on win32', () => {
            expect(topoCli.getBinaryPath()).toBe(topoCliPath);
        });
    });
});
