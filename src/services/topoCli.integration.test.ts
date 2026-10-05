import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import { topo } from '../../package.json';

const extensionPath = path.resolve(__dirname, '../..');
const topoCli = new TopoCli(
    extensionPath,
    {} as vscode.EnvironmentVariableCollection,
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
        const versionResult = await topoCli.getVersion();
        assert(versionResult.kind === 'success');

        expect(versionResult.value).toEqual(
            expect.objectContaining({
                version: topo.version,
                commit: expect.any(String),
            }),
        );
    });
});

describe('listProjects', () => {
    it('parses projects correctly', async () => {
        const projectsResult = await topoCli.listProjects();
        assert(projectsResult.kind === 'success');

        expect(projectsResult.value.length).toBeGreaterThan(0);
        for (const project of projectsResult.value) {
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
            const healthResult = await topoCli.hostHealth();
            assert(healthResult.kind === 'success');

            expect(healthResult.value).toEqual({
                host: {
                    dependencies: expect.any(Array),
                },
            });
        },
    );

    it('parses target health check result correctly', async () => {
        const healthResult = await topoCli.health('localhost');
        assert(healthResult.kind === 'success');

        expect(healthResult.value).toEqual({
            host: {
                dependencies: expect.any(Array),
            },
            target: expect.objectContaining({
                isLocalhost: true,
                dependencies: expect.any(Array),
                processingDomainDriver: expect.any(Object),
            }),
        });
    });

    it('succeeds when target is unreachable', async () => {
        const healthResult = await topoCli.health('unreachable-target');
        assert(healthResult.kind === 'success');

        expect(healthResult.value.target).toMatchObject({
            isLocalhost: false,
            connectivity: { status: 'error' },
        });
    });
});
