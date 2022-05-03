import https = require('https');

import SocketIO = require('socket.io');
import { ExtendedError } from 'socket.io/dist/namespace';

import { IRoomRepository } from "../Room/RoomRepository";
import { AdminSocketService } from "./AdminSocketService";
import { GeneralSocketService, IGeneralSocketService } from "./GeneralSocketService";
import { IRoomSocketService, RoomSocketService } from "./RoomSocketService";
import { IUserBanRepository } from "../User/UserBanRepository";
import { IUserAccountRepository } from "../User/UserAccountRepository";
import { IAuthRoomUserRepository } from "../User/AuthRoomUserRepository";
import { IMediasoupService } from "../MediasoupService";
import { IFileRepository } from "../FileService/FileRepository";
import { TokenSocketMiddleware } from "../TokenService";
import { IRoomChatRepository } from "../Room/RoomChatRepository";

export type SocketNextFunction = (err?: ExtendedError) => void;
type SocketMiddleware = (req: SocketIO.Socket, next: SocketNextFunction) => void;

/** Обработчик веб-сокетов. */
export class SocketManager
{
    /** SocketIO сервер. */
    private io: SocketIO.Server;
    private namespaces = new Map<string, SocketIO.Namespace>();
    private generalSocketService: IGeneralSocketService;
    private adminSocketService: AdminSocketService;
    private roomSocketService: IRoomSocketService;
    private userBanRepository: IUserBanRepository;

    /** Создать SocketIO сервер. */
    private createSocketServer(server: https.Server): SocketIO.Server
    {
        return new SocketIO.Server(server, {
            transports: ['websocket'],
            pingInterval: 5000,
            pingTimeout: 15000,
            serveClient: false
        });
    }

    private applyCheckBanMiddleware: SocketMiddleware = (socket, next) =>
    {
        const address = socket.handshake.address;
        if (!this.userBanRepository.has(address.substring(7)))
        {
            next();
        }
        else
        {
            next(new Error("banned"));
        }
    }

    constructor(
        server: https.Server,
        tokenMiddleware: TokenSocketMiddleware,
        fileRepository: IFileRepository,
        mediasoupService: IMediasoupService,
        roomRepository: IRoomRepository,
        userAccountRepository: IUserAccountRepository,
        userBanRepository: IUserBanRepository,
        authRoomUserRepository: IAuthRoomUserRepository,
        roomChatRepository: IRoomChatRepository
    )
    {
        this.io = this.createSocketServer(server);
        this.userBanRepository = userBanRepository;

        this.namespaces.set("general", this.io.of("/"));
        this.namespaces.set("room", this.io.of("/room"));
        this.namespaces.set("admin", this.io.of("/admin"));

        for (const mapValue of this.namespaces)
        {
            const ns = mapValue[1];
            ns.use(this.applyCheckBanMiddleware);
        }

        // главная страница (общие события)
        this.generalSocketService = new GeneralSocketService(
            this.namespaces.get("general")!,
            roomRepository
        );

        // события комнаты
        this.roomSocketService = new RoomSocketService(
            this.namespaces.get("room")!,
            this.generalSocketService,
            tokenMiddleware,
            fileRepository,
            mediasoupService,
            roomRepository,
            userAccountRepository,
            userBanRepository,
            authRoomUserRepository,
            roomChatRepository
        );

        // события администратора
        this.adminSocketService = new AdminSocketService(
            this.namespaces.get("admin")!,
            tokenMiddleware,
            this.generalSocketService,
            this.roomSocketService,
            roomRepository,
            userBanRepository,
            authRoomUserRepository,
            userAccountRepository,
            roomChatRepository,
            fileRepository
        );
    }
}