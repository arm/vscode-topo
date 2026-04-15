import { Directive, Line, LineType, parse as parseSSHConfig } from 'ssh-config';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';
import { is } from 'superstruct';

const sshDir = path.join(os.homedir(), '.ssh');
export const defaultSshConfigPath = path.join(sshDir, 'config');

function isDirective(line: Line): line is Directive {
    return line.type === LineType.DIRECTIVE;
}

function isPlainHost(host: string): boolean {
    return !/[?*!]/.test(host);
}

function flattenValue(value: Directive['value']): string[] {
    if (typeof value === 'string') {
        return [value];
    } else {
        return value.map((v) => v.val);
    }
}

function resolveInclude(value: string): string[] {
    const resolved = path.resolve(os.homedir(), '.ssh', value);
    return fs.globSync(resolved);
}

export async function getHosts(file: string): Promise<string[]> {
    const hosts = new Set<string>();
    const queue: string[] = [file];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const currentFile = queue.shift()!;
        if (visited.has(currentFile)) {
            continue;
        }
        visited.add(currentFile);

        if (!fs.existsSync(currentFile)) {
            continue;
        }

        const content = await fs.promises.readFile(currentFile, 'utf8');
        const config = parseSSHConfig(content);
        for (const line of config) {
            if (!isDirective(line)) {
                continue;
            }

            const directive = line.param.toLowerCase();
            if (directive === 'include') {
                for (const value of flattenValue(line.value)) {
                    for (const includedFile of resolveInclude(value)) {
                        logger.info(
                            `Including SSH config file: ${includedFile}`,
                            line,
                            currentFile,
                        );
                        queue.push(includedFile);
                    }
                }
            } else if (directive === 'host') {
                for (const value of flattenValue(line.value)) {
                    if (isPlainHost(value)) {
                        hosts.add(value);
                    }
                }
            }
        }
    }

    return Array.from(hosts);
}
