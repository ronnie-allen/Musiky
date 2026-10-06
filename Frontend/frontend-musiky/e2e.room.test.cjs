/**
 * End-to-end check for Musiky: three browser contexts, real sockets, real backend.
 *
 * Requires the app to be running:
 *   Backend   MONGO_MOCK=1 YOUTUBE_SEARCH_URL=<fake> python run.py     (:5000)
 *   Frontend  npx vite preview --host 127.0.0.1 --port 4173
 *
 * Then:  node e2e.room.test.cjs
 */
const { chromium } = require('playwright-core');
const fs = require('node:fs');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:4173';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/home/sisaronniejeffrey/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const SHOTS = process.env.E2E_SHOTS || '/tmp/musiky-verify';

const failures = [];
function check(label, ok, extra = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${JSON.stringify(extra)}`}`);
  if (!ok) failures.push(label);
}
function skip(label, why) {
  console.log(`  SKIP  ${label} -- ${why}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(SHOTS, { recursive: true });

async function textOf(page, selector) {
  return (await page.locator(selector).first().textContent().catch(() => null))?.trim() ?? '';
}

/** Server-authoritative room state, independent of what the embed can actually play. */
async function roomState(roomCode) {
  const res = await fetch(`${BASE}/api/rooms/${roomCode}`);
  return res.json();
}

/** The sandbox cannot stream YouTube media, so the embed may never reach PLAYING. */
async function canActuallyPlay(page) {
  const frame = page.frames().find((f) => f.url().includes('/embed/'));
  if (!frame) return false;
  return frame
    .evaluate(async () => {
      const video = document.querySelector('video');
      if (!video) return false;
      for (let i = 0; i < 20 && video.readyState < 2 && video.currentTime === 0; i += 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
      return video.readyState >= 2 || video.currentTime > 0;
    })
    .catch(() => false);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  const errors = { host: [], guest: [] };
  host.on('pageerror', (e) => errors.host.push(String(e)));
  guest.on('pageerror', (e) => errors.guest.push(String(e)));
  host.on('console', (m) => m.type() === 'error' && errors.host.push(m.text()));
  guest.on('console', (m) => m.type() === 'error' && errors.guest.push(m.text()));

  console.log('\n== Landing ==');
  await host.goto(BASE, { waitUntil: 'networkidle' });
  check('landing renders brand', (await host.locator('.brand-lg').textContent()) === 'Musiky');
  await sleep(600);
  check(
    'landing reports backend status',
    /Backend connected|set YOUTUBE_API_KEY|database/i.test(await textOf(host, 'p.small')),
    await textOf(host, 'p.small'),
  );

  console.log('\n== Create room ==');
  await host.getByRole('button', { name: 'Create room' }).click();
  await host.getByRole('button', { name: 'Generate room code' }).click();
  await host.waitForSelector('.modal-card .room-code', { timeout: 8000 });
  const roomCode = (await textOf(host, '.modal-card .room-code')).trim();
  check('room code is 6 digits', /^\d{6}$/.test(roomCode), roomCode);
  const invite = await host.locator('.modal-card input[readonly]').inputValue();
  check('invite link points at the room', invite.endsWith(`/room/${roomCode}`), invite);
  await host.getByRole('button', { name: 'Enter room' }).click();

  console.log('\n== Host enters room ==');
  await host.waitForSelector('input[placeholder="Your name"], .room-header', { timeout: 8000 });
  check('name prompt shown for a new visitor', await host.locator('input[placeholder="Your name"]').isVisible());
  await host.locator('input[placeholder="Your name"]').fill('Ada');
  await host.getByRole('button', { name: 'Enter room' }).click();
  await host.waitForSelector('.room-header', { timeout: 8000 });
  await sleep(1000);
  check('room code shown in header', (await textOf(host, '.room-header .room-code')) === roomCode);
  check('host badge shown', (await textOf(host, '.badge-role')) === 'Host');
  check('socket connected', (await textOf(host, '.status-dot')).includes('Live'));
  await host.waitForSelector('.player-overlay', { timeout: 8000 }).catch(() => {});
  check('empty player overlay', /Nothing playing yet/.test(await textOf(host, '.player-overlay')));

  console.log('\n== Guest joins ==');
  await guest.goto(`${BASE}/room/${roomCode}`, { waitUntil: 'networkidle' });
  await guest.locator('input[placeholder="Your name"]').fill('Linus');
  await guest.getByRole('button', { name: 'Enter room' }).click();
  await guest.waitForSelector('.room-header', { timeout: 8000 });
  await sleep(1300);

  check('host sees 2 listeners', /2 listening/.test(await textOf(host, '.room-header')), await textOf(host, '.room-header'));
  check('guest is a listener', (await textOf(guest, '.badge-role')) === 'Listener');
  const hostParticipants = await host.locator('.participant-list li').allTextContents();
  check('participant list has both', hostParticipants.length === 2, hostParticipants);
  const joinChat = await textOf(host, '.chat-log');
  check('join message in chat', /Linus joined the room/.test(joinChat), joinChat);
  const joinMentions = (joinChat.match(/joined the room/g) ?? []).length;
  check('join announced exactly once', joinMentions === 2, { joinMentions, joinChat });

  console.log('\n== Search and play (host) ==');
  await host.locator('.search-bar input').fill('lofi beats');
  await host.getByRole('button', { name: 'Search' }).click();
  await host.waitForSelector('.result-row', { timeout: 8000 });
  const resultCount = await host.locator('.result-row').count();
  check('search returned results', resultCount === 3, resultCount);
  check(
    'results show duration from the API',
    /3:33/.test(await textOf(host, '.result-row .opacity-75')),
    await textOf(host, '.result-row .opacity-75'),
  );
  check('guest sees no results until it searches', (await guest.locator('.result-row').count()) === 0);

  await host.getByRole('button', { name: 'Play now' }).first().click();
  await sleep(1600);
  const nowPlaying = await textOf(host, '.now-playing');
  check('host now playing shows the track', /Never Gonna Give You Up/.test(nowPlaying), nowPlaying);
  const guestNowPlaying = await textOf(guest, '.now-playing');
  check('guest received now_playing', /Never Gonna Give You Up/.test(guestNowPlaying), guestNowPlaying);
  check('controls appear once playing', await host.locator('.controls').isVisible());
  check('guest got the controls too', await guest.locator('.controls').isVisible());
  check('playback reported as playing', (await textOf(host, '.controls .btn-accent')) === 'Pause');

  console.log('\n== Shared playback controls ==');
  const mediaPlays = await canActuallyPlay(host);
  if (!mediaPlays) {
    skip('position advances while playing', 'YouTube media cannot stream in this sandbox');
    skip('host seeked to ~2:30', 'player clock is frozen');
    skip('guest followed the seek', 'player clock is frozen');
  } else {
    const hostTimeBefore = await textOf(host, '.controls .mono');
    await sleep(2600);
    const hostTimeAfter = await textOf(host, '.controls .mono');
    check('position advances while playing', hostTimeBefore !== hostTimeAfter, { hostTimeBefore, hostTimeAfter });
  }

  let playingRoom = await roomState(roomCode);
  check('server records playback as playing', playingRoom.playback?.state === 'playing', playingRoom.playback);

  await guest.getByRole('button', { name: 'Pause for everyone' }).click();
  await sleep(1300);
  check('guest pause reached the host', (await textOf(host, '.controls .btn-accent')) === 'Play');
  check('server records the pause', (await roomState(roomCode)).playback?.state === 'paused');

  await guest.getByRole('button', { name: 'Play for everyone' }).click();
  await sleep(1300);
  check('guest play reached the host', (await textOf(host, '.controls .btn-accent')) === 'Pause');
  check('server records the resume', (await roomState(roomCode)).playback?.state === 'playing');

  const seekBar = host.locator('input[aria-label="Seek"]');
  await seekBar.evaluate((el) => {
    el.value = '150';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await seekBar.dispatchEvent('mouseup');
  await sleep(1600);
  const hostClock = await textOf(host, '.controls .mono');
  const guestClock = await textOf(guest, '.controls .mono');
  if (mediaPlays) {
    check('host seeked to ~2:30', hostClock.startsWith('2:3'), hostClock);
    check('guest followed the seek', guestClock.startsWith('2:3'), { hostClock, guestClock });
  }
  const seekedRoom = await roomState(roomCode);
  check(
    'server stores the shared position at 150s',
    Math.round(seekedRoom.playback?.position) === 150,
    seekedRoom.playback,
  );

  console.log('\n== Queue ==');
  await host.getByRole('button', { name: 'Queue', exact: true }).first().click();
  await sleep(1100);
  check('queue has one entry for the host', (await host.locator('.queue-row').count()) === 1);
  check('guest sees the queue live', (await guest.locator('.queue-row').count()) === 1);
  check('queue shows who added it', /added by Ada/.test(await textOf(host, '.queue-row')), await textOf(host, '.queue-row'));

  // the same track is already queued, so the server must refuse the duplicate
  await host.locator('.search-bar input').fill('lofi beats');
  await host.getByRole('button', { name: 'Search' }).click();
  await host.waitForSelector('.result-row', { timeout: 8000 });
  await host.getByRole('button', { name: 'Queue', exact: true }).first().click();
  await sleep(1000);
  check('duplicate queue request is refused', (await host.locator('.queue-row').count()) === 1);
  check(
    'duplicate request explains itself',
    /already queued/i.test(await textOf(host, '.notice')),
    await textOf(host, '.notice'),
  );

  await guest.locator('.search-bar input').fill('despacito');
  await guest.getByRole('button', { name: 'Search' }).click();
  await guest.waitForSelector('.result-row', { timeout: 8000 });
  await guest.getByRole('button', { name: 'Queue', exact: true }).first().click();
  await sleep(1100);
  check('guest can queue a request', (await guest.locator('.queue-row').count()) === 2);
  check('guest queue play button is hidden', (await guest.getByRole('button', { name: 'Play', exact: true }).count()) === 0);
  check('chat announced the guest queue', /Linus queued/.test(await textOf(host, '.chat-log')), await textOf(host, '.chat-log'));

  // play the second queued track from the queue; the first entry is a duplicate of
// what is already playing, so the room should end up on Despacito
  const despacitoRow = host.locator('.queue-row', { hasText: 'Despacito' }).first();
  await despacitoRow.getByRole('button', { name: 'Play', exact: true }).click();
  await sleep(1600);
  check('host advanced to the queued track', /Despacito/.test(await textOf(guest, '.now-playing')), await textOf(guest, '.now-playing'));
  check('playing a queued track removes it', (await host.locator('.queue-row').count()) === 1, await textOf(host, '.queue-list'));

  console.log('\n== Chat ==');
  await host.locator('.chat-input input').fill('this track is great');
  await host.locator('.chat-input input').press('Enter');
  await sleep(1000);
  const guestChat = await textOf(guest, '.chat-log');
  check('guest received the chat message', /this track is great/.test(guestChat), guestChat);
  check('message attributed to sender', /Ada/.test(guestChat));
  await guest.locator('.chat-input input').fill('agreed!');
  await guest.getByRole('button', { name: 'Send' }).click();
  await sleep(1000);
  check('host received the reply', /agreed!/.test(await textOf(host, '.chat-log')));

  console.log('\n== Host handover ==');
  // the guest is the only one left, so the room has to promote them
  await host.getByRole('button', { name: 'Leave' }).click();
  await host.waitForURL(`${BASE}/`, { timeout: 8000 });
  await sleep(1800);
  check('remaining guest is promoted to host', (await textOf(guest, '.badge-role')) === 'Host',
    await textOf(guest, '.badge-role'));
  check('promotion is announced in chat', /is now the host/.test(await textOf(guest, '.chat-log')),
    await textOf(guest, '.chat-log'));
  check('new host gets the queue controls',
    (await guest.getByRole('button', { name: 'Next in queue' }).count()) === 1);
  await guest.locator('.search-bar input').fill('despacito');
  await guest.getByRole('button', { name: 'Search' }).click();
  await guest.waitForSelector('.result-row', { timeout: 8000 });
  await guest.getByRole('button', { name: 'Queue', exact: true }).first().click();
  await sleep(1200);
  check('promoted host can queue a track', (await guest.locator('.queue-row').count()) === 2,
    await textOf(guest, '.queue-list'));
  check('promoted host can remove from the queue',
    (await guest.getByRole('button', { name: 'Remove' }).count()) === 2);

  console.log('\n== Empty room ==');
  await guest.getByRole('button', { name: 'Leave' }).click();
  await guest.waitForURL(`${BASE}/`, { timeout: 8000 });
  await sleep(1200);

  console.log('\n== Bad room code ==');
  // the guest already picked a name in this context, so the room view goes straight
  // to the socket handshake and reports the unknown room
  await guest.goto(`${BASE}/room/000000`, { waitUntil: 'networkidle' });
  await guest.waitForSelector('.panel h1', { timeout: 8000 });
  check('unknown room shows a clear error', /Room unavailable/i.test(await textOf(guest, '.panel h1')), await textOf(guest, '.panel h1'));
  await guest.getByRole('button', { name: 'Back to home' }).click();
  await guest.waitForURL(`${BASE}/`, { timeout: 8000 });
  check('recovers to the landing page', await guest.locator('.brand-lg').isVisible());

  console.log('\n== Deep link join (share link) ==');
  const deep = await hostCtx.newPage();
  await deep.goto(`${BASE}/room/${roomCode}`, { waitUntil: 'networkidle' });
  await deep.locator('input[placeholder="Your name"]').fill('Grace');
  await deep.getByRole('button', { name: 'Enter room' }).click();
  await deep.waitForSelector('.room-header', { timeout: 8000 });
  await sleep(1400);
  check('deep link joins the same room', (await textOf(deep, '.room-header .room-code')) === roomCode);
  check('deep link inherits playback', /Despacito/.test(await textOf(deep, '.now-playing')), await textOf(deep, '.now-playing'));
  check('deep link is alone in the room', /1 listening/.test(await textOf(deep, '.room-header')));
  await deep.screenshot({ path: `${SHOTS}/room.png` });
  await deep.close();

  console.log('\n== Console cleanliness ==');
  const ignorable = /favicon|ERR_|Failed to load resource|ytimg|doubleclick|googleads|youtube\.com|googlevideo|ERR_BLOCKED/i;
  const hostErrors = errors.host.filter((e) => !ignorable.test(e));
  const guestErrors = errors.guest.filter((e) => !ignorable.test(e));
  check('no unexpected host console errors', hostErrors.length === 0, hostErrors.slice(0, 3));
  check('no unexpected guest console errors', guestErrors.length === 0, guestErrors.slice(0, 3));

  await host.screenshot({ path: `${SHOTS}/host.png` });
  await browser.close();

  console.log('');
  if (failures.length) {
    console.log(`FAILED (${failures.length}): ${JSON.stringify(failures, null, 2)}`);
    process.exit(1);
  }
  console.log('ALL E2E CHECKS PASSED');
})().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(1);
});
