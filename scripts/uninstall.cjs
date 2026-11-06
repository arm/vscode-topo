const { spawnSync } = require('node:child_process');
const { homedir } = require('node:os');
const { join } = require('node:path');

const SKILL_NAME = 'topo-cli-location';

function uninstallSkill(run = spawnSync) {
    const result = run(
        process.execPath,
        [
            join(__dirname, '../node_modules/skills/bin/cli.mjs'),
            'remove',
            SKILL_NAME,
            '--global',
            '--yes',
        ],
        {
            cwd: homedir(),
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            stdio: 'ignore',
        },
    );

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(
            `Skill uninstallation failed with exit code ${result.status ?? 'unknown'}`,
        );
    }
}

if (require.main === module) {
    uninstallSkill();
}

module.exports = { uninstallSkill };
