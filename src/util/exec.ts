import { promisify } from 'node:util';
import { execFile as _execFile } from 'node:child_process';

export const execFile = promisify(_execFile);

export type ExecFileResult = Awaited<ReturnType<typeof execFile>>;
