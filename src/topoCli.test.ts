import * as path from 'path';
import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import { ProjectDescription, TemplateDescription } from './util/types';
import { logger } from './util/logger';

jest.mock('child_process');
jest.mock('fs');
jest.mock('process');
jest.mock('./util/logger');

const execSyncMock = childProcess.execFileSync as jest.Mock;
const execMock = childProcess.execFile as unknown as jest.Mock;
const spawnMock = childProcess.spawn as unknown as jest.Mock;

describe('TopoCli', () => {
    const ext = '/fake/ext';
    const env = {} as vscode.EnvironmentVariableCollection;
    let cs: TopoCli;
    let origPlatform: string;

    beforeAll(() => {
        origPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });
    });
    afterAll(() => {
        Object.defineProperty(process, 'platform', { value: origPlatform });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        cs = new TopoCli(ext, env);
    });

    it('getBinaryPath builds correct path', () => {
        expect(cs.getBinaryPath()).toBe(path.join(ext, 'resources', 'topo-cli'));
    });

    it('getVersion parses stdout from version', () => {
        execSyncMock.mockReturnValue('1.2.3\n');
        const v = cs.getVersion();
        expect(execSyncMock).toHaveBeenCalledWith(
            path.join(ext, 'resources', 'topo-cli'), ['version'], { encoding: 'utf8' }
        );
        expect(v).toBe('1.2.3');
    });

    it('listTemplates parses JSON output', () => {
        const list: TemplateDescription[] = [{
            id: 't',
            url: 'u',
            subsystem: 'Host',
            ports: ["8080:80"],
        }];
        execSyncMock.mockReturnValue(JSON.stringify(list));
        expect(cs.listTemplates()).toEqual(list);
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
        expect(cs.getProject('p')).toEqual(list);
    });

    it('addService resolves promise on success', async () => {
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb(null, '', '');
        });
        await expect(cs.addService('c', 't', 's')).resolves.toBeUndefined();
        const expectedArgs = ['add-service', 'c', 't', 's'];
        expect(execMock).toHaveBeenCalledWith(cs.getBinaryPath(), expectedArgs, { "cwd": "." }, expect.any(Function));
    });

    it('addService rejects promise on error', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => cb(new Error('fail'), '', 'err')); 
        await expect(cs.addService('c', 't', 's')).rejects.toThrow('err');
    });

    it('removeService resolves promise on success', async () => {
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb(null, '', '');
        });
        await expect(cs.removeService('c', 's')).resolves.toBeUndefined();
        const expectedArgs = ['remove-service', 'c', 's'];
        expect(execMock).toHaveBeenCalledWith(cs.getBinaryPath(), expectedArgs, { "cwd": "." }, expect.any(Function));
    });

    it('removeService rejects promise on error', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => cb(new Error('fail'), '', 'err')); 
        await expect(cs.removeService('c', 's')).rejects.toThrow('err');
    });

    it('deploy resolves promise on success', async () => {
        const fakeChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, cb) => {
                if (event === 'close') {
                    cb(0);
                }
            }),
        };
        spawnMock.mockReturnValue(fakeChild);

        const deployRet = cs.deploy('c');

        await expect(deployRet.promise).resolves.toBeUndefined();
        const expectedArgs = ['deploy', 'c'];
        expect(childProcess.spawn).toHaveBeenCalledWith(
            cs.getBinaryPath(),
            expectedArgs,
            {
                cwd: path.dirname('c'),
                detached: true,
            }
        );
    });

    it('deploy rejects promise on error', async () => {
    // Simulate streaming child process with error
        const fakeChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, cb) => {
                if (event === 'close') {
                    cb(1);
                }
            }),
        };
        spawnMock.mockReturnValue(fakeChild);

        const deployRet = cs.deploy('c');

        await expect(deployRet.promise).rejects.toThrow('Deploy failed with exit code 1');
    });

    it('deploy streams stdout and stderr to logger', async () => {
        const fakeStdout = {
            on: jest.fn((event: string, cb: (data: string) => void) => {
                if (event === 'data') {
                    cb('out-data');
                }
            }),
        };
        const fakeStderr = {
            on: jest.fn((event: string, cb: (data: string) => void) => {
                if (event === 'data') {
                    cb('err-data');
                }
            }),
        };
        const fakeChild = {
            stdout: fakeStdout,
            stderr: fakeStderr,
            on: jest.fn((event: string, cb: (code: number) => void) => {
                if (event === 'close') {
                    cb(0);
                }
            }),
        };
        spawnMock.mockReturnValue(fakeChild);

        const deployRet = cs.deploy('c');

        await expect(deployRet.promise).resolves.toBeUndefined();

        expect(logger.show).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('out-data');
        expect(logger.error).toHaveBeenCalledWith('err-data');
    });

    it('deploy cancels and resolves when cancel is called', async () => {
        let closeCallback: ((code: number) => void) | undefined;
        const fakeChild = {
            pid: 12345,
            killed: false,
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event: string, cb: (code: number) => void) => {
                if (event === 'close') {
                    closeCallback = cb;
                }
            }),
        };
        spawnMock.mockReturnValue(fakeChild);

        const deployRet = cs.deploy('c');
        deployRet.cancel();
    //SIGKILL received by the child process
    closeCallback!(1);
    await expect(deployRet.promise).resolves.toBeUndefined();
    });

    it('initProject resolves promise on success', async () => {
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb(null, '', '');
        });
        await expect(cs.initProject('c', 'p')).resolves.toBeUndefined();
        const expectedArgs = ['init-project', 'c', 'p'];
        expect(execMock).toHaveBeenCalledWith(cs.getBinaryPath(), expectedArgs, { "cwd": "." }, expect.any(Function));
    });

    it('initProject rejects promise on error', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => cb(new Error('fail'), '', 'err')); 
        await expect(cs.initProject('c', 'p')).rejects.toThrow('err');
    });

    it('generateMakefile resolves promise on success', async () => {
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb(null, '', '');
        });
        await expect(cs.generateMakefile('c')).resolves.toBeUndefined();
        const expectedArgs = ['generate-makefile', 'c'];
        expect(execMock).toHaveBeenCalledWith(
            cs.getBinaryPath(),
            expectedArgs,
            { cwd: path.dirname('c') },
            expect.any(Function)
        );
    });

    it('generateMakefile rejects promise on error', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => cb(new Error('fail'), '', 'err'));
        await expect(cs.generateMakefile('c')).rejects.toThrow('err');
    });

    describe('getBinaryPath on Windows', () => {
        const base = path.join(ext, 'resources', 'topo-cli');
        let origPlatform: string;

        beforeAll(() => {
            origPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });
        });
        afterAll(() => {
            Object.defineProperty(process, 'platform', { value: origPlatform });
        });

        it('always returns the .exe variant on win32', () => {
            expect(cs.getBinaryPath()).toBe(base + '.exe');
        });
    });
});
