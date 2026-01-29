const socket = io();
const peer = new Peer();
let myStream, myNick, currentRoom;
const sndTitle = new Audio('/sounds/title.mp3');
const sndWait = new Audio('/sounds/waiting.mp3');
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

function createRoom() {
    myNick = document.getElementById('user-nick').value;
    if(!myNick) return alert("名前を入力してください");
    const id = prompt("6文字のID");
    if(id && id.length === 6) socket.emit('create-room', id);
}

function requestJoin() {
    myNick = document.getElementById('user-nick').value;
    const id = document.getElementById('join-id').value;
    if(!myNick || id.length !== 6) return alert("名前とIDを確認してください");
    currentRoom = id;
    socket.emit('request-join', { roomId: id, nickname: myNick });
}

socket.on('room-created', id => { currentRoom = id; prepare(); });
socket.on('play-wait-music', () => { sndTitle.pause(); sndWait.play(); show('screen-wait'); });
socket.on('admin-approval-request', data => {
    sndNotify.play();
    if(confirm(`${data.nickname}さんの参加を承認しますか？`)) socket.emit('approve-user', data.senderId);
});
socket.on('join-approved', () => { sndWait.pause(); prepare(); });

async function prepare() {
    show('screen-setup');
    myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('setup-video').srcObject = myStream;
}

function enterCall() {
    show('screen-call');
    addVideo(myStream);
    peer.on('call', call => { call.answer(myStream); call.on('stream', s => addVideo(s)); });
}

function addVideo(s) {
    const v = document.createElement('video');
    v.srcObject = s; v.autoplay = true;
    document.getElementById('video-grid').appendChild(v);
}

function toggleSide(id) { document.getElementById('side-'+id).classList.toggle('open'); }

function sendChat() {
    const text = document.getElementById('chat-in').value;
    if(text) {
        socket.emit('send-chat', { roomId: currentRoom, sender: myNick, text: text });
        document.getElementById('chat-in').value = "";
    }
}
socket.on('receive-chat', data => {
    const p = document.createElement('div');
    p.innerHTML = `<b>${data.sender}:</b> ${data.text}`;
    document.getElementById('chat-logs').appendChild(p);
});
