import { WrappedError } from '../errors/wrappedError';

const hasControlCharacter = (value: string): boolean => {
    return [...value].some((char) => {
        const code = char.charCodeAt(0);
        return code < 0x20 || code === 0x7f;
    });
};

export function assertValidSshTarget(target: string): void {
    if (
        target.length === 0 ||
        target.startsWith('-') ||
        /\s/.test(target) ||
        hasControlCharacter(target)
    ) {
        const message = `Invalid SSH target: ${target}`;
        throw new WrappedError('INVALID_TARGET', message, [
            { level: 'Error', msg: message },
        ]);
    }
}
