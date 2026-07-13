import * as path from 'node:path';
import * as vscode from 'vscode';
import { TopoCli, parseWrappedError, parseTopoLogEntries } from './topoCli';
import * as manifest from '../manifest';
import { WrappedError } from '../errors/wrappedError';
import { HealthReport, PsOutput, ProjectDescription } from './topoCliSchema';
import { TargetDescription } from '../util/types';
import { execFile } from '../util/exec';
import type { Mock } from 'vitest';

vi.mock('../util/exec', () => ({
    execFile: vi.fn(),
}));

const execFileMock: Mock = vi.mocked(execFile);
const defaultExecOptions = {
    encoding: 'utf8',
    env: {},
    windowsHide: true,
};

function errorWithStderr(stderr: string): Error & { stderr: string } {
    return Object.assign(new Error('Command failed'), { stderr });
}

describe('TopoCli', () => {
    const ext = '/fake/ext';
    const env = {} as vscode.EnvironmentVariableCollection;
    let topoCli: TopoCli;
    let origPlatform: string;
    let origEnv: NodeJS.ProcessEnv;

    beforeAll(() => {
        origPlatform = process.platform;
        origEnv = process.env;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env = {};
    });
    afterAll(() => {
        Object.defineProperty(process, 'platform', { value: origPlatform });
        process.env = origEnv;
    });

    beforeEach(() => {
        vi.resetAllMocks();
        topoCli = new TopoCli(ext, env);
    });

    it('getBinaryPath builds correct path', () => {
        expect(topoCli.getBinaryPath()).toBe(
            path.join(ext, 'resources', manifest.TOPO_CLI),
        );
    });

    it('getVersion parses stdout from version', async () => {
        execFileMock.mockResolvedValue({
            stdout: 'topo version 1.2.3 (commit: abcd)\n',
            stderr: '',
        });

        const version = await topoCli.getVersion();

        expect(execFileMock).toHaveBeenCalledWith(
            path.join(ext, 'resources', manifest.TOPO_CLI),
            ['--version'],
            defaultExecOptions,
        );
        expect(version).toEqual({
            version: '1.2.3',
            commit: 'abcd',
        });
    });

    it('listProjects parses JSON output', async () => {
        const list: ProjectDescription[] = [
            {
                name: 'p',
                url: 'u',
                features: [],
                description: 'project description',
                ref: 'r',
            },
        ];
        execFileMock.mockResolvedValue({
            stdout: JSON.stringify(list),
            stderr: '',
        });

        await expect(topoCli.listProjects('me@example.com')).resolves.toEqual(
            list,
        );
        expect(execFileMock).toHaveBeenCalledWith(
            path.join(ext, 'resources', manifest.TOPO_CLI),
            ['templates', '-o', 'json', '--target', 'me@example.com'],
            defaultExecOptions,
        );
    });

    it('listProjects omits --target when no ssh target is provided', async () => {
        const list: ProjectDescription[] = [
            {
                name: 'p',
                url: 'u',
                features: [],
                description: 'project description',
                ref: 'r',
            },
        ];
        execFileMock.mockResolvedValue({
            stdout: JSON.stringify(list),
            stderr: '',
        });

        await expect(topoCli.listProjects()).resolves.toEqual(list);
        expect(execFileMock).toHaveBeenCalledWith(
            path.join(ext, 'resources', manifest.TOPO_CLI),
            ['templates', '-o', 'json'],
            defaultExecOptions,
        );
    });

    it('listProjects throws error on invalid JSON output', async () => {
        execFileMock.mockResolvedValue({ stdout: 'invalid json', stderr: '' });

        await expect(topoCli.listProjects('me@example.com')).rejects.toThrow();
    });

    it('listProjects throws WrappedError when stderr contains structured log entries', async () => {
        const stderrOutput = [
            '{"time":"2026-04-16T15:14:48Z","level":"ERROR","msg":"collecting CPU info: \\"lscpu\\" not found"}',
            '{"time":"2026-04-16T15:14:49Z","level":"ERROR","msg":"connection lost"}',
        ].join('\n');
        const execError = errorWithStderr(stderrOutput);
        execFileMock.mockRejectedValue(execError);
        const expectedError = new WrappedError(
            'CLI',
            'collecting CPU info: "lscpu" not found; connection lost',
            [
                {
                    level: 'Error',
                    msg: 'collecting CPU info: "lscpu" not found',
                },
                { level: 'Error', msg: 'connection lost' },
            ],
            { cause: execError },
        );

        await expect(topoCli.listProjects('me@example.com')).rejects.toThrow(
            expectedError,
        );
    });

    it('listProjects rethrows original error when stderr has no structured log entries', async () => {
        const execError = errorWithStderr('plain error text');
        execFileMock.mockRejectedValue(execError);

        await expect(topoCli.listProjects()).rejects.toBe(execError);
    });

    it('listProjects rethrows original error when stderr contains only non-ERROR log entries', async () => {
        const stderrOutput =
            '{"time":"2026-04-16T15:00:00Z","level":"INFO","msg":"starting up"}';
        const execError = errorWithStderr(stderrOutput);
        execFileMock.mockRejectedValue(execError);

        await expect(topoCli.listProjects()).rejects.toBe(execError);
    });

    it('listProjects throws WrappedError with only ERROR messages when stderr has mixed log levels', async () => {
        const stderrOutput = [
            '{"time":"2026-04-16T15:00:00Z","level":"INFO","msg":"starting up"}',
            '{"time":"2026-04-16T15:00:01Z","level":"ERROR","msg":"disk full"}',
            '{"time":"2026-04-16T15:00:02Z","level":"WARN","msg":"retrying"}',
        ].join('\n');
        const execError = errorWithStderr(stderrOutput);
        execFileMock.mockRejectedValue(execError);
        const expectedError = new WrappedError('CLI', 'disk full', [
            { level: 'Info', msg: 'starting up' },
            { level: 'Error', msg: 'disk full' },
            { level: 'Warning', msg: 'retrying' },
        ]);

        await expect(topoCli.listProjects()).rejects.toThrow(expectedError);
    });

    it('describe resolves parsed JSON and runs topo describe with JSON output', async () => {
        const description: TargetDescription = {
            hostProcessors: [
                { model: 'Cortex-A55', cores: 2, features: ['fp'] },
            ],
            remoteProcessors: [{ name: 'imx-rproc' }],
            totalMemoryKb: 123456,
        };
        execFileMock.mockResolvedValue({
            stdout: JSON.stringify({
                hostProcessors: [
                    { model: ' Cortex-A55 ', cores: 2, features: [' fp '] },
                ],
                remoteProcessors: [{ name: ' imx-rproc ' }],
                totalMemoryKb: 123456,
            }),
            stderr: '',
        });

        const target = 'user@topo.local';

        await expect(topoCli.describe(target)).resolves.toEqual(description);

        expect(execFileMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['describe', '--target', target, '-o', 'json'],
            defaultExecOptions,
        );
    });

    it('describe rejects when topo describe fails', async () => {
        execFileMock.mockRejectedValue(new Error('fail'));

        await expect(topoCli.describe('user@topo.local')).rejects.toThrow(
            'fail',
        );
    });

    it('describe rejects when topo describe returns invalid JSON', async () => {
        execFileMock.mockResolvedValue({ stdout: 'not json', stderr: '' });

        await expect(topoCli.describe('user@topo.local')).rejects.toThrow(
            'Failed to parse target description JSON:',
        );
    });

    it('describe rejects when topo describe returns JSON that fails schema validation', async () => {
        execFileMock.mockResolvedValue({
            stdout: JSON.stringify({
                hostProcessors: [],
                remoteProcessors: [{ name: 1 }],
            }),
            stderr: '',
        });

        await expect(topoCli.describe('user@topo.local')).rejects.toThrow(
            'Invalid target description JSON:',
        );
    });

    it('init resolves promise on success', async () => {
        execFileMock.mockResolvedValue({ stdout: '', stderr: '' });
        const workspacePath = '/fake/workspace';

        await expect(topoCli.init(workspacePath)).resolves.toBeUndefined();

        expect(execFileMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['init'],
            { ...defaultExecOptions, cwd: workspacePath },
        );
    });

    it('init rejects promise on error', async () => {
        execFileMock.mockRejectedValue(new Error('fail'));

        await expect(topoCli.init('t')).rejects.toThrow('fail');
    });

    it('ps parses JSON output and runs topo ps in the project directory', async () => {
        const output: PsOutput = {
            containers: [
                {
                    id: '5c5f2d9b4a8f',
                    names: 'demo-linux-1',
                    image: 'ghcr.io/arm/topo-demo:latest',
                    status: 'Up 2 minutes',
                    state: 'running',
                    processingDomain: manifest.PRIMARY_PROCESSING_DOMAIN,
                    address: '192.0.2.10',
                },
                {
                    id: '7a56e7a56f01',
                    names: 'demo-rproc-1',
                    image: 'ghcr.io/arm/topo-rproc:latest',
                    status: 'Exited (0) 1 minute ago',
                    state: 'exited',
                    processingDomain: 'imx-rproc',
                    address: '',
                },
            ],
        };
        execFileMock.mockResolvedValue({
            stdout: JSON.stringify(output),
            stderr: '',
        });

        const target = 'user@topo.local';
        const projectPath = '/fake/workspace/demo';

        await expect(topoCli.ps(target, projectPath)).resolves.toEqual(output);
        expect(execFileMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['ps', '-a', '--target', target, '-o', 'json'],
            { ...defaultExecOptions, cwd: projectPath },
        );
    });

    it('ps rejects when topo ps fails', async () => {
        execFileMock.mockRejectedValue(new Error('fail'));

        await expect(topoCli.ps('hostname', '/fake/project')).rejects.toThrow(
            'fail',
        );
    });

    it('ps rejects when JSON output is invalid', async () => {
        execFileMock.mockResolvedValue({ stdout: 'invalid json', stderr: '' });

        await expect(topoCli.ps('hostname', '/fake/project')).rejects.toThrow();
    });

    it('ps rejects when JSON output fails schema validation', async () => {
        const output = {
            containers: [
                {
                    id: '5c5f2d9b4a8f',
                    names: 'demo-linux-1',
                    image: 'ghcr.io/arm/topo-demo:latest',
                    status: 'Up 2 minutes',
                    state: 'unknown',
                    processingDomain: manifest.PRIMARY_PROCESSING_DOMAIN,
                    address: '192.0.2.10',
                },
            ],
        };
        execFileMock.mockResolvedValue({
            stdout: JSON.stringify(output),
            stderr: '',
        });

        await expect(topoCli.ps('hostname', '/fake/project')).rejects.toThrow();
    });

    it('health parses JSON output', async () => {
        const want: HealthReport = {
            host: { dependencies: [] },
            target: {
                destination: 'ssh://hostname',
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
                processingDomainDriver: {
                    name: 'Processing Domain Driver (remoteproc)',
                    status: 'ok',
                    value: 'driver-x',
                },
            },
        };
        const cliResponse: HealthReport = {
            host: { dependencies: [] },
            target: {
                destination: 'ssh://hostname',
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
                processingDomainDriver: {
                    name: 'Processing Domain Driver (remoteproc)',
                    status: 'ok',
                    value: 'driver-x',
                },
            },
        };
        execFileMock.mockResolvedValue({
            stdout: JSON.stringify(cliResponse),
            stderr: '',
        });

        await expect(topoCli.health('hostname')).resolves.toMatchObject(want);
        expect(execFileMock).toHaveBeenCalledTimes(1);
        expect(execFileMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            [
                'health',
                '--skip-version-checks',
                '-o',
                'json',
                '--target',
                'hostname',
            ],
            defaultExecOptions,
        );
    });

    it('hostHealth omits --target', async () => {
        execFileMock.mockResolvedValue({
            stdout: JSON.stringify({ host: { dependencies: [] } }),
            stderr: '',
        });

        await topoCli.hostHealth();

        expect(execFileMock).toHaveBeenCalledTimes(1);
        expect(execFileMock).toHaveBeenCalledWith(
            topoCli.getBinaryPath(),
            ['health', '--skip-version-checks', '-o', 'json'],
            defaultExecOptions,
        );
    });

    it('assertVersion does not throw when versions match', async () => {
        execFileMock.mockResolvedValue({
            stdout: 'topo version 1.2.3 (commit: abcd)\n',
            stderr: '',
        });

        await expect(topoCli.assertVersion('1.2.3')).resolves.toBeUndefined();
    });

    it('assertVersion throws when versions mismatch', async () => {
        execFileMock.mockResolvedValue({
            stdout: 'topo version 1.2.3 (commit: abcd)\n',
            stderr: '',
        });

        await expect(topoCli.assertVersion('2.0.0')).rejects.toThrow(
            'version mismatch: found=1.2.3 expected=2.0.0',
        );
    });

    it('health throws error when JSON output is invalid', async () => {
        execFileMock.mockResolvedValue({ stdout: 'invalid json', stderr: '' });

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
        expect(result).toStrictEqual(
            new WrappedError('CLI', 'lscpu not found; connection lost', [
                { level: 'Error', msg: 'lscpu not found' },
                { level: 'Error', msg: 'connection lost' },
            ]),
        );
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
        expect(result).toStrictEqual(
            new WrappedError('CLI', 'disk full', [
                { level: 'Info', msg: 'starting up' },
                { level: 'Error', msg: 'disk full' },
                { level: 'Warning', msg: 'retrying' },
            ]),
        );
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

        expect(entries).toEqual([
            { level: 'Info', msg: 'starting' },
            { level: 'Error', msg: 'disk full' },
            { level: 'Error', msg: 'aborting' },
        ]);
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
