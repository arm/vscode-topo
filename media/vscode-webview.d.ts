export {};

declare global {
    interface VSCodeWebviewAPI<TState = unknown> {
        postMessage(message: unknown): void;
        getState(): TState | undefined;
        setState(state: TState): TState;
    }

    function acquireVsCodeApi<TState = unknown>(): VSCodeWebviewAPI<TState>;
}
