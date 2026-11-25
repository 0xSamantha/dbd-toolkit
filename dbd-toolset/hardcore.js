(() => {
  const { outcomes, killerOutcomes, summarize, transferKey, toGeneralMatch } = Hardcore;
  const config = window.FOG_AUTH_CONFIG;
  const app = document.querySelector('#app');
  const status = document.querySelector('#status');
  const dialog = document.querySelector('#history');
  const params = new URLSearchParams(location.search);
  const sharedId = params.get('run');
  const overlay = sharedId !== null && params.get('view') === 'obs';
  const role = params.get('role') === 'killer' ? 'killer' : 'survivor';
  const draftKey = role === 'killer' ? 'fog.hardcore.killer.v1' : 'fog.hardcore.draft.v1';
  const characters = role === 'killer' ? DBD_KILLER_NAMES : DBD_SURVIVOR_NAMES;
  let run, syncing = false, lastSnapshot, clockInterval;
  const perkNames = role => DBD_PERKS.filter(perk => perk.role === role)
    .map(perk => perk.name).sort((a, b) => a.localeCompare(b));
  const ownPerks = perkNames(role);
  const observedPerks = [...new Set([...perkNames('survivor'), ...perkNames('killer')])]
    .sort((a, b) => a.localeCompare(b));

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const initials = name => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('');
  const portrait = name => {
    const file = Object.hasOwn(HARDCORE_PORTRAITS, name) && HARDCORE_PORTRAITS[name];
    const src = file && `https://deadbydaylight.wiki.gg/images/thumb/${file}/128px-${file}`;
    return `<span class="mark" aria-hidden="true">${escape(initials(name))}
      ${src ? `<img src="${escape(src)}" alt="" width="128" height="128" loading="lazy" decoding="async"
        onerror="this.hidden=true">` : ''}</span>`;
  };
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const setStatus = message => { status.textContent = message; };
  const shareUrl = mode => {
    const url = new URL('hardcore.html', location.href);
    url.searchParams.set('run', run.id);
    if (mode === 'obs') url.searchParams.set('view', 'obs');
    return url.href;
  };
  const hero = (title, kicker) =>
    `<div class="hero"><span class="kicker">${kicker}</span><h1>${escape(title)}</h1></div>`;

  if (sharedId === null) {
    document.querySelector('#masthead').insertAdjacentHTML('afterend', `<nav class="role-nav" aria-label="Challenge role">
      <a href="hardcore.html" ${role === 'survivor' ? 'aria-current="page"' : ''}>Survivor challenge</a>
      <a href="hardcore.html?role=killer" ${role === 'killer' ? 'aria-current="page"' : ''}>Killer challenge</a></nav>`);
  }

  function setup() {
    const killer = role === 'killer';
    app.innerHTML = hero('Hardcore Challenge Tracker', 'Dead by Daylight') + `
      <form id="setup" class="panel">
        <h2>Create a run</h2>
        <label>Run name <input name="title" required maxlength="80" value="${killer ? 'Killer one-life challenge' : 'One-life challenge'}"></label>
        <fieldset><legend>Rules</legend>
          <label class="check"><input type="checkbox" name="eliminate" checked> ${killer ? 'A loss eliminates the killer' : 'Death eliminates the survivor'}</label>
          <label class="check"><input type="checkbox" name="clear" checked> ${killer ? 'A win clears the killer' : 'Escape clears the survivor'}</label>
          <label class="check"><input type="checkbox" name="disconnect"> ${killer ? 'Disconnect counts as a loss' : 'Disconnect counts as a death'}</label>
          ${killer ? '<p class="muted">0–1 kills is a loss, 2 is a draw, and 3–4 is a win.</p>' : ''}
        </fieldset>
        <fieldset><legend>Choose ${role}s</legend>
          <div class="bar"><button type="button" id="all">Select all</button><button type="button" id="none" class="quiet">Clear selection</button></div>
          <div class="picker">${characters.map((name, i) =>
            `<label class="check"><input type="checkbox" name="roster" value="${i}" ${i < 4 ? 'checked' : ''}> ${escape(name)}</label>`).join('')}</div>
        </fieldset>
        <button class="primary">Create run</button>
      </form>`;
    const form = app.querySelector('#setup');
    for (const id of ['all', 'none']) {
      form.querySelector('#' + id).onclick = () => {
        for (const input of form.querySelectorAll('[name=roster]')) input.checked = id === 'all';
      };
    }
    form.onsubmit = event => {
      event.preventDefault();
      const data = new FormData(form);
      const roster = data.getAll('roster').map(index => characters[index]);
      const title = data.get('title').trim();
      if (!title || !roster.length) {
        setStatus(`Enter a run name and select at least one ${role}.`);
        return;
      }
      save({
        id: crypto.randomUUID(), role, title, roster, matches: [], active: null, revision: 0,
        rules: { eliminate: data.has('eliminate'), clear: data.has('clear'), disconnect: data.has('disconnect') }
      });
    };
  }

  function formatDuration(duration) {
    const seconds = Math.floor(Math.max(0, duration) / 1000);
    return [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  }

  function perkFields(key, catalog, values = []) {
    return `<datalist id="${key}-choices">${catalog.map(name => `<option value="${escape(name)}">`).join('')}</datalist>
      <div class="perk-fields">${Array.from({ length: 4 }, (_, i) =>
        `<label>Perk ${i + 1}<input list="${key}-choices" name="${key}" maxlength="120" value="${escape(values[i])}"></label>`).join('')}</div>`;
  }

  function selectedPerks(data, key) {
    return [...new Set(data.getAll(key).map(perk => perk.trim()).filter(Boolean))];
  }

  function matchList(matches, canTransfer = false) {
    if (!matches.length) return '<p class="muted">No matches logged yet.</p>';
    return `<ol class="matches" reversed>${matches.slice().reverse().map(match => {
      const queue = { solo: 'Solo queue', team: 'Team / duo' }[match.queue];
      const details = [queue, match.killer, match.map, match.cause, match.vod && 'VOD ' + match.vod,
        Number.isFinite(match.durationMs) && formatDuration(match.durationMs)]
        .filter(Boolean).map(escape).join(' · ');
      const timestamp = new Date(match.at);
      const time = Number.isNaN(timestamp.getTime()) ? '' :
        `<time datetime="${timestamp.toISOString()}">${escape(dateFormat.format(timestamp))}</time>`;
      return `<li><strong>${escape(match.character)} · ${escape(match.outcome)}</strong> ${time}
        ${details ? '<br><span class="muted">' + details + '</span>' : ''}
        ${match.perks?.length ? `<br>Your perks · ${match.perks.map(escape).join(', ')}` : ''}
        ${match.observed ? `<br>Observed build · ${[match.observed.character, ...match.observed.perks]
          .filter(Boolean).map(escape).join(' · ')}` : ''}
        ${canTransfer ? `<br><button type="button" class="quiet" data-transfer="${run.matches.indexOf(match)}">Add to Match Tracker</button>` : ''}</li>`;
    }).join('')}</ol>`;
  }

  function render(readOnly = false, nextCharacter = '') {
    const { roster, escapes, deaths, streak, remaining, latest, kills } = summarize(run);
    const killer = run.role === 'killer';
    const roleLabel = killer ? 'Killer' : 'Survivor';
    const resultChoices = killer ? killerOutcomes : outcomes;
    const scores = killer ? [['Remaining', remaining], ['Wins', escapes], ['Losses', deaths], ['Win streak', streak], ['Kills', kills]]
      : [['Remaining', remaining], ['Escapes', escapes], ['Deaths', deaths], ['Escape streak', streak]];
    const optionalFields = killer ? { map: 'Map', vod: 'VOD timestamp' }
      : { killer: 'Killer faced', map: 'Map', cause: 'Cause of death', vod: 'VOD timestamp' };
    const playable = run.roster.filter(name => ['Available', 'Playing'].includes(roster[name]));
    clearInterval(clockInterval);
    const timed = readOnly ? null : run.timedMatch;
    const running = timed && timed.endedAt == null;
    const logging = !readOnly && `<section class="panel logging"><h2>Log a match</h2>
      ${!remaining ? '<p>All roster characters have been cleared or eliminated.</p>' : `
      <form id="log">
        <label>${roleLabel} <select name="character" required ${timed ? 'disabled' : ''}><option value="">Pick a ${roleLabel.toLowerCase()}</option>
          ${playable.map(name => `<option value="${escape(name)}" ${name === (nextCharacter || run.active) ? 'selected' : ''}>${escape(name)}</option>`).join('')}</select></label>
        ${timed ? `<div class="panel match-clock"><span>${running ? 'Match in progress' : 'Match duration'}</span>
          <strong id="match-clock" role="timer"></strong></div>
          <p>${timed.perks.length ? timed.perks.map(escape).join(' · ') : 'No perks selected'}</p>
          ${running ? '<button type="button" class="primary" id="stop-match">End timer</button>' : ''}
          <button type="button" class="quiet" id="discard-timer">Discard timer</button>`
        : `<details><summary>Your perks</summary>${perkFields('perk', ownPerks)}</details>
          <button type="button" class="quiet" id="start-match">Start timer</button>`}
        ${running ? '' : `<label>Outcome <select name="outcome" required><option value="">Pick an outcome</option>
          ${resultChoices.map(outcome => `<option>${outcome}</option>`).join('')}</select></label>
        <fieldset class="queue-options"><legend>Queue (optional)</legend>
          <label class="check"><input type="radio" name="queue" value="" checked> Unspecified</label>
          <label class="check"><input type="radio" name="queue" value="solo"> Solo queue</label>
          <label class="check"><input type="radio" name="queue" value="team"> Team / duo</label>
        </fieldset>
        <details><summary>Optional match details</summary>
          ${Object.entries(optionalFields)
            .map(([key, label]) => `<label>${label}<input name="${key}" maxlength="120"></label>`).join('')}
        </details>
        <details><summary>Add observed build</summary>
          <label>Observed character <input name="observedCharacter" maxlength="80"></label>
          ${perkFields('observedPerk', observedPerks)}
        </details>
        <button class="primary">${timed ? 'Save result' : 'Log match'}</button>`}
      </form>`}</section>`;
    const share = !readOnly && `<section class="panel timeline"><div class="bar">
      <h2>Share this run</h2><button type="button" id="publish" class="quiet">${run.published ? 'Sync now' : 'Publish live page'}</button></div>
      ${run.published ? `<div class="bar"><a href="${escape(shareUrl())}" target="_blank" rel="noopener">Open live page</a>
        <button type="button" data-copy="live">Copy live link</button><button type="button" data-copy="obs">Copy OBS link</button></div>`
        : '<p class="muted">Sign in to publish. Anyone with the link can see the roster, match details, and builds attached to results.</p>'}
    </section>`;
    app.innerHTML = hero(run.title, remaining ? `Hardcore ${roleLabel} Challenge` : `${roleLabel} run finished`) +
      `<div class="scores${killer ? ' killer-scores' : ''}">${scores
        .map(([label, value]) => `<div class="score"><strong class="number">${value}</strong><span>${label}</span></div>`).join('')}</div>
      <div class="panel latest">${latest ? `Latest · <strong>${escape(latest.character)} · ${escape(latest.outcome)}</strong>` : 'Waiting for the first match'}</div>
      ${overlay ? '' : `<div class="layout"><section class="panel"><h2>${roleLabel} roster</h2><div class="roster">
        ${run.roster.map((name, i) => `<button class="tile ${roster[name].toLowerCase()}" type="button" data-character="${i}">
          ${portrait(name)}<strong>${escape(name)}</strong>
          <span class="state">${roster[name]}</span></button>`).join('')}
        </div></section>${logging || ''}</div>
        ${share || ''}<section class="panel timeline"><h2>Match timeline</h2>${matchList(run.matches, !readOnly)}</section>`}`;

    for (const tile of app.querySelectorAll('[data-character]')) {
      tile.onclick = () => {
        const name = run.roster[tile.dataset.character];
        dialog.querySelector('h2').textContent = name;
        dialog.querySelector('#history-matches').innerHTML = matchList(run.matches.filter(match => match.character === name), !readOnly);
        dialog.showModal();
      };
    }
    if (readOnly) return;
    const form = app.querySelector('#log');
    if (form) {
      const startButton = form.querySelector('#start-match');
      const stopButton = form.querySelector('#stop-match');
      const discardButton = form.querySelector('#discard-timer');
      if (startButton) startButton.onclick = () => {
        const character = form.elements.character;
        if (!character.reportValidity()) return;
        const perks = selectedPerks(new FormData(form), 'perk');
        if (save({ ...run, active: character.value, timedMatch: { startedAt: Date.now(), perks },
          revision: run.revision + 1 })) app.querySelector('#stop-match').focus();
      };
      if (timed) {
        const clock = form.querySelector('#match-clock');
        const update = () => {
          if (running && document.hidden) return;
          const value = formatDuration((timed.endedAt ?? Date.now()) - timed.startedAt);
          if (clock.textContent !== value) clock.textContent = value;
        };
        update();
        if (running) clockInterval = setInterval(update, 250);
        discardButton.onclick = () => {
          if (save({ ...run, active: null, timedMatch: null, revision: run.revision + 1 }, undefined, run.active)) {
            app.querySelector('#start-match').focus();
          }
        };
      }
      if (stopButton) stopButton.onclick = () => {
        if (save({ ...run, timedMatch: { ...timed, endedAt: Date.now() } }, undefined, '', false)) {
          app.querySelector('[name=outcome]').focus();
        }
      };
      form.onsubmit = event => {
        event.preventDefault();
        if (running) return;
        const data = new FormData(form);
        const character = timed ? run.active : data.get('character');
        const outcome = data.get('outcome');
        if (!playable.includes(character) || !resultChoices.includes(outcome)) return;
        const match = { character, outcome, at: new Date(timed?.endedAt ?? Date.now()).toISOString() };
        for (const field of Object.keys(optionalFields)) {
          const value = data.get(field).trim();
          if (value) match[field] = value;
        }
        const queue = data.get('queue');
        if (queue === 'solo' || queue === 'team') match.queue = queue;
        const perks = timed?.perks ?? selectedPerks(data, 'perk');
        if (perks.length) match.perks = perks;
        if (timed) {
          match.startedAt = new Date(timed.startedAt).toISOString();
          match.durationMs = Math.max(0, timed.endedAt - timed.startedAt);
        }
        const observed = { character: data.get('observedCharacter').trim(), perks: selectedPerks(data, 'observedPerk') };
        if (observed.character || observed.perks.length) match.observed = observed;
        if (save({ ...run, active: null, timedMatch: null, matches: [...run.matches, match],
          revision: run.revision + 1 }, match.character)) {
          app.querySelector('#log select')?.focus();
        }
      };
    }
    const publish = app.querySelector('#publish');
    publish.disabled = syncing;
    publish.onclick = () => sync(true);
    for (const button of app.querySelectorAll('[data-copy]')) {
      button.onclick = async () => {
        const link = shareUrl(button.dataset.copy);
        try {
          await navigator.clipboard.writeText(link);
          setStatus(button.dataset.copy === 'obs' ? 'OBS browser-source link copied.' : 'Live run link copied.');
        } catch {
          setStatus(link);
        }
      };
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-transfer]');
    if (!button || sharedId !== null) return;
    try {
      sessionStorage.setItem(transferKey, JSON.stringify(toGeneralMatch(run, Number(button.dataset.transfer))));
      location.assign('dbd-toolkit.html?tab=track');
    } catch {
      setStatus('Could not open the match in Match Tracker. Check your browser storage settings.');
    }
  });

  function save(next, loggedCharacter, selectedCharacter = loggedCharacter, publish = true) {
    try {
      localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      setStatus('Could not save this run in browser storage.');
      return false;
    }
    run = next;
    setStatus(loggedCharacter ? `Logged ${loggedCharacter} · ${run.matches.at(-1).outcome}` : '');
    render(false, selectedCharacter);
    if (publish && run.published) sync();
    return true;
  }

  let clientPromise;
  function getClient() {
    if (!clientPromise) {
      clientPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/dist/umd/supabase.js';
        script.onload = () => resolve(window.supabase.createClient(config.url, config.publishableKey, {
          auth: { flowType: 'implicit', detectSessionInUrl: false, persistSession: true }
        }));
        script.onerror = () => reject(Error('Could not load the account service.'));
        document.head.append(script);
      }).catch(error => {
        clientPromise = null;
        throw error;
      });
    }
    return clientPromise;
  }

  async function sync(force = false) {
    if (syncing || (!force && !run.published)) return;
    syncing = true;
    const button = app.querySelector('#publish');
    button.disabled = true;
    setStatus('Syncing the live page…');
    try {
      const client = await getClient();
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError || !data.session) throw Error('Sign in with a verified account in the toolkit, then return here to publish.');
      let revision;
      do {
        const { published, timedMatch, ...snapshot } = run;
        revision = snapshot.revision;
        const { data: saved, error } = await client.rpc('hardcore_publish', {
          run_id: snapshot.id, run_snapshot: snapshot, run_revision: revision
        });
        if (error) throw Error(error.code === 'PGRST202'
          ? 'Live sharing requires the Hardcore Runs database migration.'
          : error.code === '42501' ? 'Publishing requires a verified account that owns this run.'
            : 'Could not sync this run. Try publishing again.');
        if (!saved) throw Error('The live page has a newer or conflicting revision.');
      } while (revision !== run.revision);
      if (!run.published) {
        run = { ...run, published: true };
        localStorage.setItem(draftKey, JSON.stringify(run));
        syncing = false;
        render();
        app.querySelector('#publish').focus();
      }
      setStatus('Live page synced.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      syncing = false;
      app.querySelector('#publish').disabled = false;
    }
  }

  async function watch() {
    try {
      const response = await fetch(config.url + '/rest/v1/rpc/hardcore_view', {
        method: 'POST',
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: sharedId })
      });
      if (!response.ok) throw Error('Live connection unavailable. Retrying…');
      const snapshot = await response.json();
      if (!snapshot) {
        app.innerHTML = hero('Run unavailable', 'Hardcore Challenge Tracker');
        setStatus('This run has not been published.');
      } else {
        const serialized = JSON.stringify(snapshot);
        if (serialized !== lastSnapshot) {
          run = snapshot;
          render(true);
          lastSnapshot = serialized;
        }
        setStatus('');
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setTimeout(watch, 2000);
    }
  }

  if (sharedId !== null) {
    if (overlay) document.documentElement.classList.add('overlay');
    if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sharedId)) {
      setStatus('Loading live run…');
      watch();
    } else {
      app.innerHTML = hero('Run unavailable', 'Hardcore Challenge Tracker');
      setStatus('The live run link is invalid.');
    }
    return;
  }

  try {
    run = JSON.parse(localStorage.getItem(draftKey));
  } catch {
    setStatus('Could not read the saved run.');
  }
  if (run) {
    render();
    if (run.published) sync();
  } else setup();
})();
