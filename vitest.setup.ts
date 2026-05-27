import { vi } from 'vitest';

vi.mock('vscode', async () => {
    return await import('./src/__mocks__/vscode.js');
});
