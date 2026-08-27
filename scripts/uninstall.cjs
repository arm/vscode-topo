const { spawnSync } = require('node:child_process');

const SKILL_NAME = 'topo-cli-location';

function uninstallSkill(run = spawnSync, platform = process.platform) {
    const npx = platform === 'win32' ? 'npx.cmd' : 'npx';
    const result = run(
        npx,
        ['--yes', 'skills', 'remove', SKILL_NAME, '--global', '--yes'],
        { stdio: 'ignore' },
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
