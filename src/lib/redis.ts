import IORedis from 'ioredis'
import { config } from '../config/index.js'

let client: IORedis | null = null

export function getRedis(): IORedis {
  if (!client) {
    client = new IORedis(config.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
    })

    client.on('error', (err) => {
      console.error('[Redis] connection error', err)
    })
  }
  return client
}

export async function setJson(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis()
  const payload = JSON.stringify(value)
  if (ttlSeconds > 0) {
    await redis.set(key, payload, 'EX', ttlSeconds)
  } else {
    await redis.set(key, payload)
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  const raw = await redis.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function delKeys(keys: string[]): Promise<void> {
  if (!keys.length) return
  const redis = getRedis()
  await redis.del(keys)
}

export async function withLock<T>(
  lockKey: string,
  ttlMs: number,
  task: () => Promise<T>
): Promise<T> {
  const redis = getRedis()
  const token = `${Date.now()}-${Math.random()}`
  const acquired = await redis.set(lockKey, token, 'PX', ttlMs, 'NX')
  if (!acquired) {
    // Someone else is fetching; wait briefly then return stale/null
    await new Promise((r) => setTimeout(r, 200))
    const cached = await getJson<T>(lockKey.replace(':lock', ''))
    if (cached) return cached
    // fallthrough: run anyway to avoid deadlock
  }

  try {
    const result = await task()
    return result
  } finally {
    if (acquired) {
      const current = await redis.get(lockKey)
      if (current === token) {
        await redis.del(lockKey)
      }
    }
  }
}