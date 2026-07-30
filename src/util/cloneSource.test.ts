import path from 'node:path';
import {
    buildCloneArguments,
    getDefaultProjectName,
    getDefaultProjectNameFromUrl,
    parseCloneSource,
} from './cloneSource';

describe('clone source', () => {
    describe('parseCloneSource', () => {
        it('parses explicit git and directory sources', () => {
            expect(
                parseCloneSource(
                    'git:https://example.com/virtual-bittermelon-peeler.git',
                ),
            ).toEqual({
                type: 'git',
                url: 'https://example.com/virtual-bittermelon-peeler.git',
            });
            expect(parseCloneSource('dir:/tmp/project')).toEqual({
                type: 'dir',
                path: '/tmp/project',
            });
        });

        it.each([
            'https://example.com/virtual-bittermelon-peeler.git',
            'ssh://example.com/virtual-bittermelon-peeler.git',
            'git@example.com:virtual-bittermelon-peeler.git',
        ])('keeps an untyped git source raw (%s)', (source) => {
            expect(parseCloneSource(source)).toEqual({ value: source });
        });

        it.each([
            ['not-a-valid-url', 'Invalid URL: not-a-valid-url'],
            ['foo:bar', 'Invalid type: foo'],
            ['archive:hello-world', 'Invalid type: archive'],
            [
                'invalid:https://example.com/repository.git',
                'Invalid type: invalid',
            ],
        ])('rejects invalid source %s', (source, message) => {
            expect(() => parseCloneSource(source)).toThrow(
                expect.objectContaining({ code: 'CLONE', message }),
            );
        });
    });

    describe('default project names', () => {
        it('gets the repository name from git URLs and strips refs', () => {
            expect(
                getDefaultProjectNameFromUrl(
                    'https://example.com/virtual-bittermelon-peeler.git#8303e66d',
                ),
            ).toBe('virtual-bittermelon-peeler');
            expect(
                getDefaultProjectNameFromUrl(
                    'git@example.com:owner/virtual-bittermelon-peeler.git#main',
                ),
            ).toBe('virtual-bittermelon-peeler');
        });

        it('gets the project name for every clone source type', () => {
            expect(
                getDefaultProjectName({
                    type: 'git',
                    url: 'https://example.com/project.git',
                }),
            ).toBe('project');
            expect(
                getDefaultProjectName({
                    value: 'https://example.com/raw-project.git',
                }),
            ).toBe('raw-project');
            expect(
                getDefaultProjectName({
                    type: 'dir',
                    path: path.join('/tmp', 'local-project'),
                }),
            ).toBe('local-project');
        });

        it('rejects URLs without a repository name', () => {
            expect(() =>
                getDefaultProjectNameFromUrl('not-a-valid-url'),
            ).toThrow(
                expect.objectContaining({
                    code: 'CLONE',
                    message: 'Invalid URL: not-a-valid-url',
                }),
            );
        });
    });

    describe('argument building', () => {
        it.each([
            [
                {
                    type: 'git' as const,
                    url: 'https://example.com/project.git',
                },
                'git:https://example.com/project.git',
            ],
            [
                {
                    type: 'dir' as const,
                    path: '/tmp/source-project',
                },
                'dir:/tmp/source-project',
            ],
            [
                {
                    value: 'https://example.com/project.git',
                },
                'https://example.com/project.git',
            ],
        ])('builds topo clone arguments for source %#', (source, argument) => {
            expect(buildCloneArguments(source, '/tmp/project')).toEqual([
                'clone',
                argument,
                '/tmp/project',
            ]);
        });

        it('builds topo clone arguments with arbitrary parameters', () => {
            expect(
                buildCloneArguments(
                    {
                        type: 'git',
                        url: 'https://example.com/project.git',
                    },
                    '/tmp/project',
                    {
                        model: 'some-huggingface-id',
                        ref: 'main',
                    },
                ),
            ).toEqual([
                'clone',
                'git:https://example.com/project.git',
                '/tmp/project',
                'model=some-huggingface-id',
                'ref=main',
            ]);
        });
    });
});
