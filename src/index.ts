import path = require('path');
import fs = require('fs');
import http = require('http');
import https = require('https');
import dotenv = require('dotenv');
import os = require('os');

// Express
import { WebService } from './WebService';
import { FileService } from "./FileService/FileService";

// сокеты
import { SocketManager } from './SocketService/SocketManager';

// mediasoup
import { MediasoupService } from './MediasoupService';

// логи
import { prepareLogs } from "./Logger";

// для ввода в консоль
import readline = require('readline');
import { PlainRoomRepository } from "./Room/RoomRepository";
import { UserBanRepository } from "./User/UserBanRepository";
import { UserAccountRepository } from "./User/UserAccountRepository";
import { AuthRoomUserRepository } from "./User/AuthRoomUserRepository";
import { PlainFileRepository } from "./FileService/FileRepository";
import { TokenService } from "./TokenService";

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'config', 'server.default.conf');
const CUSTOM_CONFIG_PATH = path.resolve(process.cwd(), 'config', 'server.conf');

// загрузка значений из конфигурационного файла
function prepareConfig(): boolean
{
    let config_path = CUSTOM_CONFIG_PATH;

    if (!fs.existsSync(config_path) && fs.existsSync(DEFAULT_CONFIG_PATH))
    {
        config_path = DEFAULT_CONFIG_PATH;
    }
    else if (!fs.existsSync(config_path) && !fs.existsSync(DEFAULT_CONFIG_PATH))
    {
        return false;
    }

    dotenv.config({ path: config_path });
    return true;
}

/** Инициализация приложения.
 * @throws Error, если отсутствует конфигурационный файл.
 */
function initApplication()
{
    // загрузка значений из конфигурационного файла
    // выполняем первым делом, так как в конфиге написано название файла для лога
    const configLoadSuccess = prepareConfig();

    // добавление временных меток в лог и сохранения лога в файл
    prepareLogs();

    // считываем название и версию программы
    // именно таким способом, чтобы не были нужны переменные окружения npm
    const packageJson: unknown = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    const { name, version } = packageJson as { name: string; version: string; };

    // выводим шапку
    process.title = `${name}-${version}`;
    console.log(`Nostromo Server v${version}.`);

    // если конфиг не удалось загрузить
    if (!configLoadSuccess)
    {
        throw new Error(`Отсутствует конфигурационный файл: ${DEFAULT_CONFIG_PATH}.`);
    }
}

// главная функция
async function main()
{
    try
    {
        // Инициализируем приложение.
        initApplication();

        // Количество логических ядер (потоков) процессора.
        const numWorkers = os.cpus().length;

        // Сервис для работы с медиапотоками.
        const mediasoupService = await MediasoupService.create(numWorkers);

        // Репозиторий аккаунтов пользователей.
        const userAccountRepository = new UserAccountRepository();

        // Репозиторий файлов.
        const fileRepository = new PlainFileRepository();

        // Репозиторий комнат.
        const roomRepository = new PlainRoomRepository(
            mediasoupService,
            userAccountRepository,
            fileRepository
        );
        await roomRepository.init();

        // Репозиторий для записей авторизации пользователей в комнатах.
        const authRoomUserRepository = new AuthRoomUserRepository();

        // Сервис для загрузки и скачивания файлов.
        const fileService = new FileService(
            fileRepository,
            authRoomUserRepository,
            roomRepository
        );

        // Репозиторий блокировок пользователей.
        const userBanRepository = new UserBanRepository();

        // Сервис для работы с токенами.
        const tokenService = new TokenService();

        // Express веб-сервис.
        const express = new WebService(
            fileService,
            tokenService,
            roomRepository,
            userAccountRepository,
            userBanRepository,
            authRoomUserRepository
        );

        const httpServer: http.Server = http.createServer(express.app);
        const httpPort = process.env.HTTP_PORT;

        httpServer.listen(httpPort, () =>
        {
            console.log(`[WebService] Http server running on port: ${httpPort!}.`);
        });

        // настройки https-сервера (сертификаты)
        const httpsOptions: https.ServerOptions = {
            key: fs.readFileSync(path.resolve(process.cwd(), 'config', 'ssl', process.env.SSL_PRIVATE_KEY!), 'utf8'),
            cert: fs.readFileSync(path.resolve(process.cwd(), 'config', 'ssl', process.env.SSL_PUBLIC_CERT!), 'utf8')
        };

        const httpsServer: https.Server = https.createServer(httpsOptions, express.app);
        const port = process.env.HTTPS_PORT;

        httpsServer.listen(port, () =>
        {
            console.log(`[WebService] Https server running on port: ${port!}.`);
        });

        const socketManager = new SocketManager(
            httpsServer,
            fileRepository,
            mediasoupService,
            roomRepository,
            userAccountRepository,
            userBanRepository,
            authRoomUserRepository,
            tokenService.tokenSocketMiddleware
        );
    }
    catch (err)
    {
        const e = err as Error;
        if (e.stack)
        {
            console.error(`[ERROR] ${e.stack}.`);
        }
        else
        {
            console.error(`[ERROR] ${e.name}: ${e.message}.`);
        }
    }

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
main().catch((reason) => console.error(reason));