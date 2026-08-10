const skillName = 'topo-cli-location';
const canonicalSkillsDirectory = ['.agents', 'skills'];
const claudeSkillsDirectory = ['.claude', 'skills'];

export const skillPaths = {
    canonicalSkillsDirectory,
    canonicalSkillPath: [...canonicalSkillsDirectory, skillName],
    claudeSkillsDirectory,
    claudeSkillPath: [...claudeSkillsDirectory, skillName],
    skillName,
} as const;
