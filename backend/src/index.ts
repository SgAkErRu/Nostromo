// подключаем нужные модули (библиотеки) и настраиваем веб-сервер
import express = require('express');
import path = require('path');
import fs = require('fs');
import https = require('https');
import SocketIO = require('socket.io');
import { Socket } from 'socket.io';

const app = express();

const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '/ssl', 'private.key'), 'utf8'),
    cert: fs.readFileSync(path.join(__dirname, '/ssl', 'public.crt'), 'utf8')
};

const server = https.createServer(httpsOptions, app);
const port = 443;

server.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});

// открываем доступ к статике, т.е к папке public (css, js, картинки)
app.use(express.static("../frontend/public/"));

// главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages', 'demo.html'));
});
app.get('/theory', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages', 'teoria.html'));
});

// сокеты
const io = new SocketIO.Server(server, {
    'pingInterval': 2000,
    'pingTimeout': 2000
});

type username_t = string;
type socketID = string;
let Users = new Map<socketID, username_t>();

// обрабатываем подключение нового юзера
io.on('connection', (socket: Socket) => {
    console.log(`${Users.size + 1}: ${socket.id} user connected`);

    socket.on('afterConnect', (username: username_t) => {
        // перебираем всех пользователей, кроме нового
        for (const anotherUserID of Users.keys()) {
            const offering: boolean = true;
            // сообщаем новому пользователю и пользователю anotherUser,
            // что им необходимо создать пустое p2p подключение (PeerConnection)
            socket.emit('newUser', { ID: anotherUserID, name: Users.get(anotherUserID) }, offering);
            io.to(anotherUserID).emit('newUser', { ID: socket.id, name: username }, !offering);
            // сообщаем новому пользователю, что он должен создать приглашение для юзера anotherUser
            console.log(`запросили приглашение от ${socket.id} для ${anotherUserID}`);
            socket.emit('newOffer', anotherUserID);
        }
        // добавляем в Users нашего нового пользователя
        Users.set(socket.id, username);
    });

    socket.on('newUsername', (username: username_t) => {
        Users.set(socket.id, username);
        for (const anotherUserID of Users.keys()) {
            if (anotherUserID != socket.id) {
                io.to(anotherUserID).emit('newUsername', { ID: socket.id, name: username });
            }
        }
    });

    // если получили приглашение от юзера socket для юзера anotherUserID
    socket.on('newOffer', (offer: RTCSessionDescription, anotherUserID: socketID) => {
        console.log(`получили приглашение от ${socket.id} для ${anotherUserID}`);
        // отправляем его другому пользователю
        if (Users.has(anotherUserID)) {
            console.log(`отправили приглашение от ${socket.id} для ${anotherUserID}`);
            io.to(anotherUserID).emit('receiveOffer', offer, socket.id);
        }
    });

    // если получили ответ от юзера socket для юзера anotherUserID
    socket.on('newAnswer', (answer: RTCSessionDescription, anotherUserID: socketID) => {
        console.log(`получили ответ от ${socket.id} для ${anotherUserID}`);
        if (Users.has(anotherUserID)) {
            console.log(`отправили ответ от ${socket.id} для ${anotherUserID}`);
            io.to(anotherUserID).emit('receiveAnswer', answer, socket.id);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`${socket.id}: user disconnected`, reason);
        Users.delete(socket.id);
        io.emit('userDisconnected', socket.id);
    });
});

// для ввода в консоль сервера
import readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input_str) => {
    console.log(input_str);
});
rl.on('SIGINT', () => {
    process.exit();
});