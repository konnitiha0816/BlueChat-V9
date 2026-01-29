const socket = io();
const peer = new Peer();
let myStream, screenStream, myNick, currentRoom;
let isMicOn = true, isCamOn = true;

const sndTitle = new Audio('/sounds/title.mp3'); sndTitle.loop = true;
const sndWait = new Audio('/sounds/waiting.mp3'); sndWait.loop = true;
const sndNotify = new Audio('/sounds/notify.mp3');
const sndSuccess = new Audio('https://www.soundjay.com/buttons/sounds/button-37.mp3'); // かっこいい効果音

// 画面切り替え（アニメーション対応）
const show = (id) => {
    document.querySelectorAll('body > div.full, body > div#screen-call').forEach(d => d.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

function initApp() {
    show('screen-title');
    sndTitle.play();
    setInterval(() => {
        document.getElementById('display-time').innerText = new Date().toLocaleTimeString();
    }, 1000);
    const h = new Date().getHours();
    document.getElementById('body-bg').className = (h >= 5 && h < 17) ? 'day-bg' : 'night-bg';
}

// 九九開始：BGMを止める！
let ans;
function startCaptcha() {
    // 🎵 タイトルBGMを停止
    sndTitle.pause();
    sndTitle.currentTime = 0;

    const a = Math.floor(Math.random()*9)+1, b = Math.floor(Math.random()*9)+1;
    ans = a * b;
    document.getElementById('kuku-q').innerText = `${a} × ${b} = ?`;
    show('screen-captcha');
}

// 突破：かっこいいアニメーション
function checkCaptcha() {
    if(parseInt(document.getElementById('kuku-a').value) === ans) {
        // 🌟 演出開始
        sndSuccess.play();
        const screen = document.getElementById('screen-captcha');
        const flash = document.getElementById('flash-effect');
        
        flash.classList.add('flash-active'); // 白い光
        screen.classList.add('success-zoom'); // ズームアウト
        
        setTimeout(() => {
            screen.classList.remove('success-zoom');
            flash.classList.remove('flash-active');
            show('screen-choice');
        }, 800);
    } else {
        alert("やり直し！");
        startCaptcha();
    }
}

// --- 通話・ロジック（全機能維持） ---
function handleCreate() {
    myNick = document.getElementById('user-nick').value.trim();
    if(!myNick) return alert("名前を書いてにゃ！🐈");
    const id = prompt("部屋ID(6文字)");
    if(id && id.length === 6) { currentRoom = id; socket.emit('create-room', id); }
}

function handleJoin() {
    myNick = document.getElementById('user-nick').value.trim();
    const id = document.getElementById('join-id').value.trim();
    if(!myNick) return alert("名前を書いてにゃ！🐈");
    if(id.length !== 6) return alert("IDは6文字です🚅");
    currentRoom = id;
    socket.emit('request-join', { roomId: id, nickname: myNick });
}

socket.on('room-created', id => startSession(id));
socket.on('waiting-approval', () => { sndWait.play(); show('screen-wait'); });
socket.on('admin-approval-request', data => {
    sndNotify.play();
    if(confirm(`${data.nickname}さんを承認しますか？`)) socket.emit('approve-user', data.senderId);
});
socket.on('join-approved', () => { sndWait.pause(); startSession(currentRoom); });

async function startSession(roomId) {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 }, audio: true
        });
        show('screen-call');
        document.getElementById('display-room-id').innerText = "ID: " + roomId;
        addVideo(myStream, myNick, true);
        socket.emit('join-call', { roomId: roomId, peerId: peer.id, nickname: myNick });
    } catch (e) { alert("カメラ許可が必要です"); }
}

peer.on('open', id => {});
peer.on('call', call => {
    call.answer(myStream);
    call.on('stream', s => addVideo(s, "参加者"));
});

socket.on('user-connected', data => {
    const call = peer.call(data.peerId, myStream);
    call.on('stream', s => addVideo(s, data.nickname));
});

function addVideo(stream, nickname, isMe = false, isScreen = false) {
    if (document.getElementById('vid-' + stream.id)) return;
    const container = document.createElement('div');
    container.className = 'video-container';
    container.id = 'cont-' + stream.id;

    const v = document.createElement('video');
    v.id = 'vid-' + stream.id; v.srcObject = stream; v.autoplay = true; v.playsinline = true;
    if(isMe) v.muted = true;
    if(isScreen) v.classList.add('screen-share');

    const label = document.createElement('div');
    label.className = 'nickname-label'; label.innerText = nickname;

    container.appendChild(v); container.appendChild(label);
    document.getElementById('video-grid').appendChild(container);
    stream.getVideoTracks()[0].onended = () => container.remove();
}

async function toggleScreenShare() {
    if(screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; return; }
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    addVideo(screenStream, "画面共有", false, true);
    Object.values(peer.connections).forEach(c => peer.call(c[0].peer, screenStream));
}

function toggleMic() { isMicOn = !isMicOn; myStream.getAudioTracks()[0].enabled = isMicOn; document.getElementById('btn-mic').classList.toggle('off', !isMicOn); }
function toggleCam() { isCamOn = !isCamOn; myStream.getVideoTracks()[0].enabled = isCamOn; document.getElementById('btn-cam').classList.toggle('off', !isCamOn); }
function toggleSide(id) { document.getElementById('side-'+id).classList.toggle('open'); }

function sendChat() {
    const input = document.getElementById('chat-in');
    if(input.value) { socket.emit('send-chat', { roomId: currentRoom, sender: myNick, text: input.value }); input.value = ""; }
}
socket.on('receive-chat', data => {
    const d = document.createElement('div'); d.style.marginBottom = "10px";
    d.innerHTML = `<b style="color:#0078d4">${data.sender}:</b> ${data.text}`;
    document.getElementById('chat-logs').appendChild(d);
});
