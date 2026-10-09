import { PRIMARY_PROCESSING_DOMAIN } from '../../manifest';
import { compareProcessingDomains } from './compareProcessingDomains';

describe('compareProcessingDomains', () => {
    it.each([PRIMARY_PROCESSING_DOMAIN, 'imx-rproc'])(
        'returns zero for equal domain names: %s',
        (domain) => {
            expect(compareProcessingDomains(domain, domain)).toBe(0);
        },
    );

    it('places the primary domain before names on either side alphabetically', () => {
        for (const domain of ['alpha', 'zeta']) {
            expect(
                compareProcessingDomains(PRIMARY_PROCESSING_DOMAIN, domain),
            ).toBeLessThan(0);
            expect(
                compareProcessingDomains(domain, PRIMARY_PROCESSING_DOMAIN),
            ).toBeGreaterThan(0);
        }
    });

    it('sorts other domains alphabetically without considering case', () => {
        const domains = ['zeta', 'Beta', 'alpha'];

        expect(domains.toSorted(compareProcessingDomains)).toEqual([
            'alpha',
            'Beta',
            'zeta',
        ]);
        expect(compareProcessingDomains('imx-rproc', 'IMX-RPROC')).toBe(0);
    });
});
