const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const TELEGRAM_BOT_TOKEN = '8555094944:AAEBfYQDSn3Dtai4bEVTSpS56b2XLVgtWNE'; 
const CHANNEL_CHAT_ID = '-1003752888794'; 
const ADMIN_ID = '8358255492'; // ⚠️ अपना असली एडमिन आईडी यहाँ डालें
const CHANNEL_LINK = 'https://t.me/TREDSTERV20'; 

// 🟢 DEFAULT STICKERS (अगर एडमिन नया सेट न करे तो ये काम करेंगे)
const DEFAULT_STICKERS = {
    win: 'CAACAgUAAxkBAAEGxbhqpFBAYoBBfkci1nqKQMykp2clWQACbxQAAvvweFY9gMKaaaZ_Hz0E',
    loss: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA', 
    jpt1: 'CAACAgUAAxkBAAEGxbRqpFAgw3AmWBExIgSWMZHu59sAAWoAApYPAAKPHXlWBNkiCpfo-yA9BA', // 0-3
    jpt2: 'CAACAgUAAxkBAAEGxbNqpFAgrZ0yGhD6dSOxD3Z8fl4hIgACAhAAAkmUeFYO5k1fKCUsRz0E', // 8-9
    jpt3: 'CAACAgUAAxkBAAEGxbJqpFAfhB0qQtog2WYxFKpYd5Vh1AACxw8AAvsJeVaBbAgF_n3m8j0E', // 4-7
    skip: 'CAACAgUAAxkBAAEGxbxqpFBPx9PqmPrnmbe3uXf47sk2WQACDw8AAlLmeVZPWovInAvkFT0E',
    morning: 'CAACAgUAAxkBAAEGxdZqpFJnYqt9SwUCbN1faymo--Fz-gACkhEAAmmYeFY2PES7ivQb2z0E',
    night: 'CAACAgUAAxkBAAEGxXxqpE0IZLYfOV9KcedlqzWmoY0JpgACFhEAAkQn4VXDknqUSMyX7T0E',
    predStart: 'CAACAgUAAxkBAAEGxb5qpFBXv3MhLqfJzb7zaG2EXRnY3QACbBUAAsAsIFdjqS8Z8HQ2zD0E',
    predEnd: 'CAACAgUAAxkBAAEGxc5qpFH5BX41GeGqht0yXLck6ozCDAACNxEAAjXPKVe4-q5YhV0VYj0E',
    megaWin: 'CAACAgUAAxkBAAEGxdRqpFJIVz-g7zEMJjdozZJQsmquaQAC8BkAAl17MFQ05QXD-JXE-D0E',
    megaJackpot: 'CAACAgUAAxkBAAEGxcBqpFBn_Ineoqgu8wgZssaBvlWCFgAC-hQAAu0OiFSGFOobgNZJHD0E'
};

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=50";

let history = []; 
let botLevel = 1; 
let maxLevel = 20; // 🔥 20 LEVELS FIXED
let walletBalance = 4000; 
let currentPrediction = null; 
let autoPostTimeout = null;
let isBotActive = true; 
let skipMode = true; 
let consecutiveWins = 0;
let consecutiveJackpots = 0; 
let dailyFlags = { morning: false, night: false, pin: false };
let pendingStickerUpdate = {}; // Admin के नए स्टीकर सेट करने के लिए

let stats = { total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0, maxLevelReached: 1, hourlyData: {}, pctTracker: {}, stickers: {} };
let recoveryUsers = {}; 

if (fs.existsSync('./stats.json')) { 
    try { 
        stats = JSON.parse(fs.readFileSync('./stats.json')); 
        if (!stats.stickers || Object.keys(stats.stickers).length === 0) stats.stickers = DEFAULT_STICKERS;
    } catch (e) {} 
} else {
    stats.stickers = DEFAULT_STICKERS;
}
setInterval(() => { fs.writeFileSync('./stats.json', JSON.stringify(stats)); }, 5 * 60 * 1000); 

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
http.createServer((req, res) => { res.writeHead(200); res.end('Master AI V24 Active!\n'); }).listen(process.env.PORT || 3000);

// ==========================================
// 🎯 ADMIN STICKER SETTING COMMAND (SMART CHECK)
// ==========================================
bot.onText(/^\/setsticker\s+(win|loss|jpt1|jpt2|jpt3|skip)$/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    pendingStickerUpdate[msg.chat.id] = match[1];
    bot.sendMessage(msg.chat.id, `✅ <b>${match[1].toUpperCase()}</b> के लिए नया स्टीकर भेजें...\n(बोट चेक करेगा कि यह फिट बैठता है या नहीं)`, {parse_mode: 'HTML'});
});

