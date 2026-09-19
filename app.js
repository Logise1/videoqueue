(function () {
  const ADJ = ["Nova", "Pixel", "Luna", "Neon", "Cosmo", "Amber", "Volt", "Echo"];
  const NOUN = ["Fox", "Wave", "Spark", "Orbit", "Bloom", "Drift", "Pulse", "Hawk"];
  const YT_ID = /^[a-zA-Z0-9_-]{11}$/;
  const firebaseConfig = {
    apiKey: "AIzaSyBoMXPjK4IzYSa18dSao56d4KB4xorLG7U",
    authDomain: "friendly-90c71.firebaseapp.com",
    databaseURL: "https://friendly-90c71-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "friendly-90c71",
    storageBucket: "friendly-90c71.firebasestorage.app",
    messagingSenderId: "503852021024",
    appId: "1:503852021024:web:105b2ec7c3c30317a75345",
    measurementId: "G-DKL5CY6P0B",
  };

  const els = {
    landing: document.getElementById("view-landing"),
    host: document.getElementById("view-host"),
    guest: document.getElementById("view-guest"),
    create: document.getElementById("btn-create"),
    attract: document.getElementById("attract"),
    stage: document.getElementById("player-stage"),
    veil: document.getElementById("fade-veil"),
    toast: document.getElementById("now-toast"),
    toastTitle: document.getElementById("toast-title"),
    toastThumb: document.getElementById("toast-thumb"),
    addedToast: document.getElementById("added-toast"),
    addedTitle: document.getElementById("added-title"),
    addedThumb: document.getElementById("added-thumb"),
    qrMain: document.getElementById("qr-main"),
    qrMiniBox: document.getElementById("qr-mini"),
    qrModalBox: document.getElementById("qr-modal-box"),
    qrMini: document.getElementById("btn-qr-mini"),
    qrModal: document.getElementById("qr-modal"),
    closeQr: document.getElementById("btn-close-qr"),
    roomCode: document.getElementById("room-code"),
    joinUrl: document.getElementById("join-url"),
    hostBar: document.getElementById("host-bar"),
    queueBadge: document.getElementById("queue-badge"),
    skip: document.getElementById("btn-skip"),
    unlock: document.getElementById("unlock"),
    status: document.getElementById("guest-status"),
    form: document.getElementById("add-form"),
    input: document.getElementById("video-input"),
    add: document.getElementById("btn-add"),
    feedback: document.getElementById("add-feedback"),
    list: document.getElementById("guest-list"),
    count: document.getElementById("guest-count"),
  };

  const state = {
    role: null,
    roomId: null,
    username: randomName(),
    roomRef: null,
    queue: [],
    current: null,
    player: null,
    playerReady: false,
    playerWait: null,
    ytReady: null,
    hideBar: null,
    toastTimer: null,
    addedTimer: null,
    seenInbox: {},
  };

  const sfx = {
    added: new Audio("sfx/addedvideo.ogg"),
    next: new Audio("sfx/newvideo.ogg"),
  };
  sfx.added.preload = "auto";
  sfx.next.preload = "auto";

  if (typeof firebase === "undefined") {
    console.error("Firebase no cargó");
  } else {
    firebase.initializeApp(firebaseConfig);
  }

  const db = typeof firebase !== "undefined" ? firebase.database() : null;

  const params = new URLSearchParams(location.search);
  const joinId = params.get("sala");

  if (joinId) {
    startGuest(joinId);
  } else {
    els.create.addEventListener("click", () => {
      unlockSfx();
      startHost();
    });
  }

  function unlockSfx() {
    [sfx.added, sfx.next].forEach((clip) => {
      clip.volume = 0;
      clip.play().then(() => {
        clip.pause();
        clip.currentTime = 0;
        clip.volume = 1;
      }).catch(() => {
        clip.volume = 1;
      });
    });
  }

  function playSfx(clip) {
    try {
      clip.currentTime = 0;
      clip.volume = 1;
      clip.play().catch(() => {});
    } catch (_) {}
  }

  function popToast(node, timerKey, ms) {
    node.classList.remove("show");
    void node.offsetWidth;
    node.classList.add("show");
    clearTimeout(state[timerKey]);
    state[timerKey] = setTimeout(() => node.classList.remove("show"), ms);
  }

  function randomName() {
    const a = ADJ[Math.floor(Math.random() * ADJ.length)];
    const b = NOUN[Math.floor(Math.random() * NOUN.length)];
    const n = Math.floor(100 + Math.random() * 900);
    return a + b + n;
  }

  function show(view) {
    [els.landing, els.host, els.guest].forEach((node) => {
      const on = node === view;
      node.classList.toggle("hidden", !on);
      node.hidden = !on;
    });
  }

  function joinLink(roomId, host) {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    if (host) url.hostname = host;
    url.searchParams.set("sala", roomId);
    return url.toString();
  }

  function discoverLanIp() {
    return new Promise((resolve) => {
      const done = (value) => {
        try { rtc.close(); } catch (_) {}
        resolve(value);
      };
      let rtc;
      try {
        rtc = new RTCPeerConnection({ iceServers: [] });
      } catch (_) {
        resolve(null);
        return;
      }
      const timer = setTimeout(() => done(null), 1600);
      rtc.createDataChannel("ip");
      rtc.onicecandidate = (event) => {
        const line = event.candidate && event.candidate.candidate;
        if (!line) return;
        const match = line.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
        if (!match) return;
        const ip = match[1];
        if (ip.startsWith("127.") || ip.startsWith("0.")) return;
        clearTimeout(timer);
        done(ip);
      };
      rtc.createOffer().then((offer) => rtc.setLocalDescription(offer)).catch(() => {
        clearTimeout(timer);
        done(null);
      });
    });
  }

  function paintQr(target, text) {
    target.innerHTML = "";
    new QRCode(target, {
      text,
      width: 240,
      height: 240,
      colorDark: "#120814",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  function extractVideoId(raw) {
    const value = String(raw || "").trim();
    if (YT_ID.test(value)) return value;

    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = url.pathname.split("/").filter(Boolean)[0];
        return YT_ID.test(id) ? id : null;
      }
      if (host.endsWith("youtube.com")) {
        const watch = url.searchParams.get("v");
        if (YT_ID.test(watch)) return watch;
        const parts = url.pathname.split("/").filter(Boolean);
        const fromPath = parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live"
          ? parts[1]
          : null;
        return YT_ID.test(fromPath) ? fromPath : null;
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  async function videoMeta(videoId) {
    const fallback = {
      id: videoId,
      title: "Video de YouTube",
      thumb: "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg",
    };
    try {
      const res = await fetch(
        "https://noembed.com/embed?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + videoId)
      );
      if (!res.ok) return fallback;
      const data = await res.json();
      return {
        id: videoId,
        title: data.title || fallback.title,
        thumb: data.thumbnail_url || fallback.thumb,
      };
    } catch (_) {
      return fallback;
    }
  }

  function asList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return Object.keys(value).sort().map((key) => value[key]).filter(Boolean);
  }

  function roomPath(roomId) {
    return db.ref("rooms/" + roomId);
  }

  function publishState() {
    if (state.roomRef) {
      state.roomRef.child("playback").set({
        current: state.current,
        queue: state.queue,
      });
    }
    refreshHostUi();
  }

  function refreshHostUi() {
    const waiting = !state.current && state.queue.length === 0;
    els.attract.classList.toggle("hidden", !waiting);
    els.attract.hidden = !waiting;
    els.stage.classList.toggle("live", Boolean(state.current));
    els.qrMini.classList.toggle("visible", Boolean(state.current));
    const left = state.queue.length + (state.current ? 1 : 0);
    els.queueBadge.textContent = "Cola · " + left;
  }

  function flashVeil() {
    els.veil.classList.add("on");
    requestAnimationFrame(() => {
      setTimeout(() => els.veil.classList.remove("on"), 280);
    });
  }

  function showToast(item) {
    if (!item) return;
    els.toastTitle.textContent = item.title;
    els.toastThumb.src = item.thumb;
    popToast(els.toast, "toastTimer", 3000);
  }

  function showAddedToast(item) {
    if (!item) return;
    els.addedTitle.textContent = item.title;
    els.addedThumb.src = item.thumb;
    popToast(els.addedToast, "addedTimer", 3000);
  }

  function loadYouTube() {
    if (state.ytReady) return state.ytReady;
    state.ytReady = new Promise((resolve) => {
      if (window.YT && YT.Player) {
        resolve();
        return;
      }
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      window.onYouTubeIframeAPIReady = () => resolve();
      document.head.appendChild(tag);
    });
    return state.ytReady;
  }

  async function ensurePlayer() {
    await loadYouTube();
    if (state.player && state.playerReady) return state.player;
    if (state.playerWait) return state.playerWait;
    state.playerWait = new Promise((resolve) => {
      state.player = new YT.Player("yt-player", {
        width: "1280",
        height: "720",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            state.playerReady = true;
            resolve(state.player);
          },
          onStateChange: onPlayerState,
          onError: () => playNext(true),
        },
      });
    });
    return state.playerWait;
  }

  function onPlayerState(event) {
    if (event.data === YT.PlayerState.ENDED) playNext(true);
    if (event.data === YT.PlayerState.PLAYING) hideUnlock();
    if (event.data === YT.PlayerState.UNSTARTED) {
      setTimeout(() => {
        if (!state.current || !state.player) return;
        const s = state.player.getPlayerState();
        if (s === YT.PlayerState.UNSTARTED || s === YT.PlayerState.CUED) showUnlock();
      }, 1200);
    }
  }

  function showUnlock() {
    els.unlock.classList.remove("hidden");
    els.unlock.hidden = false;
  }

  function hideUnlock() {
    els.unlock.classList.add("hidden");
    els.unlock.hidden = true;
  }

  function playItem(item, announce) {
    state.current = item;
    flashVeil();
    if (announce) {
      showToast(item);
      playSfx(sfx.next);
    }
    const player = state.player;
    if (player && player.loadVideoById) {
      player.loadVideoById({ videoId: item.id, startSeconds: 0 });
      try {
        player.unMute();
        player.playVideo();
      } catch (_) {}
    }
    publishState();
  }

  async function playNext(announce) {
    const next = state.queue.shift();
    if (!next) {
      state.current = null;
      if (state.player && state.player.stopVideo) state.player.stopVideo();
      publishState();
      return;
    }
    await ensurePlayer();
    playItem(next, announce !== false);
  }

  async function enqueue(videoId) {
    if (state.queue.length + (state.current ? 1 : 0) >= 80) return { ok: false, reason: "full" };
    const meta = await videoMeta(videoId);
    const startsNow = !state.current;
    state.queue.push(meta);
    if (startsNow) {
      await playNext(true);
    } else {
      showAddedToast(meta);
      playSfx(sfx.added);
      publishState();
    }
    return { ok: true, title: meta.title };
  }

  async function handleInboxItem(snap) {
    const key = snap.key;
    if (!key || state.seenInbox[key]) return;
    state.seenInbox[key] = true;
    const msg = snap.val() || {};
    const id = extractVideoId(msg.video);
    let reply;
    if (!id) {
      reply = { type: "nack", reason: "invalid" };
    } else {
      const result = await enqueue(id);
      reply = { type: result.ok ? "ack" : "nack", title: result.title || null, reason: result.reason || null };
    }
    state.roomRef.child("replies/" + key).set(reply);
    snap.ref.remove();
  }

  async function startHost() {
    if (!db) {
      els.create.disabled = false;
      return;
    }
    els.create.disabled = true;
    const roomId = "vq" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    state.role = "host";
    state.roomId = roomId;
    state.roomRef = roomPath(roomId);

    await loadYouTube();
    show(els.host);
    let url = joinLink(roomId);
    const localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (localHost) {
      const lan = await discoverLanIp();
      if (lan) url = joinLink(roomId, lan);
    }
    els.roomCode.textContent = "Sala " + roomId;
    els.joinUrl.textContent = url;
    paintQr(els.qrMain, url);
    paintQr(els.qrMiniBox, url);
    paintQr(els.qrModalBox, url);
    refreshHostUi();

    try {
      await state.roomRef.set({
        open: true,
        created: Date.now(),
        playback: { current: null, queue: [] },
      });
      state.roomRef.child("inbox").on("child_added", (snap) => {
        handleInboxItem(snap);
      });
    } catch (err) {
      els.roomCode.textContent = "No se pudo crear la sala";
      console.error(err);
    }

    await ensurePlayer();
    bindHostChrome();
  }

  function bindHostChrome() {
    const reveal = () => {
      els.hostBar.classList.add("show");
      clearTimeout(state.hideBar);
      state.hideBar = setTimeout(() => els.hostBar.classList.remove("show"), 2600);
    };
    document.addEventListener("mousemove", reveal);
    document.addEventListener("touchstart", reveal, { passive: true });
    els.skip.addEventListener("click", () => playNext(true));
    els.qrMini.addEventListener("click", () => {
      els.qrModal.classList.remove("hidden");
      els.qrModal.hidden = false;
    });
    els.closeQr.addEventListener("click", () => {
      els.qrModal.classList.add("hidden");
      els.qrModal.hidden = true;
    });
    els.unlock.addEventListener("click", () => {
      hideUnlock();
      if (state.player && state.player.playVideo) {
        state.player.unMute();
        state.player.playVideo();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") playNext(true);
    });
  }

  function setGuestStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.remove("ok", "bad");
    if (kind) els.status.classList.add(kind);
  }

  function renderGuestQueue(payload) {
    const items = [];
    if (payload.current) items.push({ ...payload.current, now: true });
    asList(payload.queue).forEach((v) => items.push({ ...v, now: false }));
    els.count.textContent = String(items.length);
    els.list.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "empty-queue";
      empty.textContent = "Todavía no hay nada. Sé quien ponga el primero.";
      empty.style.gridTemplateColumns = "1fr";
      els.list.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      if (item.now) li.classList.add("current");
      const img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "";
      const box = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.title;
      const tag = document.createElement("span");
      tag.textContent = item.now ? "Sonando ahora" : "En cola";
      box.append(title, tag);
      li.append(img, box);
      els.list.appendChild(li);
    });
  }

  function waitReply(roomId, key) {
    const replyRef = db.ref("rooms/" + roomId + "/replies/" + key);
    replyRef.on("value", (snap) => {
      const msg = snap.val();
      if (!msg) return;
      replyRef.off();
      if (msg.type === "ack") {
        els.feedback.textContent = "En la cola" + (msg.title ? ": " + msg.title : "");
        els.feedback.classList.remove("boom");
        void els.feedback.offsetWidth;
        els.feedback.classList.add("boom");
        els.input.value = "";
      } else {
        els.feedback.textContent = msg.reason === "full"
          ? "La cola está llena."
          : "Ese enlace no parece de YouTube.";
      }
    });
  }

  async function startGuest(roomId) {
    state.role = "guest";
    state.roomId = roomId;
    show(els.guest);
    setGuestStatus("Conectando…");

    if (!db) {
      setGuestStatus("No se pudo cargar la conexión.", "bad");
      return;
    }

    try {
      const open = await roomPath(roomId).child("open").get();
      if (!open.exists() || !open.val()) {
        setGuestStatus("No encuentro la sala. ¿Está abierta en la tele?", "bad");
        return;
      }
    } catch (err) {
      setGuestStatus("No se pudo entrar a la sala.", "bad");
      console.error(err);
      return;
    }

    els.add.disabled = false;
    setGuestStatus("Conectado a la sala.", "ok");
    roomPath(roomId).child("playback").on("value", (snap) => {
      const data = snap.val() || {};
      renderGuestQueue({
        current: data.current || null,
        queue: data.queue || [],
      });
    });

    els.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = extractVideoId(els.input.value);
      if (!id) {
        els.feedback.textContent = "Pega un enlace de YouTube.";
        return;
      }
      els.feedback.textContent = "Enviando…";
      try {
        const req = await roomPath(roomId).child("inbox").push({
          video: id,
          who: state.username,
          ts: Date.now(),
        });
        waitReply(roomId, req.key);
      } catch (err) {
        els.feedback.textContent = "No se pudo enviar.";
        console.error(err);
      }
    });
  }
})();
