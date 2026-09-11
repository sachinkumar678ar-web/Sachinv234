const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const TELEGRAM_BOT_TOKEN = '8555094944:AAEJuHmxBosT6qST62J-AwbwfiZp1NHoY5s'; 
const CHANNEL_CHAT_ID = '-1003752888794'; 
const ADMIN_ID = '8358255492'; // ⚠️ अपना असली एडमिन आईडी यहाँ डालें

const STICKER_WIN = 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA'; 
const STICKER_LOSS = 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA';
const STICKER_JACKPOT = 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE';

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=50";

let history = []; 
let botLevel = 1;
let walletBalance = 4000; 
let currentPrediction = null; 
let autoPostTimeout = null;
let isPollingReconnecting = false; 
let isBotActive = true; 
let dailyReportSent = false;
let midnightPinSent = false; // रात 12 बजे के पिन मैसेज के लिए
let consecutiveJackpots = 0; 

// 📊 Stats Object (Hourly Data जोड़ा गया है)
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0,
    maxLevelReached: 1, levelHistoryTracker: {}, knownUsers: [],
    hourlyData: {} // 24 घंटे का डेटा ट्रैक करने के लिए
};

if (fs.existsSync('./stats.json')) {
    try { stats = JSON.parse(fs.readFileSync('./stats.json')); } catch (e) {}
}
setInterval(() => { fs.writeFileSync('./stats.json', JSON.stringify(stats)); }, 5 * 60 * 1000); 

// ==========================================
// 🤖 BOT SETUP & SERVER
// ==========================================
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false, request: { agentOptions: { family: 4 } } });

bot.on('polling_error', (error) => {
    if (String(error).includes('409 Conflict') && !isPollingReconnecting) {
        isPollingReconnecting = true;
        bot.stopPolling().then(() => {
            setTimeout(() => { bot.startPolling({ restart: true }).then(() => isPollingReconnecting = false).catch(() => isPollingReconnecting = false); }, 15000); 
        }).catch(() => isPollingReconnecting = false);
    }
});
bot.deleteWebHook({ drop_pending_updates: true }).then(() => bot.startPolling({ restart: true }));

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Trade Star Non-Stop Active!\n'); }).listen(PORT);

// ==========================================
// 🛠️ UTILITY & MATH FUNCTIONS
// ==========================================
function getISTTime() { return new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)); }
function getISTTimeString() {
    let nd = getISTTime(), h = nd.getHours(), m = nd.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; m = m < 10 ? '0'+m : m;
    return (h < 10 ? '0'+h : h) + ':' + m + ' ' + ampm;
}
function getFancyType(type) {
    if (type === "BIG") return "🔵 BIGGG"; if (type === "SMALL") return "🟡 SMALL"; return type; 
}
function getRandomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// 🧠 3-LEVEL MATH (13 Units)
function getDynamicBet(level, wallet) {
    const totalUnits = 13; 
    const unitValue = wallet / totalUnits;
    const levelMultiplier = Math.pow(3, level - 1);
    const levelTotalBet = Math.round(unitValue * levelMultiplier);

    let bBet = Math.round(levelTotalBet * 0.72);
    let nBet = Math.floor((levelTotalBet - bBet) / 2);

    if (bBet >= 10 && bBet <= 25) { nBet = 1; } 
    else if (bBet < 5) { nBet = 0; }

    bBet = levelTotalBet - (nBet * 2);
    if (bBet < 1) { bBet = levelTotalBet; nBet = 0; }

    return { bBet, nBet, levelTotal: bBet + (nBet * 2) };
}

function getBadNumbers(historyData) {
    let counts = {}; let breaks = {};
    for(let i = 0; i < historyData.length - 1; i++) {
        let currentSize = historyData[i].number >= 5 ? "B" : "S"; 
        let prevSize = historyData[i+1].number >= 5 ? "B" : "S"; 
        let prevNum = historyData[i+1].number; 
        counts[prevNum] = (counts[prevNum] || 0) + 1;
        if(currentSize !== prevSize) breaks[prevNum] = (breaks[prevNum] || 0) + 1;
    }
    let badNums = [0, 5]; 
    for(let i = 0; i <= 9; i++) {
        if(counts[i] >= 5 && (breaks[i] / counts[i]) >= 0.60) {
            if(!badNums.includes(i)) badNums.push(i);
        }
    }
    return badNums;
}

