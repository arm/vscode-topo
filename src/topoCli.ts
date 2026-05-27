import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import * as vscode from 'vscode';
import * as manifest from './manifest';
import {
    HealthCheckResult,
    HostHealthCheckResult,
    healthCheckResultSchema,
    hostHealthCheckResultSchema,
    ProjectDescription,
    projectDescriptionSchema,
    TemplateDescription,
    targetDescriptionSchema,
    templateSchema,
    topoLogEntrySchema,
} from './topoCliSchema';
import { array, assert, create, is, Struct } from 'superstruct';
import {
    WrappedError,
    WrappedErrorLog,
    WrappedErrorLogLevel,
} from './errors/wrappedError';
import { getErrorMessage } from './util/getErrorMessage';
import { TargetDescription } from './util/types';

export interface TopoCliVersion {
    version: string;
    commit: string;
}

export interface CloneRemoteSource {
    url: string;
    type: 'git';
}

export interface CloneLocalSource {
    path: string;
    type: 'dir';
}

export interface CloneRawSource {
    value: string;
    type?: never;
}

export type CloneSource = CloneRemoteSource | CloneLocalSource | CloneRawSource;

const normalizeLogLevel = (level: string): WrappedErrorLogLevel => {
    switch (level.toUpperCase()) {
        case 'ERROR':
            return 'Error';
        case 'WARN':
            return 'Warning';
        case 'DEBUG':
            return 'Debug';
        case 'INFO':
            return 'Info';
        default:
            return 'Error';
    }
};

export function parseTopoLogEntries(output: string): WrappedErrorLog[] {
    const entries: WrappedErrorLog[] = [];
    for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (is(parsed, topoLogEntrySchema)) {
                entries.push({
                    level: normalizeLogLevel(parsed.level),
                    msg: parsed.msg,
                });
            }
        } catch {
            // Line is not valid JSON, skip it
        }
    }
    return entries;
}

function hasStderr(error: unknown): error is Error & { stderr: string } {
    return (
        error instanceof Error &&
        'stderr' in error &&
        typeof error.stderr === 'string'
    );
}

export function parseWrappedError(error: unknown): WrappedError | undefined {
    const stderr = hasStderr(error) ? error.stderr : getErrorMessage(error);
    const logEntries = parseTopoLogEntries(stderr);
    const errorMessages = logEntries
        .filter((entry) => entry.level === 'Error')
        .map((entry) => entry.msg);
    if (errorMessages.length === 0) {
        return undefined;
    }
    const message = errorMessages.join('; ');
    return new WrappedError('CLI', message, logEntries, { cause: error });
}

/**
 * Encapsulates operations against the topo binary.
 */
export class TopoCli {
    constructor(
        private readonly extensionPath: string,
        private readonly env: vscode.EnvironmentVariableCollection,
    ) {}

    public activate(): void {
        const sep = process.platform === 'win32' ? ';' : ':';
        this.env.prepend('PATH', this.getBinaryFolder() + sep);
    }

    public dispose(): void {
        this.env.clear();
    }

    private getBinaryFolder(): string {
        return path.join(this.extensionPath, 'resources');
    }

    private getProcessEnv(): NodeJS.ProcessEnv {
        return { ...process.env };
    }

    /**
     * Returns the file system path to the topo binary.
     * On Windows, always appends the .exe extension.
     */
    public getBinaryPath(): string {
        const binaryFolder = this.getBinaryFolder();
        const isWin = process.platform === 'win32';
        const binaryName = isWin
            ? manifest.TOPO_CLI_WINDOWS
            : manifest.TOPO_CLI;
        const base = path.join(binaryFolder, binaryName);
        return base;
    }

    /** Returns the version string of the binary (via version). */
    public getVersion(): TopoCliVersion {
        const bin = this.getBinaryPath();
        const out = childProcess.execFileSync(bin, ['--version'], {
            encoding: 'utf8',
        });
        const match = out.match(
            /topo version (?<version>\S+) \(commit: (?<commit>\S+)\)/i,
        );
        if (!match || !match.groups) {
            throw new Error(`Failed to parse version output: ${out}`);
        }
        const versionInfo: TopoCliVersion = {
            version: match.groups.version,
            commit: match.groups.commit,
        };
        return versionInfo;
    }

