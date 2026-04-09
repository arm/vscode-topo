/**
 * Copyright (C) 2025 Arm Limited
 */

export class Deferred<T = void> {
    public state: 'resolved' | 'rejected' | 'unresolved' = 'unresolved';

    public resolve!: (value: T | PromiseLike<T>) => void;
    public reject!: (err?: unknown) => void;

    public promise = new Promise<T>((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
    }).then(
        (res) => (this.setState('resolved'), res),
        (err) => (this.setState('rejected'), Promise.reject(err))
    );

    protected setState(state: 'resolved' | 'rejected'): void {
        if (this.state === 'unresolved') {
            this.state = state;
        }
    }
}
