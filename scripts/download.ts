#!npx ts-node

import fs from 'fs';
import path from 'path';
import nodeOs from 'os';
import yargs from 'yargs';

interface Asset {
    name: string;
    url: string;
}

interface Release {
    name: string;
    assets: Asset[];
    status?: string;
    message?: string;
}

const DOWNLOAD_TARGETS = [
    'win32-x64',
    'win32-arm64',
    'linux-x64',
    'linux-arm64',
    'darwin-x64',
    'darwin-arm64'
] as const;
type DownloadTarget = typeof DOWNLOAD_TARGETS[number];

const GITHUB_REGEX = /^https:\/\/github.com\/(.+)\/(.+)\/releases\/download\/(.+)\/(.+)$/;

const readFromUrl = async (url: string, token: string): Promise<Response> => {

    let response: Response;

    const match = url.match(GITHUB_REGEX);
    if (match) {
    // Fetch from GitHub
        const user = match[1];
        const repo = match[2];
        const tagName = match[3];
        const assetName = match[4];

        const apiResponse = await fetch(`https://api.github.com/repos/${user}/${repo}/releases/tags/${tagName}`, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3.raw'
            }
        });

        const release = await apiResponse.json() as Release;
        if (!release) {
            throw new Error(`Release ${tagName} not found`);
        }
        if (release.status && release.status !== '200') {
            throw new Error(`Release ${tagName} fetching failed. Status="${release.status} Message="${release.message}".`);
        }

        const asset = release.assets.find(item => item.name === assetName);
        if (!asset) {
            throw new Error(`Asset ${assetName} not found`);
        }

        response = await fetch(asset.url, {
            redirect: 'manual',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/octet-stream'
            }
        });

        if (response.status === 302) {
            // Redirect URLs now contain the auth key, redirect without the auth header
            const authenticatedUrl = response.headers.get('location')!;
            response = await fetch(authenticatedUrl, {
                headers: {
                    Accept: 'application/octet-stream'
                }
            });
        }
        if (!response.ok) {
            const body = await response.text();
            const msg = `Asset ${assetName} download failed. Status="${response.status}". Body="${body}".`;
            throw new Error(msg);
        }
    } else {
    // Fetch from URL
        response = await fetch(url);
        if (!response.ok) {
            const body = await response.text();
            const msg = `Request to ${url} failed. Status="${response.status}". Body="${body}".`;
            throw new Error(msg);
        }
    }
    return response;
};

/**
 * Download a file and get its contents.
 * A URL must be used as a path
 *
 * @param sourcePath - Path to the file (locally or http)
 * @param destPath - Path to the file to be saved
 * @param token - GitHub token for authentication
 */
const downloadFile = async (sourcePath: string, destPath: string, token: string): Promise<void> => {

    if (!sourcePath.startsWith('http')) {
        throw new Error(`Invalid source path: ${sourcePath}. Must be a http URL.`);
    }
    const response = await readFromUrl(sourcePath, token);
    const buffer = await response.arrayBuffer();
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, Buffer.from(buffer), 'binary');
};

// --- Parse CLI args ---------------------------------------------------------
const argv = process.argv.slice(2);
let githubToken: string | undefined;

for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--token' || argv[i] === '-t') && argv[i+1]) {
        githubToken = argv[i+1];
        i++;
    }
}

if (!githubToken) {
    githubToken = process.env.GITHUB_TOKEN;
}

if (!githubToken) {
    console.error('✖ No GitHub token provided via --token or GITHUB_TOKEN; public assets only.');
    process.exit(1);
}

const parsedArgs = yargs(process.argv.slice(2))
    .option('t', {
        alias: 'target',
        description: 'VS Code extension target, defaults to system',
        choices: DOWNLOAD_TARGETS,
        default: `${nodeOs.platform()}-${nodeOs.arch()}`
    })
    .version(false)
    .strict()
    .command('$0', 'Downloads the tool for the given architecture and OS')
    .parseSync() as unknown as { target: DownloadTarget };

const target = parsedArgs.target;

// --- Read package.json ------------------------------------------------------
const pkgPath = path.resolve(process.cwd(), 'package.json');
if (!fs.existsSync(pkgPath)) {
    console.error(`✖ couldn’t find package.json at ${pkgPath}`);
    process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const key = 'topo';
const section = pkg[key];
if (!section || typeof section.version !== 'string') {
    console.error(`✖ package.json must have a top-level "${key}" object with a string "version" property.`);
    process.exit(1);
}
const version = section.version.replace(/^v/, '');

// --- Parse GitHub repo owner/name -------------------------------------------
const repository = {
    url: 'https://github.com/Arm-Debug/topo-cli'
};
const m = repository.url.match(
    /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/
);
if (!m) {
    console.error(`✖ couldn’t parse owner/repo out of repository.url="${repository.url}"`);
    process.exit(1);
}
const [ , owner, repo ] = m;

// --- Determine asset name ---------------------------------------------------
const assetMapping: Record<string, string> = {
    'linux-x64': 'topo-linux-amd64',
    'linux-arm64': 'topo-linux-arm64',
    'darwin-arm64': 'topo-darwin-arm64',
    'win32-x64': 'topo-windows-amd64.exe',
};
const isWin = target.startsWith('win32');
const destFilename = `resources/${key}${isWin ? '.exe' : ''}`;
const assetName = assetMapping[`${target}`];
if (!assetName) {
    console.error(`✖ No asset found for ${target}`);
    process.exit(1);
}

// --- Compose download URL ---------------------------------------------------
const tag = `v${version}`;
const downloadUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${assetName}`;
console.log(`→ Downloading ${downloadUrl}`);

// --- Perform download --------------------------------------------------------
(async () => {
    try {
        await downloadFile(downloadUrl, destFilename, githubToken);
        fs.chmodSync(destFilename, '755');
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : err;
        console.error('✖ Error fetching release asset:', errorMsg);
        process.exit(1);
    }
})();
