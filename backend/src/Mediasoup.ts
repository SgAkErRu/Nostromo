import mediasoup = require('mediasoup');
import { NewProducerInfo, VideoCodec } from 'shared/RoomTypes';
import { User } from './Room';
import MediasoupTypes = mediasoup.types;

export { MediasoupTypes };

export class Mediasoup
{
    // массив workers, задел под многопоточность
    private mediasoupWorkers = new Array<MediasoupTypes.Worker>();

    // сетевые возможности сервера (в мегабитах Mbit)
    // для расчета максимального битрейта видеопотока клиента
    public readonly networkIncomingCapability: number = Number(process.env.NETWORK_INCOMING_CAPABILITY) ?? 100;
    public readonly networkOutcomingCapability: number = Number(process.env.NETWORK_OUTCOMING_CAPABILITY) ?? 100;

    // количество потребителей на сервере
    private _videoConsumersCount: number = 0;
    public get videoConsumersCount(): number { return this._videoConsumersCount; }

    private _audioConsumersCount: number = 0;
    public get audioConsumersCount(): number { return this._audioConsumersCount; }

    // количество производителей на сервере
    private _videoProducersCount: number = 0;
    public get videoProducersCount(): number { return this._videoProducersCount; }

    private _audioProducersCount: number = 0;
    public get audioProducersCount(): number { return this._audioProducersCount; }

    // аудио кодек
    private audioCodecConf: MediasoupTypes.RtpCodecCapability = {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
    };
    // VP9
    private videoCodecVp9Conf: MediasoupTypes.RtpCodecCapability = {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters:
        {
            'x-google-start-bitrate': 1000
        }
    };
    // VP8
    private videoCodecVp8Conf: MediasoupTypes.RtpCodecCapability = {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters:
        {
            'x-google-start-bitrate': 1000
        }
    };
    // H264
    private videoCodecH264Conf: MediasoupTypes.RtpCodecCapability = {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters:
        {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000
        }
    };

    // создаем экземпляр класса (внутри которого создаются Workers)
    public static async create(numWorkers: number): Promise<Mediasoup>
    {
        console.log(`[Mediasoup] running ${numWorkers} mediasoup Workers...`);

        let workers = new Array<MediasoupTypes.Worker>();

        for (let i: number = 0; i < numWorkers; ++i)
        {
            const worker: MediasoupTypes.Worker = await mediasoup.createWorker(
                {
                    logLevel: 'debug',
                    rtcMinPort: 40000,
                    rtcMaxPort: 50000
                });

            worker.on('died', (error) =>
            {
                console.error(
                    `[Mediasoup] mediasoup Worker died, exiting in 3 seconds... [pid: ${worker.pid}]`, (error as Error).message
                );

                setTimeout(() => process.exit(1), 3000);
            });

            workers.push(worker);
        }

        return new Mediasoup(workers);
    }

    private constructor(workers: Array<MediasoupTypes.Worker>)
    {
        this.mediasoupWorkers = workers;
    }

    private getWorker(): MediasoupTypes.Worker
    {
        // пока временно возвращаем первый Worker из массива
        const worker: MediasoupTypes.Worker = this.mediasoupWorkers[0];
        return worker;
    }

    // создать Router
    public async createRouter(codecChoice: VideoCodec): Promise<MediasoupTypes.Router>
    {
        // сначала звуковой кодек opus
        let mediaCodecs = new Array<MediasoupTypes.RtpCodecCapability>(this.audioCodecConf);

        // теперь определяемся с кодеками для видео
        if (codecChoice == VideoCodec.VP9) mediaCodecs.push(this.videoCodecVp9Conf);
        else if (codecChoice == VideoCodec.VP8) mediaCodecs.push(this.videoCodecVp8Conf);
        else if (codecChoice == VideoCodec.H264) mediaCodecs.push(this.videoCodecH264Conf);

        const routerOptions: MediasoupTypes.RouterOptions = { mediaCodecs };

        const router = await this.getWorker().createRouter(routerOptions);

        return router;
    }

