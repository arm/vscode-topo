const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { skillPaths } = require('../src/util/skillPaths.ts');

function uninstallSkill(
    userHome = os.homedir(),
    remove = fs.rmSync,
    linkStatus = fs.lstatSync,
    readLink = fs.readlinkSync,
) {
    const canonicalSkillPath = path.join(
        userHome,
        ...skillPaths.canonicalSkillPath,
    );
    const claudeSkillPath = path.join(userHome, ...skillPaths.claudeSkillPath);

    let status;
    try {
        status = linkStatus(claudeSkillPath);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }

    const linkTarget = status?.isSymbolicLink()
        ? path.resolve(path.dirname(claudeSkillPath), readLink(claudeSkillPath))
        : undefined;
    if (linkTarget === path.resolve(canonicalSkillPath)) {
        remove(claudeSkillPath, { recursive: true, force: true });
    }

    remove(canonicalSkillPath, {
        recursive: true,
        force: true,
    });
}

if (require.main === module) {
    uninstallSkill();
}

module.exports = { uninstallSkill };
