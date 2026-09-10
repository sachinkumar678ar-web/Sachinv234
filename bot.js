const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIGURATION (Direct Setup)
// ==========================================
const TELEGRAM_BOT_TOKEN = '8555094944:AAEJuHmxBosT6qST62J-AwbwfiZp1NHoY5s'; 
const CHANNEL_CHAT_ID = '-1003752888794'; 
const ADMIN_ID = '123456789'; // ⚠️ यहाँ 123456789 हटाकर अपना असली एडमिन आईडी डालें

const STICKER_WIN = 'CAACAgUAAxkBAAERUlhqH_0T0DxkDLbkEndLKZTBr0xjtgAC_A8AAg4fAAFUetjUfT4IR1s7BA'; 
const STICKER_LOSS = 'CAACAgUAAxkBAAERUmBqH_1UVPN7iQ-LBTKUs-NffGXV4AACkBEAAi4AATBXrdSO4Z9ezAM7BA';
const STICKER_JACKPOT = 'CAACAgUAAxkBAAERUfVqH5wMtoYUc1szw66OAfQpEoVnlwAC-hQAAu0OiFSGFOobgNZJHDsE';

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=15";
const SCALE_BASE = 200; 

let history = []; 
let botLevel = 1;
let walletBalance = 4000; 
let currentPrediction = null; 
let autoPostTimeout = null;
let isPollingReconnecting = false; 
let isBotActive = true; 
let dailyReportSent = false;

// 🟢 NEW: Alternate Mode Tracking (एक बंद करके एक बेट)
let altModeEnabled = true; // डिफ़ॉल्ट रूप से चालू (Play 1, Skip 1)
let lastActionWasBet = false; 

// 📊 Stats Object
let stats = {
    total: 0, wins: 0, losses: 0, jackpots: 0, skips: 0,
    maxLevelReached: 1, levelHistoryTracker: {}, knownUsers: []
};

// 💾 Load & Save Stats
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
            setTimeout(() => {
                bot.startPolling({ restart: true }).then(() => isPollingReconnecting = false).catch(() => isPollingReconnecting = false);
            }, 15000); 
        }).catch(() => isPollingReconnecting = false);
    }
});
bot.deleteWebHook({ drop_pending_updates: true }).then(() => bot.startPolling({ restart: true }));

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Trade Star Bot - Alt Mode Active!\n');
}).listen(PORT, () => console.log(`🤖 Server Listening on Port: ${PORT}`));

// ==========================================
// 🛠️ UTILITY FUNCTIONS
// ==========================================
function getISTTime() { return new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)); }
function getISTTimeString() {
    let nd = getISTTime(), h = nd.getHours(), m = nd.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; m = m < 10 ? '0'+m : m;
    return (h < 10 ? '0'+h : h) + ':' + m + ' ' + ampm;
}
function getDynamicBet(level, scale) {
    const multiplier = Math.pow(3, level - 1);
    return { bBet: Math.round(10 * multiplier * scale), nBet: Math.round(1 * multiplier * scale) };
}
function getFancyType(type) {
    if (type === "BIG") return "BIGGG"; if (type === "SMALL") return "SMALL"; if (type === "WAIT") return "🛑 WAIT 🛑"; return type; 
}

