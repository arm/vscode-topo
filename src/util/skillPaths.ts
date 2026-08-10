const skillName = 'topo-cli-location';
const canonicalSkillsDirectory = ['.agents', 'skills'];

export const skillPaths = {
    canonicalSkillsDirectory,
    canonicalSkillPath: [...canonicalSkillsDirectory, skillName],
    skillName,
} as const;
