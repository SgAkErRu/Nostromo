import UI from "./UI.js";
import UserMedia from './UserMedia.js';
import PeerConnection from "./PeerConnection.js";
import { io, Socket } from "socket.io-client";
import
{
    Mediasoup,
    MediasoupTypes,
    TransportProduceParameters
} from "./Mediasoup.js";

import
{
    SocketId,
    NewUserInfo,
    AfterConnectInfo,
    NewConsumerInfo,
    NewWebRtcTransportInfo,
    ConnectWebRtcTransportInfo,
    NewProducerInfo
} from "shared/RoomTypes";

export type SocketSettings =
    {
        remoteUserId: string,
        remoteUsername: string,
        socket: Socket;
    };

// Класс для работы с сокетами
export default class SocketHandler
{
    private ui: UI;
    private socket: Socket = io('/room', {
        'transports': ['websocket']
    });

    private userMedia: UserMedia;
    private mediasoup: Mediasoup;

    constructor(ui: UI, mediasoup: Mediasoup)
    {
        console.debug("SocketHandler ctor");

        this.ui = ui;
        this.mediasoup = mediasoup;

        this.userMedia = new UserMedia(this.ui, this);

        this.ui.buttons.get('setNewUsername')!.addEventListener('click', () =>
        {
            this.ui.setNewUsername();
            this.socket.emit('newUsername', this.ui.usernameInputValue);
        });

        this.socket.on('connect', () =>
        {
            console.info("Создано веб-сокет подключение");
            console.info("Client Id:", this.socket.id);
        });

        // получаем RTP возможности сервера
        this.socket.on('routerRtpCapabilities', async (routerRtpCapabilities: MediasoupTypes.RtpCapabilities) =>
        {
            await this.routerRtpCapabilities(routerRtpCapabilities);
        });

        // создаем локально транспортный канал для приема потоков
        this.socket.on('createRecvTransport', (transport: NewWebRtcTransportInfo) =>
        {
            this.mediasoup.recvTransport = this.createRecvTransport(transport);

            // теперь, когда транспортный канал для приема потоков создан
            // войдем в комнату - т.е сообщим имя и rtpCapabilities
            const info: AfterConnectInfo = {
                name: this.ui.usernameInputValue,
                rtpCapabilities: this.mediasoup.device.rtpCapabilities
            };

            this.socket.emit('afterConnect', info);
        });

        // создаем локально транспортный канал для отдачи потоков
        this.socket.on('createSendTransport', (transport: NewWebRtcTransportInfo) =>
        {
            this.mediasoup.sendTransport = this.createSendTransport(transport);
        });

        this.socket.on('newConsumer', async (newConsumerInfo: NewConsumerInfo) =>
        {
            const { id, producerId, kind, rtpParameters } = newConsumerInfo;

            const consumer = await this.mediasoup.recvTransport!.consume({
                id,
                producerId,
                kind,
                rtpParameters
            });

            this.socket.emit('consumerReady', consumer.id);

            console.debug("TESTESTES", newConsumerInfo.id, consumer.id);

            const remoteVideo = this.ui.allVideos.get(newConsumerInfo.producerUserId);
            if (remoteVideo) remoteVideo.srcObject = new MediaStream([consumer.track]);
        });

        // ошибка при соединении нашего веб-сокета
        this.socket.on('connect_error', (err: Error) =>
        {
            console.log(err.message); // not authorized
        });

        // получаем название комнаты
        this.socket.on('roomName', (roomName: string) =>
        {
            this.ui.roomName = roomName;
        });

        // новый пользователь (т.е другой)
        this.socket.on('newUser', ({ id, name }: NewUserInfo) =>
        {
            this.ui.addVideo(id, name);
        });

        // другой пользователь поменял имя
        this.socket.on('newUsername', ({ id, name }: NewUserInfo) =>
        {
            this.ui.updateVideoLabel(id, name);
            this.ui.updateChatOption(id, name);
        });

        // другой пользователь отключился
        this.socket.on('userDisconnected', (remoteUserId: SocketId) =>
        {
            console.info("SocketHandler > remoteUser disconnected:", `[${remoteUserId}]`);
            this.ui.removeVideo(remoteUserId);
        });

        // наше веб-сокет соединение разорвано
        this.socket.on('disconnect', () =>
        {
            console.warn("Вы были отсоединены от веб-сервера (websocket disconnect)");
        });

        // обработка личных чатов
        this.ui.buttons.get('sendMessage')!.addEventListener('click', () =>
        {
            if (this.ui.currentChatOption != "default")
            {
                const receiverId = this.ui.currentChatOption;
            }
        });

        this.ui.buttons.get('sendFile')!.addEventListener('click', () =>
        {
            if (this.ui.currentChatOption != "default")
            {
                const receiverId = this.ui.currentChatOption;
            }
        });

        document.addEventListener('beforeunload', () =>
        {
            this.socket.close();
        });
    }

