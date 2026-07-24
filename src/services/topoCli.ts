import * as path from 'node:path';
import * as vscode from 'vscode';
import * as manifest from '../manifest';
import {
    HealthReport,
    HostHealthReport,
    healthReportSchema,
    hostHealthReportSchema,
    ProjectDescription,
    targetDescriptionSchema,
    projectSchema,
    topoLogEntrySchema,
    psSchema,
    PsOutput,
} from './topoCliSchema';
import { array, create, is, Struct } from 'superstruct';
import {
    WrappedError,
    WrappedErrorLog,
    WrappedErrorLogLevel,
} from '../errors/wrappedError';
import { getErrorMessage } from '../util/getErrorMessage';
import { TargetDescription } from '../util/types';
import { execFile } from '../util/exec';

export interface TopoCliVersion {
    version: string;
    commit: string;
}

interface ExecOptions {
    cwd?: string;
}

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

export class TopoCli {
    constructor(
        private readonly extensionPath: string,
        private readonly env: vscode.EnvironmentVariableCollection,
    ) {}

    public activate(): void {
        const sep = process.platform === 'win32' ? ';' : ':';
        this.env.prepend('PATH', this.getBinaryFolder() + sep);
        this.env.replace('TOPO_DISABLE_SELF_UPGRADE', '1');
    }

    public dispose(): void {
        this.env.clear();
    }

    private getBinaryFolder(): string {
        return path.join(this.extensionPath, 'resources');
    }

    private async exec(cmd: string[], options?: ExecOptions): Promise<string> {
        const bin = this.getBinaryPath();
        let out: string;
        try {
            const { stdout } = await execFile(bin, cmd, {
                encoding: 'utf8',
                windowsHide: true,
                ...options,
                env: {
                    ...process.env,
                },
            });
            out = stdout;
        } catch (error: unknown) {
            throw parseWrappedError(error) ?? error;
        }
        return out;
    }

    private async execJson<T>(
        cmd: string[],
        schema: Struct<T>,
        outputDescription: string,
        options?: ExecOptions,
    ): Promise<T> {
        const output = await this.exec(cmd, options);

        let parsed: unknown;
        try {
            parsed = JSON.parse(output);
        } catch (parseError) {
            throw new Error(
                `Failed to parse ${outputDescription} JSON: ${getErrorMessage(parseError)}`,
                { cause: parseError },
            );
        }

        try {
            return create(parsed, schema);
        } catch (validationError) {
            throw new Error(
                `Invalid ${outputDescription} JSON: ${getErrorMessage(validationError)}`,
                { cause: validationError },
            );
        }
    }

    public getBinaryPath(): string {
        const binaryFolder = this.getBinaryFolder();
        const isWin = process.platform === 'win32';
        const binaryName = isWin
            ? manifest.TOPO_CLI_WINDOWS
            : manifest.TOPO_CLI;
        const base = path.join(binaryFolder, binaryName);
        return base;
    }

    public async getVersion(): Promise<TopoCliVersion> {
        const out = await this.exec(['--version']);
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

    public async listProjects(
        sshTarget?: string,
    ): Promise<ProjectDescription[]> {
        const cmd = ['templates', '-o', 'json'];
        if (sshTarget) {
            cmd.push('--target', sshTarget);
        }
        return this.execJson(cmd, array(projectSchema), 'project catalog');
    }

    public async describe(sshTarget: string): Promise<TargetDescription> {
        const cmd = ['describe', '--target', sshTarget, '-o', 'json'];
        return this.execJson(
            cmd,
            targetDescriptionSchema,
            'target description',
        );
    }

    public async init(projectPath: string): Promise<void> {
        await this.exec(['init'], { cwd: projectPath });
    }

    public async ps(sshTarget: string, projectPath: string): Promise<PsOutput> {
        const cmd = ['ps', '-a', '--target', sshTarget, '-o', 'json'];
        return this.execJson(cmd, psSchema, 'container status', {
            cwd: projectPath,
        });
    }

    private async runHealth<T>(
        schema: Struct<T>,
        outputDescription: string,
        sshTarget?: string,
    ): Promise<T> {
        const cmd = ['health', '-o', 'json'];
        if (sshTarget) {
            cmd.push('--target', sshTarget);
        }
        return this.execJson(cmd, schema, outputDescription);
    }

    public async hostHealth(): Promise<HostHealthReport> {
        return this.runHealth(hostHealthReportSchema, 'host health report');
    }

    public async health(sshTarget: string): Promise<HealthReport> {
        return this.runHealth(
            healthReportSchema,
            'target health report',
            sshTarget,
        );
    }

    public async assertVersion(expected: string): Promise<void> {
        const actual = (await this.getVersion()).version;
        if (actual !== expected) {
            throw new Error(
                `version mismatch: found=${actual} expected=${expected}`,
            );
        }
    }
}
