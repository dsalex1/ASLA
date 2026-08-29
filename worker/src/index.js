/**
 * ASLA stem separation.
 *
 * The app cannot hold the Moises credential — it ships to every device — so the three
 * privileged steps live here: sign in, upload, create the task. Everything else stays in
 * the browser, and the finished stem URLs are public, so no stem audio comes back through
 * this worker either; only the source track passes through, once, on its way up.
 *
 * Callers are the app's own signed-in users: the bearer token is a Firebase ID token,
 * checked against the projects below. Without that the endpoint would let anyone spend
 * the account's separations.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** the web API keys of the two deployments; a token is accepted if either project knows it */
const FIREBASE_KEYS = ['AIzaSyDR5ik7GoUZA142kws0i-b6NtfUAivS0WM', 'AIzaSyDdCLo4E3zko-_ctb3qtmXzu-5x-VBtEDk']
const MOISES_KEY = 'AIzaSyDWcFRZcUnN5EPNNA7jrcuS3HlIvMqtuCs' // public web key, referrer-locked
const MOISES_GQL = 'https://api.moises.ai/graphql'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

/* ------------------------------------------------------------------------ auth ----- */

/** The signed-in user behind an ID token, or null. `accounts:lookup` is the whole check. */
async function verify(token) {
  for (const key of FIREBASE_KEYS) {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify({ idToken: token }),
    })
    if (!response.ok) continue
    const body = await response.json().catch(() => ({}))
    if (body.users?.length) return body.users[0]
  }
  return null
}

/* ---------------------------------------------------------------------- moises ----- */

// Studio sends these on every call. A mutation missing the apollo client name comes back
// as a plain 500 rather than an auth error, and the token goes in bare, with no "Bearer ".
const moisesHeaders = (token) => ({
  authorization: token,
  'x-client-name': 'ai.moises-studio-web',
  'x-client-version': '1.0.0',
  'apollographql-client-name': 'ai.moises-studio-web',
  'apollographql-client-version': '0.1.0',
  'apollographql-client-locale': 'en-US',
  accept: 'application/graphql-response+json, application/json',
  'content-type': 'application/json',
  'user-agent': UA,
  origin: 'https://studio.moises.ai',
  referer: 'https://studio.moises.ai/',
})

const VALID_STEMS = new Set(['vocals', 'guitars', 'bass', 'drums', 'piano', 'keys', 'wind', 'strings'])
const MAX_STEMS = 5 // OPERATION_NOT_ALLOWED_MORE_THAN_5_STEMS; the residual "other" rides along

// An ID token is good for an hour. The isolate usually outlives a separation, so caching
// it here is enough to keep a poll from signing in every few seconds, and losing it costs
// one extra sign-in rather than anything breaking.
let cached = { token: '', until: 0 }

