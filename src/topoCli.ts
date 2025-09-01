import * as path from 'path';
import * as childProcess from 'child_process';
import { ConfigMetadata, ProjectDescription, TemplateDescription } from './util/types';
import { logger } from './util/logger';
import * as vscode from 'vscode';

/**
 * Encapsulates operations against the topo-cli binary.
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

    public async deactivate(): Promise<void> {
        this.env.clear();
    }

    private getBinaryFolder(): string {
        return path.join(this.extensionPath, 'resources');
    }

    /**
     * Returns the file system path to the topo-cli binary.
     * On Windows, always appends the .exe extension.
     */
    public getBinaryPath(): string {
        const binaryFolder = this.getBinaryFolder();
        const base = path.join(binaryFolder, 'topo-cli');
        if (process.platform === 'win32') {
            const exe = base + '.exe';
            return exe;
        }
        return base;
    }

    /** Returns the version string of the binary (via version). */
    public getVersion(): string {
        const bin = this.getBinaryPath();
        const out = childProcess.execFileSync(bin, ['version'], { encoding: 'utf8' });
        return out.trim();
    }

    /** Lists templates (via list-templates). */
    public listTemplates(): TemplateDescription[] {
        const bin = this.getBinaryPath();
        const out = childProcess.execFileSync(bin, ['list-templates'], { encoding: 'utf8' });
        const templates = JSON.parse(out);
        return templates;
    }

    /** Lists config metadata (via get-config-metadata). */
    public getConfigMetadata(): ConfigMetadata {
        const bin = this.getBinaryPath();
        const out = childProcess.execFileSync(bin, ['get-config-metadata'], { encoding: 'utf8' });
        return JSON.parse(out);
    }

    /** Return project (via get-project). */
    public getProject(composeFilepath: string): ProjectDescription {
        const bin = this.getBinaryPath();
        const cmd = ['get-project', composeFilepath];
        const out = childProcess.execFileSync(bin, cmd, { encoding: 'utf8' });
        return JSON.parse(out);
    }

    /** Runs the binary to add a service to a compose file. */
    public addService(composeFilepath: string, templateId: string, serviceName?: string): Promise<void> {
        const bin = this.getBinaryPath();
        return new Promise((resolve, reject) => {
            serviceName = serviceName || templateId;
            const cmd = ['add-service', composeFilepath, templateId, serviceName];
            childProcess.execFile(bin, cmd, { "cwd": "." }, (err, _stdout, stderr) => {
                if (err) {
                    reject(new Error(stderr));
                } else {
                    resolve();
                }
            });
        });
    }

    /** Runs the binary to remove a service to a compose file. */
    public removeService(composeFilepath: string, serviceName: string): Promise<void> {
        const bin = this.getBinaryPath();
        return new Promise((resolve, reject) => {
            const cmd = ['remove-service', composeFilepath, serviceName];
            childProcess.execFile(bin, cmd, { "cwd": "." }, (err, _stdout, stderr) => {
                if (err) {
                    reject(new Error(stderr));
                } else {
                    resolve();
                }
            });
        });
    }

    /** Runs the binary to deploy a solution. Supports cancellation. */
    public deploy(composeFilepath: string): { promise: Promise<void>, cancel: () => void } {
        const bin = this.getBinaryPath();
        let child: childProcess.ChildProcess | undefined;
        let canceled = false;

        const killChild = () => {
            if (child && child.pid && !child.killed) {
                if (process.platform === 'win32') {
                    // Kill process tree on Windows
                    try {
                        childProcess.execSync(`taskkill /PID ${child.pid} /T /F`);
                    } catch {
                        // ignore errors
                    }
                } else {
                    // Kill the process group on Unix
                    try {
                        const childPid = child.pid;
                        process.kill(-childPid, 'SIGTERM');
                        setTimeout(() => {
                            try {
                                process.kill(-childPid, 'SIGKILL');
                            } catch {
                                // ignore errors
                            }
                        }, 2000);
                    } catch {
                        // ignore errors
                    }
                }
            }
        };

        const promise = new Promise<void>((resolve, reject) => {
            const cmd = ['deploy', composeFilepath];
            // Set detached: true so child is in its own process group
            child = childProcess.spawn(
                bin,
                cmd,
                { cwd: path.dirname(composeFilepath), detached: true },
            );

            child.stdout?.on('data', (data: Buffer | string) => {
                logger.show();
                logger.info(data.toString());
            });

            child.stderr?.on('data', (data: Buffer | string) => {
                logger.show();
                logger.error(data.toString());
            });

            child.on('close', (code: number, _signal: string) => {
                if (canceled) {
                    resolve();
                } else if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Deploy failed with exit code ${code}`));
                }
            });

            child.on('error', (err: Error) => {
                reject(err);
            });
        });

        return {
            promise,
            cancel: () => {
                canceled = true;
                killChild();
            }
        };
    }

    public initProject(composeFilePath: string, projectName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const cmd = ['init-project', composeFilePath, projectName];
            childProcess.execFile(
                this.getBinaryPath(),
                cmd,
                { "cwd": "." },
                (error, _stdout, stderr) => {
                    if (error) {
                        reject(new Error(stderr || error.message));
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /** Runs the binary to generate a Makefile for a compose file. */
    public generateMakefile(composeFilePath: string): Promise<void> {
        const bin = this.getBinaryPath();
        return new Promise((resolve, reject) => {
            const cmd = ['generate-makefile', composeFilePath];
            childProcess.execFile(
                bin,
                cmd,
                { cwd: path.dirname(composeFilePath) },
                (error, _stdout, stderr) => {
                    if (error) {
                        reject(new Error(stderr || error.message));
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

}
