import * as path from 'path';
import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import { ProjectDescription, TemplateDescription } from './util/types';

jest.mock('child_process');
jest.mock('fs');
jest.mock('process');

const execSyncMock = childProcess.execFileSync as jest.Mock;
const execMock = childProcess.execFile as unknown as jest.Mock;

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
