const socket = io();
const peer = new Peer();
let myStream, myNick, currentRoom, myPeerId;
let isMicOn = true, isCamOn = true;

const sndTitle = new Audio('/sounds/title.mp3'); sndTitle.loop = true;
const sndWait = new Audio('/sounds/waiting.mp3'); sndWait.loop = true;
const sndNotify = new Audio('/sounds/notify.mp3');

function show(id) {
    document.querySelectorAll('body > div').forEach(d => d.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function initApp() { show('screen-title'); sndTitle.play(); updateBg(); }
function updateBg() {
    const h = new Date().getHours();
    document.getElementById('body-bg').className = (h >= 5 && h < 17) ? 'day-bg' : 'night-bg';
}

let ans;
function startCaptcha() {
    const a = Math.floor(Math.random()*9)+1, b = Math.floor(Math.random()*9)+1;
    ans = a * b;
    document.getElementById('kuku-q').innerText = `${a} × ${b} = ?`;
    show('screen-captcha');
}
function checkCaptcha() {
    if(parseInt(document.getElementById('kuku-a').value) === ans) show('screen-choice');
    else { alert("不正解！"); startCaptcha(); }
}

peer.on('open', id => { myPeerId = id; });

function createRoom() {
    myNick = document.getElementById('user-nick').value;
    const id = prompt("6文字のID");
    if(myNick && id && id.length === 6) {
        currentRoom = id;
        socket.emit('create-room', id);
    }
}

function requestJoin() {
    myNick = document.getElementById('user-nick').value;
    const id = document.getElementById('join-id').value;
    if(myNick && id && id.length === 6) {
        currentRoom = id;
        socket.emit('request-join', { roomId: id, nickname: myNick });
    }
}

socket.on('room-created', () => prepareMedia());
socket.on('play-wait-music', () => { sndTitle.pause(); sndWait.play(); show('screen-wait'); });
socket.on('admin-approval-request', data => {
    sndNotify.play();
    if(confirm(`${data.nickname}さんを承認しますか？`)) socket.emit('approve-user', data.senderId);
});
socket.on('join-approved', () => { sndWait.pause(); prepareMedia(); });

async function prepareMedia() {
    show('screen-setup');
    myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('setup-video').srcObject = myStream;
}

function enterCall() {
    show('screen-call');
    addVideo(myStream, myNick, true);
    
    // 自分の参加を他全員に知らせる
    socket.emit('join-call', { roomId: currentRoom, peerId: myPeerId, nickname: myNick });

    // 着信処理
    peer.on('call', call => {
        call.answer(myStream);
        call.on('stream', userStream => {
            // 相手のニックネームはSocket経由で受け取る（今回は簡易的にメタデータとして扱う工夫が必要ですが、通常は受信後に名前を紐付けます）
            addVideo(userStream, "参加者"); 
        });
    });
}

// 他のユーザーが接続したとき
socket.on('user-connected', data => {
    const call = peer.call(data.peerId, myStream);
    call.on('stream', userStream => {
        addVideo(userStream, data.nickname);
    });
});

function addVideo(stream, nickname, isMe = false) {
    const container = document.createElement('div');
    container.className = 'video-container';
    container.id = 'cont-' + stream.id;

    const v = document.createElement('video');
    v.srcObject = stream;
    v.autoplay = true;
    v.playsinline = true;
    if(isMe) v.muted = true;

    const label = document.createElement('div');
    label.className = 'nickname-label';
    label.innerText = nickname;

    container.appendChild(v);
    container.appendChild(label);
    document.getElementById('video-grid').appendChild(container);

    // 画面共有などの終了検知
    stream.getVideoTracks()[0].onended = () => {
        container.remove();
    };
}

// 画面共有
async function shareScreen() {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
    addVideo(s, "画面共有", false);
    Object.values(peer.connections).forEach(c => peer.call(c[0].peer, s));
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
    const p = document.createElement('div');
    p.innerHTML = `<b>${data.sender}:</b> ${data.text}`;
    document.getElementById('chat-logs').appendChild(p);
});
