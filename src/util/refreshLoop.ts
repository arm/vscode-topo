export class RefreshLoop {
    private timeoutId: NodeJS.Timeout | undefined;

    constructor(
        private readonly callback: () => Promise<void>,
        private readonly refreshInterval: number,
    ) {}

    public start(): void {
        this.stop();
        this.timeoutId = setTimeout(async () => {
            await this.callback();
            if (this.timeoutId !== undefined) {
                this.start();
            }
        }, this.refreshInterval);
    }

    public stop(): void {
        clearTimeout(this.timeoutId);
        this.timeoutId = undefined;
    }
}