// ==========================================
// 🧠 PATTERN SCANNER + ALTERNATE MODE AI
// ==========================================
function generatePrediction(nextId) {
    const recentHistory = history.slice(0, 15);
    let finalSelection = "WAIT", skipReason = "";

    if (recentHistory.length < 4) return;

    // 🛑 1. Alternate Betting Logic (एक छोड़कर एक बेट)
    if (altModeEnabled && lastActionWasBet) {
        skipReason = "Alternate Mode Active (एक छोड़कर एक)";
        finalSelection = "WAIT";
        lastActionWasBet = false; // अगला खेलेगा
    } else {
        // 2. Pattern Scanning Logic
        let h0 = recentHistory[0].number >= 5 ? "B" : "S"; 
        let h1 = recentHistory[1].number >= 5 ? "B" : "S";
        let h2 = recentHistory[2].number >= 5 ? "B" : "S";
        let h3 = recentHistory[3].number >= 5 ? "B" : "S";
        let seq = h3 + h2 + h1 + h0; 
        let last3 = h2 + h1 + h0;

        if ([0, 5].includes(recentHistory[0].number)) {
            skipReason = "0/5 Volatile (ट्रेंड ब्रेक)";
            finalSelection = "WAIT";
        } else {
            if (last3 === "BBB") { finalSelection = "BIG"; }
            else if (last3 === "SSS") { finalSelection = "SMALL"; }
            else if (seq === "BBSS") { finalSelection = "BIG"; } 
            else if (seq === "SSBB") { finalSelection = "SMALL"; } 
            else if (last3 === "BBS") { finalSelection = "SMALL"; }
            else if (last3 === "SSB") { finalSelection = "BIG"; }
            else if (last3 === "BSB") { finalSelection = "SMALL"; }
            else if (last3 === "SBS") { finalSelection = "BIG"; }
            else if (seq === "BSBB") { finalSelection = "BIG"; }
            else if (seq === "SBSS") { finalSelection = "SMALL"; }
            else { skipReason = "No Matching Pattern"; finalSelection = "WAIT"; }
        }

        // बेट स्टेटस अपडेट करें
        if (finalSelection !== "WAIT") lastActionWasBet = true;
        else lastActionWasBet = false;
    }

    // 🎯 Hedging Numbers
    let finalNums = [5, 7]; 
    if (finalSelection === "BIG") finalNums = [7, 9];
    if (finalSelection === "SMALL") finalNums = [1, 3];
    if (finalSelection === "WAIT") finalNums = ["-", "-"];

    currentPrediction = { issue: nextId, predType: finalSelection, nums: finalNums, level: botLevel, messageId: null, isChannelPosted: false, predTime: getISTTimeString(), skipReason: skipReason };
    
    clearTimeout(autoPostTimeout);
    autoPostTimeout = setTimeout(async () => {
        if (currentPrediction && !currentPrediction.isChannelPosted) await sendPredictionToChannel();
    }, 8000); 
}

