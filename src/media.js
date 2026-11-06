// Fixed audio/camera/screen transceivers avoid renegotiation when devices toggle.
// Only the lexicographically first peer creates the initial offer.
export function createMedia({ socket, request, notify, onChange }) {
  let self = null,
    iceServers = [],
    active = false,
    broadcast = false,
    muted = false,
    generation = 0;
  const tracks = [null, null, null],
    peers = new Map();
  let members = [];
  const panel = document.getElementById("media-grid");
  const local = document.createElement("section");
  local.className = "media-tile local";
  local.hidden = true;
  const label = document.createElement("strong");
  label.textContent = "あなた";
  local.append(label);
  panel.append(local);
  const preview = [
    null,
    ...[1, 2].map(() => {
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.hidden = true;
      local.append(v);
      return v;
    }),
  ];
  const state = () => ({
    call: active,
    mic: !!tracks[0],
    camera: !!tracks[1],
    screen: !!tracks[2],
    broadcast,
  });
  async function publish() {
    const r = await request("media", state());
    if (r.error) throw new Error(r.error);
    onChange(state());
  }
  function tell(to, data) {
    socket.emit("signal", { to, ...data });
  }
  function close(id) {
    const peer = peers.get(id);
    if (!peer) return;
    clearTimeout(peer.timer);
    peer.pc.close();
    peer.tile.remove();
    peers.delete(id);
  }
  function render() {
    local.hidden = !active;
    for (const [id, p] of peers) {
      const person = members.find((m) => m.id === id);
      p.name.textContent = person?.name || "参加者";
      p.video.hidden = !person?.camera;
      p.screen.hidden = !person?.screen;
      p.audio.muted = muted;
      p.tile.dataset.camera = String(!!person?.camera);
      p.tile.dataset.screen = String(!!person?.screen);
    }
  }
  async function replace(peer) {
    const transceivers = peer.pc.getTransceivers();
    for (let i = 0; i < transceivers.length && i < 3; i++) {
      transceivers[i].direction = "sendrecv";
      await transceivers[i].sender.replaceTrack(tracks[i]);
    }
  }
  function make(id) {
    if (peers.has(id)) return peers.get(id);
    const pc = new RTCPeerConnection({ iceServers });
    const tile = document.createElement("section");
    tile.className = "media-tile";
    tile.dataset.peer = id;
    const name = document.createElement("strong");
    const connection = document.createElement("small");
    connection.textContent = "通話に接続中…";
    const audio = document.createElement("audio"),
      video = document.createElement("video"),
      screen = document.createElement("video");
    audio.autoplay = true;
    audio.muted = muted;
    for (const v of [video, screen]) {
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.hidden = true;
      v.controls = true;
    }
    screen.className = "shared-screen";
    tile.append(name, connection, audio, video, screen);
    panel.append(tile);
    const peer = {
      pc,
      tile,
      name,
      audio,
      video,
      screen,
      connection,
      chain: Promise.resolve(),
      candidates: [],
    };
    peers.set(id, peer);
    peer.timer = setTimeout(() => {
      if (
        pc.connectionState !== "connected" &&
        pc.connectionState !== "closed"
      ) {
        connection.textContent = "接続未完了";
        notify(
          "通話の接続が完了しません。TURN設定・ブラウザの通信ポリシー・ネットワークをご確認ください。",
        );
      }
    }, 12000);
    pc.onicecandidate = (e) => {
      if (e.candidate) tell(id, { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const index = Number(e.transceiver.mid);
      const element = index === 0 ? audio : index === 2 ? screen : video;
      element.srcObject = new MediaStream([e.track]);
      element
        .play()
        .catch(() =>
          notify("音声を再生するには「音を再生」を押してください。"),
        );
    };
    pc.onconnectionstatechange = () => {
      tile.dataset.connection = pc.connectionState;
      if (pc.connectionState === "connected") clearTimeout(peer.timer);
      connection.textContent =
        pc.connectionState === "connected"
          ? "接続済み"
          : pc.connectionState === "failed"
            ? "接続失敗：通話を退出して再参加してください"
            : "接続中…";
      if (pc.connectionState === "failed")
        notify(
          "通話接続に失敗しました。別ネットワーク間ではTURN設定が必要な場合があります。",
        );
    };
    if (self < id) {
      for (const kind of ["audio", "video", "video"])
        pc.addTransceiver(kind, { direction: "sendrecv" });
      peer.chain = peer.chain
        .then(async () => {
          await replace(peer);
          await pc.setLocalDescription(await pc.createOffer());
          tell(id, { description: pc.localDescription.toJSON() });
        })
        .catch((e) => notify("通話の準備に失敗しました：" + e.message));
    }
    render();
    return peer;
  }
  socket.on("signal", (data) => {
    if (!active || !self) return;
    const peer = make(data.from);
    peer.chain = peer.chain
      .then(async () => {
        if (data.description) {
          await peer.pc.setRemoteDescription(data.description);
          if (data.description.type === "offer") {
            await replace(peer);
            await peer.pc.setLocalDescription(await peer.pc.createAnswer());
            tell(data.from, { description: peer.pc.localDescription.toJSON() });
          }
          for (const c of peer.candidates.splice(0))
            await peer.pc.addIceCandidate(c);
        } else if (data.candidate) {
          if (peer.pc.remoteDescription)
            await peer.pc.addIceCandidate(data.candidate);
          else peer.candidates.push(data.candidate);
        }
      })
      .catch((e) => {
        if (peer.pc.connectionState !== "closed")
          notify("通話処理に失敗しました：" + e.message);
      });
  });
  socket.on("peers", (ids) => {
    if (!active) return;
    for (const id of peers.keys()) if (!ids.includes(id)) close(id);
    for (const id of ids) make(id);
    render();
  });
  async function updateTracks() {
    for (const peer of peers.values())
      await peer.chain.then(() => replace(peer));
    for (const i of [1, 2]) {
      preview[i].hidden = !tracks[i];
      preview[i].srcObject = tracks[i] ? new MediaStream([tracks[i]]) : null;
    }
    await publish();
    render();
  }
  async function stopSlot(i) {
    tracks[i]?.stop();
    tracks[i] = null;
    await updateTracks();
  }
  async function stop() {
    generation++;
    active = false;
    broadcast = false;
    for (let i = 0; i < 3; i++) {
      tracks[i]?.stop();
      tracks[i] = null;
    }
    for (const id of [...peers.keys()]) close(id);
    for (const i of [1, 2]) {
      preview[i].srcObject = null;
      preview[i].hidden = true;
    }
    local.hidden = true;
    if (self && socket.connected)
      try {
        await publish();
      } catch {}
    onChange(state());
  }
  async function toggle(i, deviceId) {
    if (!self) throw new Error("先に入室してください。");
    if (tracks[i]) {
      await stopSlot(i);
      return;
    }
    if (!navigator.mediaDevices)
      throw new Error("カメラ・マイクにはHTTPSまたはlocalhostが必要です。");
    const version = generation;
    let stream;
    try {
      stream =
        i === 2
          ? await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false,
            })
          : await navigator.mediaDevices.getUserMedia(
              i === 0
                ? {
                    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
                    video: false,
                  }
                : {
                    audio: false,
                    video: {
                      width: { ideal: 640 },
                      height: { ideal: 360 },
                      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
                    },
                  },
            );
    } catch (e) {
      throw new Error(
        e.name === "NotAllowedError"
          ? "利用が許可されませんでした。ブラウザの権限設定を確認してください。"
          : e.name === "NotFoundError"
            ? "利用できるデバイスが見つかりません。"
            : e.message,
      );
    }
    if (version !== generation) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    tracks[i] = stream.getTracks()[0];
    tracks[i].onended = () => {
      if (tracks[i]?.readyState === "ended")
        stopSlot(i).catch((e) => notify(e.message));
    };
    active = true;
    try {
      await updateTracks();
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      tracks[i] = null;
      await stop();
      throw e;
    }
  }
  return {
    state,
    configure(id, servers) {
      self = id;
      iceServers = servers;
    },
    members(data) {
      members = data;
      render();
    },
    async join() {
      if (!self) throw new Error("先に入室してください。");
      active = true;
      await publish();
    },
    stop,
    disconnect() {
      self = null;
      return stop();
    },
    toggle,
    async setBroadcast(value) {
      broadcast = value;
      try {
        await publish();
      } catch (e) {
        broadcast = !value;
        throw e;
      }
    },
    mute() {
      muted = !muted;
      render();
      return muted;
    },
    resume() {
      for (const p of peers.values()) p.audio.play().catch(() => {});
    },
    async devices() {
      if (!navigator.mediaDevices) return [];
      return navigator.mediaDevices.enumerateDevices();
    },
  };
}
