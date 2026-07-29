const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function uninstallSkill(userHome = os.homedir(), remove = fs.rmSync) {
    remove(path.join(userHome, '.agents', 'skills', 'topo-cli-location'), {
        recursive: true,
        force: true,
    });
}

if (require.main === module) {
    uninstallSkill();
}

module.exports = { uninstallSkill };
