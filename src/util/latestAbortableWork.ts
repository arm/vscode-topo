export type AbortableWorkCallback<T> = (signal: AbortSignal) => Promise<T>;

export class LatestAbortableWork {
    private currentAbortController: AbortController | undefined;

    public isRunning(): boolean {
        if (!this.currentAbortController) {
            return false;
        }
        return !this.currentAbortController.signal.aborted;
    }

    public abort(): void {
        this.currentAbortController?.abort();
        this.currentAbortController = undefined;
    }

    public async run<T>(
        work: AbortableWorkCallback<T>,
    ): Promise<T | undefined> {
        this.abort();

        const abortController = new AbortController();
        this.currentAbortController = abortController;

        try {
            const result = await work(abortController.signal);
            abortController.signal.throwIfAborted();
            return result;
        } catch (error) {
            if (abortController.signal.aborted) {
                return undefined;
            }
            throw error;
        } finally {
            if (this.currentAbortController === abortController) {
                this.currentAbortController = undefined;
            }
        }
    }

    public dispose(): void {
        this.abort();
    }
}
