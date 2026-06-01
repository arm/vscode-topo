import { promisify } from 'node:util';
import { exec as _exec, execFile as _execFile } from 'node:child_process';

export const exec = promisify(_exec);
export const execFile = promisify(_execFile);

export type ExecResult = Awaited<ReturnType<typeof exec>>;
export type ExecFileResult = Awaited<ReturnType<typeof execFile>>;
