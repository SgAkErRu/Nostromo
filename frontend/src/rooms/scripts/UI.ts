// Класс для работы с интерфейсом (веб-страница)
export default class UI {
    constructor() {
        // поля
        /** @type {Map<string, HTMLElement | HTMLButtonElement>} */
        this.buttons = new Map(); // кнопки
        this.roomName = document.getElementById('roomName');
        /** @type {HTMLElement | HTMLVideoElement} */
        this.localVideo; // локальное видео
        this.localVideoLabel;
        /** @type {Map<string, HTMLElement | HTMLVideoElement>} */
        this.allVideos = new Map();
        // количество строк и столбцов в раскладке
        this.videoRows = 2;
        this.videoColumns = 2;
        /// чат
        /** @type {HTMLElement | HTMLTextAreaElement} */
        this.chat = document.getElementById('chat');
        /** @type {HTMLElement | HTMLInputElement} */
        this.messageText = document.getElementById('messageText'); // сообщение пользователя, отправляемое собеседнику
        /// файлы
        this.fileInput = document.getElementById('fileInput');
        /** @type {HTMLElement | HTMLAnchorElement} */
        this.downloadAnchor = document.getElementById('download');
        /** @type {HTMLElement | HTMLProgressElement} */
        this.receiveProgress = document.getElementById('receiveProgress');
        this.captureSettings = document.querySelector("#captureSettings");
        this.chatOptions = document.querySelector("#chatOptions");
        this.usernameInput = document.querySelector("#usernameInput");
        this.mutePolicy = true;
        // конструктор, т.е функции ниже вызываются при создания объекта UI
        console.debug("UI ctor");
        this.prepareButtons();
        this.prepareCloseButtonsForModalsWindows();
        this.prepareLocalVideo();
        this.prepare_messageText();
        this.resizeVideos();
        window.addEventListener('resize', () => this.resizeVideos());
        this.buttons.get('enableSounds').addEventListener('click', () => this.enableSounds());
        this.showUserName();

    }
    showModalWindow(modalWindowName) {
        document.getElementById(`modalWindow_${modalWindowName}`).style.display = "block"; // показываем модальное окно с инструкцией
    }
    prepareButtons() {
        this.buttons.set('getUserMediaMic', document.getElementById('btn_getUserMediaMic'));
        this.buttons.set('getUserMediaCam', document.getElementById('btn_getUserMediaCam'));
        this.buttons.set('getDisplayMedia', document.getElementById('btn_getDisplayMedia'));
        this.buttons.set('sendMessage', document.getElementById('btn_sendMessage'));
        this.buttons.set('sendFile', document.getElementById('btn_sendFile'));
        this.buttons.set('enableSounds', document.getElementById('btn_enableSounds'));
        this.buttons.set('setNewUsername', document.getElementById('btn_setNewUsername'));
    }
    prepare_messageText() {
        this.messageText.addEventListener('keydown', (e) => {
            if (e.key == 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.buttons.get('sendMessage').click();
                this.messageText.value = "";
            };
        });
    }

    setNewUsername() {
        localStorage["username"] = this.usernameInput.value;
        this.showUserName();
    }
    showUserName() {
        if (localStorage["username"] == undefined) localStorage["username"] = "noname";
        this.usernameInput.value = localStorage["username"];
        this.localVideoLabel.innerText = localStorage["username"];
    }
    prepareCloseButtonsForModalsWindows() {
        // -- для модального окна, обрабатываем закрытие окон на кнопку "X" -- //
        const btn_close_list = document.getElementsByClassName("close");
        for (let btn of btn_close_list) {
            btn.addEventListener('click', () => {
                btn.parentElement.parentElement.style.display = "none";
            });
        }
    }
    setRoomName(roomName) {
        this.roomName.innerText = roomName;
    }
    getCaptureSettings() {
        return this.captureSettings.value;
    }
    getChatOption() {
        return this.chatOptions.value;
    }
    enableSounds() {
        for (const video of this.allVideos.values()) {
            if (video != this.localVideo) {
                video.muted = false;
            }
        }
        this.mutePolicy = false;
    }
    addVideo(remoteVideoID, name) {
        let newVideoItem = document.createElement('div');
        newVideoItem.classList.add('videoItem');

        let newVideoContainer = document.createElement('div');
        newVideoContainer.classList.add('videoContainer');

        newVideoItem.appendChild(newVideoContainer);

        let newVideo = document.createElement('video');
        newVideo.id = `remoteVideo-${remoteVideoID}`;
        newVideo.autoplay = true;
        newVideo.muted = this.mutePolicy;
        newVideo.poster = "./images/novideodata.jpg";

        let label = document.createElement('span');
        label.classList.add('videoLabel');
        label.innerText = name;
        label.id = `remoteVideoLabel-${remoteVideoID}`;
        newVideoItem.appendChild(label);

        newVideoContainer.appendChild(newVideo);
        document.querySelector("#videos").appendChild(newVideoItem);
        this.allVideos.set(remoteVideoID, newVideo);
        // перестроим раскладку
        this.calculateLayout();
        this.resizeVideos();
    }

