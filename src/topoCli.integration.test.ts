import * as path from 'path';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import * as fs from 'fs';
import * as os from 'os';
import { ProjectDescription } from './topoCliSchema';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'topo-integration-'));

const extensionPath = path.resolve(__dirname, '..');
const topoCli = new TopoCli(
    extensionPath,
    {} as vscode.EnvironmentVariableCollection,
);

// The real `topo health localhost` integration path can take longer on
// Windows CI runners because it probes the local host environment.
jest.setTimeout(process.platform === 'win32' ? 60_000 : 15_000);

afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

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
    it('parses health check result correctly', async () => {
        const health = await topoCli.health('localhost');

        expect(health).toEqual({
            host: {
                dependencies: expect.any(Array),
            },
            target: expect.objectContaining({
                isLocalhost: true,
                dependencies: expect.any(Array),
                connectivity: expect.any(Object),
                subsystemDriver: expect.any(Object),
            }),
        });
    });

    it('succeeds when target is unreachable', async () => {
        const health = await topoCli.health('unreachable-target');

        expect(health.target.connectivity.status).toBe('error');
    });
});

describe('listCandidateTargets', () => {
    function createSshConfig(content: string): string {
        const dir = fs.mkdtempSync(path.join(tmpRoot, 'ssh-config-'));
        const filePath = path.join(dir, 'config');
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
    }

    it('returns host entries from an SSH config file', () => {
        const configPath = createSshConfig(`
Host myserver
    HostName 192.168.1.100
    User root

Host dev-box
    HostName 10.0.0.5
    User admin
`);
        const hosts = topoCli.listCandidateTargets(configPath);

        expect(hosts).toContain('myserver');
        expect(hosts).toContain('dev-box');
    });

    it('returns an empty array for an empty SSH config', () => {
        const configPath = createSshConfig('');
        const hosts = topoCli.listCandidateTargets(configPath);

        expect(hosts).toEqual([]);
    });

    it('returns an empty array when the config file does not exist', () => {
        const hosts = topoCli.listCandidateTargets('/nonexistent/path/config');

        expect(hosts).toEqual([]);
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
