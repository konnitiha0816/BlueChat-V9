const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// 通話部屋の情報を管理する台帳
const rooms = new Map(); // roomId -> { hostId, locked, members: [] }

io.on('connection', (socket) => {
    // 1. 通話作成
    socket.on('create-room', (roomId) => {
        if (rooms.has(roomId)) {
            socket.emit('room-error', 'そのIDは既に使用されています');
        } else {
            // 部屋を作成し、作成者を「プラチナ（主催者）」として登録
            rooms.set(roomId, { hostId: socket.id, locked: false });
            socket.join(roomId);
            socket.emit('room-created', roomId);
        }
    });

    // 2. 参加リクエスト（ここが重要）
    socket.on('request-join', (data) => {
        const room = rooms.get(data.roomId);
        
        if (!room) return socket.emit('join-error', 'IDが見つかりません');
        if (room.locked) return socket.emit('join-error', 'ロックされています');

        // 参加者に「音楽鳴らして待ってて」と伝える
        socket.emit('play-wait-music');

        // 主催者に「○○さんが来たよ」と伝える
        io.to(room.hostId).emit('admin-approval-request', {
            senderId: socket.id,
            nickname: data.nickname
        });
    });

    // 3. 承認処理
    socket.on('approve-user', (targetId) => {
        // 待たせていた参加者に「OK」を出す
        io.to(targetId).emit('join-approved', { role: 'ブロンズ' });
    });

    // 4. チャット
    socket.on('send-chat', (data) => {
        io.to(data.roomId).emit('receive-chat', data);
    });

    // 5. 管理者機能（ロック、全員退出）
    socket.on('admin-action', (data) => {
        const room = rooms.get(data.roomId);
        if(room && room.hostId === socket.id) {
            if(data.type === 'kick-all') io.to(data.roomId).emit('force-exit');
            if(data.type === 'lock') room.locked = !room.locked;
        }
    });

    // 切断時
    socket.on('disconnect', () => {
        // 主催者が落ちたら部屋を消すなどの処理（今回は簡易化）
    });
});

server.listen(process.env.PORT || 3000);