// ==========================================
// 🧠 NON-STOP AI LOGIC (Dynamic Percentage)
// ==========================================
function generatePrediction(nextId) {
    if (history.length < 6) return; 

    let activeBadNumbers = getBadNumbers(history);
    let lastNum = history[0].number;
    
    let s0 = history[0].number >= 5 ? "B" : "S"; let s1 = history[1].number >= 5 ? "B" : "S";
    let s2 = history[2].number >= 5 ? "B" : "S"; let s3 = history[3].number >= 5 ? "B" : "S";
    let s4 = history[4].number >= 5 ? "B" : "S"; let s5 = history[5].number >= 5 ? "B" : "S";
    
    let seq5 = s4+s3+s2+s1+s0; let seq4 = s3+s2+s1+s0;

    let finalSelection = s0 === "B" ? "BIG" : "SMALL"; // डिफ़ॉल्ट: पिछला फॉलो करेगा (No Skip)
    let baseWinChance = 65; // नॉर्मल ट्रेंड का चांस

    // 1. पैटर्न चेकिंग
    if (seq5 === "BBSBB") { finalSelection = "SMALL"; baseWinChance = 94; } 
    else if (seq5 === "SSBSS") { finalSelection = "BIG"; baseWinChance = 94; } 
    else if (seq5 === "BSSSB") { finalSelection = "SMALL"; baseWinChance = 92; } 
    else if (seq5 === "SBBBS") { finalSelection = "BIG"; baseWinChance = 92; }
    else if (seq4 === "BBBB") { finalSelection = "BIG"; baseWinChance = 88; }
    else if (seq4 === "SSSS") { finalSelection = "SMALL"; baseWinChance = 88; }
    else if (seq4 === "BBSS") { finalSelection = "BIG"; baseWinChance = 86; } 
    else if (seq4 === "SSBB") { finalSelection = "SMALL"; baseWinChance = 86; } 
    else if (seq4 === "BSBS") { finalSelection = "BIG"; baseWinChance = 82; }
    else if (seq4 === "SBSB") { finalSelection = "SMALL"; baseWinChance = 82; }

    // 2. प्रतिशत (Percentage) घटाने का लॉजिक (0, 5 या Bad Number आने पर)
    let isBadTrend = activeBadNumbers.includes(lastNum) || [0, 5].includes(lastNum);
    
    if (isBadTrend) {
        // अगर ट्रेंड खराब है, तो % गिरा कर 51 से 59 के बीच कर दो
        baseWinChance = getRandomNumber(51, 59);
    } else {
        // अगर ट्रेंड अच्छा है, तो रियल बेस में थोड़ा रैंडम टच दो (जैसे 86% -> 85-88%)
        if (baseWinChance === 65) baseWinChance = getRandomNumber(60, 69);
        else baseWinChance = getRandomNumber(baseWinChance - 2, baseWinChance + 2);
    }

    let finalNums = ["-", "-"];
    if (finalSelection === "BIG") finalNums = [7, 9];
    if (finalSelection === "SMALL") finalNums = [1, 3];

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNums, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), chance: baseWinChance };
    
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel();
    }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    
    const bets = getDynamicBet(currentPrediction.level, walletBalance);
    const nBetDisplay = bets.nBet > 0 ? `₹${bets.nBet} (EACH)` : `₹0 (LOW BAL)`;
    
    // कलर कोड % के हिसाब से
    let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : (currentPrediction.chance >= 65 ? "⚡" : "⚠️");

    let msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ${nBetDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}/3 (STRICT PROG.)\n━━━━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE:-   ${currentPrediction.chance}%</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
    
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
                if (!history.find(h => h.issue === id)) {
                    history.unshift({ issue: id, number: num });
                    newlyAdded = true;
                }
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
        let outcomeDisplay = `🌟${actualSize}(${actualNum})🌟`;
        
        stats.total++;
        let isWin = false;
        let isJackpot = currentPrediction.nums.includes(actualNum); 
        
        if (currentPrediction.predType === "BIG" && actualNum >= 5) isWin = true;
        else if (currentPrediction.predType === "SMALL" && actualNum < 5) isWin = true;

        // 🔴 घंटे का डेटा सेव करो (पिन मैसेज के लिए)
        let currentHour = getISTTime().getHours();
        if(!stats.hourlyData[currentHour]) stats.hourlyData[currentHour] = { wins: 0, total: 0 };
        stats.hourlyData[currentHour].total++;
        if(isWin || isJackpot) stats.hourlyData[currentHour].wins++;

        const bets = getDynamicBet(currentPrediction.level, walletBalance);
        let chanceIcon = currentPrediction.chance >= 80 ? "🔥" : (currentPrediction.chance >= 65 ? "⚡" : "⚠️");
        
        // 🟢 एडिट मैसेज में % को सुरक्षित रखा गया है
        const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}/3\n━━━━━━━━━━━━━━━━━━━━━━━\n${chanceIcon} <b>WIN CHANCE:-   ${currentPrediction.chance}%</b>\n━━━━━━━━━━━━━━━━━━━━━━━`;
        
        try { await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (err) {}

        if (isWin || isJackpot) {
            stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
            stats.wins++;
            
            if(isJackpot) {
                stats.jackpots++;
                consecutiveJackpots++;
                if (currentPrediction.level === 3) { setTimeout(() => { bot.sendMessage(CHANNEL_CHAT_ID, `🔥 <b>Level 3 पर सीधा जैकपॉट!</b> 🔥\nसारा लॉस कवर! इसे कहते हैं स्नाइपर शॉट! 💸`, { parse_mode: 'HTML' }).catch(()=>{}); }, 2000); }
            } else {
                consecutiveJackpots = 0; 
                if (currentPrediction.level === 3) { bot.sendMessage(CHANNEL_CHAT_ID, `🔥 <b>LEVEL 3 CLEAR!</b> 🔥\nखतरनाक मार्केट में भी प्रॉफिट पक्का!`, { parse_mode: 'HTML' }).catch(()=>{}); }
            }
            botLevel = 1; 
            bot.sendSticker(CHANNEL_CHAT_ID, isJackpot ? STICKER_JACKPOT : STICKER_WIN).catch(()=>{});
        } else {
            stats.losses++;
            consecutiveJackpots = 0; 
            
            if (botLevel >= 3) {
                bot.sendMessage(CHANNEL_CHAT_ID, `⚠️ <b>STOP LOSS HIT (Level 3)</b> ⚠️\nमार्केट का ट्रेंड अचानक बदल गया। फंड को ज़ीरो होने से बचाने के लिए, बोट अब वापस <b>Level 1</b> से दांव शुरू करेगा।`, { parse_mode: 'HTML' }).catch(()=>{});
                botLevel = 1; 
            } else {
                botLevel++; 
                bot.sendSticker(CHANNEL_CHAT_ID, STICKER_LOSS).catch(()=>{});
            }
        }
        if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
    }
    const nextId = (BigInt(latestId) + 1n).toString();
    generatePrediction(nextId);
}

// ==========================================
// 📊 AUTO DAILY REPORT & MIDNIGHT PIN MESSAGE
// ==========================================
setInterval(() => {
    const now = getISTTime();
    
    // 1. 23:55 (रात 11:55) - Daily Report
    if (now.getHours() === 23 && now.getMinutes() === 55 && !dailyReportSent) {
        let levelTrackerText = "";
        Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
        const reportMsg = `📋 <b>TODAY'S 3-LEVEL SNIPER REPORT</b> 📋\n\n🔥 <b>Total Signals:</b> ${stats.total}\n🎯 <b>JACKPOTS:</b> ${stats.jackpots} 🤑\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Highest Level:</b> L${stats.maxLevelReached}/3\n\n🏆 <b>LEVEL CLEARANCE DETAILS:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "आज कोई डेटा नहीं है।"}\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ <i>कल मिलते हैं! गुड नाईट! 🌙</i>`;
        bot.sendMessage(CHANNEL_CHAT_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});
        dailyReportSent = true;
    }

    // 2. 00:00 (रात 12:00 बजे) - GOLDEN HOUR PIN MESSAGE
    if (now.getHours() === 0 && now.getMinutes() === 0 && !midnightPinSent) {
        let bestHour = -1; let bestWinRate = -1;
        
        // 24 घंटे का डेटा एनालाइज करो
        for(let h=0; h<24; h++) {
            if(stats.hourlyData[h] && stats.hourlyData[h].total >= 10) { // कम से कम 10 दांव लगे हों
                let rate = stats.hourlyData[h].wins / stats.hourlyData[h].total;
                if(rate > bestWinRate) { bestWinRate = rate; bestHour = h; }
            }
        }

        if(bestHour !== -1) {
            let ampm1 = bestHour >= 12 ? 'PM' : 'AM'; let h1 = bestHour % 12 || 12;
            let nextH = (bestHour + 1) % 24;
            let ampm2 = nextH >= 12 ? 'PM' : 'AM'; let h2 = nextH % 12 || 12;
            let timeStr = `${h1}:00 ${ampm1} से ${h2}:00 ${ampm2}`;

            let pinMsg = `🏆 <b>GOLDEN TRADING HOUR</b> 🏆\n\nपिछले 24 घंटे की AI रिसर्च के अनुसार, आज सबसे सुरक्षित दांव लगाने का समय है:\n\n⏰ <b>${timeStr}</b>\n⚡ <b>Win Rate:</b> ${Math.round(bestWinRate*100)}%\n\n<i>बोट 24 घंटे चालू है, लेकिन इस समय पर प्रॉफिट के चांस सबसे ज़्यादा होते हैं! इस समय एक्टिव रहें। 🚀</i>`;
            
            // मैसेज भेजो और पिन करो
            bot.sendMessage(CHANNEL_CHAT_ID, pinMsg, { parse_mode: 'HTML' }).then(sentMsg => {
                bot.pinChatMessage(CHANNEL_CHAT_ID, sentMsg.message_id).catch(()=>{});
            });
        }
        
        // अगले दिन के लिए डेटा रीसेट
        stats.hourlyData = {}; 
        midnightPinSent = true;
    }

    // फ्लैग्स को रीसेट करो
    if (now.getHours() === 0 && now.getMinutes() === 5) {
        dailyReportSent = false;
        midnightPinSent = false;
    }
}, 60000); 

