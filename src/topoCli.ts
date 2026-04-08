import * as path from 'path';
import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as manifest from './manifest';
import {
    HealthCheckResult,
    healthCheckResultSchema,
    ProjectDescription,
    projectDescriptionSchema,
    TemplateDescription,
    templateSchema,
} from './topoCliSchema';
import { array, assert } from 'superstruct';

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

export interface CloneTemplateSource {
    template: string;
    type: 'template';
}

export interface CloneRawSource {
    value: string;
    type?: never;
}

export type CloneSource =
    | CloneRemoteSource
    | CloneLocalSource
    | CloneTemplateSource
    | CloneRawSource;

export const targetDescriptionFileName = 'target-description.yaml';

/**
 * Encapsulates operations against the topo binary.
 */
export class TopoCli {
    constructor(
        private readonly extensionPath: string,
        private readonly env: vscode.EnvironmentVariableCollection,
        private readonly defaultSshTarget?: string,
    ) {}

    public async activate(): Promise<void> {
        const sep = process.platform === 'win32' ? ';' : ':';
        this.env.prepend('PATH', this.getBinaryFolder() + sep);
        if (this.defaultSshTarget) {
            this.env.replace(
                manifest.TOPO_TARGET_ENV_VAR,
                this.defaultSshTarget,
            );
        }
    }

    public dispose(): void {
        this.env.clear();
    }

    private getBinaryFolder(): string {
        return path.join(this.extensionPath, 'resources');
    }

    private getProcessEnv(): NodeJS.ProcessEnv {
        const env: NodeJS.ProcessEnv = { ...process.env };
        if (this.defaultSshTarget) {
            env[manifest.TOPO_TARGET_ENV_VAR] = this.defaultSshTarget;
        }
        return env;
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
        const out = childProcess.execFileSync(bin, cmd, {
            encoding: 'utf8',
        });
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
