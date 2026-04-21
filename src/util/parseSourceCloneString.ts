import { WrappedError } from '../errors/wrappedError';
import { CloneSource } from '../topoCli';

const isGitURL = (source: string): boolean =>
    source.startsWith('git@') ||
    source.startsWith('ssh://') ||
    source.startsWith('https://') ||
    source.startsWith('http://') ||
    source.startsWith('git://');

export const parseCloneSourceString = (
    cloneSourceString: string,
): CloneSource => {
    if (isGitURL(cloneSourceString)) {
        return { value: cloneSourceString };
    }
    const [sourceType, ...valueParts] = cloneSourceString.split(':');
    if (!sourceType || valueParts.length === 0) {
        throw new WrappedError('CLONE', `Invalid URL: ${cloneSourceString}`);
    }
    const value = valueParts.join(':');

    switch (sourceType) {
        case 'dir':
            return { type: 'dir', path: value };
        case 'git':
            return { type: 'git', url: value };
        default:
            throw new WrappedError('CLONE', `Invalid type: ${sourceType}`);
    }
};
