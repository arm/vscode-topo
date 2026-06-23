import * as vscode from 'vscode';
import { parseQuery, parseRequestData } from './protocolRequest';

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

    it('uses the last repeated query param value', () => {
        expect(parseQuery('source=repo&param=v1&param=v2')).toEqual({
            source: 'repo',
            param: 'v2',
        });
    });
});

describe('parseRequestData', () => {
    it('keeps a non-protocol url query param', () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/clone?source=https://example.com/repo.git%238303e66db59a7a11e64877121f3db1b688d2011f&url=https%3A%2F%2Fexample.com%2Fmodel',
        );

        expect(parseRequestData(uri)).toEqual({
            source: 'https://example.com/repo.git#8303e66db59a7a11e64877121f3db1b688d2011f',
            url: 'https://example.com/model',
        });
    });

    it('keeps a non-protocol url query param with later request data', () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/clone?source=https://example.com/repo.git%238303e66db59a7a11e64877121f3db1b688d2011f&url=https%3A%2F%2Fexample.com%2Fmodel&GREETING_NAME=F%23ed',
        );

        expect(parseRequestData(uri)).toEqual({
            source: 'https://example.com/repo.git#8303e66db59a7a11e64877121f3db1b688d2011f',
            url: 'https://example.com/model',
            GREETING_NAME: 'F#ed',
        });
    });

    it('keeps an invalid url query param', () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/clone?source=https://example.com/repo.git&url=not%20a%20valid%20url',
        );

        expect(parseRequestData(uri)).toEqual({
            source: 'https://example.com/repo.git',
            url: 'not a valid url',
        });
    });

    it('removes a protocol url query param', () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/clone?source=https://example.com/repo.git&url=vscode%3A%2F%2Farm.topo%2Fclone%3Fsource%3Dhttps%253A%252F%252Fexample.com%252Frepo.git',
        );

        expect(parseRequestData(uri)).toEqual({
            source: 'https://example.com/repo.git',
        });
    });

    it('parses URL-encoded request args', () => {
        const source =
            'https://github.com/Arm-Examples/topo-welcome.git#8303e66db59a7a11e64877121f3db1b688d2011f';
        const greetingName = 'F#ed';
        const mode = 'test';
        const protocolQuery = new URLSearchParams();
        protocolQuery.append('mode', mode);
        protocolQuery.append('source', source);
        protocolQuery.append('GREETING_NAME', greetingName);
        const uri = vscode.Uri.parse(
            `vscode://arm.topo/clone?${protocolQuery.toString()}`,
        );

        expect(parseRequestData(uri)).toEqual({
            mode,
            source,
            GREETING_NAME: greetingName,
        });
    });

    it('does not treat the URI fragment as a query when source already has one', () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/clone?source=https%3A%2F%2Fexample.com%2Frepo.git%23main#ignored&param=v1',
        );

        expect(parseRequestData(uri)).toEqual({
            source: 'https://example.com/repo.git#main',
        });
    });

    it('normalizes HTML-escaped ampersands in request query params', () => {
        const uri = vscode.Uri.from({
            scheme: 'vscode',
            authority: 'arm.topo',
            path: '/clone',
            query: 'source=https://example.com/repo.git&amp;model=some-huggingface-id&#38;param=v1&#x26;another=val',
        });

        expect(parseRequestData(uri)).toEqual({
            source: 'https://example.com/repo.git',
            model: 'some-huggingface-id',
            param: 'v1',
            another: 'val',
        });
    });
});
