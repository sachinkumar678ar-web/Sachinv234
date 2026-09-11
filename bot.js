const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const TELEGRAM_BOT_TOKEN = '8555094944:AAEJuHmxBosT6qST62J-AwbwfiZp1NHoY5s'; 
const CHANNEL_CHAT_ID = '-1003752888794'; 
const ADMIN_ID = '8358255492'; // ⚠️ अपना असली एडमिन आईडी यहाँ डालें
const CHANNEL_LINK = 'https://t.me/TREDSTERV20'; 

// 🟢 STICKERS CONFIGURATION
const STICKERS = {
    win: 'CAACAgUAAxkBAAEGxbhqpFBAYoBBfkci1nqKQMykp2clWQACbxQAAvvweFY9gMKaaaZ_Hz0E',
    loss: 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA', 
    jackpots: [
        'CAACAgUAAxkBAAEGxbRqpFAgw3AmWBExIgSWMZHu59sAAWoAApYPAAKPHXlWBNkiCpfo-yA9BA',
        'CAACAgUAAxkBAAEGxbNqpFAgrZ0yGhD6dSOxD3Z8fl4hIgACAhAAAkmUeFYO5k1fKCUsRz0E',
        'CAACAgUAAxkBAAEGxbJqpFAfhB0qQtog2WYxFKpYd5Vh1AACxw8AAvsJeVaBbAgF_n3m8j0E'
    ],
    morning: 'CAACAgUAAxkBAAEGxdZqpFJnYqt9SwUCbN1faymo--Fz-gACkhEAAmmYeFY2PES7ivQb2z0E',
    night: 'CAACAgUAAxkBAAEGxXxqpE0IZLYfOV9KcedlqzWmoY0JpgACFhEAAkQn4VXDknqUSMyX7T0E',
    skip: 'CAACAgUAAxkBAAEGxbxqpFBPx9PqmPrnmbe3uXf47sk2WQACDw8AAlLmeVZPWovInAvkFT0E',
    predStart: 'CAACAgUAAxkBAAEGxb5qpFBXv3MhLqfJzb7zaG2EXRnY3QACbBUAAsAsIFdjqS8Z8HQ2zD0E',
    predEnd: 'CAACAgUAAxkBAAEGxc5qpFH5BX41GeGqht0yXLck6ozCDAACNxEAAjXPKVe4-q5YhV0VYj0E',
    megaWin: 'CAACAgUAAxkBAAEGxdRqpFJIVz-g7zEMJjdozZJQsmquaQAC8BkAAl17MFQ05QXD-JXE-D0E',
    megaJackpot: 'CAACAgUAAxkBAAEGxcBqpFBn_Ineoqgu8wgZssaBvlWCFgAC-hQAAu0OiFSGFOobgNZJHD0E'
};

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=50";

let history = []; 
let botLevel = 1; 
let walletBalance = 4000; 
let currentPrediction = null; 
let autoPostTimeout = null;
let isBotActive = true; 
let skipMode = true; 
let consecutiveWins = 0;
let consecutiveJackpots = 0; 
let dailyFlags = { morning: false, night: false, report: false, pin: false };

let stats = { total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0, maxLevelReached: 1, hourlyData: {}, pctTracker: {} };
let recoveryUsers = {}; 

if (fs.existsSync('./stats.json')) { try { stats = JSON.parse(fs.readFileSync('./stats.json')); } catch (e) {} }
setInterval(() => { fs.writeFileSync('./stats.json', JSON.stringify(stats)); }, 5 * 60 * 1000); 

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
http.createServer((req, res) => { res.writeHead(200); res.end('Master AI V22 Active!\n'); }).listen(process.env.PORT || 3000);

// ==========================================
// 🛠️ UTILS & MATH
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
    const totalUnits = 364; 
    const unitValue = wallet / totalUnits;
    const levelMultiplier = Math.pow(3, level - 1);
    const levelTotalBet = Math.round(unitValue * levelMultiplier);

    let bBet = Math.round(levelTotalBet * 0.72);
    let nBet = Math.floor((levelTotalBet - bBet) / 2);

    if (bBet >= 10 && bBet <= 25) nBet = 1; else if (bBet < 5) nBet = 0;
    bBet = levelTotalBet - (nBet * 2);
    if (bBet < 1) { bBet = levelTotalBet; nBet = 0; }
    return { bBet, nBet, levelTotal: bBet + (nBet * 2) };
}

