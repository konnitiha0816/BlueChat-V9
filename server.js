const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
const rooms = new Map();

io.on('connection', (socket) => {
    // 部屋作成
    socket.on('create-room', (roomId) => {
        rooms.set(roomId, { hostId: socket.id, users: [] });
        socket.join(roomId);
        socket.emit('room-created', roomId);
    });

    // 参加リクエスト
    socket.on('request-join', (data) => {
        const room = rooms.get(data.roomId);
        if (room) {
            socket.emit('play-wait-music');
            io.to(room.hostId).emit('admin-approval-request', { 
                senderId: socket.id, 
                nickname: data.nickname 
            });
        }
    });

    // 承認
    socket.on('approve-user', (targetId) => {
        io.to(targetId).emit('join-approved');
    });

    // 通話開始後の情報共有（PeerIDとニックネームの紐付け）
    socket.on('join-call', (data) => {
        socket.join(data.roomId);
        socket.to(data.roomId).emit('user-connected', {
            peerId: data.peerId,
            nickname: data.nickname
        });
    });

    // チャット
    socket.on('send-chat', (data) => {
        io.to(data.roomId).emit('receive-chat', data);
    });
});

server.listen(process.env.PORT || 3000);