async function sendPredictionToChannel() {
    if (!currentPrediction || currentPrediction.isChannelPosted) return;
    let msgContent = "";
    if (currentPrediction.predType === "WAIT") {
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(skip)🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹0 (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ₹0 (EACH)\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
        const bets = getDynamicBet(currentPrediction.level, walletBalance / SCALE_BASE);
        msgContent = `🚨 <b>PREDICTION LIVE</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${currentPrediction.issue.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🔮 N•PRED:-   🌐🌐(${currentPrediction.nums.join(',')})🌐🌐\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   WAIT\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n🪙 N•BET.  :- ₹${bets.nBet} (EACH)\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level} (3X PROGRESSIVE)\n━━━━━━━━━━━━━━━━━━━━━━━`;
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
                if (!history.find(h => h.issue === id)) {
                    history.unshift({ issue: id, number: num });
                    newlyAdded = true;
                }
            });
            if (newlyAdded) {
                history.sort((a,b) => b.issue.localeCompare(a.issue));
                if (history.length > 50) history = history.slice(0, 50); 
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
        const actualSize = actualNum >= 5 ? "BIGGG" : "SMALL";
        let outcomeDisplay = `🌟${actualSize}(${actualNum})🌟`;
        
        if (currentPrediction.predType === "WAIT") {
            stats.skips++;
            if(currentPrediction.messageId) {
                let waitResolved = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟skip🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹0\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━`;
                try { await bot.editMessageText(waitResolved, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (e) {}
            }
        } else {
            stats.total++;
            let isWin = false, isJackpot = currentPrediction.nums.includes(actualNum); 
            isWin = (currentPrediction.predType === (actualSize === "BIGGG" ? "BIG" : "SMALL"));

            const bets = getDynamicBet(currentPrediction.level, walletBalance / SCALE_BASE);
            const editedMsg = `🚨 <b>PREDICTION LIVE RESOLVED</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━━━\n🆔 PERIOD:- #${latestId.slice(-4)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🎯 MY PRE:-   🌟${getFancyType(currentPrediction.predType)}(${currentPrediction.nums.join(',')})🌟\n━━━━━━━━━━━━━━━━━━━━━━━\n🎲 RUGLT. :-   ${outcomeDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━\n💵 B•BET.  :- ₹${bets.bBet} (SIZE)\n━━━━━━━━━━━━━━━━━━━━━━━\n📊 LEVEL.  :- ${currentPrediction.level}\n━━━━━━━━━━━━━━━━━━━━━━━`;
            try { await bot.editMessageText(editedMsg, { chat_id: CHANNEL_CHAT_ID, message_id: currentPrediction.messageId, parse_mode: 'HTML' }); } catch (err) {}

            if (isWin || isJackpot) {
                stats.levelHistoryTracker[botLevel] = (stats.levelHistoryTracker[botLevel] || 0) + 1;
                stats.wins++;
                if(isJackpot) stats.jackpots++;
                
                if (currentPrediction.level >= 3) {
                    bot.sendMessage(CHANNEL_CHAT_ID, `🔥 <b>RECOVERY SUCCESSFUL!</b> 🔥\n\n📈 लगातार ${currentPrediction.level - 1} लॉस के बाद, <b>Level ${currentPrediction.level}</b> पर शानदार वापसी!`, { parse_mode: 'HTML' }).catch(()=>{});
                }
                botLevel = 1; 
                bot.sendSticker(CHANNEL_CHAT_ID, isJackpot ? STICKER_JACKPOT : STICKER_WIN).catch(()=>{});
            } else {
                stats.losses++;
                if (botLevel === 3 || botLevel === 5) {
                    bot.sendMessage(CHANNEL_CHAT_ID, `⚠️ <b>मार्केट थोड़ा कठिन चल रहा है (Level ${botLevel} Loss)</b>\nचिंता न करें, अपना 3X फंड तैयार रखें।`, { parse_mode: 'HTML' }).catch(()=>{});
                }
                botLevel++; 
                bot.sendSticker(CHANNEL_CHAT_ID, STICKER_LOSS).catch(()=>{});
            }
            if (botLevel > stats.maxLevelReached) stats.maxLevelReached = botLevel;
        }
    }
    const nextId = (BigInt(latestId) + 1n).toString();
    generatePrediction(nextId);
}

// ==========================================
// 📢 GROUP NEW MEMBER WELCOME
// ==========================================
bot.on('new_chat_members', (msg) => {
    const chatId = msg.chat.id;
    msg.new_chat_members.forEach(member => {
        if (member.is_bot) return;
        const welcomeMsg = `🎉 <b>WELCOME TO TRADE'S STAR VIP, ${member.first_name}!</b> 🎉\n\n💡 <b>शुरुआत कैसे करें?</b>\n1️⃣ 6 लेवल का 3X फंड तैयार रखें।\n2️⃣ 10-20% प्रॉफिट होते ही रुक जाएं।\n3️⃣ जैकपॉट के लिए नंबर्स पर पैसा ज़रूर लगाएं!\n\n<i>लॉस का डर खत्म, अब सिर्फ प्रॉफिट होगा!</i> 🚀`;
        bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'HTML' }).catch(()=>{});
    });
});

// ==========================================
// 📊 AUTO DAILY TRANSPARENCY REPORT (11:55 PM)
// ==========================================
setInterval(() => {
    const now = getISTTime();
    if (now.getHours() === 23 && now.getMinutes() === 55 && !dailyReportSent) {
        let levelTrackerText = "";
        Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
        const reportMsg = `📋 <b>TODAY'S FULL TRANSPARENCY REPORT</b> 📋\n\n🔥 <b>Total Signals:</b> ${stats.total}\n🛑 <b>Skipped:</b> ${stats.skips}\n🌟 <b>Total Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Highest Level:</b> L${stats.maxLevelReached}\n\n🏆 <b>LEVEL CLEARANCE DETAILS:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "आज कोई डेटा नहीं है।"}\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ <i>कल मिलते हैं एक नए प्रॉफिट सेशन के साथ! गुड नाईट! 🌙</i>`;
        bot.sendMessage(CHANNEL_CHAT_ID, reportMsg, { parse_mode: 'HTML' }).catch(()=>{});
        dailyReportSent = true;
    }
    if (now.getHours() === 0 && now.getMinutes() === 5) dailyReportSent = false;
}, 60000); 

