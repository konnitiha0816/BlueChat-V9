const socket = io();
const peer = new Peer();
let myStream;
let myNick = "";
let currentRoom = "";
let myRole = "ブロンズ";

// 音声ファイル (ファイル名を正確に！)
const sndTitle = new Audio('/sounds/title.mp3'); sndTitle.loop = true;
const sndWait = new Audio('/sounds/waiting.mp3'); sndWait.loop = true;
const sndNotify = new Audio('/sounds/notify.mp3');

// --- 画面遷移ヘルパー ---
function show(id) {
    document.querySelectorAll('body > div').forEach(d => {
        if(d.id !== 'version') d.classList.add('hidden');
    });
    const el = document.getElementById(id);
    if(el) el.classList.remove('hidden');
}

// 1. 起動・背景
function initApp() {
    show('screen-title');
    sndTitle.play().catch(e=>console.log(e));
    updateBg();
}
function updateBg() {
    const h = new Date().getHours();
    document.body.className = (h >= 5 && h < 17) ? 'day-bg' : 'night-bg';
}

// 2. 認証・入力
let ans=0;
function startCaptcha() {
    const a = Math.floor(Math.random()*9)+1, b = Math.floor(Math.random()*9)+1;
    ans = a*b;
    document.getElementById('kuku-q').innerText = `${a} × ${b} = ?`;
    show('screen-captcha');
}
function checkCaptcha() {
    if(parseInt(document.getElementById('kuku-a').value) === ans) {
        myNick = prompt("ニックネームを入力 (本名NG)");
        if(myNick) show('screen-choice');
    } else { alert("不正解！"); startCaptcha(); }
}
function toLobby() { show('screen-lobby'); }

// 3. 通話作成・参加ロジック
function createRoom() {
    const id = prompt("6文字のIDを決めてください");
    if(!id || id.length !== 6) return alert("6文字で入力してください");
    myRole = "プラチナ"; // 主催者権限
    socket.emit('create-room', id);
}

function requestJoin() {
    const id = document.getElementById('join-id').value;
    if(!id || id.length !== 6) return alert("IDを確認してください");
    currentRoom = id;
    socket.emit('request-join', { roomId: id, nickname: myNick });
}

// --- Socketイベント (ここが命) ---
socket.on('room-created', (id) => {
    currentRoom = id;
    prepareCall();
});

socket.on('play-wait-music', () => {
    sndTitle.pause();
    sndWait.play();
    show('screen-wait');
});

socket.on('admin-approval-request', (data) => {
    sndNotify.play();
    if(confirm(`${data.nickname}さんが参加を希望しています。承認しますか？`)) {
        socket.emit('approve-user', data.senderId);
    }
});

socket.on('join-approved', (data) => {
    sndWait.pause();
    myRole = data.role;
    prepareCall();
});

// 4. 準備〜通話開始
async function prepareCall() {
    show('screen-setup');
    myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('setup-video').srcObject = myStream;
}

function enterCall() {
    show('screen-call');
    document.getElementById('disp-id').innerText = "ID: " + currentRoom;
    if(myRole === 'プラチナ') document.getElementById('btn-admin').style.display = 'flex';
    
    // 自分を表示
    addVideo(myStream);
    
    // PeerJS: 既存メンバーに接続 & 新規メンバー受け入れ
    peer.on('call', call => {
        call.answer(myStream);
        call.on('stream', stream => addVideo(stream));
    });
    socket.on('user-connected', (userId) => { // 簡易実装: PeerID交換が必要だが今回は省略
        // 本来はここで socket.emit('connect-to-peer', ...) 等の処理が入る
    });
    
    setInterval(()=>document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000);
}

function addVideo(stream) {
    const v = document.createElement('video');
    v.srcObject = stream;
    v.autoplay = true;
    document.getElementById('video-grid').appendChild(v);
}

// 5. 機能ボタン
function toggleMute(btn) {
    const track = myStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    btn.classList.toggle('active-red');
}
function toggleCam(btn) {
    const track = myStream.getVideoTracks()[0];
    track.enabled = !track.enabled;
    btn.classList.toggle('active-red');
}
async function shareScreen() {
    if(myRole === 'ブロンズ') return alert("権限がありません");
    // 画面共有ロジック(簡易)
    const screenStream = await navigator.mediaDevices.getDisplayMedia();
    addVideo(screenStream);
}

// サイドバーとチャット
function toggleSide(name) {
    document.getElementById('side-'+name).classList.toggle('open');
}
function sendChat() {
    const text = document.getElementById('chat-in').value;
    if(text) {
        socket.emit('send-chat', { roomId: currentRoom, text: myNick + ": " + text });
        document.getElementById('chat-in').value = "";
    }
}
socket.on('receive-chat', data => {
    const p = document.createElement('div');
    p.innerText = data.text;
    document.getElementById('chat-logs').appendChild(p);
    // メンション時の自動オープン
    if(data.text.includes("@"+myNick) || (myRole==='プラチナ' && data.text.includes("@All"))) {
        document.getElementById('side-chat').classList.add('open');
    }
});

function sendAdmin(type) {
    socket.emit('admin-action', { roomId: currentRoom, type: type });
}
socket.on('force-exit', () => location.reload());
