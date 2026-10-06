import * as path from 'node:path';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import { topo } from '../../package.json';
import { Config } from './config';

const extensionPath = path.resolve(__dirname, '../..');
const topoCli = new TopoCli(
    extensionPath,
    {} as vscode.EnvironmentVariableCollection,
    new Config(),
);
const isWindowsCi = process.platform === 'win32' && process.env.CI === 'true';

beforeAll(() => {
    vi.stubEnv('TOPO_TARGET', undefined);
});

afterAll(() => {
    vi.unstubAllEnvs();
});

// The real `topo health localhost` integration path can take longer on
// Windows CI runners because it probes the local host environment.
vi.setConfig({ testTimeout: process.platform === 'win32' ? 60_000 : 15_000 });

describe('getVersion', () => {
    it('parses output', async () => {
        const version = await topoCli.getVersion();

        expect(version).toEqual(
            expect.objectContaining({
                version: topo.version,
                commit: expect.any(String),
            }),
        );
    });
});

describe('listProjects', () => {
    it('parses projects correctly', async () => {
        const projects = await topoCli.listProjects();

        expect(projects.length).toBeGreaterThan(0);
        for (const project of projects) {
            expect(project).toEqual(
                expect.objectContaining({
                    name: expect.any(String),
                    description: expect.any(String),
                    url: expect.any(String),
                    ref: expect.any(String),
                }),
            );

            expect(
                project.features === null || Array.isArray(project.features),
            ).toBe(true);
        }
    });
});

describe('health', () => {
    it.skipIf(isWindowsCi)(
        'parses host health check result correctly',
        async () => {
            const health = await topoCli.hostHealth();

            expect(health.capabilities.flatMap(({ checks }) => checks)).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ location: 'host' }),
                ]),
            );
        },
    );

    it('parses local target checks without requiring SSH connectivity or a driver', async () => {
        const health = await topoCli.health('localhost');
        const checks = health.capabilities.flatMap(({ checks }) => checks);

        expect(checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ location: 'host' }),
                expect.objectContaining({ location: 'target' }),
            ]),
        );
        expect(checks.some(({ name }) => name === 'Connectivity')).toBe(false);
    });

    it('succeeds when target is unreachable', async () => {
        const health = await topoCli.health('unreachable-target');

        expect(health.capabilities.flatMap(({ checks }) => checks)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Connectivity',
                    location: 'target',
                    status: 'error',
                }),
                expect.objectContaining({
                    location: 'target',
                    status: 'undetermined',
                }),
            ]),
        );
    });
});
