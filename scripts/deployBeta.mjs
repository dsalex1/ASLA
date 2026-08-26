/**
 * Publishes a beta build to the separate GitHub Pages repository.
 *
 * The build output is force-pushed as a single commit from a throwaway
 * repository in a temp dir, so no build artifacts ever land on this branch and
 * the beta repo never accumulates history nobody reads.
 *
 * The version comes from package.json and must already be ahead of master: the workflow
 * is to bump it in the first commit of a branch, so every beta of an unreleased version
 * is numbered from 1 and a forgotten bump is caught here rather than on the phone.
 *
 * Prerequisites, both one-off:
 *   1. an empty GitHub repo whose name matches VITE_BASE_URL in .env.beta
 *   2. that repo's Settings > Pages set to branch `master`, folder `/docs`
 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// only npm needs a shell on Windows (it is a .cmd); running git through one would
// re-split arguments and break the commit message
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: cmd === 'npm' && process.platform === 'win32' })
const capture = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()

const base = (readFileSync('.env.beta', 'utf8').match(/^VITE_BASE_URL=(.+)$/m) ?? [])[1]
if (!base) throw new Error('VITE_BASE_URL missing from .env.beta')
const repoName = base.replace(/\//g, '')

// same owner as origin, so this keeps working whatever the account is called
const origin = capture('git', ['remote', 'get-url', 'origin'])
const remote = process.env.BETA_REMOTE ?? origin.replace(/[^/]+?(\.git)?$/, `${repoName}.git`)

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

// A beta that carries master's version is indistinguishable from production once it is
// on the phone, which is the whole thing this numbering exists to prevent.
run('git', ['fetch', '-q', 'origin', 'master'])
const released = JSON.parse(capture('git', ['show', 'origin/master:package.json'])).version
if (version === released)
  throw new Error(`package.json is still ${version}, the version already on master. Bump it before deploying a beta.`)

// The counter lives in an untracked file so the version bump never becomes a commit, and
// it is keyed to the version so each unreleased version counts from 1.
const COUNTER = '.beta-build'
const [countedFor, count] = existsSync(COUNTER) ? readFileSync(COUNTER, 'utf8').trim().split(/\s+/) : []
const build = countedFor === version ? Number(count) + 1 : 1
writeFileSync(COUNTER, `${version} ${build}`)

console.log(`building ${version}-beta${build} for ${base}`)
process.env.BETA_BUILD = String(build)
run('npm', ['run', 'build:beta'])
if (!existsSync('dist-beta/index.html')) throw new Error('build produced no dist-beta/index.html')

const staging = mkdtempSync(join(tmpdir(), 'asla-beta-'))
try {
  cpSync('dist-beta', join(staging, 'docs'), { recursive: true })
  // Pages runs Jekyll otherwise, which silently drops files it does not like
  writeFileSync(join(staging, 'docs', '.nojekyll'), '')

  run('git', ['init', '-q', '-b', 'master'], staging)
  run('git', ['add', '-A'], staging)
  run('git', ['commit', '-q', '-m', `${version}-beta${build} from ${capture('git', ['rev-parse', '--short', 'HEAD'])}`], staging)
  run('git', ['push', '-q', '--force', remote, 'master'], staging)
  console.log(`\npublished beta ${build} to https://${remote.split('/').at(-2)}.github.io/${repoName}/`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}
