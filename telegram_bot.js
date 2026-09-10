require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const CHANNEL_CHAT_ID = process.env.CHANNEL_CHAT_ID; 

const STICKER_WIN = 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA'; 
const STICKER_LOSS = 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA';
const STICKER_JACKPOT = 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE';

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=15";
const SCALE_BASE = 200; 

let history = [];
let botLevel = 1;
let walletBalance = 4000; 
let currentPrediction = null; 
let lastUserRequest = {};

let autoPostTimeout = null;
let isPollingReconnecting = false; 

// 🧹 Memory Leak Fix: User session tracking
let userSessions = {};       
let personalRequests = {};   

let periodResults = [];      
let lastPinnedDate = null;   
let pinnedMessageId = null;  

// 📊 Level Tracking & Stats
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0,
    maxLevelReached: 1,
    levelHistoryTracker: {}, 
    currentStreakType: null,
    currentStreakCount: 0,
    currentStreakPeriods: [],
    maxStreakWin: 0, maxStreakWinPeriods: [],
    maxStreakLoss: 0, maxStreakLossPeriods: [],
    maxStreakJackpot: 0, maxStreakJackpotPeriods: []
};

// 🔄 Garbage Collection: Clear inactive users every hour
setInterval(() => {
    const now = Date.now();
    for (const uid in userSessions) {
        if (now - (userSessions[uid].lastActivity || now) > 24 * 60 * 60 * 1000) delete userSessions[uid];
    }
    for (const uid in lastUserRequest) {
        if (now - lastUserRequest[uid] > 60 * 60 * 1000) delete lastUserRequest[uid];
    }
    console.log("🧹 Garbage Collection: Cleared inactive sessions from memory.");
}, 60 * 60 * 1000);

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
    polling: false,
    request: { agentOptions: { family: 4 } }
});

// Self-Healing Polling
bot.on('polling_error', (error) => {
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('409 Conflict') && !isPollingReconnecting) {
        isPollingReconnecting = true;
        console.log("🔄 409 Conflict! Restarting polling safely...");
        bot.stopPolling().then(() => {
            setTimeout(() => {
                bot.startPolling({ restart: true }).then(() => {
                    isPollingReconnecting = false;
                    console.log("🟢 Polling synced successfully.");
                }).catch(() => { isPollingReconnecting = false; });
            }, 15000); 
        }).catch(() => { isPollingReconnecting = false; });
    }
});

bot.deleteWebHook({ drop_pending_updates: true }).then(() => {
    bot.startPolling({ restart: true });
});

// Server & Keep-Alive
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Trade Star Bot Ultra-Safe Mode Active!\n');
});
server.listen(PORT, () => console.log(`🤖 Server Listening on Port: ${PORT}`));

function getISTTime() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5)); 
}

function getISTTimeString() {
    const nd = getISTTime();
    let hours = nd.getHours();
    let minutes = nd.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0'+minutes : minutes;
    return (hours < 10 ? '0'+hours : hours) + ':' + minutes + ' ' + ampm;
}

// ♾️ DYNAMIC BET CALCULATOR (Infinite 3X Martingale)
function getDynamicBet(level, scale) {
    const multiplier = Math.pow(3, level - 1);
    return {
        bBet: Math.round(10 * multiplier * scale),
        nBet: Math.round(1 * multiplier * scale)
    };
}

function getFancyType(type) {
    if (type === "BIG") return "BIGGG";
    if (type === "SMALL") return "SMALL";
    if (type === "WAIT") return "🛑 WAIT 🛑";
    return type; 
}

