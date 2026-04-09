/* eslint-disable @typescript-eslint/no-explicit-any */
export {};

declare global {
  interface VSCodeWebviewAPI<TState = unknown> {
    postMessage(message: any): void;
    getState(): TState | undefined;
    setState(state: TState): void;
  }

  function acquireVsCodeApi<TState = unknown>(): VSCodeWebviewAPI<TState>;
}
