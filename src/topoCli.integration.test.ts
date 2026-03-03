import * as path from 'path';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import * as fs from 'fs';
import * as os from 'os';
import { ProjectDescription } from './topoCliSchema';

const extensionPath = path.resolve(__dirname, '..');
const topoCli = new TopoCli(
    extensionPath,
    {} as vscode.EnvironmentVariableCollection,
);

jest.setTimeout(15_000);

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
                    id: expect.any(String),
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
    it('parses health check result correctly', async () => {
        const health = await topoCli.health('localhost');

        expect(health).toEqual({
            Host: {
                Dependencies: expect.any(Array),
            },
            Target: expect.objectContaining({
                IsLocalhost: true,
                Dependencies: expect.any(Array),
                Connectivity: expect.any(Object),
                SubsystemDriver: expect.any(Object),
            }),
        });
    });

    it('fails when target is unreachable', async () => {
        await expect(topoCli.health('unreachable-host')).rejects.toThrow(
            'ssh probe failed',
        );
    });
});

describe('getProject', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'topo-test-'));

    function createTempFile(contents: string) {
        const dir = fs.mkdtempSync(path.join(tmpRoot, 'topo-compose-'));
        const filePath = path.join(dir, 'compose.yaml');
        fs.writeFileSync(filePath, contents, 'utf8');
        return filePath;
    }

    afterAll(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    const composeFiles: {
        name: string;
        content: string;
        expected: ProjectDescription;
    }[] = [
        {
            name: 'unnamed compose file',
            content: `
services:
  web:
    image: nginx
`,
            expected: {
                name: expect.any(String),
                services: {
                    web: {},
                },
            },
        },
        {
            name: 'named compose file',
            content: `
name: myproject
services:
  web:
    image: nginx
`,
            expected: {
                name: 'myproject',
                services: {
                    web: {},
                },
            },
        },
        {
            name: 'compose file with dockerfile_inline and dockerfile',
            content: `
name: myproject
services:
  base:
    build:
      dockerfile_inline: |
        FROM alpine
        RUN ...
  my-service:
    build:
      context: ./custom-context
      dockerfile: Dockerfile
`,
            expected: {
                name: 'myproject',
                services: {
                    base: {
                        build: {
                            context: '.',
                        },
                    },
                    'my-service': {
                        build: {
                            context: './custom-context',
                        },
                    },
                },
            },
        },
    ];

    it.each(composeFiles)('$name', (file) => {
        const composeFilepath = createTempFile(file.content);
        const project = topoCli.getProject(composeFilepath);

        expect(project).toMatchObject(file.expected);
    });
});