    private async routerRtpCapabilities(routerRtpCapabilities: MediasoupTypes.RtpCapabilities)
    {
        await this.mediasoup.loadDevice(routerRtpCapabilities);

        // запрашиваем создание транспортного канала на сервере для приема потоков
        let consuming: boolean = true;
        this.socket.emit('createWebRtcTransport', consuming);

        // и для отдачи наших потоков
        this.socket.emit('createWebRtcTransport', !consuming);
    }

    private handleCommonTransportEvents(localTransport: MediasoupTypes.Transport)
    {
        localTransport.on('connect', (
            { dtlsParameters }, callback, errback
        ) =>
        {
            console.debug('> TEST: ', dtlsParameters);
            try
            {
                const info: ConnectWebRtcTransportInfo = {
                    transportId: localTransport.id,
                    dtlsParameters
                };
                this.socket.emit('connectWebRtcTransport', info);

                // сообщаем транспорту, что параметры были переданы на сервер
                callback();
            }
            catch (error)
            {
                // сообщаем транспорту, что что-то пошло не так
                errback(error);
            }
        });

        localTransport.on('connectionstatechange', async (state) =>
        {
            console.debug("connectionstatechange: ", state);
        });
    }

    private createSendTransport(transport: NewWebRtcTransportInfo)
        : MediasoupTypes.Transport | undefined
    {
        console.debug('> createSendTransport | server transport: ', transport);
        try
        {
            const localTransport = this.mediasoup.device.createSendTransport({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
            console.debug('> createSendTransport | client transport: ', localTransport);

            this.handleCommonTransportEvents(localTransport);

            localTransport.on('produce', (
                parameters: TransportProduceParameters, callback, errback
            ) =>
            {
                try
                {
                    const info: NewProducerInfo = {
                        transportId: localTransport.id,
                        kind: parameters.kind,
                        rtpParameters: parameters.rtpParameters
                    };

                    this.socket.emit('newProducer', info);

                    // сообщаем транспорту, что параметры были переданы на сервер
                    // и передаем транспорту id серверного producer
                    this.socket.once('newProducer', (id: string) =>
                    {
                        console.log("TEST id Producer > | ", id);
                        callback({ id });
                    });
                }
                catch (error)
                {
                    // сообщаем транспорту, что что-то пошло не так
                    errback(error);
                }
            });

            return localTransport;
        }
        catch (error)
        {
            console.error('> createSendTransport | error', error);
        }
    }

    private createRecvTransport(transport: NewWebRtcTransportInfo)
        : MediasoupTypes.Transport | undefined
    {
        console.debug('> createRecvTransport | server transport: ', transport);
        try
        {
            const localTransport = this.mediasoup.device.createRecvTransport({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });

            console.debug('> createRecvTransport | client transport: ', localTransport);

            this.handleCommonTransportEvents(localTransport);

            return localTransport;
        }
        catch (error)
        {
            console.error('> createRecvTransport | error', error);
        }
    }

    // добавить медиапоток в подключение
    public async addNewMediaStream(trackKind: string): Promise<void>
    {
        const videoTrack = this.userMedia.stream.getVideoTracks()[0];
        const producer = await this.mediasoup.sendTransport!.produce({
            track: videoTrack,
            codecOptions:
            {
                videoGoogleStartBitrate: 1000
            }
        });
    }

    // обновить существующее медиа
    public updateMediaStream(trackKind: string): void
    {

    }
}