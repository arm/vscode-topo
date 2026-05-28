import * as vscode from 'vscode';
import { logger } from './logger';
import { DisposableCollector } from './disposableCollector';

vi.mock('./logger');

function disposable(dispose: () => void): vscode.Disposable {
    return { dispose };
}

describe('DisposableCollector', () => {
    it('disposes collected disposables in reverse order and clears them', () => {
        const collector = new DisposableCollector();
        const calls: string[] = [];

        collector.collect(
            disposable(() => calls.push('first')),
            disposable(() => calls.push('second')),
        );

        collector.dispose();
        collector.dispose();

        expect(calls).toEqual(['second', 'first']);
    });

    it('disposes a single collected disposable', () => {
        const collector = new DisposableCollector();
        const collected = disposable(vi.fn());

        collector.collect(collected);

        collector.dispose();

        expect(collected.dispose).toHaveBeenCalledWith();
    });

    it('reports disposal errors and continues disposing', () => {
        const disposalError = new Error('failed to dispose');
        const collector = new DisposableCollector();
        const calls: string[] = [];
        const failingDisposable = disposable(() => {
            calls.push('failing');
            throw disposalError;
        });

        collector.collect(
            disposable(() => calls.push('first')),
            failingDisposable,
            disposable(() => calls.push('third')),
        );

        collector.dispose();

        expect(calls).toEqual(['third', 'failing', 'first']);
        expect(logger.error).toHaveBeenCalledWith(
            `Error disposing resource`,
            disposalError,
        );
    });
});