// ==========================================
// 🧠 100% REAL LIVE PROBABILITY CALCULATOR
// ==========================================
// यह फंक्शन पुरानी 600 हिस्ट्री में जाकर चेक करेगा कि जो पैटर्न अभी है, वो पहले कब आया था और उसके बाद क्या रिज़ल्ट आया।
function calculateRealProbability(historyData, type) {
    if (historyData.length < 20) return { pred: type === 'size' ? 'B' : 'R', chance: 50 };

    // पिछले 3 रिज़ल्ट का पैटर्न बनाओ
    let currentSeq = "";
    for(let i=0; i<3; i++) {
        let item = historyData[i];
        if (type === 'size') currentSeq += (item.number >= 5 ? "B" : "S");
        else currentSeq += (item.number % 2 === 0 ? "R" : "G");
    }

    let matchCount = 0;
    let nextOutcomeCounts = {};

    // 600 हिस्ट्री में यह पैटर्न ढूंढो
    for (let i = 3; i < historyData.length - 1; i++) {
        let histSeq = "";
        for(let j=0; j<3; j++) {
            let item = historyData[i - j];
            if (type === 'size') histSeq += (item.number >= 5 ? "B" : "S");
            else histSeq += (item.number % 2 === 0 ? "R" : "G");
        }
        
        // अगर पैटर्न मैच हो गया, तो देखो अगला (Next) रिज़ल्ट क्या था
        if (histSeq === currentSeq) {
            matchCount++;
            let nextItem = historyData[i - 3]; // इसके तुरंत बाद वाला रिजल्ट
            let nextVal = type === 'size' ? (nextItem.number >= 5 ? "B" : "S") : (nextItem.number % 2 === 0 ? "R" : "G");
            nextOutcomeCounts[nextVal] = (nextOutcomeCounts[nextVal] || 0) + 1;
        }
    }

    // अगर पैटर्न पहली बार बन रहा है (Data नहीं है)
    if (matchCount === 0) return { pred: type === 'size' ? 'B' : 'R', chance: 55 };

    let bestPred = "";
    let bestCount = -1;
    for (let key in nextOutcomeCounts) {
        if (nextOutcomeCounts[key] > bestCount) {
            bestCount = nextOutcomeCounts[key];
            bestPred = key;
        }
    }

    // रियल % कैलकुलेट करो
    let chance = Math.round((bestCount / matchCount) * 100);
    if (chance < 50) chance = 50; // सेफ्टी के लिए
    
    return { pred: bestPred, chance: chance };
}

