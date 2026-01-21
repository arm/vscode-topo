export class Target {
    public static from(obj: unknown): Target {
        if (obj instanceof Target) {
            return obj;
        }
        if (obj && typeof obj === 'object') {
            const maybe = obj as Record<string, unknown>;
            const id = typeof maybe.id === 'string' ? maybe.id.trim() : '';
            const ssh = typeof maybe.ssh === 'string' ? maybe.ssh.trim() : '';
            if (!id) {
                throw new Error('Invalid stored target: missing id');
            }
            if (!ssh) {
                throw new Error('Invalid stored target: missing ssh');
            }
            return new Target(id, ssh);
        }
        throw new Error(
            'Invalid stored target: expected an object with id and ssh properties',
        );
    }

    public readonly user?: string;
    public readonly host: string;
    public readonly id: string;
    public readonly ssh: string;

    constructor(id: string, ssh: string) {
        this.id = id.toString().trim();
        this.ssh = ssh.toString().trim();

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

    public get displayName(): string {
        return this.id;
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
        return { id: this.id, ssh: this.ssh };
    }
}
