const { execSync } = require('child_process');
const { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } = require('fs');
const { tmpdir } = require('os');
const { dirname, join } = require('path');

const root = process.cwd();
const protoFile = join(root, 'proto', 'payment', 'v1', 'payment.proto');

function hasProto() {
  return existsSync(protoFile) && statSync(protoFile).size > 0;
}

function submoduleSha() {
  const line = execSync('git ls-tree HEAD proto', { cwd: root, encoding: 'utf8' }).trim();
  const sha = line.split(/\s+/)[2];
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`Could not read the proto submodule commit from "git ls-tree HEAD proto": ${line || '(empty)'}`);
  }
  return sha;
}

function githubRepo() {
  const gitmodules = readFileSync(join(root, '.gitmodules'), 'utf8');
  const match = gitmodules.match(/url\s*=\s*https:\/\/github\.com\/([^/\s]+)\/([^.\s]+)/);
  if (!match) {
    throw new Error('Could not parse the proto submodule GitHub URL from .gitmodules');
  }
  return `${match[1]}/${match[2]}`;
}

function main() {
  if (hasProto()) {
    console.log(`Using ${protoFile}`);
    return;
  }

  const sha = submoduleSha();
  const repo = githubRepo();
  const tmp = mkdtempSync(join(tmpdir(), 'payment-proto-'));

  console.log(`proto submodule checkout is empty. Cloning ${repo}@${sha}`);

  try {
    execSync(`git clone https://github.com/${repo}.git ${tmp}`, { stdio: 'inherit' });
    execSync(`git -C ${tmp} checkout ${sha}`, { stdio: 'inherit' });

    const source = join(tmp, 'payment', 'v1', 'payment.proto');
    if (!existsSync(source)) {
      throw new Error(`payment.proto is not in ${repo} at ${sha}`);
    }

    mkdirSync(dirname(protoFile), { recursive: true });
    copyFileSync(source, protoFile);
    console.log(`Wrote ${protoFile}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
