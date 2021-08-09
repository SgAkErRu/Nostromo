import path = require('path');
import fs = require('fs');
import http = require('http');
import https = require('https');
require('dotenv').config();

// Express
import { ExpressApp } from './ExpressApp';

// сокеты
import { SocketHandler } from './SocketHandler';

// mediasoup
import { Mediasoup } from './Mediasoup';

// комната
import { RoomId, Room } from './Room';
import { VideoCodec } from 'shared/RoomTypes';

// для ввода в консоль
import readline = require('readline');

// инициализация тестовой комнаты
async function initTestRoom(mediasoup: Mediasoup, socketHandler: SocketHandler, rooms: Map<RoomId, Room>): Promise<void>
{
    rooms.set('0',
        await Room.create(
            '0',
            process.env.DEV_TESTROOM_NAME ?? 'Тестовая',
            process.env.DEV_TESTROOM_PASS ?? 'testik1',
            VideoCodec.VP8,
            mediasoup,
            socketHandler
        )
    );
}

// добавление временных в меток в лог
function addTimestampsToConsoleLogs(): void
{
    let origlog = console.log;
    let origerror = console.error;

    let consoleFuncExtending = (obj: any, ...placeholders: any[]) =>
    {
        const timestamp = (new Date).toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: '2-digit',
            minute: "2-digit",
            second: "numeric"
        }) + '.' + ((new Date).getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5);

        if (typeof obj === 'string')
        {
            placeholders.unshift(`[${timestamp}] ${obj}`);
        }
        else
        {
            placeholders.unshift(obj);
            placeholders.unshift(`[${timestamp}] %j`);
        }
        return placeholders;
    };

    console.log = function (obj, ...placeholders)
    {
        let data: any[];
        origlog.apply(this, data = consoleFuncExtending(obj, ...placeholders));
        fs.writeFileSync(process.env.LOG_FILENAME ?? 'log.txt', data.toString() + '\n', { flag: 'a+', encoding: "utf8" });
    };

    console.error = function (obj, ...placeholders)
    {
        let data: any[];
        origerror.apply(this, data = consoleFuncExtending(obj, ...placeholders));
        fs.writeFileSync(process.env.LOG_FILENAME ?? 'log.txt', data.toString() + '\n', { flag: 'a+', encoding: "utf8" });
    };
}

// главная функция
async function main()
{
    // добавление временных меток в лог
    addTimestampsToConsoleLogs();

    // -- инициализация приложения -- //
    process.title = `webrtc-server-${process.env.npm_package_version}`;
    console.log(`Version: ${process.env.npm_package_version}`);

    // создание класса-обработчика mediasoup
    const mediasoup = await Mediasoup.create(1);

    // комнаты
    let rooms = new Map<RoomId, Room>();

    const Express = new ExpressApp(rooms);

    const httpServer: http.Server = http.createServer(Express.app);
    const httpPort = process.env.HTTP_PORT;

    httpServer.listen(httpPort, () =>
    {
        console.log(`Http server running on port: ${httpPort}`);
    });

    // настройки https-сервера (сертификаты)
    const httpsOptions: https.ServerOptions = {
        key: fs.readFileSync(path.join(__dirname, '../ssl', process.env.SSL_PRIVATE_KEY!), 'utf8'),
        cert: fs.readFileSync(path.join(__dirname, '../ssl', process.env.SSL_PUBLIC_CERT!), 'utf8')
    };

    const server: https.Server = https.createServer(httpsOptions, Express.app);
    const port = process.env.HTTPS_PORT;

    server.listen(port, () =>
    {
        console.log(`Https server running on port: ${port}`);
    });

    const socketHandlerInstance = new SocketHandler(
        server,
        Express.sessionMiddleware,
        mediasoup, rooms, 0
    );

    // создаем тестовую комнату
    await initTestRoom(mediasoup, socketHandlerInstance, rooms);

    // для ввода в консоль сервера
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', (input_str) =>
    {
        console.log(input_str);
    });
    rl.on('SIGINT', () =>
    {
        process.exit();
    });
}

// вызов главной функции
main();