bot.on('sticker', async (msg) => {
    if (msg.chat.type === 'private' && msg.from.id.toString() === ADMIN_ID) {
        if (pendingStickerUpdate[msg.chat.id]) {
            let type = pendingStickerUpdate[msg.chat.id];
            let fileId = msg.sticker.file_id;
            try {
                // 🔥 बोट खुद सेंड करके चेक करेगा (Test)
                await bot.sendSticker(msg.chat.id, fileId);
                
                // अगर सक्सेस हुआ, तो सेव कर लेगा
                stats.stickers[type] = fileId;
                delete pendingStickerUpdate[msg.chat.id];
                bot.sendMessage(msg.chat.id, `✅ <b>एकदम फिट!</b>\nयह स्टीकर <b>${type.toUpperCase()}</b> के लिए सफलतापूर्वक सेट हो गया है।`, {parse_mode: 'HTML'});
            } catch (e) {
                bot.sendMessage(msg.chat.id, `❌ <b>यह स्टीकर सपोर्ट नहीं कर रहा!</b>\nटेलीग्राम ने इसे रिजेक्ट कर दिया। कृपया कोई दूसरा स्टीकर भेजें।`, {parse_mode: 'HTML'});
            }
        } else {
            bot.sendMessage(msg.chat.id, `✅ <b>Sticker ID:</b>\n<code>${msg.sticker.file_id}</code>`, {parse_mode: 'HTML'});
        }
    }
});

// ==========================================
// 🛠️ MATH (20-LEVEL DYNAMIC SYSTEM)
// ==========================================
function getISTTime() { return new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)); }
function getISTTimeString() {
    let nd = getISTTime(), h = nd.getHours(), m = nd.getMinutes(), ampm = h >= 12 ? 'PM' : 'AM'; 
    h = h % 12 || 12; m = m < 10 ? '0'+m : m; return (h < 10 ? '0'+h : h) + ':' + m + ' ' + ampm;
}
function getFancyType(type) {
    if (type === "BIG") return "🔵 BIGGG"; if (type === "SMALL") return "🟡 SMALL";
    if (type === "RED") return "🔴 REDDD"; if (type === "GREEN") return "🟢 GREEN"; return type; 
}

function getDynamicBet(level, wallet) {
    let totalUnits = 0;
    // 20 लेवल के लिए टोटल यूनिट्स कैलकुलेट करेगा
    for(let i=0; i<maxLevel; i++) totalUnits += Math.pow(3, i); 
    
    let unitValue = wallet / totalUnits;
    let levelMultiplier = Math.pow(3, level - 1);
    let levelTotalBet = Math.round(unitValue * levelMultiplier);

    // ⚠️ 20 लेवल के लिए अगर अमाउंट बहुत कम आ रहा है (0), तो बेस मल्टीप्लायर को दांव बनाएगा (1, 3, 9, 27...)
    if (levelTotalBet < 1) levelTotalBet = levelMultiplier; 

    let bBet = Math.round(levelTotalBet * 0.72);
    let nBet = Math.floor((levelTotalBet - bBet) / 2);

    if (bBet >= 10 && bBet <= 25) nBet = 1; else if (bBet < 5) nBet = 0;
    bBet = levelTotalBet - (nBet * 2);
    if (bBet < 1) { bBet = levelTotalBet; nBet = 0; }
    return { bBet, nBet, levelTotal: bBet + (nBet * 2) };
}

// ==========================================
// 🧠 ULTRA-SAFE PREDICTION LOGIC
// ==========================================
function calculateRealProbability(historyData, type) {
    if (historyData.length < 20) return { pred: type === 'size' ? 'B' : 'R', chance: 50 };
    let currentSeq = "";
    for(let i=0; i<3; i++) {
        let item = historyData[i];
        if (type === 'size') currentSeq += (item.number >= 5 ? "B" : "S");
        else currentSeq += (item.number % 2 === 0 ? "R" : "G");
    }
    let matchCount = 0; let nextOutcomeCounts = {};
    for (let i = 3; i < historyData.length - 1; i++) {
        let histSeq = "";
        for(let j=0; j<3; j++) {
            let item = historyData[i - j];
            if (type === 'size') histSeq += (item.number >= 5 ? "B" : "S");
            else histSeq += (item.number % 2 === 0 ? "R" : "G");
        }
        if (histSeq === currentSeq) {
            matchCount++;
            let nextItem = historyData[i - 3]; 
            let nextVal = type === 'size' ? (nextItem.number >= 5 ? "B" : "S") : (nextItem.number % 2 === 0 ? "R" : "G");
            nextOutcomeCounts[nextVal] = (nextOutcomeCounts[nextVal] || 0) + 1;
        }
    }
    if (matchCount === 0) return { pred: type === 'size' ? 'B' : 'R', chance: 55 };
    let bestPred = ""; let bestCount = -1;
    for (let key in nextOutcomeCounts) {
        if (nextOutcomeCounts[key] > bestCount) { bestCount = nextOutcomeCounts[key]; bestPred = key; }
    }
    let chance = Math.round((bestCount / matchCount) * 100);
    if (chance < 50) chance = 50; 
    return { pred: bestPred, chance: chance };
}