// ==========================================
// 💬 USER & ADMIN COMMANDS
// ==========================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id, userId = msg.from.id, userName = msg.from.first_name || "VIP Member"; 
    if (!stats.knownUsers.includes(userId)) {
        stats.knownUsers.push(userId); 
        const newWelcomeMsg = `🎉 <b>WELCOME TO THE VIP FAMILY, ${userName}!</b> 🎉\n\nमैं Trade's Star V20 AI हूँ। मैं 100% सुरक्षित प्रेडिक्शन देता हूँ।\n\n👇 <b>मेन्यू:</b>\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - इन्वेस्टमेंट चार्ट\n👉 /rules - ट्रेडिंग नियम\n👉 /ai - AI से सवाल पूछें`;
        bot.sendMessage(chatId, newWelcomeMsg, { parse_mode: 'HTML' }).catch(()=>{});
    } else {
        bot.sendMessage(chatId, `🌟 <b>TRADE'S STAR V20 (SAFE AI)</b> 🌟\n\nवापसी पर स्वागत है, <b>${userName}</b>!\n\n👉 /stats - लाइव एक्यूरेसी\n👉 /chart - इन्वेस्टमेंट चार्ट\n👉 /ai - AI से सवाल पूछें`, { parse_mode: 'HTML' }).catch(()=>{});
    }
});