async function moisesToken(env) {
  if (cached.token && Date.now() < cached.until) return cached.token
  if (!env.MOISES_EMAIL || !env.MOISES_PASSWORD) throw new Error('moises credentials not configured')
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${MOISES_KEY}`, {
    method: 'POST',
    // the key's referrer restriction is only a header check, so sending one is enough
    headers: { 'content-type': 'application/json', referer: 'https://studio.moises.ai/', 'user-agent': UA },
    body: JSON.stringify({ email: env.MOISES_EMAIL, password: env.MOISES_PASSWORD, returnSecureToken: true }),
  })
  const body = await response.json().catch(() => ({}))
  if (!body.idToken) throw new Error(`moises sign-in failed: ${body.error?.message ?? response.status}`)
  cached = { token: body.idToken, until: Date.now() + 50 * 60_000 }
  return body.idToken
}

async function gql(env, query, variables) {
  const response = await fetch(MOISES_GQL, {
    method: 'POST',
    headers: moisesHeaders(await moisesToken(env)),
    body: JSON.stringify({ query, variables: variables ?? {} }),
  })
  const body = await response.json().catch(() => null)
  if (!body) throw new Error(`moises ${response.status}`)
  if (body.errors) throw new Error(body.errors[0].message)
  return body.data
}

/**
 * Upload the track and start the work: the separation itself, the beat and chord pass
 * that carries bpm, key and the rendered click, and the sections. SEGMENTATION_A and _B
 * are not on this plan and answer a request for them with a 500, so _C is the one to ask
 * for. Returns the task id to poll.
 */
async function startSeparation(env, sourceUrl, name, stems) {
  const source = await fetch(sourceUrl)
  if (!source.ok) throw new Error(`could not read the track (${source.status})`)

  const { uploadFile } = await gql(
    env,
    'mutation($i:String!){uploadFile(input:$i,type:FILESYSTEM,resumable:false){signedUrl tempLocation}}',
    { i: `${name}.audio` }
  )
  const put = await fetch(uploadFile.signedUrl, { method: 'PUT', body: await source.arrayBuffer() })
  if (!put.ok) throw new Error(`upload PUT ${put.status}`)

  const { createTask } = await gql(env, 'mutation($f:FileInput!,$o:[OperationInput]){createTask(file:$f,operations:$o)}', {
    f: { provider: 'FILESYSTEM', tempLocation: uploadFile.tempLocation, name, input: `${name}.audio` },
    o: [
      { name: 'SEPARATE_CUSTOM', params: { stems } },
      { name: 'BEATSCHORDS_A', params: {} },
      { name: 'SEGMENTATION_C', params: {} },
    ],
  })
  return createTask
}

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'ERROR'])

/**
 * What the task has produced so far. The separation is what the caller waits on, but the
 * analysis is reported with it, so the answer is only COMPLETED once every operation has
 * settled — otherwise a fast separation would arrive without the bpm the app wants.
 */
async function separationStatus(env, taskId) {
  const { track } = await gql(env, 'query($id:String!){track(id:$id){operations{name status statusReason result files}}}', {
    id: taskId,
  })
  const operations = track?.operations ?? []
  const find = (name) => operations.find((o) => o.name === name)
  const separate = find('SEPARATE_CUSTOM')
  if (!separate) return { status: 'PENDING' } // the row exists a beat before its operations do
  if (separate.status !== 'COMPLETED') return { status: separate.status, error: separate.statusReason ?? undefined }
  if (!operations.every((o) => TERMINAL.has(o.status))) return { status: 'RUNNING' }

  const beats = find('BEATSCHORDS_A')
  const sections = find('SEGMENTATION_C')
  const segmentsUrl = sections?.files?.segments
  const segments = segmentsUrl
    ? await fetch(segmentsUrl)
        .then((r) => (r.ok ? r.json() : undefined))
        .catch(() => undefined)
    : undefined

  return {
    status: 'COMPLETED',
    stems: separate.files ?? {},
    metronome: beats?.files?.metronome,
    bpm: beats?.result?.bpm,
    key: beats?.result?.key,
    tuning: beats?.result?.estimatedTuning,
    segments,
  }
}

/* --------------------------------------------------------------------- handler ----- */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(request.url)

    if (url.pathname === '/') return json({ ok: true, service: 'asla-stems', endpoints: ['/split'] })
    if (url.pathname !== '/split') return json({ error: 'not found' }, 404)

    const token = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '')
    if (!token || !(await verify(token))) return json({ error: 'sign in first' }, 401)

    try {
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const stems = Array.isArray(body?.stems) ? body.stems : []
        if (!stems.length || stems.length > MAX_STEMS || stems.some((s) => !VALID_STEMS.has(s)))
          return json({ error: `stems must be 1-${MAX_STEMS} of: ${[...VALID_STEMS].join(', ')}` }, 400)
        if (typeof body.url !== 'string' || !body.url.startsWith('https://'))
          return json({ error: 'a track url is required' }, 400)
        const name = (body.name ?? 'track').replace(/[^\w -]/g, '').slice(0, 60) || 'track'
        return json({ taskId: await startSeparation(env, body.url, name, stems) })
      }

      const taskId = url.searchParams.get('taskId')
      if (!taskId) return json({ error: 'taskId is required' }, 400)
      return json(await separationStatus(env, taskId))
    } catch (e) {
      return json({ error: String(e.message ?? e) }, 502)
    }
  },
}
