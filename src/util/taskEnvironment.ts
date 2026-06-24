import os from 'node:os';
import path from 'node:path';
import type * as vscode from 'vscode';

type TaskEnvironment = NonNullable<vscode.ProcessExecutionOptions['env']>;

const COMMON_POSIX_EXECUTABLE_DIRS = [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
];

function getPathKey(env: NodeJS.ProcessEnv): string {
    if (process.platform !== 'win32') {
        return 'PATH';
    }

    return (
        Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'Path'
    );
}

function getCommonExecutableDirs(): string[] {
    if (process.platform === 'win32') {
        return [];
    }

    const dirs = [...COMMON_POSIX_EXECUTABLE_DIRS];
    if (process.platform === 'darwin') {
        dirs.push(
            '/opt/homebrew/bin',
            '/Applications/Docker.app/Contents/Resources/bin',
            path.join(os.homedir(), '.docker', 'bin'),
        );
    }
    return dirs;
}

function appendUniquePathDirs(basePath: string, dirs: string[]): string {
    const seen = new Set<string>();
    const pathDirs = basePath
        .split(path.delimiter)
        .filter((dir) => dir.length > 0);
    const allDirs = [...pathDirs, ...dirs];
    const uniqueDirs = allDirs.filter((dir) => {
        if (seen.has(dir)) {
            return false;
        }
        seen.add(dir);
        return true;
    });
    return uniqueDirs.join(path.delimiter);
}

export function withCommonExecutablePath(
    env: TaskEnvironment = {},
): TaskEnvironment {
    const pathKey = getPathKey({ ...process.env, ...env });
    const existingPath = env[pathKey] ?? process.env[pathKey] ?? '';
    return {
        ...env,
        [pathKey]: appendUniquePathDirs(
            existingPath,
            getCommonExecutableDirs(),
        ),
    };
}