// ==========================================
// 🧠 ULTRA-SAFE DEFENSIVE AI & PREDICTION LOGIC
// ==========================================
function generatePrediction(nextId) {
    const recentHistory = history.slice(0, 15);
    let finalSelection = "WAIT"; 
    let skipReason = "";

    // 1️⃣ Zig-Zag Checker (कचरा मार्केट)
    let isZigZag = true;
    for (let i = 0; i < 3; i++) {
        if (!recentHistory[i] || !recentHistory[i+1]) break;
        let currentSize = recentHistory[i].number >= 5 ? "BIG" : "SMALL";
        let prevSize = recentHistory[i + 1].number >= 5 ? "BIG" : "SMALL";
        if (currentSize === prevSize) {
            isZigZag = false; 
            break;
        }
    }

    // 2️⃣ 0 या 5 (Volatile Numbers) की पहचान
    let hasZeroOrFive = recentHistory[0] && recentHistory[1] && 
                       ([0, 5].includes(recentHistory[0].number) || [0, 5].includes(recentHistory[1].number));

    // 3️⃣ डिसीजन मेकिंग (Trend Confirmation)
    if (isZigZag) {
        skipReason = "Zig-Zag Market (कचरा मार्केट)";
        finalSelection = "WAIT";
    } else if (hasZeroOrFive) {
        skipReason = "0/5 Volatile Number detected";
        finalSelection = "WAIT";
    } else {
        let lastSize = recentHistory[0].number >= 5 ? "BIG" : "SMALL";
        let secondLastSize = recentHistory[1].number >= 5 ? "BIG" : "SMALL";
        
        if (lastSize === secondLastSize) {
            finalSelection = lastSize;
        } else {
            let lastColor = [1,3,7,9].includes(recentHistory[0].number) ? "GREEN" : ([0,5].includes(recentHistory[0].number) ? "VIOLET" : "RED");
            let secondLastColor = [1,3,7,9].includes(recentHistory[1].number) ? "GREEN" : ([0,5].includes(recentHistory[1].number) ? "VIOLET" : "RED");
            
            if (lastColor !== "VIOLET" && lastColor === secondLastColor) {
                finalSelection = lastColor;
            } else {
                finalSelection = "WAIT";
                skipReason = "No Clear Trend (कोई मज़बूत ट्रेंड नहीं)";
            }
        }
    }

    let finalNums = [5, 7]; 
    if (finalSelection === "BIG") finalNums = [7, 9];
    if (finalSelection === "SMALL") finalNums = [1, 3];
    if (finalSelection === "RED") finalNums = [2, 4];
    if (finalSelection === "GREEN") finalNums = [3, 7];
    if (finalSelection === "WAIT") finalNums = ["-", "-"];

    currentPrediction = {
        issue: nextId,
        predType: finalSelection,
        nums: finalNums,
        level: botLevel,
        messageId: null,
        isChannelPosted: false,
        predTime: getISTTimeString(),
        skipReason: skipReason
    };

    console.log(`🎯 AI Computed: Issue: #${nextId.slice(-4)} -> Type: ${finalSelection} ${finalSelection === "WAIT" ? '('+skipReason+')' : ''}`);

    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) {
            await sendPredictionToChannel();
        }
    }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;

    let msgContent = "";
    if (currentPrediction.predType === "WAIT") {
        msgContent = `🛑 <b>MARKET IS HIGHLY VOLATILE</b> 🛑\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `⚠️ <b>AI MESSAGE:</b> अभी मार्केट बहुत खराब (${currentPrediction.skipReason}) चल रहा है। लॉस से बचने के लिए इस पीरियड में कोई बेट न लगाएँ।\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `⏳ <b>PLEASE WAIT FOR SAFE TREND...</b>`;
    } else {
        const scale = walletBalance / SCALE_BASE;
        const bets = getDynamicBet(currentPrediction.level, scale);

        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🎲 RUGLT. :-   WAIT\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🪙 N•BET.  :- ₹${bets.nBet} (EACH NUMBER)\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `📊 LEVEL.  :- ${currentPrediction.level} (3X PROGRESSIVE)\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    try {
        const sentMessage = await bot.sendMessage(CHANNEL_CHAT_ID, msgContent, { parse_mode: 'HTML' });
        currentPrediction.messageId = sentMessage.message_id;
        currentPrediction.isChannelPosted = true;
    } catch (err) {}
}

async function monitorLoop() {
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
                if (history.length > 1000) history = history.slice(0, 1000); 
                await handleNewOutcome();
            }
        }
    } catch (e) {}
}

async function handleNewOutcome() {
    if (history.length < 15) return;
    const latestOutcome = history[0];
    const latestId = latestOutcome.issue;

    if (currentPrediction && currentPrediction.issue === latestId) {
        const actualNum = latestOutcome.number;
        const actualSize = actualNum >= 5 ? "BIGGG" : "SMALL";
        const actualCol = [1,3,7,9].includes(actualNum) ? "GREEN" : ([0,5].includes(actualNum) ? "VIOLET" : "REDDD");
        
        if (currentPrediction.predType === "WAIT") {
            stats.skips++;
            // WAIT था, इसलिए कोई Win/Loss नहीं, बस मैसेज अपडेट करें
            if(currentPrediction.messageId) {
                let waitResolved = `🛑 <b>PERIOD SKIPPED SUCCESSFULLY</b> 🛑\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n✅ AI ने सही फैसला लिया, रिज़ल्ट: ${actualSize}(${actualNum}) आया।`;
                try { bot.editMessageText(waitResolved, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (e) {}
            }
        } else {
            stats.total++;
            let isWin = false;
            let isJackpot = currentPrediction.nums.includes(actualNum); 
            
            if (["BIG", "SMALL"].includes(currentPrediction.predType)) {
                isWin = (currentPrediction.predType === (actualSize === "BIGGG" ? "BIG" : "SMALL"));
            } else {
                isWin = (currentPrediction.predType === (actualCol === "REDDD" ? "RED" : "GREEN") || actualCol === "VIOLET");
            }

            const scale = walletBalance / SCALE_BASE;
            const bets = getDynamicBet(currentPrediction.level, scale);
            let outcomeDisplay = ["RED", "GREEN"].includes(currentPrediction.predType) ? `🌟${actualCol}(${actualNum})🌟` : `🌟${actualSize}(${actualNum})🌟`;

            const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n` +
                              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                              `🆔 PERIOD:- #${latestId.slice(-4)}\n` +
                              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                              `🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n` +
                              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                              `🎲 RUGLT. :-   ${outcomeDisplay}\n` +
                              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                              `💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n` +
                              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                              `📊 LEVEL.  :- ${currentPrediction.level}\n` +
                              `━━━━━━━━━━━━━━━━━━━━━━━`;

            try { bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (err) {}

            if (isWin || isJackpot) {
                stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
                stats.wins++;
                if(isJackpot) stats.jackpots++;
                botLevel = 1; 
                bot.sendSticker(CHANNEL_CHAT_ID, isJackpot ? STICKER_JACKPOT : STICKER_WIN).catch(()=>{});
            } else {
                stats.losses++;
                botLevel++; // ♾️ Infinite Progression
                bot.sendSticker(CHANNEL_CHAT_ID, STICKER_LOSS).catch(()=>{});
            }

            if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        }
    }

    const nextId = (BigInt(latestId) + 1n).toString();
    generatePrediction(nextId);
}

