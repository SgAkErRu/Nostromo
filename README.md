# Nostromo (Russian)

For [english version click here](/README-EN.md).

# Описание

## Краткое описание

**Nostromo** - это платформа для организации и проведения видеоконференций, основанная на технологии `WebRTC`.

Полностью бесплатная, автономная, с открытым исходным кодом, без искусственных лимитов и ограничений.

Платформа **Nostromo** состоит из нескольких компонентов:
Репозиторий                                                     | Описание
-------------                                                   | -------------
[Nostromo Server](https://gitlab.com/SgAkErRu/nostromo)         | Сервер Nostromo (backend), построенный на платформе `Node.js`
[Nostromo Web](https://gitlab.com/SgAkErRu/nostromo-web)        | Веб-клиент Nostromo (frontend), написанный на чистом `HTML` и `TypeScript`
[Nostromo Shared](https://gitlab.com/SgAkErRu/nostromo-shared)  | Компонент с общими типами и структурами для сервера и клиентской части

## Особенности

- ♾️ Полностью **бесплатно** без каких-либо ограничений (например, по времени или количеству участников).

- 🏢 Полностью **автономная платформа** - можно работать как в закрытой сети без подключения к Интернету, так и в открытой сети через Интернет.

- 🛡️ Безопасность обеспечивается использованием технологий, поддерживающих шифрование передаваемых данных: `DTLS-SRTP` для передачи медиапотоков и `HTTPS` для передачи иных (текстовых и файловых) данных.

- 🤨 **Количество участников** зависит от технических возможностей сервера (см. [производительность](#производительность)).

- 🖥️ **Подключение** со смартфона или компьютера с помощью браузера. В ближайших планах - отдельное приложение для компьютера. В далёких - приложение для Android.

- 🕵️ **Поддержка гостей** - не нужно регистрироваться для участия в конференции. Достаточно просто перейти по ссылке и вы уже можете участвовать в конференции.

- 🔒 Комнаты (конференции) можно защищать **паролем**. А войти в комнату можно как с помощью ручного ввода пароля, так и перейдя по специальной ссылке, где хэш-пароля вшит прямо в ссылке на комнату.

- 🎙️ Возможность захватывать **микрофон**, **веб-камеру** или **экран / окно компьютера** (если браузер Chrome, то можно также захватить вкладку, и опционально - звук компьютера или вкладки). Причем для захвата веб-камеры или экрана можно выбирать **разрешение и частоту кадров** захватываемого изображения (от 240p до 1440p).

- 📋 Во время конференции можно переписываться в **чате**, а также отправлять **файлы** (можно несколько файлов за раз).

- 📎 Загрузка файлов реализована на основе протокола `TUS`, поэтому она **восстанавливается** при обрыве загрузки, более того, вы можете остановить загрузку, а потом **продолжить её с того же места** даже через несколько часов.

- 🔨 **Функции администратора** - создание, редактирование и удаление комнат. Отключение видео или аудио, исходящего от участника конференции, изменение имени пользователя, исключение пользователя из комнаты, а также функция блокировки пользователя по IP-адресу.

- ⏸️ Захваченный микрофон можно **ставить на паузу и снимать с паузы**, не перезахватывая микрофон.

- 🔊 **Звуковые оповещения** при входе или выходе участников, при захвате видеопотоков, при включении или отключении звуков собеседников, а также при паузе / снятия с паузы микрофона. Эти оповещения можно и отключить.

- 🎚️ Можно регулировать уровень **громкости звука** участников, а также ставить и снимать с паузы медиапотоки другого участника (например, для экономии ресурсов).

- 📷 Поддержка картинки-в-картинке для видео, исходящих от участников.


## Производительность

Мы провели тестирование на **40** участников на протяжении нескольких часов и в целом всё прошло неплохо. У **всех** были захвачены микрофоны, а **15** из них ещё и демонстрировали экраны или захватывали веб-камеры.

Всё это было стареньком 10-летнем сервере и с пропускной способностью сети (Интернет) около **15 МБит/с**.

Попробуйте и вы, и делитесь вашими результатами любым удобным вам способом (через Issues или электронной почтой).

# Установка, настройка, требования

С **установкой**, **настройкой** и **требованиями** можно ознакомиться [тут](/docs/SETUP.md).

# Демонстрационный скриншот
![Nostromo demo screenshot](nostromo-demo-screenshot.png)