function generatePrediction(nextId) {
    if (history.length < 10) return; 
    let finalSelection = "WAIT", skipReason = "", winChance = 0;

    let sizeResult = calculateRealProbability(history, 'size'); 
    let colResult = calculateRealProbability(history, 'color'); 

    if (sizeResult.chance >= 70 || colResult.chance >= 70) {
        if (colResult.chance >= sizeResult.chance + 15) {
            finalSelection = colResult.pred === "R" ? "RED" : "GREEN";
            winChance = colResult.chance;
        } else {
            finalSelection = sizeResult.pred === "B" ? "BIG" : "SMALL";
            winChance = sizeResult.chance;
        }
    } else {
        skipReason = "Low Probability (रिस्क बहुत ज़्यादा है)";
        finalSelection = "WAIT";
    }

    if ([0, 5].includes(history[0].number) && skipMode) {
        skipReason = "0/5 Volatile (Skip Mode ON)";
        finalSelection = "WAIT";
    }

    let finalNums = ["-", "-"];
    if (finalSelection === "BIG") finalNums = [7, 9]; if (finalSelection === "SMALL") finalNums = [1, 3];
    if (finalSelection === "RED") finalNums = [2, 8]; if (finalSelection === "GREEN") finalNums = [3, 7];

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNums, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), chance: winChance, skipReason: skipReason };
    
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => { if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel(); }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    let msgContent = "";
    if (currentPrediction.predType === "WAIT") {
        bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.skip || DEFAULT_STICKERS.skip).catch(()=>{});
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹0\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}/${maxLevel}\n━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
        const bets = getDynamicBet(currentPrediction.level, walletBalance);
        const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet} (EACH)` : `₹0 (LOW BAL)`;
        let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : "⚡";
        
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet}\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ${nBetDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}/${maxLevel}\n━━━━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE:- ${currentPrediction.chance}% SURE</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
    }
    try {
        const sentMessage = await bot.sendMessage(CHANNEL_CHAT_ID, msgContent, { parse_mode: 'HTML' });
        currentPrediction.messageId = sentMessage.message_id;
        currentPrediction.isChannelPosted = true;
    } catch (err) {}
}

async function monitorLoop() {
    if (!isBotActive) return;
    try {
        const response = await fetch(`${API_ENDPOINT}&t=${Date.now()}`);
        if (!response.ok) return;
        const json = await response.json();
        const list = json.data?.list || json.list || json.data || [];
        
        if (Array.isArray(list) && list.length > 0) {
            let newlyAdded = false;
            list.reverse().forEach(item => {
                const id = (item.issueNumber || item.period || item.issue).toString();
                const num = parseInt(item.number !== undefined ? item.number : item.resultNum);
                if (!history.find(h => h.issue === id)) { history.unshift({ issue: id, number: num }); newlyAdded = true; }
            });
            if (newlyAdded) {
                history.sort((a,b) => b.issue.localeCompare(a.issue));
                if (history.length > 600) history = history.slice(0, 600); 
                await handleNewOutcome();
            }
        }
    } catch (e) {}
}

async function handleNewOutcome() {
    if (history.length < 15) return;
    const latestOutcome = history[0], latestId = latestOutcome.issue;

    if (currentPrediction && currentPrediction.issue === latestId) {
        const actualNum = latestOutcome.number;
        const actualSize = actualNum >= 5 ? "🔵 BIGGG" : "🟡 SMALL";
        const actualColor = actualNum % 2 === 0 ? "🔴 RED" : "🟢 GREEN";
        let outcomeDisplay = `🌟${actualSize} / ${actualColor}(${actualNum})🌟`;
        
        if (currentPrediction.predType === "WAIT") {
            stats.skips++;
            try { await bot.editMessageText(`🚨 <b>PREDICTION RESOLVED</b> 🚨\n🆔 #${latestId.slice(-4)}\n🎯 MY PRE:- 🌟skip🌟\n🎲 RUGLT. :- ${outcomeDisplay}\n📊 LEVEL. :- ${currentPrediction.level}/${maxLevel}`, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (e) {}
        } else {
            stats.total++;
            let isWin = false; let isJackpot = currentPrediction.nums.includes(actualNum); 
            
            if (currentPrediction.predType === "BIG" && actualNum >= 5) isWin = true;
            else if (currentPrediction.predType === "SMALL" && actualNum < 5) isWin = true;
            else if (currentPrediction.predType === "RED" && actualNum % 2 === 0) isWin = true;
            else if (currentPrediction.predType === "GREEN" && actualNum % 2 !== 0) isWin = true;

            const bets = getDynamicBet(currentPrediction.level, walletBalance);
            let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : "⚡";
            
            const editedMsg = `🚨 <b>PREDICTION RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet}\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}/${maxLevel}\n━━━━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>CHANCE:- ${currentPrediction.chance}% SURE</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
            try { await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (err) {}

            if (isWin || isJackpot) {
                stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
                stats.wins++; consecutiveWins++;
                
                if (isJackpot) {
                    stats.jackpots++; consecutiveJackpots++;
                    // 🎲 आपके दिए गए रूल्स के हिसाब से डायनामिक स्टीकर्स
                    let selectedSticker;
                    if (actualNum >= 0 && actualNum <= 3) selectedSticker = stats.stickers.jpt1 || DEFAULT_STICKERS.jpt1;
                    else if (actualNum >= 4 && actualNum <= 7) selectedSticker = stats.stickers.jpt3 || DEFAULT_STICKERS.jpt3;
                    else selectedSticker = stats.stickers.jpt2 || DEFAULT_STICKERS.jpt2;
                    
                    bot.sendSticker(CHANNEL_CHAT_ID, selectedSticker).catch(e => console.log("Jpt Sticker Error:", e.message));
                } else {
                    bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.win || DEFAULT_STICKERS.win).catch(e => console.log("Win Sticker Error:", e.message));
                }
                
                botLevel = 1; 
            } else {
                stats.losses++; consecutiveWins = 0; consecutiveJackpots = 0; 
                bot.sendSticker(CHANNEL_CHAT_ID, stats.stickers.loss || DEFAULT_STICKERS.loss).catch(e => console.log("Loss Sticker Error:", e.message));
                
                // 🔥 LEVEL 20 STOP-LOSS
                if (botLevel >= maxLevel) {
                    bot.sendMessage(CHANNEL_CHAT_ID, `⚠️ <b>STOP LOSS HIT (Level ${maxLevel})</b>\nमार्केट का ट्रेंड बहुत खराब है। फंड बचाने के लिए लेवल 1 से फिर शुरू कर रहे हैं।`, {parse_mode: 'HTML'}).catch(()=>{});
                    botLevel = 1;
                } else {
                    botLevel++;
                }
            }
            if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        }
    }
    const nextId = (BigInt(latestId) + 1n).toString();
    generatePrediction(nextId);
}

// 💬 COMMANDS & RECOVERY 
bot.onText(/^\/start$/, (msg) => { bot.sendMessage(msg.chat.id, `🎉 <b>WELCOME, ${msg.from.first_name}!</b> 🎉\n\n👇 <b>मेन्यू:</b>\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - 20X फंड चार्ट\n👉 /recovery - रिकवरी शुरू करें`, { parse_mode: 'HTML' }).catch(()=>{}); });
bot.onText(/^\/chart$/, (msg) => {
    let chartMsg = `📊 <b>20-LEVEL FUND CHART</b> 📊\n💰 <b>Total Wallet:</b> ₹${walletBalance}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    let cumulative = 0;
    // चार्ट बहुत लंबा हो जाएगा इसलिए सिर्फ 10 लेवल दिखाएंगे
    for(let i = 1; i <= 10; i++) {
        const bets = getDynamicBet(i, walletBalance);
        cumulative += bets.levelTotal;
        const nBetText = bets.nBet > 0 ? `₹${bets.nBet}, ₹${bets.nBet}` : `₹0 (Low Bal)`;
        chartMsg += `👉 <b>L${i}:</b> B/S: ₹${bets.bBet} | Nums: ${nBetText} (Cum: ₹${cumulative})\n`;
    }
    chartMsg += `\n<i>⚠️ Note: यह चार्ट लेवल 20 तक कैलकुलेटेड है।</i>`;
    bot.sendMessage(msg.chat.id, chartMsg, { parse_mode: 'HTML' }).catch(()=>{});
});
bot.onText(/^\/stats$/, (msg) => {
    const statsMsg = `📊 <b>LIVE BOT ACCURACY</b> 📊\n🔥 <b>Signals:</b> ${stats.total}\n🎯 <b>JACKPOT WINS:</b> ${stats.jackpots} 🤑\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Max Level Reached:</b> L${stats.maxLevelReached}/${maxLevel}`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

setInterval(monitorLoop, 5000);
console.log("🚀 V24 Booted Successfully with Dynamic Stickers & 20 Levels...");
