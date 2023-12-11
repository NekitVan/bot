const TelegramBot = require('node-telegram-bot-api');
const { subDays, subMonths, format } = require('date-fns');

const TOKEN = '6527056417:AAGCtjSyGFAlvFS2K8YdpKGnnLoYLBCqbQk';
const bot = new TelegramBot(TOKEN, { polling: true });

// Объект для хранения выполненных заданий
const completedTasks = {};
// Объект для хранения данных о заявках
const requestsData = {};

// Переменные для хранения текущего номера кабинета и информации о проделанной работе
let currentRoomNumber;
let currentTaskText;

// Команда /start
bot.onText(/\/start/i, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, 'Выберите действие:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Заявка', callback_data: 'request' }],
                [{ text: 'Неделя', callback_data: 'week' }],
                [{ text: 'Месяц', callback_data: 'month' }],
            ],
        },
    });
});

// Обработчик кнопки "Заявка"
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;

    if (callbackQuery.data === 'request') {
        // Отправляем сообщение с клавиатурой выбора проделанной работы
        bot.sendMessage(chatId, 'Выберите тип проделанной работы:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Настройка принтера', callback_data: 'printer_setup' }],
                    [{ text: 'Настройка АРМ', callback_data: 'arm_setup' }],
                    // Добавьте другие типы работы, если необходимо
                ],
            },
        }).then(() => {
            // Добавляем обработчик для выбора типа работы
            bot.once('callback_query', (workTypeQuery) => {
                const selectedWorkType = workTypeQuery.data;
                const workTypeMappings = {
                    'printer_setup': 'Настройка принтера',
                    'arm_setup': 'Настройка АРМ',
                    // Добавьте другие соответствия по мере необходимости
                };
            
                // Получите внешнее название типа работы
                const externalWorkType = workTypeMappings[selectedWorkType] || selectedWorkType;
            

                // Теперь отправляем сообщение, запрашивая номер кабинета
                bot.sendMessage(chatId, 'Введите номер кабинета:').then(() => {
                    bot.once('message', (roomMsg) => {
                        const roomNumber = roomMsg.text;

                        if (!requestsData[roomNumber]) {
                            requestsData[roomNumber] = [];
                        }

                        // Теперь запрашиваем информацию о проделанной работе в кабинете
                        bot.sendMessage(chatId, 'Введите дополнительную информацию о проделанной работе:').then(() => {
                            bot.once('message', (taskMsg) => {
                                const taskText = taskMsg.text;

                                requestsData[roomNumber].push({ user: userId, task: `${externalWorkType}: ${taskText}` });
                                bot.sendMessage(chatId, 'Выберите действие:', {
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{ text: 'Заявка', callback_data: 'request' }],
                                            [{ text: 'Неделя', callback_data: 'week' }],
                                            [{ text: 'Месяц', callback_data: 'month' }],
                                        ],
                                    },
                                });
                            });
                        });
                    });
                }).then(() => {
                    // Теперь формируем и отправляем отчет
                    const userRequests = requestsData[roomNumber].filter((request) => request.user === userId);
                    let reportMessage = `Отчет по кабинету ${roomNumber} для пользователя ${userId}\n`;

                    userRequests.forEach((request) => {
                        reportMessage += `- ${request.task}\n`;
                    });

                    bot.sendMessage(chatId, reportMessage);
                });
            });
        });
    } else if (callbackQuery.data === 'week' || callbackQuery.data === 'month') {
        let startDate;
        let endDate;

        if (callbackQuery.data === 'week') {
            const today = new Date();
            startDate = subDays(today, 7);
            endDate = today;
        } else if (callbackQuery.data === 'month') {
            const today = new Date();
            startDate = subMonths(today, 1);
            endDate = today;
        }

        const formattedStartDate = format(startDate, 'dd.MM.yyyy');
        const formattedEndDate = format(endDate, 'dd.MM.yyyy');

        const userRequests = Object.keys(requestsData)
            .filter((roomNumber) => requestsData[roomNumber].some((request) => request.user === userId))
            .reduce((acc, roomNumber) => {
                acc[roomNumber] = requestsData[roomNumber].filter((request) => request.user === userId);
                return acc;
            }, {});

        // Формируем отчет с учетом данных о заявках текущего пользователя
        let reportMessage = `Отчет за ${formattedStartDate} по ${formattedEndDate}\n`;
        let currentUserReport = `Пользователь ${userId}\n`;

        // Создаем объект для группировки задач по типу и номеру кабинета
        const groupedUserRequests = {};

        for (const roomNumber in userRequests) {
            if (userRequests.hasOwnProperty(roomNumber)) {
                userRequests[roomNumber].forEach((request) => {
                    const [taskType, taskNumber] = request.task.split(':').map(part => part.trim());

                    // Если еще нет группы для данного типа задачи, создаем ее
                    if (!groupedUserRequests[taskType]) {
                        groupedUserRequests[taskType] = {};
                    }

                    // Если еще нет группы для данного номера кабинета, создаем ее
                    if (!groupedUserRequests[taskType][roomNumber]) {
                        groupedUserRequests[taskType][roomNumber] = [];
                    }

                    groupedUserRequests[taskType][roomNumber].push(`${taskType}: ${taskNumber}`);
                });
            }
        }

    // Фрагмент кода для формирования и отправки сообщения с отчетом
for (const taskType in groupedUserRequests) {
    if (groupedUserRequests.hasOwnProperty(taskType)) {
        currentUserReport += `\n${taskType}:\n`;

        for (const roomNumber in groupedUserRequests[taskType]) {
            if (groupedUserRequests[taskType].hasOwnProperty(roomNumber)) {
                const tasksInRoom = groupedUserRequests[taskType][roomNumber];

                // Проверяем, что у нас есть номер кабинета
                if (roomNumber && tasksInRoom.length > 0) {
                    currentUserReport += ` ${tasksInRoom.join(', ')}:${roomNumber}:\n`;
                }
            }
        }
    }
}


        reportMessage += currentUserReport;

        bot.sendMessage(chatId, reportMessage);
    }
});

bot.on('polling_error', (error) => {
    console.error(error);
});
