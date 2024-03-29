import path = require('path');
import fs = require('fs');
import http = require('http');
import https = require('https');
import dotenv = require('dotenv');
import os = require('os');
import proxyAddr = require("proxy-addr");

export type ProxyAddrTrust = (addr: string, i: number) => boolean;

// Express и прочие HTTP сервисы
import { WebService } from './WebService';
import { FileService } from "./FileService/FileService";
import { TokenService } from "./TokenService";

// Сокеты
import { SocketManager } from './SocketService/SocketManager';

// Mediasoup
import { MediasoupService } from './MediasoupService';

// Логи
import { prepareLogs } from "./Logger";

// для ввода в консоль
import readline = require('readline');

// Репозитории
import { PlainRoomRepository } from "./Room/RoomRepository";
import { PlainUserBanRepository } from "./User/UserBanRepository";
import { PlainUserAccountRepository } from "./User/UserAccountRepository";
import { PlainAuthRoomUserRepository } from "./User/AuthRoomUserRepository";
import { PlainFileRepository } from "./FileService/FileRepository";
import { PlainRoomChatRepository } from "./Room/RoomChatRepository";

const DEFAULT_CONFIG_PATH = path.resolve("config", "server.default.conf");
const CUSTOM_CONFIG_PATH = path.resolve("config", "server.conf");

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
    // Вместо дефолтного поведения, когда за cwd берется папка, откуда запущен процесс node
    // Берем за cwd родительскую папку для index.js (т.е папку выше по иерархии над dist, где находится package.json)
    process.chdir(path.dirname(__dirname));

    // загрузка значений из конфигурационного файла
    // выполняем первым делом, так как в конфиге написано название файла для лога
    const configLoadSuccess = prepareConfig();

    // добавление временных меток в лог и сохранения лога в файл
    prepareLogs();

    // считываем название и версию программы
    // именно таким способом, чтобы не были нужны переменные окружения npm
    const packageJson: unknown = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
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

function createAdminAllowlist(): Set<string>
{
    let allowlist = new Set<string>();

    const allowlistStr = process.env.ADMIN_ALLOWLIST;

    if (allowlistStr)
    {
        // Ищем точку с запятой, не обращая внимание на пробелы ДО и ПОСЛЕ точки с запятой.
        const re = /\s*;\s*/;

        allowlist = new Set(allowlistStr.split(re));
    }

    return allowlist;
}

function getProxyAddrTrustFunc(): ProxyAddrTrust | undefined
{
    const addr = process.env.TRUST_PROXY_ADDR ?? false;

    if (!addr || addr === "false")
    {
        return undefined;
    }

    console.log(`[Config] Trust proxy addresses: ${addr}.`);

    // Ищем точку с запятой, не обращая внимание на пробелы ДО и ПОСЛЕ точки с запятой.
    const re = /\s*;\s*/;
    const addresses = addr.split(re);

    return proxyAddr.compile(addresses);
}

// главная функция
async function main()
{
    try
    {
        // Инициализируем приложение.
        initApplication();

        const mediaserverMaxProcesses = process.env.MEDIASERVER_MAX_PROCESSES;

        // Количество процессов для медиасервера.
        let numWorkers = os.cpus().length;

        if (mediaserverMaxProcesses !== undefined && mediaserverMaxProcesses !== "auto"
            && (Number(mediaserverMaxProcesses) > 0 && Number(mediaserverMaxProcesses) <= os.cpus().length)
        )
        {
            numWorkers = Number(mediaserverMaxProcesses);
        }

        // Сервис для работы с медиапотоками.
        const mediasoupService = await MediasoupService.create(numWorkers);

        // Репозиторий аккаунтов пользователей.
        const userAccountRepository = new PlainUserAccountRepository();

        // Репозиторий файлов.
        const fileRepository = new PlainFileRepository();

        // Репозиторий для истории чатов комнат.
        const roomChatRepository = new PlainRoomChatRepository();

        // Репозиторий комнат.
        const roomRepository = new PlainRoomRepository(
            mediasoupService,
            userAccountRepository
        );
        await roomRepository.init();

        // Репозиторий для записей авторизации пользователей в комнатах.
        const authRoomUserRepository = new PlainAuthRoomUserRepository();

        // Сервис для загрузки и скачивания файлов.
        const fileService = new FileService(
            fileRepository,
            authRoomUserRepository,
            roomRepository
        );

        // Репозиторий блокировок пользователей.
        const userBanRepository = new PlainUserBanRepository();

        // Сервис для работы с токенами.
        const tokenService = new TokenService(userAccountRepository);

        // Список IP-адресов, которым разрешено заходить в админку / в форму авторизации в админку.
        const adminAllowlist = createAdminAllowlist();

        // Получить скомпилированную функцию проверки списка доверенных адресов (от прокси).
        const trustProxyAddrFunc = getProxyAddrTrustFunc();

        // Express веб-сервис.
        const express = new WebService(
            fileService,
            tokenService,
            roomRepository,
            userAccountRepository,
            userBanRepository,
            authRoomUserRepository,
            adminAllowlist,
            trustProxyAddrFunc
        );

        const httpServer: http.Server = http.createServer(express.app);
        const httpPort = process.env.HTTP_PORT;

        httpServer.listen(httpPort, () =>
        {
            console.log(`[WebService] Http server running on port: ${httpPort!}.`);
        });

        // настройки https-сервера (сертификаты)
        const httpsOptions: https.ServerOptions = {
            key: fs.readFileSync(path.resolve("config", "ssl", process.env.SSL_PRIVATE_KEY!), 'utf8'),
            cert: fs.readFileSync(path.resolve("config", "ssl", process.env.SSL_PUBLIC_CERT!), 'utf8')
        };

        const httpsServer: https.Server = https.createServer(httpsOptions, express.app);
        const port = process.env.HTTPS_PORT;

        httpsServer.listen(port, () =>
        {
            console.log(`[WebService] Https server running on port: ${port!}.`);
        });

        const socketManager = new SocketManager(
            httpsServer,
            tokenService.tokenSocketMiddleware,
            fileRepository,
            mediasoupService,
            roomRepository,
            userAccountRepository,
            userBanRepository,
            authRoomUserRepository,
            roomChatRepository,
            adminAllowlist,
            trustProxyAddrFunc
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