import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { TopoCli } from './topoCli';
import * as fs from 'fs';
import * as path from 'path';

export class Deployer {
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
    private readonly topoCli: Pick<TopoCli , 'generateMakefile'>,
    ) {}

    public async start(composeFilePath: string): Promise<void> {
        if (this.proc) {
            return;
        }
        const composeFolderPath = path.dirname(composeFilePath);
        const makefilePath = path.join(composeFolderPath, 'Makefile');
        if (!fs.existsSync(makefilePath)) {
            const choice = await vscode.window.showInformationMessage(
                'Makefile not found in the folder. Would you like to create one?',
                'Yes',
                'No'
            );
            if (choice === 'Yes') {
                await this.topoCli.generateMakefile(composeFilePath);
            } else {
                this.onErrorEmitter.fire(Error('Deploy operation cancelled'));
                return;
            }
        }
        this.proc = spawn('make', [], { cwd: composeFolderPath, shell: true, detached: true });
        if (this.proc.stdout) {
            this.proc.stdout.on('data', (data: Buffer) => this.onStdoutDataEmitter.fire(data));
        }
        if (this.proc.stderr) {
            this.proc.stderr.on('data', (data: Buffer) => this.onStderrDataEmitter.fire(data));
        }
        this.proc.on('exit', (code: number | null) => {
            this.proc = undefined;
            this.onExitEmitter.fire(code);
        });
        this.proc.on('error', (err: Error) => {
            this.proc = undefined;
            this.onErrorEmitter.fire(err);
        });
    }

    public stop(): void {
        if (this.proc === undefined) {
            return;
        }
        if (process.platform === 'win32') {
            if (this.proc.pid !== undefined) {
                spawn('taskkill', ['/pid', this.proc.pid.toString(), '/T', '/F']);
            }
        } else {
            if (this.proc.pid) {
                process.kill(-this.proc.pid);
            } else {
                this.proc.kill('SIGTERM');
            }
        }
        this.proc = undefined;
    }
}
