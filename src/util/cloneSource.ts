import path from 'node:path';
import { WrappedError } from '../errors/wrappedError';
import { type Result, success } from './result';

interface CloneRemoteSource {
    url: string;
    type: 'git';
}

interface CloneLocalSource {
    path: string;
    type: 'dir';
}

interface CloneRawSource {
    value: string;
    type?: never;
}

export type CloneSource = CloneRemoteSource | CloneLocalSource | CloneRawSource;

export type CloneParameters = Record<string, string>;

const isGitUrl = (source: string): boolean =>
    source.startsWith('git@') ||
    source.startsWith('ssh://') ||
    source.startsWith('https://') ||
    source.startsWith('http://') ||
    source.startsWith('git://');

export const parseCloneSource = (source: string): Result<CloneSource> => {
    if (isGitUrl(source)) {
        return success({ value: source });
    }

    const [sourceType, ...valueParts] = source.split(':');
    if (!sourceType || valueParts.length === 0) {
        return new WrappedError('CLONE', `Invalid URL: ${source}`);
    }
    const value = valueParts.join(':');

    switch (sourceType) {
        case 'dir':
            return success({ type: 'dir', path: value });
        case 'git':
            return success({ type: 'git', url: value });
        default:
            return new WrappedError('CLONE', `Invalid type: ${sourceType}`);
    }
};

export const getDefaultProjectNameFromUrl = (url: string): Result<string> => {
    let pathname: string;
    const [urlWithoutFragment] = url.split('#');
    // Support scp-like SSH URLs (e.g. git@host:owner/repo.git).
    const scpMatch = urlWithoutFragment.match(/^(?:[^@]+@)?[^:]+:(.+)$/);
    if (scpMatch) {
        pathname = scpMatch[1];
    } else {
        try {
            pathname = new URL(urlWithoutFragment).pathname;
        } catch {
            return new WrappedError('CLONE', `Invalid URL: ${url}`);
        }
    }

    const projectName = pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/\.git$/, '');
    if (!projectName) {
        return new WrappedError('CLONE', `Invalid URL: ${url}`);
    }
    return success(projectName);
};

export const getDefaultProjectName = (source: CloneSource): Result<string> => {
    switch (source.type) {
        case 'dir':
            return success(path.basename(source.path));
        case 'git':
            return getDefaultProjectNameFromUrl(source.url);
        case undefined:
            return getDefaultProjectNameFromUrl(source.value);
    }
};

const getCloneSourceArgument = (source: CloneSource): string => {
    switch (source.type) {
        case 'dir':
            return `dir:${source.path}`;
        case 'git':
            return `git:${source.url}`;
        case undefined:
            return source.value;
    }
};

export const buildCloneArguments = (
    source: CloneSource,
    repositoryPath: string,
    parameters: CloneParameters = {},
): string[] => [
    'clone',
    getCloneSourceArgument(source),
    repositoryPath,
    ...Object.entries(parameters).map(([key, value]) => `${key}=${value}`),
];
