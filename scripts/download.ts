#!npx ts-node

import fs from 'fs';
import path from 'path';
import nodeOs from 'os';
import yargs from 'yargs';
import extract from 'extract-zip';
import * as manifest from '../src/manifest';
import * as tar from 'tar';

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
    'darwin-arm64',
] as const;
type DownloadTarget = (typeof DOWNLOAD_TARGETS)[number];

const GITHUB_REGEX =
    /^https:\/\/github.com\/(.+)\/(.+)\/releases\/download\/(.+)\/(.+)$/;

const readFromUrl = async (url: string, token: string): Promise<Response> => {
    let response: Response;

    const githubMatch = url.match(GITHUB_REGEX);
    if (githubMatch) {
        // Fetch from GitHub
        const user = githubMatch[1];
        const repo = githubMatch[2];
        const tagName = githubMatch[3];
        const assetName = githubMatch[4];

        const apiResponse = await fetch(
            `https://api.github.com/repos/${user}/${repo}/releases/tags/${tagName}`,
            {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3.raw',
                },
            },
        );

        const release = (await apiResponse.json()) as Release;
        if (!release) {
            throw new Error(`Release ${tagName} not found`);
        }
        if (release.status && release.status !== '200') {
            throw new Error(
                `Release ${tagName} fetching failed. Status="${release.status}" Message="${release.message}".`,
            );
        }

        const asset = release.assets.find((item) => item.name === assetName);
        if (!asset) {
            throw new Error(`Asset ${assetName} not found`);
        }

        response = await fetch(asset.url, {
            redirect: 'manual',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/octet-stream',
            },
        });

        if (response.status === 302) {
            const authenticatedUrl = response.headers.get('location')!;
            response = await fetch(authenticatedUrl, {
                headers: {
                    Accept: 'application/octet-stream',
                },
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

const findFileInDir = (dir: string, filename: string): string | undefined => {
    const entries = fs.readdirSync(dir, {
        recursive: true,
        withFileTypes: true,
    });
    for (const entry of entries) {
        if (entry.isFile() && entry.name === filename) {
            return path.join(entry.parentPath, entry.name);
        }
    }
    return undefined;
};

const extractFileFromArchive = async (
    buffer: Buffer,
    destPath: string,
    filename: string,
    type: 'tar' | 'zip',
): Promise<void> => {
    const ext = type === 'tar' ? '.tar.gz' : '.zip';
    const tmpArchive = `${destPath}${ext}`;
    const tmpDir = fs.mkdtempSync(path.join(nodeOs.tmpdir(), 'topo-'));
    fs.writeFileSync(tmpArchive, buffer);
    try {
        fs.mkdirSync(tmpDir, { recursive: true });
        if (type === 'tar') {
            await tar.x({
                file: tmpArchive,
                cwd: tmpDir,
            });
        } else if (type === 'zip') {
            await extract(tmpArchive, {
                dir: path.resolve(tmpDir),
            });
        }
        const targetFilePath = findFileInDir(tmpDir, filename);
        if (!targetFilePath) {
            throw new Error(`Couldn't find "${filename}" in archive`);
        }
        fs.copyFileSync(targetFilePath, destPath);
    } finally {
        if (fs.existsSync(tmpArchive)) {
            fs.unlinkSync(tmpArchive);
        }
        if (fs.existsSync(tmpDir)) {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.warn(
                    `Warning: Failed to remove temporary directory "${tmpDir}":`,
                    cleanupErr,
                );
            }
        }
    }
};

/**
 * Download a file and get its contents.
 * A URL must be used as a path
 *
 * @param sourcePath - Path to the file (locally or http)
 * @param destPath - Path to the file to be saved
 * @param filename - Filename inside the archive to extract
 * @param token - GitHub token for authentication
 */
const downloadFile = async (
    sourcePath: string,
    destPath: string,
    filename: string,
    token: string,
): Promise<void> => {
    if (!sourcePath.startsWith('http')) {
        throw new Error(
            `Invalid source path: ${sourcePath}. Must be a http URL.`,
        );
    }
    const response = await readFromUrl(sourcePath, token);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Detect archive type by magic bytes
    const isGzip = sourcePath.endsWith('.tar.gz');
    const isZip = sourcePath.endsWith('.zip');
    if (isGzip) {
        await extractFileFromArchive(buffer, destPath, filename, 'tar');
    } else if (isZip) {
        await extractFileFromArchive(buffer, destPath, filename, 'zip');
    } else {
        throw new Error(
            `Unsupported archive format for "${sourcePath}"; expected .tar.gz or .zip`,
        );
    }
};

// --- Parse CLI args ---------------------------------------------------------
const parsedArgs = yargs(process.argv.slice(2))
    .option('t', {
        alias: 'target',
        description: 'VS Code extension target, defaults to system',
        choices: DOWNLOAD_TARGETS,
        default: `${nodeOs.platform()}-${nodeOs.arch()}`,
    })
    .option('token', {
        description: 'GitHub token for downloading release assets',
        type: 'string',
        default: process.env.GITHUB_TOKEN,
        defaultDescription: 'GITHUB_TOKEN env var',
    })
    .option('ci', {
        description: 'Only download if running in CI environment',
        type: 'boolean',
        default: false,
    })
    .check((argv) => {
        if (argv.ci && !process.env.CI) {
            console.log(
                '→ Skipping download since not running in CI environment. Use `npm run download` to download locally.',
            );
            process.exit(0);
        }
        return true;
    })
    .check((argv) => {
        if (!argv.token) {
            throw new Error(
                '✖ No GitHub token provided via --token or GITHUB_TOKEN',
            );
        }
        return true;
    })
    .version(false)
    .strict()
    .command('$0', 'Downloads the tool for the given architecture and OS')
    .parseSync() as unknown as { target: DownloadTarget; token: string };

const target = parsedArgs.target;
const githubToken = parsedArgs.token;

// --- Read package.json ------------------------------------------------------
const pkgPath = path.resolve(process.cwd(), 'package.json');
if (!fs.existsSync(pkgPath)) {
    console.error(`✖ couldn’t find package.json at ${pkgPath}`);
    process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const key = manifest.TOPO_CLI;
const section = pkg[key];
if (!section || typeof section.version !== 'string') {
    console.error(
        `✖ package.json must have a top-level "${key}" object with a string "version" property.`,
    );
    process.exit(1);
}
const version = section.version.replace(/^v/, '');

// --- Determine asset name ---------------------------------------------------
const assetMapping: Record<string, string> = {
    'linux-x64': `topo_linux_amd64.tar.gz`,
    'linux-arm64': `topo_linux_arm64.tar.gz`,
    'darwin-arm64': `topo_darwin_arm64.tar.gz`,
    'win32-x64': `topo_windows_amd64.zip`,
};
const isWin = target.startsWith('win32');
const topoFilename = isWin ? `${manifest.TOPO_CLI_WINDOWS}` : manifest.TOPO_CLI;
const destFilename = `resources/${topoFilename}`;
const assetName = assetMapping[`${target}`];
if (!assetName) {
    console.error(`✖ No asset found for ${target}`);
    process.exit(1);
}

// --- Compose download URL ---------------------------------------------------
const tag = `v${version}`;
const downloadUrl = `https://github.com/arm/topo/releases/download/${tag}/${assetName}`;
console.log(`→ Downloading ${downloadUrl}`);

// --- Perform download --------------------------------------------------------
(async () => {
    try {
        await downloadFile(
            downloadUrl,
            destFilename,
            topoFilename,
            githubToken,
        );
        fs.chmodSync(destFilename, '755');
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : err;
        console.error('✖ Error fetching release asset:', errorMsg);
        process.exit(1);
    }
})();
