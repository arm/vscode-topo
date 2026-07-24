import fs from 'node:fs';
import path from 'node:path';
import nodeOs from 'node:os';
import { createHash } from 'node:crypto';
import yargs from 'yargs';
import extract from 'extract-zip';
import * as tar from 'tar';
import * as manifest from '../src/manifest.ts';

const DOWNLOAD_TARGETS = [
    'win32-x64',
    'win32-arm64',
    'linux-x64',
    'linux-arm64',
    'darwin-x64',
    'darwin-arm64',
] as const;
type DownloadTarget = (typeof DOWNLOAD_TARGETS)[number];

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

const isSha256 = (value: unknown): value is string =>
    typeof value === 'string' && SHA256_PATTERN.test(value);

const readFromUrl = async (url: string): Promise<Response> => {
    const response = await fetch(url);
    if (response.ok) {
        return response;
    }

    const body = await response.text();
    throw new Error(
        `Request to ${url} failed. Status="${response.status}". Body="${body}".`,
    );
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
 * @param sourcePath - HTTPS URL of the archive to download
 * @param destPath - Path to the file to be saved
 * @param filename - Filename inside the archive to extract
 * @param expectedSha256 - Expected SHA-256 digest of the downloaded archive
 */
const downloadFile = async (
    sourcePath: string,
    destPath: string,
    filename: string,
    expectedSha256: string,
): Promise<void> => {
    if (!sourcePath.startsWith('http')) {
        throw new Error(
            `Invalid source path: ${sourcePath}. Must be a http URL.`,
        );
    }
    const response = await readFromUrl(sourcePath);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const actualSha256 = createHash('sha256').update(buffer).digest('hex');
    if (actualSha256 !== expectedSha256.toLowerCase()) {
        throw new Error(
            `Downloaded archive SHA-256 mismatch for "${sourcePath}".\nExpected SHA-256: ${expectedSha256}\nCalculated SHA-256: ${actualSha256}`,
        );
    }

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
    .help('h')
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

const section = pkg[manifest.TOPO_CLI];
if (!section || typeof section.version !== 'string') {
    console.error(
        `✖ package.json must have a top-level "${manifest.TOPO_CLI}" object with a string "version" property.`,
    );
    process.exit(1);
}
const version = section.version;
const expectedSha256 = section.sha256?.[target];
if (!isSha256(expectedSha256)) {
    console.error(
        `✖ package.json must have a valid SHA-256 digest at "${manifest.TOPO_CLI}.sha256.${target}".\nConfigured SHA-256: ${expectedSha256 ?? '<missing>'}`,
    );
    process.exit(1);
}

// --- Determine asset name ---------------------------------------------------
const assetMapping: Record<DownloadTarget, string> = {
    'linux-x64': 'linux/topo_linux_amd64.tar.gz',
    'linux-arm64': 'linux/topo_linux_arm64.tar.gz',
    'darwin-x64': 'macos/topo_darwin_amd64.tar.gz',
    'darwin-arm64': 'macos/topo_darwin_arm64.tar.gz',
    'win32-x64': 'windows/topo_windows_amd64.zip',
    'win32-arm64': 'windows/topo_windows_arm64.zip',
};
const isWin = target.startsWith('win32');
const topoFilename = isWin ? `${manifest.TOPO_CLI_WINDOWS}` : manifest.TOPO_CLI;
const destFilename = `resources/${topoFilename}`;
const assetPath = assetMapping[target];

// --- Compose download URL ---------------------------------------------------
const tag = `v${version}`;
const downloadUrl = `https://artifacts.tools.arm.com/topo/${tag}/${assetPath}`;
console.log(`→ Downloading ${downloadUrl}`);

// --- Perform download --------------------------------------------------------
void (async () => {
    try {
        await downloadFile(
            downloadUrl,
            destFilename,
            topoFilename,
            expectedSha256,
        );
        fs.chmodSync(destFilename, '755');
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : err;
        console.error('✖ Error fetching release asset:', errorMsg);
        process.exit(1);
    }
})();
