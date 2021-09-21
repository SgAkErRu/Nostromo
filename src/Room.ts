import { ConsumerAppData, Mediasoup, MediasoupTypes } from "./Mediasoup";
import { SocketHandler, SocketWrapper, SocketId, HandshakeSession } from "./SocketHandler";
import
{
    RoomId,
    NewUserInfo,
    NewConsumerInfo,
    JoinInfo,
    NewWebRtcTransportInfo,
    ConnectWebRtcTransportInfo,
    NewProducerInfo,
    VideoCodec,
    CloseConsumerInfo,
    ChatMsgInfo
} from "shared/types/RoomTypes";

export { RoomId };

// пользователь комнаты
export class User
{
    public userId: SocketId;
    public rtpCapabilities?: MediasoupTypes.RtpCapabilities;

    public transports = new Map<string, MediasoupTypes.WebRtcTransport>();
    public producers = new Map<string, MediasoupTypes.Producer>();
    public consumers = new Map<string, MediasoupTypes.Consumer>();

    constructor(_userId: SocketId)
    {
        this.userId = _userId;
    }
}

// комнаты
export class Room
{
    // номер комнаты
    private _id: RoomId;
    public get id(): RoomId { return this._id; }

    // название комнаты
    private _name: string;
    public get name(): string { return this._name; }

    // пароль комнаты
    private _password: string;
    public get password(): string { return this._password; }
    public set password(value: string) { this._password = value; }

    // mediasoup
    private mediasoup: Mediasoup;
    private mediasoupRouter: MediasoupTypes.Router;

    // SocketHandler
    private socketHandler: SocketHandler;

    // пользователи в комнате
    private _users = new Map<SocketId, User>();
    public get users() : Map<SocketId, User> { return this._users; }

    // максимальный битрейт (Кбит) для аудио в этой комнате
    // 1024 - kilo
    private maxAudioBitrate = 64 * 1024;

    public static async create(
        roomId: RoomId,
        name: string, password: string, videoCodec: VideoCodec,
        mediasoup: Mediasoup,
        socketHandler: SocketHandler
    ) : Promise<Room>
    {
        // для каждой комнаты свой mediasoup router
        const router = await mediasoup.createRouter(videoCodec);

        return new Room(
            roomId,
            name, password,
            mediasoup, router, videoCodec,
            socketHandler
        );
    }

    private constructor(
        roomId: RoomId,
        name: string, password: string,
        mediasoup: Mediasoup, mediasoupRouter: MediasoupTypes.Router, videoCodec: VideoCodec,
        socketHandler: SocketHandler
    )
    {
        console.log(`[Room] creating a new Room [#${roomId}, ${name}, ${videoCodec}]`);

        this._id = roomId;
        this._name = name;
        this._password = password;

        this.mediasoup = mediasoup;
        this.mediasoupRouter = mediasoupRouter;

        this.socketHandler = socketHandler;
    }

    // получить RTP возможности (кодеки) роутера
    public get routerRtpCapabilities(): MediasoupTypes.RtpCapabilities
    {
        return this.mediasoupRouter.rtpCapabilities;
    }

    // рассчитываем новый максимальный видео битрейт
    private calculateAndEmitNewMaxVideoBitrate()
    {
        const MEGA = 1024 * 1024;

        // макс. аудиобитрейт в мегабитах
        const maxAudioBitrateMbs = this.maxAudioBitrate / MEGA;

        const networkIncomingCapability = this.mediasoup.networkIncomingCapability - (maxAudioBitrateMbs * this.mediasoup.audioProducersCount);
        const networkOutcomingCapability = this.mediasoup.networkOutcomingCapability - (maxAudioBitrateMbs * this.mediasoup.audioConsumersCount);

        const consumersCount: number = (this.mediasoup.videoConsumersCount != 0) ? this.mediasoup.videoConsumersCount : 1;
        const producersCount: number = this.mediasoup.videoProducersCount;

        if (producersCount > 0)
        {
            const maxVideoBitrate: number = Math.min(
                networkIncomingCapability / producersCount,
                networkOutcomingCapability / consumersCount
            ) * MEGA;

            if (maxVideoBitrate > 0)
                this.socketHandler.emitToAll('maxVideoBitrate', maxVideoBitrate);
        }
    }

