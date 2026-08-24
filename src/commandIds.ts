import { PACKAGE_NAME } from './manifest';

function command(id: string): string {
    return `${PACKAGE_NAME}.${id}`;
}

export const refreshHost = command('refreshHost');
export const refreshProjects = command('refreshProjects');
export const refreshTargetData = command('refreshTargetData');
export const refreshProjectContainers = command('refreshProjectContainers');
export const refreshSelectedTargetHealth = command(
    'refreshSelectedTargetHealth',
);
export const refreshSkillStatus = command('refreshSkillStatus');
export const showOutput = command('showOutput');
export const selectTarget = command('selectTarget');
export const resetExtensionData = command('resetExtensionData');
export const clearTargetSelection = command('clearTargetSelection');
export const openSettings = command('openSettings');
export const cloneProject = command('cloneProject');
export const deploy = command('deploy');
export const deployContext = command('deploy.context');
export const deployProject = command('deployProject');
export const configure = command('configure.context');
export const configureProject = command('configureProject');
export const stop = command('stop.context');
export const stopProject = command('stopProject');
export const openContainerShell = command('openContainerShell');
export const connectViaSSH = command('connectViaSSH');
export const openContainerInBrowser = command('openContainerInBrowser');
export const startContainer = command('startContainer');
export const stopContainer = command('stopContainer');
export const deleteContainer = command('deleteContainer');
export const fixIssue = command('fixIssue');
export const fixTargetIssues = command('fixTargetIssues');
export const remoteClone = command('remoteClone');
export const localClone = command('localClone');
export const installSkill = command('installSkill');
export const uninstallSkill = command('uninstallSkill');