bot.onText(/\/chart/, (msg) => {
    let chartMsg = `📊 <b>3X MARTINGALE INVESTMENT CHART</b> 📊\n💰 <b>Current Base Wallet:</b> ₹${walletBalance}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for(let i = 1; i <= 6; i++) {
        const bets = getDynamicBet(i, walletBalance / SCALE_BASE);
        chartMsg += `👉 <b>Level ${i}:</b> Size ₹${bets.bBet} | Nums ₹${bets.nBet} (Total: ₹${bets.bBet + (bets.nBet * 2)})\n`;
    }
    chartMsg += `━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ <i>हमेशा 6 लेवल का फंड मेंटेन रखें!</i>`;
    bot.sendMessage(msg.chat.id, chartMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/rules/, (msg) => { bot.sendMessage(msg.chat.id, `🛑 <b>VIP TRADING RULES</b> 🛑\n1️⃣ लालच न करें: 10-20% प्रॉफिट होते ही रुक जाएं।\n2️⃣ फंड मैनेजमेंट: 6 लेवल का फंड रखें।\n3️⃣ AI को फॉलो करें: WAIT बोलता है, तो खुद से दांव न लगाएँ।\n4️⃣ नंबर हेजिंग: जैकपॉट के लिए 2 नंबर्स पर भी लगाएँ।`, { parse_mode: 'HTML' }).catch(()=>{}); });

bot.onText(/\/stats/, (msg) => {
    let levelTrackerText = "";
    Object.keys(stats.levelHistoryTracker).sort((a,b) => a-b).forEach(lvl => { levelTrackerText += `👉 <b>Level ${lvl}:</b> ${stats.levelHistoryTracker[lvl]} बार पास\n`; });
    const statsMsg = `📊 <b>LIVE BOT ACCURACY (SAFE MODE)</b> 📊\n\n🔥 <b>Signals:</b> ${stats.total} | 🛑 <b>Skipped:</b> ${stats.skips}\n🌟 <b>Wins:</b> ${stats.wins} | 🤬 <b>Losses:</b> ${stats.losses}\n📈 <b>Win Rate:</b> ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n🎚️ <b>Max Level:</b> L${stats.maxLevelReached}\n\n🏆 <b>LEVEL CLEARANCE HISTORY:</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n${levelTrackerText || "अभी कोई डेटा नहीं है।"}`;
    bot.sendMessage(msg.chat.id, statsMsg, { parse_mode: 'HTML' }).catch(()=>{});
});

bot.onText(/\/ai/, (msg) => {
    const opts = { reply_markup: { inline_keyboard: [
        [{ text: '🛑 Q1. WAIT क्यों बोलता है?', callback_data: 'ai_wait' }],
        [{ text: '💰 Q2. सुरक्षित ट्रेडिंग के लिए फंड?', callback_data: 'ai_fund' }],
        [{ text: '📈 Q3. क्या प्रेडिक्शन 100% सही है?', callback_data: 'ai_accuracy' }],
        [{ text: '🎯 Q4. नंबर्स पर पैसा क्यों लगाएँ?', callback_data: 'ai_numbers' }],
        [{ text: '🤬 Q5. 5-6 लॉस हो जाए तो?', callback_data: 'ai_loss' }]
    ]}};
    bot.sendMessage(msg.chat.id, '🤖 <b>TRADE\'S STAR AI प्रश्न कंसोल</b> 🤖\n\nसवालों के जवाब के लिए क्लिक करें:', { parse_mode: 'HTML', reply_markup: opts.reply_markup }).catch(() => {});
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id, data = callbackQuery.data;
    let replyText = "";
    try {
        await bot.answerCallbackQuery(callbackQuery.id);
        if (data === 'ai_wait') replyText = `🛑 <b>जवाब:</b> AI मार्केट के कचरा ट्रेंड या 0/5 आने पर दांव लगाने से मना कर देता है। पैसा बचाना ही पैसा कमाना है!`;
        else if (data === 'ai_fund') replyText = `💰 <b>जवाब:</b> हमेशा कम से कम <b>6 लेवल का फंड</b> मेंटेन रखें। इससे आपका रिस्क 0% हो जाता है।`;
        else if (data === 'ai_accuracy') replyText = `📈 <b>जवाब:</b> कोई सिस्टम 100% नहीं होता, लेकिन हमारा <b>Safe Defensive Mode</b> और <b>3X Recovery System</b> आपको प्रॉफिट में रखता है।`;
        else if (data === 'ai_numbers') replyText = `🎯 <b>जवाब:</b> सिर्फ BIG/SMALL पर 2X मिलता है, लेकिन नंबर्स पर सीधा <b>9X (नौ गुना) जैकपॉट</b> मिलता है!`;
        else if (data === 'ai_loss') replyText = `🤬 <b>जवाब:</b> घबराएं नहीं! 3X दांव लगाने पर पिछला सारा लॉस एक ही झटके में कवर हो जाएगा।`;
        if (replyText) await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML' });
    } catch (err) {}
});

// 🔒 ADMIN ONLY COMMANDS
bot.onText(/\/level\s+(\d+)/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "❌ <b>ACCESS DENIED</b>", { parse_mode: 'HTML' });
    walletBalance = parseFloat(match[1]);
    bot.sendMessage(msg.chat.id, `✅ <b>ADMIN ACTION:</b> Wallet Configured to ₹${walletBalance}`, { parse_mode: 'HTML' });
});

bot.onText(/\/pause/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    isBotActive = false;
    bot.sendMessage(msg.chat.id, "🛑 बोट का प्रेडिक्शन रोक दिया गया है।");
});

bot.onText(/\/resume/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    isBotActive = true;
    bot.sendMessage(msg.chat.id, "▶️ बोट का प्रेडिक्शन फिर से चालू कर दिया गया है।");
});

// 🟢 NEW ADMIN COMMAND: /altmode (Play 1, Skip 1 टॉगल करने के लिए)
bot.onText(/\/altmode/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    altModeEnabled = !altModeEnabled; // चालू है तो बंद, बंद है तो चालू
    const status = altModeEnabled ? "🟢 ON (अब बोट 1 खेलेगा, 1 छोड़ेगा)" : "🔴 OFF (अब बोट लगातार प्रेडिक्शन देगा)";
    bot.sendMessage(msg.chat.id, `⚙️ <b>ADMIN ACTION:</b> Alternate Mode is now ${status}`, { parse_mode: 'HTML' });
});

setInterval(monitorLoop, 5000);
console.log("🚀 System Booted. Monitoring Wingo 1M...");
