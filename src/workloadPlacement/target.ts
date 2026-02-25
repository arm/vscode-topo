import { TargetDescription, TargetItem } from '../util/types';
import { parseTargetDescription } from '../util/parseTargetDescription';

export class Target implements TargetItem {
    public static from(obj: unknown): Target {
        if (obj instanceof Target) {
            return obj;
        }
        if (obj && typeof obj === 'object') {
            const maybeTarget = obj as Record<string, unknown>;
            if (typeof maybeTarget.id !== 'string') {
                throw new Error(
                    'Invalid stored target: expected property "id" of type string',
                );
            }
            if (typeof maybeTarget.ssh !== 'string') {
                throw new Error(
                    'Invalid stored target: expected property "ssh" of type string',
                );
            }
            if (
                maybeTarget.targetDescription !== undefined &&
                typeof maybeTarget.targetDescription !== 'string'
            ) {
                throw new Error(
                    'Invalid stored target: expected property "targetDescription" of type undefined or string',
                );
            }
            return new Target(
                maybeTarget.id,
                maybeTarget.ssh,
                maybeTarget.targetDescription,
            );
        }
        throw new Error(
            'Invalid stored target: expected an object with id and ssh properties',
        );
    }

    public readonly user?: string;
    public readonly host: string;
    public readonly id: string;
    public readonly ssh: string;
    public readonly targetDescription: TargetDescription | undefined;

    constructor(
        id: string,
        ssh: string,
        private readonly yamlTargetDescription?: string,
    ) {
        this.id = id.toString().trim();
        this.ssh = ssh.toString().trim();
        if (yamlTargetDescription) {
            this.targetDescription = parseTargetDescription(
                yamlTargetDescription,
            );
        }

        if (!this.id) {
            throw new TypeError('Target id must be a non-empty string');
        }
        if (!this.ssh) {
            throw new TypeError('Target ssh must be a non-empty string');
        }

        const { user, host } = Target.parseSsh(this.ssh);

        this.user = user;
        this.host = host;
    }

    private static parseSsh(sshTarget: string): {
        user?: string;
        host: string;
    } {
        if (sshTarget.includes('@')) {
            const [user, host] = sshTarget.split('@');
            if (!host) {
                throw new Error(`missing host in SSH target: ${sshTarget}`);
            }
            return { user: user === '' ? undefined : user, host };
        }
        return { host: sshTarget };
    }

    public toJSON() {
        return {
            id: this.id,
            ssh: this.ssh,
            targetDescription: this.yamlTargetDescription,
        };
    }
}