    // пользователь заходит в комнату
    public join(socket: SocketWrapper): void
    {
        const session = socket.handshake.session;
        if (!session) throw `[Room] Error: session is missing (${socket.id})`;

        console.log(`[Room] [#${this._id}, ${this._name}]: ${socket.id} (${session.username ?? "Unknown"}) user connected`);
        this._users.set(socket.id, new User(socket.id));

        const user: User = this.users.get(socket.id)!;

        // сообщаем пользователю название комнаты
        socket.emit('roomName', this.name);

        // сообщаем пользователю макс. битрейт аудио в комнате
        socket.emit('maxAudioBitrate', this.maxAudioBitrate);

        // сообщаем пользователю RTP возможности (кодеки) сервера
        socket.emit('routerRtpCapabilities', this.routerRtpCapabilities);

        // создание транспортного канала на сервере (с последующей отдачей информации о канале клиенту)
        socket.on('createWebRtcTransport', async (consuming: boolean) =>
        {
            await this.joinEvCreateWebRtcTransport(user, socket, consuming);
        });

        // подключение к транспортному каналу со стороны сервера
        socket.on('connectWebRtcTransport', async (
            connectWebRtcTransportInfo: ConnectWebRtcTransportInfo
        ) =>
        {
            await this.joinEvConnectWebRtcTransport(user, connectWebRtcTransportInfo);
        });

        // пользователь заходит в комнату (т.е уже создал транспортные каналы)
        // и готов к получению потоков (готов к получению consumers)
        socket.once('join', async (joinInfo: JoinInfo) =>
        {
            await this.joinEvJoin(user, socket, session, joinInfo);
        });

        // клиент ставит consumer на паузу
        socket.on('pauseConsumer', async (consumerId: string) =>
        {
            const consumer = user.consumers.get(consumerId);

            if (!consumer)
                throw new Error(`[Room] consumer with id "${consumerId}" not found`);

            // запоминаем, что клиент поставил на паузу вручную
            (consumer.appData as ConsumerAppData).clientPaused = true;

            await this.pauseConsumer(consumer);
        });

        // клиент снимает consumer с паузы
        socket.on('resumeConsumer', async (consumerId: string) =>
        {
            const consumer = user.consumers.get(consumerId);

            if (!consumer)
                throw new Error(`[Room] consumer with id "${consumerId}" not found`);

            // клиент хотел снять с паузы consumer, поэтому выключаем флаг ручной паузы
            (consumer.appData as ConsumerAppData).clientPaused = false;

            await this.resumeConsumer(consumer);
        });
        // создание нового producer
        socket.on('newProducer', async (newProducerInfo: NewProducerInfo) =>
        {
            await this.createProducer(user, socket, newProducerInfo);
        });

        // клиент закрывает producer
        socket.on('closeProducer', (producerId: string) =>
        {
            const producer = user.producers.get(producerId);

            if (!producer)
                throw new Error(`[Room] producer with id "${producerId}" not found`);

            producer.close();

            this.closeProducer(user, producer);
        });

        // клиент ставит producer на паузу (например, временно выключает микрофон)
        socket.on('pauseProducer', async (producerId: string) =>
        {
            const producer = user.producers.get(producerId);

            if (!producer)
                throw new Error(`[Room] producer with id "${producerId}" not found`);

            await this.pauseProducer(producer);
        });

        // клиент снимает producer с паузы (например, включает микрофон обратно)
        socket.on('resumeProducer', async (producerId: string) =>
        {
            const producer = user.producers.get(producerId);

            if (!producer)
                throw new Error(`[Room] producer with id "${producerId}" not found`);

            await this.resumeProducer(producer);
        });

        // перезапуск ICE слоя (генерирование новых локальных ICE параметров и отдача их клиенту)
        socket.on('restartIce', async (transportId) =>
        {
            await this.joinEvRestartIce(user, socket, transportId);
        });

        // новый ник пользователя
        socket.on('newUsername', (username: string) =>
        {
            this.joinEvNewUsername(socket, session, username);
        });

        socket.on('chatMsg', (msg: string) =>
        {
            const chatMsgInfo: ChatMsgInfo = {
                name: socket.handshake.session!.username!,
                msg: msg.trim()
            };
            socket.to(this.id).emit('chatMsg', chatMsgInfo);
        });

        // пользователь отсоединился
        socket.on('disconnect', (reason: string) =>
        {
            this.joinEvDisconnect(socket, session, reason);
        });
    }

    private async pauseConsumer(consumer: MediasoupTypes.Consumer, socket?: SocketWrapper)
    {
        // если уже не на паузе
        if (!consumer.paused)
        {
            await consumer.pause();

            // поскольку consumer поставлен на паузу,
            // то уменьшаем счетчик и перерасчитываем битрейт
            this.mediasoup.decreaseConsumersCount(consumer.kind);
            this.calculateAndEmitNewMaxVideoBitrate();
        }
        // Сообщаем клиенту, чтобы он тоже поставил на паузу, если только это не он попросил.
        // То есть сообщаем клиенту, что сервер поставил или хотел поставить на паузу. Хотел в том случае,
        // если до этого клиент уже поставил на паузу, а после соответствующий producer был поставлен на паузу.
        // Это необходимо, чтобы клиент знал при попытке снять с паузы, что сервер НЕ ГОТОВ снимать с паузы consumer.
        if (socket) socket.emit('pauseConsumer', consumer.id);
    }

