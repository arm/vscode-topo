import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import * as vscode from 'vscode';
import { TopoCli, parseWrappedError, parseTopoLogEntries } from './topoCli';
import { Mutable } from './util/types';
import * as manifest from './manifest';
import { ChildProcessWithoutNullStreams } from 'node:child_process';
import { mock } from 'vitest-mock-extended';
import { Writable } from 'node:stream';
import { WrappedError } from './errors/wrappedError';
import {
    HealthCheckResult,
    ProjectDescription,
    TemplateDescription,
} from './topoCliSchema';
import { TargetDescription } from './util/types';

vi.mock('node:child_process');
vi.mock('node:fs');
vi.mock('node:process');

function errorWithStderr(stderr: string): Error & { stderr: string } {
    return Object.assign(new Error('Command failed'), { stderr });
}

const execSyncMock = vi.mocked(childProcess.execFileSync);
const execMock = vi.mocked(childProcess.execFile);

describe('TopoCli', () => {
    const ext = '/fake/ext';
    const env = {} as vscode.EnvironmentVariableCollection;
    let topoCli: TopoCli;
    let origPlatform: string;
    let cp: Mutable<ChildProcessWithoutNullStreams>;

    beforeAll(() => {
        origPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        vi.resetModules();
        process.env = {};
    });
    afterAll(() => {
        Object.defineProperty(process, 'platform', { value: origPlatform });
    });

    beforeEach(() => {
        vi.clearAllMocks();
        topoCli = new TopoCli(ext, env);
        cp = mock<ChildProcessWithoutNullStreams>();
        cp.stdin = mock<Writable>() as ChildProcessWithoutNullStreams['stdin'];
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
                name: 't',
                url: 'u',
                features: [],
                description: 'catty template description',
                ref: 'r',
            },
        ];
        execSyncMock.mockReturnValue(JSON.stringify(list));
        expect(topoCli.listTemplates('me@example.com')).toEqual(list);
        expect(execSyncMock).toHaveBeenCalledWith(
            path.join(ext, 'resources', manifest.TOPO_CLI),
            ['templates', '--target', 'me@example.com', '-o', 'json'],
            { encoding: 'utf8' },
        );
    });

    it('listTemplates omits --target when no ssh target is provided', () => {
        const list: TemplateDescription[] = [
            {
                name: 't',
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

        expect(() => topoCli.listTemplates('me@example.com')).toThrow();
    });

    it('listTemplates throws WrappedError when stderr contains structured log entries', () => {
        const stderrOutput = [
            '{"time":"2026-04-16T15:14:48Z","level":"ERROR","msg":"collecting CPU info: \\"lscpu\\" not found"}',
            '{"time":"2026-04-16T15:14:49Z","level":"ERROR","msg":"connection lost"}',
        ].join('\n');
        const execError = errorWithStderr(stderrOutput);
        execSyncMock.mockImplementation(() => {
            throw execError;
        });

        expect.assertions(6);
        try {
            topoCli.listTemplates('me@example.com');
        } catch (error) {
            expect(error).toBeInstanceOf(WrappedError);
            const cliError = error as WrappedError;
            expect(cliError.logs).toHaveLength(2);
            expect(cliError.logs[0].msg).toBe(
                'collecting CPU info: "lscpu" not found',
            );
            expect(cliError.logs[1].msg).toBe('connection lost');
            expect(cliError.message).toBe(
                'collecting CPU info: "lscpu" not found; connection lost',
            );
            expect(cliError.cause).toBe(execError);
        }
    });

    it('listTemplates rethrows original error when stderr has no structured log entries', () => {
        const execError = errorWithStderr('plain error text');
        execSyncMock.mockImplementation(() => {
            throw execError;
        });

        expect(() => topoCli.listTemplates()).toThrow(execError);
    });

    it('listTemplates rethrows original error when stderr contains only non-ERROR log entries', () => {
        const stderrOutput =
            '{"time":"2026-04-16T15:00:00Z","level":"INFO","msg":"starting up"}';
        const execError = errorWithStderr(stderrOutput);
        execSyncMock.mockImplementation(() => {
            throw execError;
        });

        expect(() => topoCli.listTemplates()).toThrow(execError);
    });

    it('listTemplates throws WrappedError with only ERROR messages when stderr has mixed log levels', () => {
        const stderrOutput = [
            '{"time":"2026-04-16T15:00:00Z","level":"INFO","msg":"starting up"}',
            '{"time":"2026-04-16T15:00:01Z","level":"ERROR","msg":"disk full"}',
            '{"time":"2026-04-16T15:00:02Z","level":"WARN","msg":"retrying"}',
        ].join('\n');
        const execError = errorWithStderr(stderrOutput);
        execSyncMock.mockImplementation(() => {
            throw execError;
        });

        expect.assertions(3);
        try {
            topoCli.listTemplates();
        } catch (error) {
            expect(error).toBeInstanceOf(WrappedError);
            const cliError = error as WrappedError;
            expect(cliError.logs).toHaveLength(3);
            expect(cliError.message).toBe('disk full');
        }
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

    it('describe resolves parsed JSON and runs topo describe with --output json', async () => {
        const description: TargetDescription = {
            hostProcessors: [
                { model: 'Cortex-A55', cores: 2, features: ['fp'] },
            ],
            remoteProcessors: [{ name: 'imx-rproc' }],
        };
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb!(
                null,
                JSON.stringify({
                    hostProcessors: [
                        { model: ' Cortex-A55 ', cores: 2, features: [' fp '] },
                    ],
                    remoteProcessors: [{ name: ' imx-rproc ' }],
                }),
                '',
            );
            return cp;
        });

        const target = 'user@topo.local';

        await expect(topoCli.describe(target)).resolves.toEqual(description);

        expect(execMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['describe', '--target', target, '--output', 'json'],
            { env: {} },
            expect.any(Function),
        );
    });

    it('describe rejects when topo describe fails', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => {
            cb!(new Error('fail'), '', 'err');
            return cp;
        });

        await expect(topoCli.describe('user@topo.local')).rejects.toThrow(
            'Failed to describe target: fail',
        );
    });

    it('describe rejects when topo describe returns invalid JSON', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => {
            cb!(null, 'not json', '');
            return cp;
        });

        await expect(topoCli.describe('user@topo.local')).rejects.toThrow(
            'Failed to parse target description JSON:',
        );
    });

    it('describe rejects when topo describe returns JSON that fails schema validation', async () => {
        execMock.mockImplementation((_bin, _args, _options, cb) => {
            cb!(
                null,
                JSON.stringify({
                    hostProcessors: [],
                    remoteProcessors: [{ name: 1 }],
                }),
                '',
            );
            return cp;
        });

        await expect(topoCli.describe('user@topo.local')).rejects.toThrow(
            'Invalid target description JSON:',
        );
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

    it('health parses JSON output', async () => {
        const want: HealthCheckResult = {
            host: { dependencies: [] },
            target: {
                isLocalhost: false,
                dependencies: [
                    {
                        name: 'Container Engine',
                        status: 'ok',
                        value: 'docker',
                    },
                ],
                connectivity: {
                    name: 'Connected',
                    status: 'ok',
                    value: '',
                },
                subsystemDriver: {
                    name: 'Subsystem Driver (remoteproc)',
                    status: 'ok',
                    value: 'driver-x',
                },
            },
        };
        const cliResponse: HealthCheckResult = {
            host: { dependencies: [] },
            target: {
                isLocalhost: false,
                dependencies: [
                    {
                        name: 'Container Engine',
                        status: 'ok',
                        value: 'docker',
                    },
                ],
                connectivity: {
                    name: 'Connected',
                    status: 'ok',
                    value: '',
                },
                subsystemDriver: {
                    name: 'Subsystem Driver (remoteproc)',
                    status: 'ok',
                    value: 'driver-x',
                },
            },
        };
        execMock.mockImplementation((_bin, _cargs, _options, cb) => {
            cb!(null, JSON.stringify(cliResponse), '');
            return cp;
        });

        await expect(topoCli.health('hostname')).resolves.toMatchObject(want);
        expect(execMock).toHaveBeenCalledTimes(1);
        expect(execMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            [
                'health',
                '--target',
                'hostname',
                '--skip-version-checks',
                '-o',
                'json',
            ],
            {
                env: {},
                windowsHide: true,
            },
            expect.any(Function),
        );
        expect(cp.stdin.end).toHaveBeenCalledTimes(1);
    });

    it('hostHealth omits --target', async () => {
        await topoCli.hostHealth();

        expect(execMock).toHaveBeenCalledTimes(1);
        expect(execMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['health', '--skip-version-checks', '-o', 'json'],
            {
                env: {},
                windowsHide: true,
            },
            expect.any(Function),
        );
        expect(cp.stdin.end).toHaveBeenCalledTimes(1);
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

describe('parseWrappedError', () => {
    it('returns error with parsed entries when stderr contains structured logs', () => {
        const stderr = [
            '{"time":"2026-04-16T15:14:48Z","level":"ERROR","msg":"lscpu not found"}',
            '{"time":"2026-04-16T15:14:49Z","level":"ERROR","msg":"connection lost"}',
        ].join('\n');
        const original = errorWithStderr(stderr);

        const result = parseWrappedError(original);

        expect(result).toBeInstanceOf(WrappedError);
        expect(result!.logs).toHaveLength(2);
        expect(result!.message).toBe('lscpu not found; connection lost');
        expect(result!.cause).toBe(original);
    });

    it('returns error with only ERROR messages when stderr has mixed levels', () => {
        const stderr = [
            '{"time":"2026-04-16T15:00:00Z","level":"INFO","msg":"starting up"}',
            '{"time":"2026-04-16T15:00:01Z","level":"ERROR","msg":"disk full"}',
            '{"time":"2026-04-16T15:00:02Z","level":"WARN","msg":"retrying"}',
        ].join('\n');
        const original = errorWithStderr(stderr);

        const result = parseWrappedError(original);

        expect(result).toBeInstanceOf(WrappedError);
        expect(result!.message).toBe('disk full');
        expect(result!.logs).toHaveLength(3);
    });

    it('returns undefined when stderr has only non-ERROR entries', () => {
        const stderr =
            '{"time":"2026-04-16T15:00:00Z","level":"INFO","msg":"starting up"}';
        const original = errorWithStderr(stderr);

        expect(parseWrappedError(original)).toBeUndefined();
    });

    it('returns undefined when stderr has no structured logs', () => {
        const original = errorWithStderr('plain error text');

        expect(parseWrappedError(original)).toBeUndefined();
    });

    it('returns undefined for plain error message', () => {
        expect(parseWrappedError(new Error('some message'))).toBeUndefined();
    });

    it('returns undefined for non-Error values', () => {
        expect(parseWrappedError('string error')).toBeUndefined();
    });
});

describe('parseTopoLogEntries', () => {
    it('parses a single structured log line', () => {
        const input =
            '{"time":"2026-04-16T15:14:48.476234895+01:00","level":"ERROR","msg":"collecting CPU info: \\"lscpu\\" not found on remote target\'s $PATH"}';

        const entries = parseTopoLogEntries(input);

        expect(entries).toEqual([
            {
                level: 'Error',
                msg: 'collecting CPU info: "lscpu" not found on remote target\'s $PATH',
            },
        ]);
    });

    it('parses multiple structured log lines', () => {
        const input = [
            '{"time":"2026-04-16T15:00:00Z","level":"INFO","msg":"starting"}',
            '{"time":"2026-04-16T15:00:01Z","level":"ERROR","msg":"disk full"}',
            '{"time":"2026-04-16T15:00:02Z","level":"ERROR","msg":"aborting"}',
        ].join('\n');

        const entries = parseTopoLogEntries(input);

        expect(entries).toHaveLength(3);
        expect(entries[0].level).toBe('Info');
        expect(entries[1].msg).toBe('disk full');
        expect(entries[2].msg).toBe('aborting');
    });

    it('skips non-JSON lines', () => {
        const input = [
            'some plain text',
            '{"time":"2026-04-16T15:00:00Z","level":"ERROR","msg":"real error"}',
            'another plain line',
        ].join('\n');

        const entries = parseTopoLogEntries(input);

        expect(entries).toEqual([
            {
                level: 'Error',
                msg: 'real error',
            },
        ]);
    });

    it('skips JSON objects missing required fields', () => {
        const input = [
            '{"time":"2026-04-16T15:00:00Z","level":"ERROR"}',
            '{"time":"2026-04-16T15:00:00Z","msg":"no level"}',
            '{"level":"ERROR","msg":"no time"}',
            '{"unrelated":"json"}',
        ].join('\n');

        const entries = parseTopoLogEntries(input);

        expect(entries).toEqual([]);
    });

    it('skips entries where fields are not strings', () => {
        const input = '{"time":123,"level":"ERROR","msg":"bad time"}';

        const entries = parseTopoLogEntries(input);

        expect(entries).toEqual([]);
    });

    it('returns empty array for empty input', () => {
        expect(parseTopoLogEntries('')).toEqual([]);
    });

    it('returns empty array for whitespace-only input', () => {
        expect(parseTopoLogEntries('  \n  \n  ')).toEqual([]);
    });

    it('ignores extra fields in log entries', () => {
        const input =
            '{"time":"2026-04-16T15:00:00Z","level":"ERROR","msg":"fail","extra":"data"}';

        const entries = parseTopoLogEntries(input);

        expect(entries).toEqual([{ level: 'Error', msg: 'fail' }]);
    });
});
