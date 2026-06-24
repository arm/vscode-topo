import path from 'node:path';
import { withCommonExecutablePath } from './taskEnvironment';

function getPathValue(env: { [key: string]: string }): string {
    return env.PATH ?? env.Path ?? '';
}

describe('withCommonExecutablePath', () => {
    const originalPath = process.env.PATH;

    afterEach(() => {
        process.env.PATH = originalPath;
    });

    it('preserves existing PATH entries before adding common executable paths', () => {
        process.env.PATH = ['/custom/bin', '/usr/local/bin'].join(
            path.delimiter,
        );

        const env = withCommonExecutablePath();

        expect(getPathValue(env).split(path.delimiter).slice(0, 2)).toEqual([
            '/custom/bin',
            '/usr/local/bin',
        ]);
    });

    it('does not duplicate PATH entries', () => {
        process.env.PATH = ['/custom/bin', '/usr/local/bin'].join(
            path.delimiter,
        );

        const env = withCommonExecutablePath();
        const pathDirs = getPathValue(env).split(path.delimiter);

        expect(pathDirs.filter((dir) => dir === '/usr/local/bin')).toHaveLength(
            1,
        );
    });
});
