const { format } = require('date-fns');


async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function logMessage(message) {
    const dateTime = `${format(new Date(), 'dd.MM.yyyy HH:mm:ss')}`;
    const logItem = `[${dateTime}] ${message}\n`;
    console.log(logItem);
}

module.exports = {sleep, logMessage};