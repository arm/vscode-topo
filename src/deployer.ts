import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { TopoCli } from './topoCli';
import { TargetStore } from './workloadPlacement/targetStore';

export class Deployer {
    private deploying = false;
    private proc: ChildProcess | undefined;
    private onStdoutDataEmitter = new vscode.EventEmitter<Buffer>();
    private onStderrDataEmitter = new vscode.EventEmitter<Buffer>();
    private onExitEmitter = new vscode.EventEmitter<number | null>();
    private onErrorEmitter = new vscode.EventEmitter<Error>();

    public readonly onStdoutData = this.onStdoutDataEmitter.event;
    public readonly onStderrData = this.onStderrDataEmitter.event;
    public readonly onExit = this.onExitEmitter.event;
    public readonly onError = this.onErrorEmitter.event;

    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetStore: TargetStore,
    ) {}

    public async start(composeFilePath: string): Promise<void> {
        if (this.deploying) {
            return;
        }
        this.deploying = true;
        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            this.deploying = false;
            const err = new Error(
                'No target selected. Please select a target before deploying.',
            );
            throw err;
        }
        const composeFolderPath = path.dirname(composeFilePath);
        this.proc = this.topoCli.deploy(composeFolderPath, target.ssh);
        if (this.proc.stdout) {
            this.proc.stdout.on('data', (data: Buffer) =>
                this.onStdoutDataEmitter.fire(data),
            );
        }
        if (this.proc.stderr) {
            this.proc.stderr.on('data', (data: Buffer) =>
                this.onStderrDataEmitter.fire(data),
            );
        }
        this.proc.on('exit', (code: number | null) => {
            this.proc = undefined;
            this.deploying = false;
            this.onExitEmitter.fire(code);
        });
        this.proc.on('error', (err: Error) => {
            this.proc = undefined;
            this.deploying = false;
            this.onErrorEmitter.fire(err);
        });
    }

    public stop(): void {
        if (this.proc === undefined) {
            return;
        }

        try {
            if (process.platform === 'win32') {
                if (this.proc.pid !== undefined) {
                    const taskkillProc = spawn('taskkill', [
                        '/pid',
                        this.proc.pid.toString(),
                        '/T',
                        '/F',
                    ]);
                    taskkillProc.on('error', (err) => {
                        this.onErrorEmitter.fire(err as Error);
                    });
                    taskkillProc.on('exit', (code) => {
                        if (code !== 0) {
                            this.onErrorEmitter.fire(
                                new Error(`taskkill exited with code ${code}`),
                            );
                        }
                    });
                }
            } else {
                if (this.proc.pid) {
                    // Use a negative PID on Unix-like systems to signal
                    // the entire process group created with `detached: true`.
                    process.kill(-this.proc.pid);
                } else {
                    this.proc.kill('SIGTERM');
                }
            }
        } catch (err) {
            this.onErrorEmitter.fire(err as Error);
        }
    }
}
