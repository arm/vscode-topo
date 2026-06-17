import { parseQuery } from './parseQuery';

describe('parseQuery', () => {
    it('parses query params into an object', () => {
        expect(parseQuery('source=repo&model=test')).toEqual({
            source: 'repo',
            model: 'test',
        });
    });

    it('normalizes HTML-escaped ampersands before parsing', () => {
        expect(
            parseQuery('source=repo&amp;model=test&#38;param=v1&#x26;x=y'),
        ).toEqual({
            source: 'repo',
            model: 'test',
            param: 'v1',
            x: 'y',
        });
    });
});
