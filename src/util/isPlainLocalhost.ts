// Match Topo's local-target handling; an explicit user or port requires SSH.
export function isPlainLocalhost(target: string): boolean {
    return target.toLowerCase() === 'localhost' || target === '127.0.0.1';
}
