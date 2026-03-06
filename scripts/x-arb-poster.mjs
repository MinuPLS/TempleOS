import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createHmac, randomBytes } from 'node:crypto'

const X_MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json'
const X_STATUS_UPDATE_URL = 'https://api.twitter.com/1.1/statuses/update.json'
const MAX_POST_LENGTH = 280
const MAX_APPEND_CHUNK_SIZE = 4 * 1024 * 1024

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const percentEncode = (value) =>
  encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )

const decodeHtmlEntities = (value) =>
  String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim()

const stripHtml = (value) =>
  decodeHtmlEntities(
    String(value)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )

const extractLinkByLabel = (message, label) => {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matcher = new RegExp(
    `<a\\s+[^>]*href=["']([^"']+)["'][^>]*>\\s*${safeLabel}\\s*<\\/a>`,
    'i'
  )
  const match = String(message).match(matcher)
  return match?.[1] ?? null
}

const truncateForX = (text, limit = MAX_POST_LENGTH) => {
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`
}

const extractValueLine = (lines, prefix) =>
  lines.find((line) => line.toLowerCase().startsWith(prefix.toLowerCase())) ?? null

const PARTNER_SYMBOL_BY_LABEL = {
  briah: 'BRIAH',
  coinmafia: 'COINMAFIA',
  dumbmoney: 'DUMB',
}

const extractPartnerBurnUsdValues = (lines) => {
  const entries = []

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9]+)\s+.+\(([^)]+)\)\s*$/)
    if (!match) continue

    const rawLabel = match[1]
    const rawUsdValue = match[2]
    const symbol = PARTNER_SYMBOL_BY_LABEL[rawLabel.toLowerCase()]
    if (!symbol) continue

    const usdValue = rawUsdValue.trim()
    if (!usdValue.startsWith('$')) continue
    entries.push(`${symbol} ${usdValue}`)
  }

  return entries
}

const buildFallbackPostText = (telegramHtmlMessage) => {
  const text = stripHtml(telegramHtmlMessage)
  const lines = text
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)
  const collapsed = lines.join(' | ')
  return truncateForX(collapsed)
}

export const buildXPostTextFromTelegramMessage = (telegramHtmlMessage) => {
  const txUrl = extractLinkByLabel(telegramHtmlMessage, 'TX')
  const dashboardUrl = extractLinkByLabel(telegramHtmlMessage, 'Dashboard')
  const plainText = stripHtml(telegramHtmlMessage)
  const lines = plainText
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)

  const gained = extractValueLine(lines, 'Gained:')
  const value = extractValueLine(lines, 'Value:')
  const burned = extractValueLine(lines, 'HolyC Burned:')
  const partnerBurnUsdValues = extractPartnerBurnUsdValues(lines)

  const bodyLines = [
    'New On-Chain Arb Executed',
    gained ? gained.replace(/^Gained:/i, 'Net:') : null,
    value ?? null,
    burned ? burned.replace(/^HolyC Burned:/i, 'HolyC Burned (This Arb):') : null,
    partnerBurnUsdValues.length > 0
      ? `Partner Token Burn Value (USD): ${partnerBurnUsdValues.join(' | ')}`
      : null,
  ].filter(Boolean)

  if (bodyLines.length <= 1) {
    return buildFallbackPostText(telegramHtmlMessage)
  }

  const body = bodyLines.join('\n')
  const linkLines = []
  if (txUrl) linkLines.push(`TX: ${txUrl}`)
  if (dashboardUrl) linkLines.push(`Website: ${dashboardUrl}`)

  if (linkLines.length === 0) {
    return truncateForX(body)
  }

  const suffix = `\n\n${linkLines.join('\n')}`
  if (body.length + suffix.length <= MAX_POST_LENGTH) {
    return `${body}${suffix}`
  }

  const allowedBodyLength = Math.max(1, MAX_POST_LENGTH - suffix.length)
  return `${truncateForX(body, allowedBodyLength)}${suffix}`
}

const parseSignatureParams = (params) => {
  const pairs = []
  for (const [key, value] of params) {
    if (Array.isArray(value)) {
      value.forEach((entry) => pairs.push([key, String(entry)]))
      continue
    }
    pairs.push([key, String(value)])
  }
  return pairs
}

const collectQueryParams = (url) => {
  const parsed = new URL(url)
  const pairs = []
  for (const [key, value] of parsed.searchParams.entries()) {
    pairs.push([key, value])
  }
  return pairs
}

const buildSignature = ({ method, url, signatureParams, consumerSecret, tokenSecret }) => {
  const parsedUrl = new URL(url)
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`

  const encodedPairs = parseSignatureParams(signatureParams)
    .map(([key, value]) => [percentEncode(key), percentEncode(value)])
    .sort((a, b) => {
      if (a[0] === b[0]) {
        if (a[1] === b[1]) return 0
        return a[1] < b[1] ? -1 : 1
      }
      return a[0] < b[0] ? -1 : 1
    })

  const normalized = encodedPairs.map(([key, value]) => `${key}=${value}`).join('&')
  const signatureBase = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(normalized)].join(
    '&'
  )
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`

  return createHmac('sha1', signingKey).update(signatureBase).digest('base64')
}

const buildOAuthHeader = ({ method, url, credentials, extraSignatureParams = [] }) => {
  const oauthParams = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: randomBytes(18).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: '1.0',
  }

  const signatureParams = [
    ...collectQueryParams(url),
    ...extraSignatureParams,
    ...Object.entries(oauthParams),
  ]

  const oauthSignature = buildSignature({
    method,
    url,
    signatureParams,
    consumerSecret: credentials.apiSecret,
    tokenSecret: credentials.accessTokenSecret,
  })

  oauthParams.oauth_signature = oauthSignature

  const headerValue =
    'OAuth ' +
    Object.entries(oauthParams)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
      .join(', ')

  return headerValue
}

const parseJsonResponse = async (response, fallbackMessage, allowEmptyResponse = false) => {
  const text = await response.text()
  const payload = text ? (() => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  })() : null

  if (!response.ok) {
    const details = payload?.errors
      ? JSON.stringify(payload.errors)
      : text || response.statusText || fallbackMessage
    throw new Error(`X API error ${response.status}: ${details}`)
  }

  if (!payload) {
    if (allowEmptyResponse) return {}
    throw new Error(fallbackMessage)
  }

  return payload
}

const oauthJsonRequest = async ({
  method,
  url,
  credentials,
  headers = {},
  body,
  extraSignatureParams = [],
  fallbackError = 'Unexpected X API response',
  allowEmptyResponse = false,
}) => {
  const authorization = buildOAuthHeader({
    method,
    url,
    credentials,
    extraSignatureParams,
  })

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      ...headers,
    },
    body,
  })

  return parseJsonResponse(response, fallbackError, allowEmptyResponse)
}

const getMimeType = (mediaPath) => {
  const extension = path.extname(mediaPath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.mp4') return 'video/mp4'
  return 'application/octet-stream'
}

const getMediaCategory = (mimeType) => {
  if (mimeType === 'video/mp4') return 'tweet_video'
  if (mimeType === 'image/gif') return 'tweet_gif'
  return 'tweet_image'
}

const waitForMediaProcessing = async ({ mediaId, credentials, processingInfo }) => {
  let info = processingInfo
  let retries = 0

  while (info && (info.state === 'pending' || info.state === 'in_progress')) {
    retries += 1
    if (retries > 20) {
      throw new Error('Timed out while waiting for X media processing')
    }

    const waitSeconds = Number(info.check_after_secs ?? 2)
    await sleep(Math.max(1, waitSeconds) * 1000)

    const statusUrl = `${X_MEDIA_UPLOAD_URL}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`
    const status = await oauthJsonRequest({
      method: 'GET',
      url: statusUrl,
      credentials,
      fallbackError: 'Could not read X media processing status',
    })

    info = status?.processing_info ?? null
  }

  if (!info || info.state === 'succeeded') return

  const reason = info?.error?.message ? `: ${info.error.message}` : ''
  throw new Error(`X media processing failed${reason}`)
}

const uploadMedia = async ({ credentials, mediaPath }) => {
  const buffer = await fs.readFile(mediaPath)
  if (buffer.length === 0) {
    throw new Error(`Cannot upload empty media file at ${mediaPath}`)
  }

  const mimeType = getMimeType(mediaPath)
  const mediaCategory = getMediaCategory(mimeType)
  const initPayload = {
    command: 'INIT',
    total_bytes: String(buffer.length),
    media_type: mimeType,
    media_category: mediaCategory,
  }

  const init = await oauthJsonRequest({
    method: 'POST',
    url: X_MEDIA_UPLOAD_URL,
    credentials,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(initPayload).toString(),
    extraSignatureParams: Object.entries(initPayload),
    fallbackError: 'Could not initialize media upload on X',
  })

  const mediaId = init?.media_id_string ?? (init?.media_id ? String(init.media_id) : null)
  if (!mediaId) {
    throw new Error('X media upload did not return a media_id')
  }

  const segmentCount = Math.ceil(buffer.length / MAX_APPEND_CHUNK_SIZE)
  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    const start = segmentIndex * MAX_APPEND_CHUNK_SIZE
    const end = Math.min(start + MAX_APPEND_CHUNK_SIZE, buffer.length)
    const chunk = buffer.subarray(start, end)

    const form = new FormData()
    form.append('command', 'APPEND')
    form.append('media_id', mediaId)
    form.append('segment_index', String(segmentIndex))
    form.append('media', new Blob([chunk], { type: mimeType }), path.basename(mediaPath))

    await oauthJsonRequest({
      method: 'POST',
      url: X_MEDIA_UPLOAD_URL,
      credentials,
      body: form,
      fallbackError: 'Could not append media chunk to X upload',
      allowEmptyResponse: true,
    })
  }

  const finalizePayload = {
    command: 'FINALIZE',
    media_id: mediaId,
  }

  const finalize = await oauthJsonRequest({
    method: 'POST',
    url: X_MEDIA_UPLOAD_URL,
    credentials,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(finalizePayload).toString(),
    extraSignatureParams: Object.entries(finalizePayload),
    fallbackError: 'Could not finalize media upload on X',
  })

  await waitForMediaProcessing({
    mediaId,
    credentials,
    processingInfo: finalize?.processing_info ?? null,
  })

  return mediaId
}

const createStatusUpdate = async ({ credentials, text, mediaId }) => {
  const payload = {
    status: text,
  }

  if (mediaId) {
    payload.media_ids = mediaId
  }

  return oauthJsonRequest({
    method: 'POST',
    url: X_STATUS_UPDATE_URL,
    credentials,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString(),
    extraSignatureParams: Object.entries(payload),
    fallbackError: 'Could not create post on X',
  })
}

const readXCredentials = () => {
  const credentials = {
    apiKey: process.env.X_API_KEY?.trim() ?? '',
    apiSecret: process.env.X_API_SECRET?.trim() ?? '',
    accessToken: process.env.X_ACCESS_TOKEN?.trim() ?? '',
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET?.trim() ?? '',
  }

  const missing = Object.entries({
    X_API_KEY: credentials.apiKey,
    X_API_SECRET: credentials.apiSecret,
    X_ACCESS_TOKEN: credentials.accessToken,
    X_ACCESS_TOKEN_SECRET: credentials.accessTokenSecret,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(`Missing X credentials: ${missing.join(', ')}`)
  }

  return credentials
}

export const maybePostArbUpdateToX = async ({
  telegramHtmlMessage,
  mediaPath,
  dryRun = false,
  logger = console,
  enabled = process.env.POST_X_ARB_UPDATES === 'true',
}) => {
  if (!enabled) return false

  const postText = buildXPostTextFromTelegramMessage(telegramHtmlMessage)
  if (!postText) {
    throw new Error('Cannot post an empty arb update to X')
  }

  if (!mediaPath) {
    throw new Error('mediaPath is required to post arb updates to X')
  }

  if (dryRun) {
    logger.log('[DRY_RUN] X arb post text:')
    logger.log(postText)
    logger.log(`[DRY_RUN] X arb media: ${mediaPath}`)
    return true
  }

  const credentials = readXCredentials()
  await fs.access(mediaPath)
  const mediaId = await uploadMedia({ credentials, mediaPath })
  await createStatusUpdate({
    credentials,
    text: postText,
    mediaId,
  })

  logger.log(`Posted arb update on X (media_id=${mediaId}).`)
  return true
}
