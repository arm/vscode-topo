import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import * as vscode from 'vscode';
import * as manifest from './manifest';
import {
    HealthCheckResult,
    healthCheckResultSchema,
    ProjectDescription,
    projectDescriptionSchema,
    TemplateDescription,
    templateSchema,
    topoLogEntrySchema,
} from './topoCliSchema';
import { array, assert, is } from 'superstruct';
import { TopoError, TopoLogEntry } from './errors/topoError';
import { getErrorMessage } from './util/getErrorMessage';

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

export const targetDescriptionFileName = 'target-description.yaml';

export function parseTopoLogEntries(output: string): TopoLogEntry[] {
    const entries: TopoLogEntry[] = [];
    for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (is(parsed, topoLogEntrySchema)) {
                entries.push({
                    time: parsed.time,
                    level: parsed.level,
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

export function parseTopoError(error: unknown): TopoError | undefined {
    const stderr = hasStderr(error) ? error.stderr : getErrorMessage(error);
    const logEntries = parseTopoLogEntries(stderr);
    const errorMessages = logEntries
        .filter((entry) => entry.level === 'ERROR')
        .map((entry) => entry.msg);
    if (errorMessages.length === 0) {
        return undefined;
    }
    const message = errorMessages.join('; ');
    return new TopoError('CLI', message, { cause: error, logEntries });
}

/**
 * Encapsulates operations against the topo binary.
 */
export class TopoCli {
    constructor(
        private readonly extensionPath: string,
        private readonly env: vscode.EnvironmentVariableCollection,
    ) {}

    public async activate(): Promise<void> {
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
            throw parseTopoError(error) ?? error;
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

    /**
     * Runs topo describe for a target and writes target-description.yaml
     * in the provided working directory.
     */
    public describe(
        workingDirectory: string,
        sshTarget: string,
    ): Promise<string> {
        const bin = this.getBinaryPath();
        return new Promise((resolve, reject) => {
            const cmd = ['describe', '--target', sshTarget];
            childProcess.execFile(
                bin,
                cmd,
                {
                    env: this.getProcessEnv(),
                    cwd: workingDirectory,
                },
                (error, _stdout) => {
                    if (error) {
                        reject(
                            new Error(
                                `Failed to describe target: ${error.message}`,
                                { cause: error },
                            ),
                        );
                        return;
                    }
                    const targetDescriptionFilePath = path.join(
                        workingDirectory,
                        targetDescriptionFileName,
                    );
                    resolve(targetDescriptionFilePath);
                },
            );
        });
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

    public deploy(
        projectPath: string,
        sshTarget?: string,
    ): childProcess.ChildProcessWithoutNullStreams {
        const cmd = ['deploy'];
        if (sshTarget) {
            cmd.push('--target', sshTarget);
        }
        return childProcess.spawn(this.getBinaryPath(), cmd, {
            cwd: projectPath,
            env: this.getProcessEnv(),
            detached: true,
        });
    }

    public async health(sshTarget: string): Promise<HealthCheckResult> {
        const bin = this.getBinaryPath();
        const cmd = [
            'health',
            '--target',
            sshTarget,
            '--accept-new-host-keys',
            '-o',
            'json',
        ];
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
        assert(result, healthCheckResultSchema);
        return result;
    }
}
