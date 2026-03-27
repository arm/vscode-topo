import { TargetItem } from '../util/types';

export class Target implements TargetItem {
    public static from(obj: unknown): Target {
        if (obj instanceof Target) {
            return obj;
        }
        if (obj && typeof obj === 'object') {
            const maybeTarget = obj as Record<string, unknown>;
            if (typeof maybeTarget.ssh !== 'string') {
                throw new Error(
                    'Invalid stored target: expected property "ssh" of type string',
                );
            }
            return new Target(maybeTarget.ssh);
        }
        throw new Error(
            'Invalid stored target: expected an object describing a Target',
        );
    }

    public readonly user?: string;
    public readonly host: string;
    public readonly ssh: string;

    constructor(ssh: string) {
        this.ssh = ssh.toString().trim();

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
            ssh: this.ssh,
        };
    }
}
