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
        bot.sendMessage(chatId, 'Введите номер кабинета:').then(() => {
            bot.once('message', (msg) => {
                const { text } = msg;

                if (!requestsData[text]) {
                    requestsData[text] = [];
                }

                currentRoomNumber = text;

                bot.sendMessage(chatId, 'Введите информацию о проделанной работе:').then(() => {
                    bot.once('message', (msg) => {
                        const { text: taskText } = msg;
                        currentTaskText = taskText;

                        requestsData[currentRoomNumber].push({ user: userId, task: currentTaskText });

                        bot.sendMessage(chatId, `Информация о работе в кабинете ${currentRoomNumber} пользователя ${userId}: ${currentTaskText}`);
                    });
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
                        if (currentRoomNumber && currentTaskText) {
                            currentUserReport += `- ${roomNumber}\n`;
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