    private async resumeConsumer(consumer: MediasoupTypes.Consumer, socket?: SocketWrapper)
    {
        // проверяем чтобы:
        // 1) consumer был на паузе,
        // 2) соответствующий producer был не на паузе
        // 3) клиент ГОТОВ к снятию паузы у этого consumer
        if (consumer.paused
            && !consumer.producerPaused
            && !(consumer.appData as ConsumerAppData).clientPaused)
        {
            await consumer.resume();

            // поскольку consumer снят с паузы,
            // то увеличиваем счетчик и перерасчитываем битрейт
            this.mediasoup.increaseConsumersCount(consumer.kind);
            this.calculateAndEmitNewMaxVideoBitrate();
        }
        // Сообщаем клиенту, чтобы он тоже снял с паузы, если только это не он попросил.
        // То есть сообщаем клиенту, что сервер снял или хотел снять паузу.
        // Это необходимо, чтобы клиент знал при попытке снять с паузы, что сервер ГОТОВ снимать с паузы consumer.
        if (socket) socket.emit('resumeConsumer', consumer.id);
    }

    // обработка события 'createWebRtcTransport' в методе join
    private async joinEvCreateWebRtcTransport(
        user: User,
        socket: SocketWrapper,
        consuming: boolean
    )
    {
        try
        {
            const transport = await this.mediasoup.createWebRtcTransport(
                user,
                consuming,
                this.mediasoupRouter
            );

            transport.on('routerclose', () =>
            {
                user.transports.delete(transport.id);

                socket.emit('closeTransport', transport.id);
            });

            const info: NewWebRtcTransportInfo = {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates as NewWebRtcTransportInfo['iceCandidates'],
                dtlsParameters: transport.dtlsParameters
            };

            socket.emit(consuming ? 'createRecvTransport' : 'createSendTransport', info);
        }
        catch (error)
        {
            console.error(`[Room] createWebRtcTransport for User ${user.userId} error: `, (error as Error).message);
        }
    }

    // обработка события 'connectWebRtcTransport' в методе join
    private async joinEvConnectWebRtcTransport(
        user: User,
        connectWebRtcTransportInfo: ConnectWebRtcTransportInfo
    )
    {
        const { transportId, dtlsParameters } = connectWebRtcTransportInfo;

        if (!user.transports.has(transportId))
            throw new Error(`[Room] transport with id "${transportId}" not found`);

        const transport = user.transports.get(transportId)!;
        await transport.connect({ dtlsParameters });
    }

    // обработка события 'join' в методе join
    private async joinEvJoin(
        user: User,
        socket: SocketWrapper,
        session: HandshakeSession,
        joinInfo: JoinInfo
    )
    {
        const { name, rtpCapabilities } = joinInfo;

        // запоминаем имя в сессии
        session.username = name;
        user.rtpCapabilities = rtpCapabilities;

        // перебираем всех пользователей, кроме нового
        for (const anotherUser of this.users)
        {
            if (anotherUser[0] != socket.id)
            {
                for (const producer of anotherUser[1].producers.values())
                {
                    await this.createConsumer(user, anotherUser[0], producer, socket);
                }

                const anotherUserInfo: NewUserInfo = {
                    id: anotherUser[0],
                    name: this.socketHandler
                        .getSocketById(anotherUser[0])
                        .handshake.session!.username!
                };

                // сообщаем новому пользователю о пользователе anotherUser
                socket.emit('newUser', anotherUserInfo);

                const thisUserInfo: NewUserInfo = {
                    id: socket.id,
                    name: name
                };

                // сообщаем пользователю anotherUser о новом пользователе
                this.socketHandler.emitTo(anotherUser[0], 'newUser', thisUserInfo);
            }
        }
    }

    // создание потребителя для пользователя user
    // из изготовителя пользователя producerUserId
    private async createConsumer(
        user: User,
        producerUserId: SocketId,
        producer: MediasoupTypes.Producer,
        socket: SocketWrapper
    )
    {
        try
        {
            // создаем потребителя на сервере в режиме паузы
            // (транспорт на сервере уже должен быть создан у этого клиента)
            const consumer = await this.mediasoup.createConsumer(
                user,
                producer,
                this.mediasoupRouter
            );

            user.consumers.set(consumer.id, consumer);

            // так как изначально consumer создается на паузе
            // не будем пока увеличивать счетчик consumersCount в классе mediasoup

            // обрабатываем события у Consumer
            this.handleConsumerEvents(consumer, user, producerUserId, socket);

            // сообщаем клиенту всю информацию об этом потребителе
            const newConsumer: NewConsumerInfo = {
                producerUserId,
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters
            };

            socket.emit('newConsumer', newConsumer);
        }
        catch (error)
        {
            console.error(`[Room] createConsumer error for User ${user.userId} | `, (error as Error).message);
        }
    }