    updateVideoLabel(remoteVideoID, name) {
        document.querySelector(`#remoteVideoLabel-${remoteVideoID}`).innerText = name;
    }
    updateChatOption(remoteUserID, name) {
        let chatOption = document.querySelector(`option[value='${remoteUserID}']`);
        chatOption.innerText = `собеседник ${name}`;
    }

    addChatOption(remoteUserID, remoteUsername) {
        let newChatOption = document.createElement('option');
        newChatOption.value = remoteUserID;
        newChatOption.innerText = `собеседник ${remoteUsername}`;
        this.chatOptions.appendChild(newChatOption);
    }
    removeChatOption(remoteUserID) {
        let chatOption = document.querySelector(`option[value='${remoteUserID}']`);
        if (chatOption) {
            chatOption.remove();
        }
    }
    // удалить видео собеседника (и опцию для чата/файлов тоже)
    removeVideo(remoteVideoID) {
        if (this.allVideos.has(remoteVideoID)) {
            const video = this.allVideos.get(remoteVideoID);
            video.parentElement.parentElement.remove();
            this.allVideos.delete(remoteVideoID);
            this.removeChatOption(remoteVideoID);
            this.calculateLayout();
            this.resizeVideos();
        }
    }
    // подсчитать количество столбцов и строк в раскладке
    // в зависимости от количества собеседников
    calculateLayout() {
        const videoCount = this.allVideos.size;
        // если только 1 видео на экране
        if (videoCount == 1) {
            this.videoRows = 2;
            this.videoColumns = 2;
            // если количество собеседников превысило размеры сетки раскладки
        } else if (videoCount > this.videoColumns * this.videoRows) {
            // если количество столбцов не равно количеству строк, значит увеличиваем количество строк
            if (this.videoColumns != this.videoRows) ++this.videoRows;
            else ++this.videoColumns;
        } // пересчитываем сетку и после выхода пользователей
        else if (videoCount < this.videoColumns * this.videoRows) {
            if (this.videoColumns == this.videoRows && (videoCount <= this.videoColumns * (this.videoRows - 1))) --this.videoRows;
            else if (this.videoColumns != this.videoRows && (videoCount <= (this.videoColumns - 1) * this.videoRows)) --this.videoColumns;
        }
    }
    // перестроить раскладку
    resizeVideos() {
        const header_offset = 82.5;
        const nav_offset = 150;
        const offset = 30;
        const aspect_ratio = 16 / 9;
        // max_h для регулирования размеров видео, чтобы оно вмещалось в videoRows (количество) строк
        let max_h = ((document.documentElement.clientHeight - header_offset) / this.videoRows) - offset;
        let flexBasis = ((document.documentElement.clientWidth - nav_offset) / this.videoColumns) - offset;
        for (const videoItem of document.getElementsByClassName('videoItem')) {
            videoItem.style.maxWidth = max_h * aspect_ratio + "px";
            videoItem.style.flexBasis = flexBasis + "px";
        }
    }
    prepareLocalVideo() {
        let localVideoItem = document.createElement('div');
        localVideoItem.classList.add('videoItem');

        let localVideoContainer = document.createElement('div');
        localVideoContainer.classList.add('videoContainer');

        localVideoItem.appendChild(localVideoContainer);

        this.localVideo = document.createElement('video');
        this.localVideo.id = `localVideo`;
        this.localVideo.autoplay = true;
        this.localVideo.muted = true;
        this.localVideo.poster = "./img/novideodata.jpg";
        localVideoContainer.appendChild(this.localVideo);

        this.localVideoLabel = document.createElement('span');
        this.localVideoLabel.classList.add('videoLabel');
        localVideoItem.appendChild(this.localVideoLabel);

        document.querySelector("#videos").appendChild(localVideoItem);
        this.allVideos.set('0', this.localVideo);
    }
}