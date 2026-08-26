/**
 * Publishes a beta build to the separate GitHub Pages repository.
 *
 * The build output is force-pushed as a single commit from a throwaway
 * repository in a temp dir, so no build artifacts ever land on this branch and
 * the beta repo never accumulates history nobody reads.
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

// The counter lives in an untracked file so the version bump never becomes a commit.
// It starts at 2: the first beta upload was the plain `-beta` build.
const COUNTER = '.beta-build'
const build = (existsSync(COUNTER) ? Number(readFileSync(COUNTER, 'utf8')) : 1) + 1
writeFileSync(COUNTER, String(build))

console.log(`building beta ${build} for ${base}`)
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
  run('git', ['commit', '-q', '-m', `beta ${build} from ${capture('git', ['rev-parse', '--short', 'HEAD'])}`], staging)
  run('git', ['push', '-q', '--force', remote, 'master'], staging)
  console.log(`\npublished beta ${build} to https://${remote.split('/').at(-2)}.github.io/${repoName}/`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}