    /** Lists templates (via templates). */
    public listTemplates(sshTarget?: string): TemplateDescription[] {
        const bin = this.getBinaryPath();
        const cmd = ['templates'];
        if (sshTarget) {
            cmd.push('--target', sshTarget);
        }
        cmd.push('-o', 'json');
        let out: string;
        try {
            out = childProcess.execFileSync(bin, cmd, {
                encoding: 'utf8',
            });
        } catch (error: unknown) {
            throw parseWrappedError(error) ?? error;
        }
        const templates = JSON.parse(out);
        assert(templates, array(templateSchema));
        return templates;
    }

    /** Return project (via get-project). */
    public getProject(composeFilepath: string): ProjectDescription {
        const bin = this.getBinaryPath();
        const cmd = ['get-project', composeFilepath];
        const out = childProcess.execFileSync(bin, cmd, { encoding: 'utf8' });
        const project = JSON.parse(out);
        assert(project, projectDescriptionSchema);
        return project;
    }

    /** Returns target description data from topo describe JSON output. */
    public async describe(sshTarget: string): Promise<TargetDescription> {
        const bin = this.getBinaryPath();
        const cmd = ['describe', '--target', sshTarget, '--output', 'json'];
        const output = await new Promise<string>((resolve, reject) => {
            childProcess.execFile(
                bin,
                cmd,
                {
                    env: this.getProcessEnv(),
                },
                (error, stdout) => {
                    if (error) {
                        reject(
                            new Error(
                                `Failed to describe target: ${error.message}`,
                                { cause: error },
                            ),
                        );
                        return;
                    }

                    resolve(stdout);
                },
            );
        });

        let parsedDescription: unknown;
        try {
            parsedDescription = JSON.parse(output);
        } catch (parseError) {
            throw new Error(
                `Failed to parse target description JSON: ${getErrorMessage(parseError)}`,
                { cause: parseError },
            );
        }

        try {
            return create(parsedDescription, targetDescriptionSchema);
        } catch (validationError) {
            throw new Error(
                `Invalid target description JSON: ${getErrorMessage(validationError)}`,
                { cause: validationError },
            );
        }
    }

    /** Runs the binary to initialize a project. */
    public init(projectPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const cmd = ['init'];
            childProcess.execFile(
                this.getBinaryPath(),
                cmd,
                {
                    cwd: projectPath,
                    env: this.getProcessEnv(),
                },
                (error, _stdout, stderr) => {
                    if (error) {
                        reject(new Error(stderr || error.message));
                    } else {
                        resolve();
                    }
                },
            );
        });
    }

    private async runHealth<T>(
        schema: Struct<T>,
        sshTarget?: string,
    ): Promise<T> {
        const bin = this.getBinaryPath();
        const cmd = ['health'];
        if (sshTarget) {
            cmd.push('--target', sshTarget);
        }
        cmd.push(
            '--skip-version-checks',
            '--accept-new-host-keys',
            '-o',
            'json',
        );
        const promise = await new Promise<string>((resolve, reject) => {
            const child = childProcess.execFile(
                bin,
                cmd,
                {
                    env: this.getProcessEnv(),
                    windowsHide: true,
                },
                (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(stderr || error.message));
                    } else {
                        resolve(stdout);
                    }
                },
            );
            child.stdin?.end();
        });
        const result = JSON.parse(promise);
        assert(result, schema);
        return result;
    }

    public async hostHealth(): Promise<HostHealthCheckResult> {
        return this.runHealth(hostHealthCheckResultSchema);
    }

    public async health(sshTarget: string): Promise<HealthCheckResult> {
        return this.runHealth(healthCheckResultSchema, sshTarget);
    }
}
