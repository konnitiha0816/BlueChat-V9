const socket = io();
const peer = new Peer();
let myStream, screenStream, myNick, currentRoom, myPeerId;
let isMicOn = true, isCamOn = true;

const sndTitle = new Audio('/sounds/title.mp3'); sndTitle.loop = true;
const sndWait = new Audio('/sounds/waiting.mp3'); sndWait.loop = true;
const sndNotify = new Audio('/sounds/notify.mp3');

// ユーティリティ
const show = (id) => {
    document.querySelectorAll('body > div').forEach(d => d.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

const updateClock = () => {
    const now = new Date();
    document.getElementById('display-time').innerText = now.toLocaleTimeString();
};

function initApp() {
    show('screen-title');
    sndTitle.play();
    setInterval(updateClock, 1000);
    const h = new Date().getHours();
    document.getElementById('body-bg').className = (h >= 5 && h < 17) ? 'day-bg' : 'night-bg';
}

// 認証
let ans;
function startCaptcha() {
    const a = Math.floor(Math.random()*9)+1, b = Math.floor(Math.random()*9)+1;
    ans = a * b;
    document.getElementById('kuku-q').innerText = `${a} × ${b} = ?`;
    show('screen-captcha');
}
function checkCaptcha() {
    if(parseInt(document.getElementById('kuku-a').value) === ans) show('screen-choice');
    else { alert("認証エラー。もう一度計算してください！"); startCaptcha(); }
}

// 入室処理
function handleCreate() {
    myNick = document.getElementById('user-nick').value.trim();
    if(!myNick) return alert("ニックネームを記入してください！");
    const id = prompt("部屋ID(6文字)を入力");
    if(id && id.length === 6) { currentRoom = id; socket.emit('create-room', id); }
}

function handleJoin() {
    myNick = document.getElementById('user-nick').value.trim();
    const id = document.getElementById('join-id').value.trim();
    if(!myNick) return alert("ニックネームを記入してください！");
    if(id.length !== 6) return alert("正しいIDを入力してください。");
    currentRoom = id;
    socket.emit('request-join', { roomId: id, nickname: myNick });
}

// 通信イベント
socket.on('room-created', id => startSession(id));
socket.on('waiting-approval', () => { sndTitle.pause(); sndWait.play(); show('screen-wait'); });

socket.on('admin-approval-request', data => {
    sndNotify.play();
    if(confirm(`${data.nickname}さんから参加リクエストがあります。承認しますか？`)) {
        socket.emit('approve-user', data.senderId);
    }
});

socket.on('join-approved', () => { sndWait.pause(); startSession(currentRoom); });

// セッション開始（HD画質設定）
async function startSession(roomId) {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: true
        });
        show('screen-call');
        document.getElementById('display-room-id').innerText = "ID: " + roomId;
        addVideo(myStream, myNick, true);
        socket.emit('join-call', { roomId: roomId, peerId: peer.id, nickname: myNick });
    } catch (e) { alert("カメラへのアクセスを許可してください。"); }
}

peer.on('open', id => myPeerId = id);
peer.on('call', call => {
    call.answer(myStream);
    call.on('stream', s => addVideo(s, "参加者"));
});

socket.on('user-connected', data => {
    const call = peer.call(data.peerId, myStream);
    call.on('stream', s => addVideo(s, data.nickname));
});

// ビデオ表示（ミラーモード/画面共有自動切替）
function addVideo(stream, nickname, isMe = false, isScreen = false) {
    if (document.getElementById('vid-' + stream.id)) return;

    const container = document.createElement('div');
    container.className = 'video-container';
    container.id = 'cont-' + stream.id;

    const v = document.createElement('video');
    v.id = 'vid-' + stream.id;
    v.srcObject = stream;
    v.autoplay = true;
    v.playsinline = true;
    if(isMe) v.muted = true;
    if(isScreen) v.classList.add('screen-share');

    const label = document.createElement('div');
    label.className = 'nickname-label';
    label.innerText = nickname;

    container.appendChild(v);
    container.appendChild(label);
    document.getElementById('video-grid').appendChild(container);

    // 画面共有が止まったら要素を消す
    stream.getVideoTracks()[0].onended = () => {
        container.remove();
        if(isScreen) screenStream = null;
    };
}

// 画面共有機能
async function toggleScreenShare() {
    if(screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        return;
    }
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        addVideo(screenStream, "画面共有", false, true);
        Object.values(peer.connections).forEach(c => peer.call(c[0].peer, screenStream));
    } catch (err) { console.log("Sharing cancelled"); }
}

// ツール・チャット
function toggleMic() {
    isMicOn = !isMicOn;
    myStream.getAudioTracks()[0].enabled = isMicOn;
    document.getElementById('btn-mic').classList.toggle('off', !isMicOn);
}
function toggleCam() {
    isCamOn = !isCamOn;
    myStream.getVideoTracks()[0].enabled = isCamOn;
    document.getElementById('btn-cam').classList.toggle('off', !isCamOn);
}
function toggleSide(id) { document.getElementById('side-'+id).classList.toggle('open'); }

function sendChat() {
    const input = document.getElementById('chat-in');
    if(input.value) {
        socket.emit('send-chat', { roomId: currentRoom, sender: myNick, text: input.value });
        input.value = "";
    }
}
socket.on('receive-chat', data => {
    const logs = document.getElementById('chat-logs');
    const div = document.createElement('div');
    div.style.marginBottom = "10px";
    div.innerHTML = `<b style="color:#0078d4">${data.sender}:</b> ${data.text}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
});
