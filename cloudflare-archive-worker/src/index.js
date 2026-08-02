import existingWorker from '../upstream/divine-manager-feed-worker/src/index.js'
import { runPublish, seed, seedFeeder, runFeederBackfill } from './archive-publisher.js'

// The archive publisher shares the existing Worker D1 binding. Keeping this
// adapter at the boundary lets the preserved indexer code continue to use DB,
// while the additive publisher module retains its explicit ARCHIVE_DB name.
const withArchiveDb = (env) => new Proxy(env, {
  get(target, property, receiver) {
    return property === 'ARCHIVE_DB' ? target.DB : Reflect.get(target, property, receiver)
  },
})

const runExistingSchedule = async (event, env) => {
  let work = Promise.resolve()
  await existingWorker.scheduled(event, env, {
    waitUntil(promise) {
      work = Promise.resolve(promise)
    },
  })
  return work
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url)
    if (url.pathname === '/archive/health') return Response.json({ ok: true, publisherConfigured: Boolean(env.PUBLISH_TOKEN) })
    if (url.pathname.startsWith('/archive/admin/')) {
      if (request.headers.get('authorization') !== `Bearer ${env.PUBLISH_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 })
      }
      try {
        const archiveEnv = withArchiveDb(env)
        if (url.pathname === '/archive/admin/seed' && request.method === 'POST') {
          return Response.json(await seed(archiveEnv, request))
        }
        if (url.pathname === '/archive/admin/publish' && request.method === 'POST') {
          return Response.json(await runPublish(archiveEnv))
        }
        if (url.pathname === '/archive/admin/feeder/initialize' && request.method === 'POST') {
          const result = await seedFeeder(archiveEnv)
          return Response.json({ ...result, manifest: await runPublish(archiveEnv) })
        }
        if (url.pathname === '/archive/admin/feeder/backfill' && request.method === 'POST') {
          return Response.json(await runFeederBackfill(archiveEnv))
        }
        return new Response('Not found', { status: 404 })
      } catch (error) {
        console.error(error)
        return Response.json({ error: error instanceof Error ? error.message : 'Archive publication failed' }, { status: 500 })
      }
    }
    return existingWorker.fetch(request, env, context)
  },

  async scheduled(event, env, context) {
    // Both cron expressions fire at the top of the hour. The hourly trigger
    // owns that minute so index completion and publication are strictly ordered.
    if (event.cron === '* * * * *') {
      if (new Date(event.scheduledTime ?? Date.now()).getUTCMinutes() === 0) return
      context.waitUntil(runExistingSchedule(event, env))
      return
    }
    if (event.cron === '0 * * * *') {
      context.waitUntil(runExistingSchedule(event, env).then(() => runPublish(withArchiveDb(env))))
      return
    }
    context.waitUntil(runExistingSchedule(event, env))
  },
}