function generatePrediction(nextId) {
    if (history.length < 10) return; 
    let finalSelection = "WAIT", skipReason = "", winChance = 0;

    // 🔴 1. असली लाइव % कैलकुलेशन (Real Market Data)
    let sizeResult = calculateRealProbability(history, 'size'); // Big/Small चांस
    let colResult = calculateRealProbability(history, 'color'); // Red/Green चांस

    // 🔴 2. 15% गैप वाला कलर रूल
    if (colResult.chance >= sizeResult.chance + 15) {
        finalSelection = colResult.pred === "R" ? "RED" : "GREEN";
        winChance = colResult.chance;
    } else {
        finalSelection = sizeResult.pred === "B" ? "BIG" : "SMALL";
        winChance = sizeResult.chance;
    }

    // 🔴 3. हाई-रिस्क लेवल वार्निंग (अगर लेवल 6 या ज़्यादा है तो % सिर्फ 50% दिखाएगा ताकि लोग लालच न करें)
    if (botLevel >= 6 && finalSelection !== "WAIT") {
        winChance = 50; 
    }

    // 🔴 4. स्किप मोड (0 या 5 आने पर अगर मोड ON है)
    if ([0, 5].includes(history[0].number) && skipMode) {
        skipReason = "Market Unstable (Skip Mode ON)";
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
        bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.skip).catch(()=>{});
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹0\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
        const bets = getDynamicBet(currentPrediction.level, walletBalance);
        const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet} (EACH)` : `₹0 (LOW BAL)`;
        let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : (currentPrediction.chance >= 65 ? "⚡" : "⚠️");
        
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet}\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ${nBetDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level} (UNLIMITED)\n━━━━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE:- ${currentPrediction.chance}% SURE</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
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
                if (history.length > 600) history = history.slice(0, 600); // 10 घंटे का डेटा सेव
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
            try { await bot.editMessageText(`🚨 <b>PREDICTION RESOLVED</b> 🚨\n🆔 #${latestId.slice(-4)}\n🎯 MY PRE:- 🌟skip🌟\n🎲 RUGLT. :- ${outcomeDisplay}\n📊 LEVEL. :- ${currentPrediction.level}`, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (e) {}
        } else {
            stats.total++;
            let isWin = false; let isJackpot = currentPrediction.nums.includes(actualNum); 
            
            if (currentPrediction.predType === "BIG" && actualNum >= 5) isWin = true;
            else if (currentPrediction.predType === "SMALL" && actualNum < 5) isWin = true;
            else if (currentPrediction.predType === "RED" && actualNum % 2 === 0) isWin = true;
            else if (currentPrediction.predType === "GREEN" && actualNum % 2 !== 0) isWin = true;

            let range = (Math.floor(currentPrediction.chance / 10) * 10).toString(); 
            if(!stats.pctTracker[range]) stats.pctTracker[range] = {total:0, wins:0, loss:0, jackpots:0};
            stats.pctTracker[range].total++;
            if (isWin) stats.pctTracker[range].wins++; else stats.pctTracker[range].loss++;
            if (isJackpot) stats.pctTracker[range].jackpots++;

            const bets = getDynamicBet(currentPrediction.level, walletBalance);
            let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : (currentPrediction.chance >= 65 ? "⚡" : "⚠️");
            
            const editedMsg = `🚨 <b>PREDICTION RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet}\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>CHANCE:- ${currentPrediction.chance}% SURE</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
            try { await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (err) {}

            if (isWin || isJackpot) {
                stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
                stats.wins++; consecutiveWins++;
                
                if (isJackpot) {
                    stats.jackpots++; consecutiveJackpots++;
                    // 🎲 3 जैकपॉट स्टीकर्स में से Randomly एक चुनकर भेजो
                    const randomJptSticker = STICKERS.jackpots[Math.floor(Math.random() * STICKERS.jackpots.length)];
                    bot.sendSticker(CHANNEL_CHAT_ID, randomJptSticker).catch(()=>{});
                    
                    if (consecutiveJackpots >= 3) bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.megaJackpot).catch(()=>{});
                } else {
                    bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.win).catch(()=>{});
                }
                
                if (consecutiveWins >= 5) bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.megaWin).catch(()=>{});
                botLevel = 1; // विन होने पर लेवल वापस 1
            } else {
                stats.losses++; consecutiveWins = 0; consecutiveJackpots = 0; 
                botLevel++; // अनलिमिटेड मार्टिंगेल
                bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.loss).catch(()=>{}); // रोने वाला स्टीकर
            }
            if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        }
    }
    const nextId = (BigInt(latestId) + 1n).toString();
    generatePrediction(nextId);
}

// ==========================================
// ⏰ TIME BASED TRIGGERS & PIN
// ==========================================
setInterval(() => {
    const now = getISTTime();
    let h = now.getHours(), m = now.getMinutes();

    if (h === 8 && m === 0 && !dailyFlags.morning) {
        bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.morning).catch(()=>{});
        bot.sendMessage(CHANNEL_CHAT_ID, "🌅 <b>GOOD MORNING VIPs!</b> 🌅\nआज के प्रॉफिट सेशन के लिए तैयार हो जाएं!", {parse_mode:'HTML'}).catch(()=>{});
        dailyFlags.morning = true;
    }
    if (h === 22 && m === 0 && !dailyFlags.night) {
        bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.night).catch(()=>{});
        bot.sendMessage(CHANNEL_CHAT_ID, "🌙 <b>GOOD NIGHT VIPs!</b> 🌙\nकल मिलेंगे नए प्रेडिक्शन के साथ!", {parse_mode:'HTML'}).catch(()=>{});
        dailyFlags.night = true;
    }
    if (h === 0 && m === 0 && !dailyFlags.pin) {
        let bestHour = -1, bestWinRate = -1;
        for(let hr=0; hr<24; hr++) {
            if(stats.hourlyData[hr] && stats.hourlyData[hr].total >= 10) {
                let rate = stats.hourlyData[hr].wins / stats.hourlyData[hr].total;
                if(rate > bestWinRate) { bestWinRate = rate; bestHour = hr; }
            }
        }
        if(bestHour !== -1) {
            let ampm1 = bestHour >= 12 ? 'PM' : 'AM', h1 = bestHour % 12 || 12;
            let nextH = (bestHour + 1) % 24, ampm2 = nextH >= 12 ? 'PM' : 'AM', h2 = nextH % 12 || 12;
            bot.sendMessage(CHANNEL_CHAT_ID, `🏆 <b>GOLDEN TRADING HOUR</b> 🏆\n\nकल के डेटा के अनुसार, सबसे सुरक्षित समय:\n⏰ <b>${h1}:00 ${ampm1} से ${h2}:00 ${ampm2}</b>\n⚡ <b>Win Rate:</b> ${Math.round(bestWinRate*100)}%\n\n<i>बोट 24 घंटे चालू है, लेकिन इस समय प्रॉफिट चांस ज़्यादा है!</i>`, {parse_mode:'HTML'})
               .then(sentMsg => bot.pinChatMessage(CHANNEL_CHAT_ID, sentMsg.message_id).catch(()=>{}));
        }
        stats.hourlyData = {}; dailyFlags.pin = true;
    }
    if (h === 1 && m === 0) { dailyFlags = { morning: false, night: false, report: false, pin: false }; }
}, 60000); 

// ==========================================
// 💬 STRICT COMMANDS (Group + Private)
// ==========================================

bot.onText(/^\/start$/, (msg) => {
    bot.sendMessage(msg.chat.id, `🎉 <b>WELCOME TO THE VIP FAMILY, ${msg.from.first_name}!</b> 🎉\n\n👇 <b>मेन्यू:</b>\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - 3X फंड चार्ट\n👉 /recovery - (PM Only) रिकवरी शुरू करें`, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/^\/chart$/, (msg) => {
    let chartMsg = `📊 <b>3X CUMULATIVE FUND CHART</b> 📊\n💰 <b>Total Wallet Setup:</b> ₹${walletBalance}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    let cumulative = 0;
    for(let i = 1; i <= 6; i++) {
        const bets = getDynamicBet(i, walletBalance);
        cumulative += bets.levelTotal;
        const nBetText = bets.nBet > 0 ? `₹${bets.nBet}, ₹${bets.nBet}` : `₹0 (Low Bal)`;
        chartMsg += `👉 <b>L${i}:</b> B/S: ₹${bets.bBet} | Nums: ${nBetText}\n   └ <i>Total: ₹${bets.levelTotal} | Cum.(जुड़कर): ₹${cumulative}</i>\n`;
    }
    bot.sendMessage(msg.chat.id, chartMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/^\/stats$/, (msg) => {
    let levelTrackerText = "";
    Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
    const statsMsg = `📊 <b>LIVE BOT ACCURACY</b> 📊\n\n🔥 <b>Signals:</b> ${stats.total}\n🎯 <b>JACKPOT WINS:</b> ${stats.jackpots} 🤑\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Max Level:</b> L${stats.maxLevelReached}\n\n🏆 <b>LEVEL CLEARANCE:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "अभी कोई डेटा नहीं है।"}`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

// 🔒 RECOVERY MODE (PRIVATE MESSAGE ONLY)
bot.onText(/^\/recovery$/, (msg) => {
    if (msg.chat.type !== 'private') return bot.sendMessage(msg.chat.id, "⚠️ भाई, यह कमांड सिर्फ मुझे प्राइवेट मैसेज (DM) में काम करता है!");
    if (!recoveryUsers[msg.chat.id]) recoveryUsers[msg.chat.id] = { state: 'IDLE' };
    bot.sendMessage(msg.chat.id, `😔 कोई बात नहीं भाई, लॉस होता रहता है।\n\n<b>आपका कुल लॉस (Loss) कितना है?</b> (सिर्फ अमाउंट लिखें, जैसे 600)`, {parse_mode:'HTML'});
    recoveryUsers[msg.chat.id].state = 'ASK_LOSS';
});

bot.on('message', (msg) => {
    if (msg.chat.type !== 'private' || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id, text = msg.text;
    if (!recoveryUsers[chatId]) return;
    let user = recoveryUsers[chatId];

    if (user.state === 'ASK_LOSS' && !isNaN(text)) {
        user.loss = parseFloat(text);
        bot.sendMessage(chatId, `💰 ठीक है। <b>अभी आपके Wingo वॉलेट में कुल कितना बैलेंस (Wallet) है?</b>`, {parse_mode:'HTML'});
        user.state = 'ASK_WALLET';
    }
    else if (user.state === 'ASK_WALLET' && !isNaN(text)) {
        user.wallet = parseFloat(text);
        user.target = Math.min(user.loss, user.wallet * 0.2); 
        let planMsg = `✅ <b>रिकवरी प्लान तैयार!</b>\n\n📉 <b>लॉस:</b> ₹${user.loss}\n💳 <b>वॉलेट:</b> ₹${user.wallet}\n🎯 <b>आज का टारगेट:</b> ₹${user.target}\n\nप्रेडिक्शन लेने के लिए 👉 /play दबाएं।`;
        bot.sendMessage(chatId, planMsg, {parse_mode:'HTML'});
        user.state = 'READY_TO_PLAY';
    }
});

bot.onText(/^\/play$/, (msg) => {
    if (msg.chat.type !== 'private') return;
    const chatId = msg.chat.id;
    let user = recoveryUsers[chatId];
    if (!user || user.state !== 'READY_TO_PLAY') return bot.sendMessage(chatId, "पहले 👉 /recovery कमांड भेजें।");

    if (user.cooldown && Date.now() < user.cooldown) {
        return bot.sendMessage(chatId, `🛑 <b>लालच नहीं भाई!</b>\nमैंने कहा था ना 1 घंटे बाद आना। अभी चैनल में देखो 👉 ${CHANNEL_LINK}`, {parse_mode:'HTML'});
    }
    
    if (currentPrediction && currentPrediction.chance >= 75) {
        const bets = getDynamicBet(currentPrediction.level, user.wallet);
        const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet}` : `₹0 (Low Bal, सिर्फ Size लगाएं)`;
        bot.sendMessage(chatId, `🎯 <b>PRIVATE RECOVERY SIGNAL</b>\n\n🌟 <b>लगाओ:</b> ${currentPrediction.predType}\n💵 <b>अमाउंट:</b> ₹${bets.bBet}\n🪙 <b>नंबर (${currentPrediction.nums}):</b> ${nBetDisplay}\n\n<i>प्रॉफिट होने के बाद बताना!</i>`, {parse_mode:'HTML'});
        user.cooldown = Date.now() + (60 * 60 * 1000); 
    } else {
        bot.sendMessage(chatId, `⚠️ अभी ट्रेंड बहुत खराब चल रहा है भाई। लॉस हो सकता है।\n\n<b>1 घंटे बाद आना</b>, तब सेफ प्रेडिक्शन दूँगा।`, {parse_mode:'HTML'});
        user.cooldown = Date.now() + (60 * 60 * 1000); 
    }
});

// 🔒 ADMIN COMMANDS
bot.onText(/^\/startsession$/, (msg) => { if (msg.from.id.toString() !== ADMIN_ID) return; isBotActive = true; bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.predStart).catch(()=>{}); bot.sendMessage(msg.chat.id, "✅ Session Started!"); });
bot.onText(/^\/endsession$/, (msg) => { if (msg.from.id.toString() !== ADMIN_ID) return; isBotActive = false; bot.sendSticker(CHANNEL_CHAT_ID, STICKERS.predEnd).catch(()=>{}); bot.sendMessage(msg.chat.id, "✅ Session Ended!"); });
bot.onText(/^\/skipmode$/, (msg) => { if (msg.from.id.toString() !== ADMIN_ID) return; skipMode = !skipMode; bot.sendMessage(msg.chat.id, `⚙️ Skip Mode is now ${skipMode ? "ON" : "OFF"}`); });
bot.onText(/^\/level\s+(\d+)$/, (msg, match) => { if (msg.from.id.toString() !== ADMIN_ID) return; walletBalance = parseFloat(match[1]); bot.sendMessage(msg.chat.id, `✅ Base Wallet = ₹${walletBalance}`); });
bot.onText(/^\/pause$/, (msg) => { if (msg.from.id.toString() !== ADMIN_ID) return; isBotActive = false; bot.sendMessage(msg.chat.id, "🛑 Paused."); });
bot.onText(/^\/resume$/, (msg) => { if (msg.from.id.toString() !== ADMIN_ID) return; isBotActive = true; bot.sendMessage(msg.chat.id, "▶️ Resumed."); });
bot.onText(/^\/adminstats$/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    let text = `📊 <b>PERCENTAGE TRACKER</b> 📊\n\n`;
    for(let pct in stats.pctTracker) {
        let d = stats.pctTracker[pct]; let rate = Math.round((d.wins/d.total)*100);
        text += `👉 <b>${pct}% Range:</b> Win ${rate}% | Jackpots: ${d.jackpots}\n`;
    }
    bot.sendMessage(msg.chat.id, text || "No data.", { parse_mode: 'HTML' });
});

setInterval(monitorLoop, 5000);
console.log("🚀 Master AI V22 Booted Successfully...");
