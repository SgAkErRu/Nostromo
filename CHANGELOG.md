### 0.3.2

* [9c095e0] Добавлена опция на клиенте для установки подключения ТОЛЬКО по TCP.
* [19b716d] Добавлен параметр срока жизни JWT-токена в конфиг.
* [7c36c5f] Добавлен параметр максимального битрейта для аудиодорожек в конфиг.
* [4b8da56] Добавлены параметры включения/выключения TCP/UDP для RTC в конфиг.
* [587fe72] Добавлена опция на клиенте для включения и выключения шумоподавления микрофона. Фикс передачи стереозвука.

### 0.3.1

* [bd210562] Фикс бага с 5 фпс в Chrome на VP9 (#7), а также бага с игнорированием настройки лимита фпс в Firefox (#42).
* [67276c33] Изменен размер максимального разумного битрейта для повышения стабильности и качества передаваемого видеоизображения.
* [f1fcf6aa] Администратор теперь может исключать всех участников из комнаты одной кнопкой.
* [df1d05b4] Реализованы новый режим конференции: режим докладчика (#38).
* [0bec4308] Реализован список пользователей в комнате (#33) и возможность опционально не отображать неактивные видеоэлементы пользователей (#36).
* [33c8b6d4] Исправлена локаль для дат в чате (теперь в формате дд/мм/гггг).

### 0.3.0

* [3cddb7b0] Теперь можно создавать комнаты, в которых **не будет** сохраняться история чата (`политика сохранения истории чата`). Также реализована новая функция для администратора: изменение политики сохранения истории чата.
* [5728ff5a] Изменено поведение при нажатии на ссылку на файлы. Для аудио, видео и фото реализован просмотр в отдельной вкладке без необходимости скачивания файла.
* [bdcf3b67] **Новые функции для администратора**: очистка истории чатов и удаление файлов, загруженных в комнате.
* [4a0addfb] Реализована **история чата** (#18).
* [cbfd637d] Информация об авторизованных пользователях в комнатах сохраняется в файл `auth-room-users.json`.
* [79b453d3] Аккаунты (информация о пользователях) сохраняется в файл `users.json`.
* [14ee0581] Переименован параметр в конфиге с `EXPRESS_SESSION_KEY` на `TOKEN_SECRET_KEY`.
* [2e2fc9ef] Теперь в механизме авторизации и аутентификации вместо серверных сессий используются `JWT` токены (#19).
* [a887a541] Информация о файлах сохраняется в файл `files.json`.
* [460922a6] Файлы с данными `bans.json` и `rooms.json` перенесены из `config` в `data`.
* [73ffdd00] Фикс самопроизвольного **увеличения шрифта** в чате на мобильном **Chrome**.
* [19826932] **Новые функции для администратора**: остановка демонстрации экрана пользователя, остановка захвата видеоустройств пользователя.
* [8b8f12ad] Реализованы возможности **одновременного захвата нескольких видеоустройств** (#41). А также возможность **одновременного захвата веб-камеры и экрана компьютера** (#21). Различные изменения в интерфейсе, связанных с этими возможностями. Добавлены опции при захвате экрана 720p@5, 1080p@5, 900p@30, 900p@60, 144p@30. Также было реализовано экспериментальное изменение параметра (videoGoogleMaxBitrate) для повышения стабильности битрейта.
* [fb0e7f16] Ограничение на длину ника в 32 символа (и синхронизация с nostromo-web). Добавлены подсказки при наведении на текстовые метки с ником у видео.
* [707fe62d] Теперь при загрузке файла на сервер, учитывается Id комнаты, где загружается файл.
* [e5aad9c0] Если комната без пароля, то для скачивания файла теперь не нужно быть авторизованным в комнате.
* Добавлена возможность **выбирать захватываемое устройство** в интерфейсе.
* [60d2f76b] Новый **дизайн чата** и новый вид **ссылок** на файлы в чате. Новый стиль **списка комнат** на главной страницы и добавлен Id комнаты на главной страницы. Новый шрифт `Rubik`. Уменьшена боковая панель с 140px до 60px.
* [b6842812] Обработка случая, когда пользователь уже находится в комнате, и в рамках одной сессии (одной учётной записи) совершается попытка зайти в комнату с другой ещё одной вкладки/устройства.
* [e39991c7] **Деавторизация пользователей** при кике из комнаты или смены пароля комнаты.
* [d3e8a5b3] Улучшены логи.
* [ba75c643] Поддержка медиасервером подключения по `TCP` с приоритетом на `UDP`.
* [b9276c62] Изменен способ **идентификации пользователя внутри комнаты** с Id сокета на Id учетной записи.
* [6d47d57e] **Новые функции для администратора**: изменение названия или пароля от комнаты.
* [50872013] Реструктуризация файла проекта (`package-lock -> npm-shrinkwrap`) для Backend и Frontend по отдельности. Также теперь требуется `NPM` минимум 8 версии.
* [85616152] **Хеширование** паролей от комнаты. А также теперь **информация о комнатах** сохраняется в файл `rooms.json`.
* [f59a40a3] Поддержка адреса для комнаты `/r`, а не только `/rooms`.
* [9e7b419c] **Новые звуки интерфейса** - при захвате видеоустройства, при отмене захвата видеоустройства, постановка и снятие микрофона с паузы, включение и выключение звука собеседников, звук сообщения в чате.
* [e50930eb] Теперь переход в комнату без пароля происходит сразу без страницы авторизации.
* [63691a3e] Функция **отключения звуковых оповещений** (#39).
* [c786d3ea] **Новые функции для администратора**: блокировка по IP (#37).
* [21f52fdb] Смена версии `Node.JS` с 16 до 12.
* [48d4a8e4] Добавлена **центральная** метка для видео.
* [b02aed4e] Обработка ситуации **удаления** комнаты с находящимися участниками внутри.
* [1afe312e] Фикс бага (максимальный битрейт для видео не применяется с первого раза) (#28).
* **Базовые функции для администратора**: отключение видео или аудио, исходящего от участника конференции, изменение имени пользователя, исключение пользователя из комнаты (#11).
* [1005c43a] Рефакторинг бэкенда.
* [41f02323] **Распараллеливание** медиапотоков по ядрам сервера (#23).
* Теперь при отправке сообщения в чат, поле для ввода сообщения очищается.
* [d7b5bb86] Добавлен **выбор разрешения** захватываемого изображения с веб-камеры.
* [62ce4bdb] Обновление `mediasoup` до версии 3.9.6 и `mediasoup-client` до 3.6.50.
* [db5691e0] Реализована возможность загрузки сразу **нескольких** файлов (#27).
* Реализована **возобновляемая загрузка файлов** в соответствии с протоколом `TUS` (#17).
* [c5dfb74f] Обновление `NPM` зависимостей.
* [652557ef] Добавлена поддержка конфига по умолчанию `server.default.conf`.
* [c35adff8] Новые опции в конфиге - `MEDIASOUP_RTC_MIN_PORT`, `MEDIASOUP_RTC_MAX_PORT`.
* [2adad359] **Разделение** проекта на отдельные репозитории (backend, frontend).
* [18cbe2e9] Кнопка вкл. и выкл. звука собеседников.
* [86002bc3] Конфигурационный файл `.env` переименован в `server.conf`. Создана папка `config`.
* [254eb389] Добавлены **звуковые оповещения** при заходе / выходе пользователей в комнате.
* [dab99e93] Новый видеоплеер `Plyr` (#9).
* [942f463f] [0fbdf638] Теперь видеопотоки (consumers/producers) на паузе учитываются при расчете битрейта. Также учитываются аудиопотоки (#10, #12).
* [215c3d0a] Новые опции в конфиге - `NETWORK_INCOMING_CAPABILITY`, `NETWORK_OUTCOMING_CAPABILITY`.
* [215c3d0a] Алгоритм регулирования (ограничения) битрейта в зависимости от сетевых возможностей сервера и количества участников (#6, #8).
* [5ed73931] Убран кодек H264 с профилем **4d0032**.
* [331168d8] Новые опции в конфиге - `MEDIASOUP_LOCAL_IP`, `MEDIASOUP_ANNOUNCED_IP`, `LOG_FILENAME`.
* [331168d8] Сохранение **логов** в файл `log.txt`.


### 0.2.1

* Используется кастомный патч by snnz для [mediasoup-client](https://gitlab.com/SgAkErRu/mediasoup-client/-/tree/3.6.36-patched), исправляющий баг при использовании Firefox, [подробнее о баге](https://github.com/versatica/mediasoup-client/pull/149).
* Исправлен баг с невозможностью захватить потоки на Chrome.

### 0.2.0

* Переделана архитектура с `Mesh` на `SFU`, с использованием библиотеки `mediasoup`.
* Front-end переписан на `TypeScript` с использованием `Webpack`.
* Улучшено масштабирование видеометок участников на экране, также теперь урезается текст метки (ник) с добавлением многоточия, если он не влезает в размер видеоэлемента.
* Рефакторинг Back-end'а.
* Добавление файла конфигурации `.env`
* Возможность устанавливать видеокодек (VP9, VP8 или H264) для комнаты через панель администратора.
* Добавлена инструкция по компиляции зависимости `mediasoup-worker` под Windows и Linux.
* Реализован общий чат в комнате.
* Обновлены NPM зависимости (включая переход с `socket.io` 3.x на 4.x).

### 0.1

* Версия с архитектурой `Mesh`.