// ==========================================
// 💬 USER COMMANDS
// ==========================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id, userName = msg.from.first_name || "VIP Member"; 
    bot.sendMessage(chatId, `🎉 <b>WELCOME TO THE 3-LEVEL VIP FAMILY, ${userName}!</b> 🎉\n\nहमारा बोट 24 घंटे बिना रुके (Non-Stop) प्रेडिक्शन देता है।\n\n👇 <b>मेन्यू:</b>\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - नया 3X फंड चार्ट`, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/chart/, (msg) => {
    let chartMsg = `📊 <b>NEW 3-LEVEL CUMULATIVE CHART</b> 📊\n💰 <b>Total Wallet Setup:</b> ₹${walletBalance}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    let cumulative = 0;
    for(let i = 1; i <= 3; i++) {
        const bets = getDynamicBet(i, walletBalance);
        cumulative += bets.levelTotal;
        const nBetText = bets.nBet > 0 ? `₹${bets.nBet}, ₹${bets.nBet}` : `₹0 (Low Bal)`;
        chartMsg += `👉 <b>L${i}:</b> B/S: ₹${bets.bBet} | Nums: ${nBetText}\n   └ <i>Total: ₹${bets.levelTotal} | Cum.(जुड़कर): ₹${cumulative}</i>\n`;
    }
    bot.sendMessage(msg.chat.id, chartMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/stats/, (msg) => {
    let levelTrackerText = "";
    Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
    const statsMsg = `📊 <b>LIVE BOT ACCURACY</b> 📊\n\n🔥 <b>Signals:</b> ${stats.total}\n🎯 <b>JACKPOT WINS:</b> ${stats.jackpots} 🤑\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Max Level:</b> L${stats.maxLevelReached}/3\n\n🏆 <b>LEVEL CLEARANCE:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "अभी कोई डेटा नहीं है।"}`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/level\s+(\d+)/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    walletBalance = parseFloat(match[1]);
    bot.sendMessage(msg.chat.id, `✅ <b>ADMIN ACTION:</b> Total 3-Level Wallet = ₹${walletBalance}`, { parse_mode: 'HTML' });
});

setInterval(monitorLoop, 5000);
console.log("🚀 System Booted. Non-Stop Dynamic % Sniper Active...");