    // обработка событий у потребителя Consumer
    private handleConsumerEvents(
        consumer: MediasoupTypes.Consumer,
        user: User,
        producerUserId: SocketId,
        socket: SocketWrapper
    ): void
    {
        const closeConsumer = () =>
        {
            user.consumers.delete(consumer.id);

            // если он и так был на паузе, то не учитывать его удаление
            // в расчете битрейта
            if (!consumer.paused)
            {
                this.mediasoup.decreaseConsumersCount(consumer.kind);
                this.calculateAndEmitNewMaxVideoBitrate();
            }

            const closeConsumerInfo: CloseConsumerInfo = {
                consumerId: consumer.id,
                producerUserId
            };

            socket.emit('closeConsumer', closeConsumerInfo);
        };

        consumer.on('transportclose', closeConsumer);
        consumer.on('producerclose', closeConsumer);
        consumer.on('producerpause', async () => { await this.pauseConsumer(consumer, socket); });
        consumer.on('producerresume', async () => { await this.resumeConsumer(consumer, socket); });
    }

    private async createProducer(
        user: User,
        socket: SocketWrapper,
        newProducerInfo: NewProducerInfo
    )
    {
        try
        {
            const producer = await this.mediasoup.createProducer(user, newProducerInfo);

            user.producers.set(producer.id, producer);

            this.mediasoup.increaseProducersCount(producer.kind);
            this.calculateAndEmitNewMaxVideoBitrate();

            producer.on('transportclose', () =>
            {
                this.closeProducer(user, producer);
                socket.emit('closeProducer', producer.id);
            });

            // перебираем всех пользователей, кроме текущего
            // и создадим для них consumer
            for (const anotherUser of this.users)
            {
                if (anotherUser[0] != socket.id)
                {
                    await this.createConsumer(
                        anotherUser[1],
                        socket.id,
                        producer,
                        this.socketHandler.getSocketById(anotherUser[0])
                    );
                }
            }

            socket.emit('newProducer', producer.id);
        }
        catch (error)
        {
            console.error(`[Room] createProducer error for User ${user.userId} | `, (error as Error).message);
        }
    }

    private closeProducer(user: User, producer: MediasoupTypes.Producer)
    {
        user.producers.delete(producer.id);

        if (!producer.paused)
        {
            this.mediasoup.decreaseProducersCount(producer.kind);
            this.calculateAndEmitNewMaxVideoBitrate();
        }
    }

    private async pauseProducer(producer: MediasoupTypes.Producer)
    {
        if (!producer.paused)
        {
            await producer.pause();

            this.mediasoup.decreaseProducersCount(producer.kind);
            this.calculateAndEmitNewMaxVideoBitrate();
        }
    }

    private async resumeProducer(producer: MediasoupTypes.Producer)
    {
        if (producer.paused)
        {
            await producer.resume();

            this.mediasoup.increaseProducersCount(producer.kind);
            this.calculateAndEmitNewMaxVideoBitrate();
        }
    }

    // обработка события 'disconnect' в методе join
    private joinEvDisconnect(
        socket: SocketWrapper,
        session: HandshakeSession,
        reason: string
    )
    {
        session.joined = false;
        session.save();

        this.leave(socket, reason);

        this.socketHandler.emitTo(this.id, 'userDisconnected', socket.id);
    }

    // обработка события 'newUsername' в методе join
    private joinEvNewUsername(
        socket: SocketWrapper,
        session: HandshakeSession,
        username: string
    )
    {
        session.username = username;

        const userInfo: NewUserInfo = {
            id: socket.id,
            name: username
        };

        socket.to(this.id).emit('newUsername', userInfo);
    }

    // обработка события 'restartIce' в методе join
    private async joinEvRestartIce(
        user: User,
        socket: SocketWrapper,
        transportId: string
    )
    {
        if (!user.transports.has(transportId))
            throw new Error(`[Room] transport with id "${transportId}" not found`);

        const transport = user.transports.get(transportId)!;
        const iceParameters = await transport.restartIce();
        socket.emit('restartIce', iceParameters);
    }

    // пользователь покидает комнату
    public leave(userSocket: SocketWrapper, reason: string): void
    {
        const username = userSocket.handshake.session?.username ?? "Unknown";
        if (this._users.has(userSocket.id))
        {
            console.log(`[Room] [#${this._id}, ${this._name}]: ${userSocket.id} (${username}) user disconnected > ${reason}`);

            const transports = this._users.get(userSocket.id)!.transports;
            for (const transport of transports.values())
            {
                transport.close();
            }

            this._users.delete(userSocket.id);
        }
    }

    // комната закрывается
    public close(): void
    {
        console.log(`[Room] closing Room [${this._id}]`);
        this.mediasoupRouter.close();
    }
}