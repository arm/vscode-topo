import { PRIMARY_PROCESSING_DOMAIN } from '../../manifest';

export function compareProcessingDomains(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    if (a === PRIMARY_PROCESSING_DOMAIN) {
        return -1;
    }
    if (b === PRIMARY_PROCESSING_DOMAIN) {
        return 1;
    }

    return a.localeCompare(b, undefined, { sensitivity: 'base' });
}
