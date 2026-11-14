// Run from lucent/desktop. CHROME_PATH can point to a system Chromium.
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { spawn } = require('node:child_process')
const path = require('node:path')
const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('playwright')
const port = 1422
const server = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function main() {
  let ready = false
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) { ready = true; break } } catch {} await delay(200) }
  if (!ready || server.exitCode != null) throw new Error('Test server did not start')
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error' && /same key|unique.*key/i.test(message.text())) errors.push(message.text()) })
    await page.goto(`http://127.0.0.1:${port}`)
    await page.evaluate(async () => {
      localStorage.clear()
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('lucent-library'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      const tx = db.transaction(['tracks', 'audio', 'artwork'], 'readwrite')
      for (const store of ['tracks', 'audio', 'artwork']) tx.objectStore(store).clear()
      for (let i = 1; i <= 5; i++) {
        tx.objectStore('tracks').put({ id: `song-${i}`, title: `Song ${i}`, artist: `Artist ${i}`, album: `Album ${i}`, albumArtist: `Artist ${i}`, trackNo: i, year: null, duration: 30, folder: 'Test', fileName: `song${i}.wav`, size: 44, mime: 'audio/wav', format: 'WAV', artworkId: i === 5 ? null : `art-${i}`, accent: null, lyrics: null, addedAt: i, lastPlayedAt: null, playCount: 0, fingerprint: `song-${i}` })
        const bytes = new Uint8Array(44 + 8000 * 30); const view = new DataView(bytes.buffer)
        const str = (at, value) => { for (let j = 0; j < value.length; j++) bytes[at+j] = value.charCodeAt(j) }
        str(0,'RIFF'); view.setUint32(4,bytes.length-8,true); str(8,'WAVE'); str(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,8000,true); view.setUint32(28,8000,true); view.setUint16(32,1,true); view.setUint16(34,8,true); str(36,'data'); view.setUint32(40,bytes.length-44,true); bytes.fill(128,44)
        tx.objectStore('audio').put(new Blob([bytes], { type: 'audio/wav' }), `song-${i}`)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${['tomato','royalblue','seagreen','orchid'][i-1]}"/></svg>`
        if (i < 5) tx.objectStore('artwork').put({ id: `art-${i}`, blob: new Blob([svg], { type: 'image/svg+xml' }), accent: null })
      }
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) }); db.close()
    })
    await page.reload()
    await page.getByRole('link', { name: 'Playlists', exact: false }).first().click()
    await page.getByLabel('New playlist name').fill('Transition test')
    await page.getByRole('button', { name: 'Create playlist' }).click()
    await page.getByRole('button', { name: 'Add songs', exact: true }).click()
    for (let i = 1; i <= 5; i++) await page.getByRole('button', { name: `Add Song ${i} to playlist` }).click()
    await page.getByRole('button', { name: 'Done adding' }).click()
    await page.getByLabel('Playlist songs').getByRole('button', { name: 'Play Song 1' }).click()
    await page.getByRole('button', { name: 'Now Playing', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Now Playing' })
    const stage = dialog.locator('[data-track-stage]')
    const next = dialog.getByRole('button', { name: 'Next', exact: true })
    await dialog.locator('[data-track-role="current"] img[data-loaded="true"]').waitFor()
    await delay(1000) // Let the Now Playing panel entrance finish before measuring layout.
    const initial = await next.boundingBox()
    await next.click()
    await stage.locator('[data-track-role="outgoing"]').waitFor()
    assert.equal(await stage.locator('[data-track-role="current"]').getAttribute('data-track-id'), 'song-2')
    const offsets = await stage.evaluate((el) => {
      for (const node of el.querySelectorAll('[data-track-role]')) for (const anim of node.getAnimations()) { anim.pause(); anim.currentTime = 120 }
      const position = (role) => new DOMMatrix(getComputedStyle(el.querySelector(`[data-track-role="${role}"]`)).transform).m41
      return { outgoing: position('outgoing'), incoming: position('current') }
    })
    assert(offsets.outgoing < 0 && offsets.incoming > 0, JSON.stringify(offsets))
    if (process.env.TRANSITION_SCREENSHOT) await page.screenshot({ path: process.env.TRANSITION_SCREENSHOT })
    await next.click()
    assert.equal(await stage.locator('[data-track-role="current"]').getAttribute('data-track-id'), 'song-3')
    assert((await stage.locator('[data-track-role]').count()) <= 2)
    await delay(650)
    assert.equal(await stage.locator('[data-track-role]').count(), 1)
    assert.equal(await stage.locator('img').count(), 1)
    assert.equal(await stage.locator('h1').textContent(), 'Song 3')
    assert((await stage.locator('img').evaluate((img) => fetch(img.src).then((r) => r.text()))).includes('seagreen'))
    const after = await next.boundingBox(); assert(Math.abs(after.y - initial.y) < 2, `Controls shifted: ${initial.y} to ${after.y}`)
    for (let i = 0; i < 20; i++) { await next.click(); assert((await stage.locator('[data-track-role]').count()) <= 2) }
    await delay(650)
    assert.equal(await stage.locator('[data-track-role]').count(), 1)
    assert.equal(await stage.locator('img').count(), 1)
    const id = await stage.locator('[data-track-role="current"]').getAttribute('data-track-id')
    assert.equal(await stage.locator('h1').textContent(), `Song ${id.slice(-1)}`)
    await next.click(); await next.click(); await delay(650)
    assert.equal(await stage.locator('[data-track-role="current"]').getAttribute('data-track-id'), 'song-5')
    assert.equal(await stage.locator('img').count(), 0) // no stale cover on a track with no art
    await dialog.getByRole('button', { name: 'Close Now Playing' }).click()
    await page.getByRole('button', { name: 'Now Playing', exact: true }).click()
    assert.equal(await stage.locator('[data-track-role]').count(), 1)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await next.click()
    assert.equal(await stage.locator('[data-track-role]').count(), 1)
    await page.setViewportSize({ width: 880, height: 600 })
    await next.click()
    const box = await next.boundingBox(); assert(box && box.y >= 0 && box.y + box.height <= 600, JSON.stringify(box))
    assert.deepEqual(errors, [])
    console.log('Track transitions passed: artwork, movement, rapid switches, cleanup, reduced motion and layout.')
  } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => server.kill())
