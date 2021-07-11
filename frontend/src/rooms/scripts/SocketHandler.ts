import UI from "./UI.js";
import UserMedia from './UserMedia.js';
import PeerConnection from "./PeerConnection.js";
import { io, Socket } from "socket.io-client";
import { Mediasoup, MediasoupTypes } from "./Mediasoup.js";
import { SocketId, NewUserInfo, AfterConnectInfo, NewConsumerInfo } from "shared/RoomTypes";

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

        this.socket.on('routerRtpCapabilities', async (routerRtpCapabilities: MediasoupTypes.RtpCapabilities) =>
        {
            const rtpCapabilities = await this.mediasoup.loadDevice(routerRtpCapabilities);

            // сообщаем имя и rtpCapabilities
            const info: AfterConnectInfo = {
                name: this.ui.usernameInputValue,
                rtpCapabilities: rtpCapabilities
            };

            this.socket.emit('afterConnect', info);
        });

        this.socket.on('connect_error', (err: Error) =>
        {
            console.log(err.message); // not authorized
        });

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

    // добавить медиапоток в подключение
    public addNewMediaStream(trackKind: string): void
    {

    }

    // обновить существующее медиа
    public updateMediaStream(trackKind: string): void
    {

    }
}