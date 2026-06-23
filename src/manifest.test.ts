import fs from 'node:fs';
import path from 'node:path';
import { CONTEXT_HAS_SELECTED_TARGET } from './manifest';

describe('package manifest', () => {
    it('uses the selected target context key in the target welcome view', () => {
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
        ) as {
            contributes: {
                viewsWelcome: Array<{
                    view: string;
                    when: string;
                }>;
            };
        };

        const targetWelcome = packageJson.contributes.viewsWelcome.find(
            (welcome) => welcome.view === 'topo.target-manager',
        );

        expect(targetWelcome?.when).toBe(`!${CONTEXT_HAS_SELECTED_TARGET}`);
    });
});
