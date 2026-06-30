import * as path from 'node:path';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';

const extensionPath = path.resolve(__dirname, '../..');
const topoCli = new TopoCli(
    extensionPath,
    {} as vscode.EnvironmentVariableCollection,
);
const isWindowsCi = process.platform === 'win32' && process.env.CI === 'true';

// The real `topo health localhost` integration path can take longer on
// Windows CI runners because it probes the local host environment.
vi.setConfig({ testTimeout: process.platform === 'win32' ? 60_000 : 15_000 });

describe('getVersion', () => {
    it('parses output', async () => {
        const version = topoCli.getVersion();

        expect(version).toEqual(
            expect.objectContaining({
                version: expect.any(String),
                commit: expect.any(String),
            }),
        );
    });
});

describe('listTemplates', () => {
    it('parses templates correctly', () => {
        const templates = topoCli.listTemplates();

        expect(templates.length).toBeGreaterThan(0);
        for (const template of templates) {
            expect(template).toEqual(
                expect.objectContaining({
                    name: expect.any(String),
                    description: expect.any(String),
                    url: expect.any(String),
                    ref: expect.any(String),
                }),
            );

            expect(
                template.features === null || Array.isArray(template.features),
            ).toBe(true);
        }
    });
});

describe('health', () => {
    it.skipIf(isWindowsCi)(
        'parses host health check result correctly',
        async () => {
            const health = await topoCli.hostHealth();

            expect(health).toEqual({
                host: {
                    dependencies: expect.any(Array),
                },
            });
        },
    );

    it('parses target health check result correctly', async () => {
        const health = await topoCli.health('localhost');

        expect(health).toEqual({
            host: {
                dependencies: expect.any(Array),
            },
            target: expect.objectContaining({
                isLocalhost: true,
                dependencies: expect.any(Array),
                connectivity: expect.any(Object),
                processingDomainDriver: expect.any(Object),
            }),
        });
    });

    it('succeeds when target is unreachable', async () => {
        const health = await topoCli.health('unreachable-target');

        expect(health.target.connectivity.status).toBe('error');
    });
});