// User Commands
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `🌟 <b>TRADE'S STAR V20 PRO (ULTRA-SAFE AI)</b> 🌟\n\n👉 /stats - लाइव विन रेट और लेवल हिस्ट्री देखें।\n👉 /level 4000 - वॉलेट सेट करें।`, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/level\s+(\d+)/, (msg, match) => {
    walletBalance = parseFloat(match[1]);
    bot.sendMessage(msg.chat.id, `💰 <b>Wallet Configured:</b> ₹${walletBalance}`, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/stats/, (msg) => {
    let levelTrackerText = "";
    const sortedLevels = Object.keys(stats.levelHistoryTracker).sort((a, b) => Number(a) - Number(b));
    if (sortedLevels.length > 0) {
        sortedLevels.forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
    } else { levelTrackerText = "अभी कोई डेटा नहीं है।"; }

    const statsMsg = `📊 <b>LIVE BOT ACCURACY (SAFE MODE)</b> 📊\n\n` +
                     `🔥 <b>Total Signals:</b> ${stats.total} | 🛑 <b>Skipped (Safe):</b> ${stats.skips}\n` +
                     `🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n` +
                     `📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n` +
                     `🎚️ <b>Max Level Reached:</b> L${stats.maxLevelReached}\n\n` +
                     `🏆 <b>LEVEL CLEARANCE HISTORY:</b>\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `${levelTrackerText}`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

setInterval(monitorLoop, 5000);
console.log("🚀 System Booted. Monitoring Wingo 1M with Ultra-Safe AI...");
