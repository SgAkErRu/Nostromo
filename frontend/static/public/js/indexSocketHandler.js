// Класс для работы с сокетами на главной странице
export default class indexSocketHandler {
    constructor() {
        // поля
        this.socket = io("/", {
            'transports': ['websocket']
        });

        // конструктор (тут работаем с сокетами)
        console.debug("indexSocketHandler ctor");
        this.socket.on('connect', () => {
            console.info("Создано подключение веб-сокета");
            console.info("Client ID:", this.socket.id);
        });

        this.socket.on('connect_error', (err) => {
            console.log(err.message);
        });

        this.socket.on('roomList', (rooms) => this.getRoomList(rooms));

        this.socket.on('disconnect', () => this.onDisconnect());
    }

    getRoomList(rooms) {
        const roomList = document.getElementById('roomList');
        for (const room of rooms) {
            let roomListItem = document.createElement('a');
            roomListItem.classList.add('roomListItem');
            roomListItem.href = `/rooms/${room['id']}`;
            roomListItem.innerText = room['name'];
            roomList.appendChild(roomListItem);
        }
    }

    onDisconnect()
    {
        console.warn("Вы были отсоединены от веб-сервера (websocket disconnect)");
        const roomList = document.querySelectorAll(".roomListItem");
        console.log(roomList);
        for (const room of roomList)
        {
            console.log(room);
            room.remove();
        }
    }
}