    // создать транспортный канал для user
    // если consuming = true,   то канал для приема потоков
    // если consuming = false,  то канал для отдачи потоков
    public async createWebRtcTransport(
        user: User,
        consuming: boolean,
        router: MediasoupTypes.Router
    ): Promise<MediasoupTypes.WebRtcTransport>
    {
        const transport = await router.createWebRtcTransport({
            listenIps: [
                { ip: process.env.MEDIASOUP_LOCAL_IP! },
                { ip: process.env.MEDIASOUP_LOCAL_IP!, announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP! }
            ],
            initialAvailableOutgoingBitrate: 600000,
            enableUdp: true,
            appData: { consuming }
        });

        transport.on('icestatechange', (state: MediasoupTypes.IceState) =>
        {
            console.log(`[Mediasoup] User: ${user.userId} > WebRtcTransport > icestatechange event: ${transport.iceSelectedTuple?.remoteIp} ${state}`);
        });

        transport.on('dtlsstatechange', (dtlsstate: MediasoupTypes.DtlsState) =>
        {
            if (dtlsstate === 'failed' || dtlsstate === 'closed')
                console.error(`[Mediasoup] User: ${user.userId} > WebRtcTransport > dtlsstatechange event: ${transport.iceSelectedTuple?.remoteIp} ${dtlsstate}`);
        });

        user.transports.set(transport.id, transport);

        return transport;
    }

    // создаем производителя (producer) для user
    public async createProducer(
        user: User,
        newProducerInfo: NewProducerInfo
    ): Promise<MediasoupTypes.Producer>
    {
        const { transportId, kind, rtpParameters } = newProducerInfo;

        if (!user.transports.has(transportId))
            throw new Error(`[Mediasoup] transport with id "${transportId}" not found`);

        const transport = user.transports.get(transportId)!;

        const producer = await transport.produce({ kind, rtpParameters });

        return producer;
    }

    // создаем потребителя (consumer) для user
    public async createConsumer(
        user: User,
        producer: MediasoupTypes.Producer,
        router: MediasoupTypes.Router
    ): Promise<MediasoupTypes.Consumer>
    {
        // не создаем consumer, если пользователь не может потреблять медиапоток
        if (!user.rtpCapabilities ||
            !router.canConsume(
                {
                    producerId: producer.id,
                    rtpCapabilities: user.rtpCapabilities
                })
        )
        {
            throw new Error(`[Mediasoup] User can't consume`);
        };

        // берем Transport пользователя, предназначенный для потребления
        const transport = Array.from(user.transports.values())
            .find((tr) => tr.appData.consuming);

        if (!transport)
        {
            throw new Error(`[Mediasoup] Transport for consuming not found`);
        }

        // создаем Consumer в режиме паузы
        let consumer: MediasoupTypes.Consumer;

        try
        {
            consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities: user.rtpCapabilities,
                paused: true
            });
        }
        catch (error)
        {
            throw new Error(`[Mediasoup] transport.consume() error: ${error}`);
        }

        return consumer;
    }

    public increaseConsumersCount(kind: MediasoupTypes.MediaKind)
    {
        if (kind == 'video')
            ++this._videoConsumersCount;
        else
            ++this._audioConsumersCount;
    }
    public decreaseConsumersCount(kind: MediasoupTypes.MediaKind)
    {
        if (kind == 'video')
            --this._videoConsumersCount;
        else
            --this._audioConsumersCount;
    }

    public increaseProducersCount(kind: MediasoupTypes.MediaKind)
    {
        if (kind == 'video')
            ++this._videoProducersCount;
        else
            ++this._audioProducersCount;
    }
    public decreaseProducersCount(kind: MediasoupTypes.MediaKind)
    {
        if (kind == 'video')
            --this._videoProducersCount;
        else
            --this._audioProducersCount;
    }
}