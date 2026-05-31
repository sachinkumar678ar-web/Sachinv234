const TelegramBot = require('node-telegram-bot-api');

// --- SETUP CONFIGURATIONS ---
// BotFather se mila Token yahan paste karein:
const TELEGRAM_BOT_TOKEN = '8555094944:AAEJuHmxBosT6qST62J-AwbwfiZp1NHoY5s'; 
// Aapki customized Channel Chat ID (Configured):
const CHANNEL_CHAT_ID = '-1003752888794'; 

// --- STICKERS FILES IDS (REPLACE WITH YOUR OWN PACK IDS IF WANTED) ---
const STICKER_WIN = 'CAACAgUAAxkBAAERTcRqG9-PZ0KFyAw7wsPpgZDuCzIVqwAC1w8AAvPbqFV1s2OiBxrZcjsE'; // Apne sticker file ID yaha daalein
const STICKER_LOSS = 'CAACAgUAAxkBAAERTcZqG9-jI7AjERzeb9MHjqTtPJlzpwACXBEAAmUfuFV3xxYkqMI8FjsE';
const STICKER_JACKPOT = 'CAACAgUAAxkBAAERTcJqG9-Cy7F9u15glGNz5ovKsoG6DgACuBEAAi-IuFXIfWQ-6-g1TDsE';

const API_ENDPOINT = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=15";

// --- EMBEDDED DATABASES (Sync with Web App) ---
const ONE_DIGIT_MAP = {
    0: [4, 2], 1: [6, 8], 2: [1, 3], 3: [9, 7], 4: [0, 2],
    5: [3, 1], 6: [5, 7], 7: [0, 4], 8: [9, 5], 9: [1, 3]
};

const THREE_DIGIT_STR = "999:8|998:5|997:7|996:7|995:1|994:5|993:2|992:3|991:6|990:7|989:7|988:7|987:6|986:2|985:0|984:7|983:9|982:3|981:6|980:5|979:6|978:8|977:3|976:7|975:2|974:6|973:9|972:6|971:4|970:2|969:5|968:0|967:5|966:5|965:2|964:0|963:2|962:1|961:5|960:0|959:1|958:8|957:5|956:0|955:9|954:6|953:9|952:8|951:4|950:5|949:9|948:5|947:4|946:3|945:4|944:9|943:0|942:6|941:7|940:1|939:4|938:7|937:9|936:4|935:2|934:5|933:0|932:0|931:3|930:8|929:6|928:9|927:2|926:4|925:0|924:9|923:1|922:9|921:8|920:8|919:9|918:9|917:6|916:0|915:0|914:5|913:1|912:9|911:0|910:1|000:7";
const THREE_DIGIT_MAP = {};
THREE_DIGIT_STR.split('|').forEach(pair => {
    const [k, v] = pair.split(':');
    THREE_DIGIT_MAP[parseInt(k.trim())] = parseInt(v.trim());
});

// Bot State memory
let history = [];
let botLevel = 1;
let currentPrediction = null; // Next period state storage
let stats = { wins: 0, losses: 0, jackpots: 0, total: 0 };

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log("🌟 TRADE'S STAR BOT INITIATED SUCCESSFULLY FOR CHANNEL -1003752888794 🌟");

// Listen for /stats command
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    const response = `📊 *CURRENT SYSTEM STATUS* 📊\n\n` +
                     `🔥 *Total Signals:* ${stats.total}\n` +
                     `🌟 *Wins:* ${stats.wins}\n` +
                     `🎇 *Jackpots:* ${stats.jackpots}\n` +
                     `🤬 *Losses:* ${stats.losses}\n` +
                     `📈 *Accuracy:* ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%\n` +
                     `🎚️ *Current Bet Level:* L${botLevel}`;
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
});

// Main loop for Wingo 1M monitoring
async function monitorLoop() {
    try {
        const response = await fetch(API_ENDPOINT);
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
                if (history.length > 100) history = history.slice(0, 100);
                
                await handleNewOutcome();
            }
        }
    } catch (e) {
        console.error("API Fetch Error:", e.message);
    }
}

// Logic analysis & prediction evaluation
async function handleNewOutcome() {
    if (history.length < 15) return;

    const latestOutcome = history[0];
    const latestId = latestOutcome.issue;

    // 1. Process previous period predicted outcomes
    if (currentPrediction && currentPrediction.issue === latestId) {
        const actualNum = latestOutcome.number;
        const actualSize = actualNum >= 5 ? "BIG" : "SMALL";
        const actualCol = [1,3,7,9].includes(actualNum) ? "GREEN" : ([0,5].includes(actualNum) ? "VIOLET" : "RED");
        stats.total++;

        let winMsg = "";
        let isJackpot = currentPrediction.jackpotNums.includes(actualNum);
        
        let matchesPrediction = false;
        if (currentPrediction.predType === "BIG" || currentPrediction.predType === "SMALL") {
            matchesPrediction = (currentPrediction.predType === actualSize);
        } else {
            matchesPrediction = (currentPrediction.predType === actualCol || actualCol === "VIOLET");
        }

        if (isJackpot) {
            stats.jackpots++;
            stats.wins++;
            botLevel = 1;
            winMsg = `🎇 *JACKPOT WINNER OVERKILL!* 🎇\n\n` +
                     `🆔 *Period ID:* #${latestId.slice(-4)}\n` +
                     `🎲 *Result:* ${actualNum} (${actualSize})\n` +
                     `🎯 *Jackpots Target Hit:* ${currentPrediction.jackpotNums.join(', ')}\n\n` +
                     `💸 Status: *JACKPOT SUCCESS (LEVEL ${currentPrediction.level})*`;
            await sendStickerSafe(STICKER_JACKPOT, "🎇");
            await bot.sendMessage(CHANNEL_CHAT_ID, winMsg, { parse_mode: 'Markdown' });
        } else if (matchesPrediction || currentPrediction.nums.includes(actualNum)) {
            stats.wins++;
            botLevel = 1;
            winMsg = `🌟 *WIN SUCCESS IN LEVEL ${currentPrediction.level}!* 🌟\n\n` +
                     `🆔 *Period ID:* #${latestId.slice(-4)}\n` +
                     `🎲 *Result:* ${actualNum} (${actualSize})\n` +
                     `🎯 *Predicted Target:* ${currentPrediction.predType}(${currentPrediction.nums.join(',')})\n\n` +
                     `🟢 Status: *SUCCESS WIN*`;
            await sendStickerSafe(STICKER_WIN, "🌟");
            await bot.sendMessage(CHANNEL_CHAT_ID, winMsg, { parse_mode: 'Markdown' });
        } else {
            stats.losses++;
            botLevel = botLevel >= 5 ? 1 : botLevel + 1; // Strict 5-level Recovery
            winMsg = `🤬 *LOSS ENCOUNTERED* 🤬\n\n` +
                     `🆔 *Period ID:* #${latestId.slice(-4)}\n` +
                     `🎲 *Result:* ${actualNum} (${actualSize})\n` +
                     `🔴 Status: *PROMOTING TO LEVEL ${botLevel}*`;
            await sendStickerSafe(STICKER_LOSS, "🤬");
            await bot.sendMessage(CHANNEL_CHAT_ID, winMsg, { parse_mode: 'Markdown' });
        }
    }

    // 2. Generate Prediction for NEXT upcoming period
    const nextId = (BigInt(latestId) + 1n).toString();
    const P = BigInt(nextId);

    // Box 1 (P - 10)
    let b1Val = history.find(h => h.issue === (P - 10n).toString());
    let b1 = b1Val ? b1Val.number : null;

    // Box 2 & 3 Matching
    const curN = latestOutcome.number;
    let matches = [];
    for (let i = 1; i < history.length; i++) {
        if (history[i].number === curN) {
            if (history[i-1]) matches.push(history[i-1].number);
        }
    }
    let b2 = matches[0] !== undefined ? matches[0] : null;
    let b3 = matches[1] !== undefined ? matches[1] : null;

    // Box 4 Last Digit Mapping (3-Digit lookup)
    const pLast3 = parseInt(nextId.slice(-3));
    let b4 = THREE_DIGIT_MAP[pLast3] !== undefined ? THREE_DIGIT_MAP[pLast3] : 0;

    // Box 5 Mapping (P - 11)
    let b5Val = history.find(h => h.issue === (P - 11n).toString());
    let b5 = b5Val ? b5Val.number : null;

    // Hedging Solver
    let inputs = [b1, b2, b3, b4, b5].filter(v => v !== null);
    let finalSelection = "BIG";
    let finalNums = [2, 4];

    if (inputs.length > 0) {
        let bigCount = 0, smallCount = 0, redCount = 0, greenCount = 0;
        inputs.forEach(n => {
            if (n >= 5) bigCount++; else smallCount++;
            if ([0, 2, 4, 6, 8].includes(n)) redCount++; else greenCount++;
        });

        // Resolve priority
        let isSize = (bigCount === smallCount && redCount === greenCount) || (bigCount === redCount);
        if (isSize) {
            finalSelection = bigCount >= smallCount ? "BIG" : "SMALL";
        } else {
            finalSelection = redCount >= greenCount ? "RED" : "GREEN";
        }

        // Apply strict 2-number opposite hedging rules
        if (bigCount >= smallCount) {
            finalSelection = "BIG";
            finalNums = (redCount >= greenCount) ? [2, 4] : [1, 3]; // BIG + RED -> BIG(2,4) ; BIG + GREEN -> BIG(1,3)
        } else {
            finalSelection = "SMALL";
            finalNums = (redCount >= greenCount) ? [6, 8] : [5, 7, 9]; // SMALL + RED -> SMALL(6,8) ; SMALL + GREEN -> SMALL(5,7,9)
        }
    }

    // Home 4-number Jackpot Compiler
    // Target Box 5 1-digit rule
    const pLast1 = parseInt(nextId.slice(-1));
    let b5Array = ONE_DIGIT_MAP[pLast1] || [4, 2];

    let jackpotSet = new Set([b4, b5Array[0], b5Array[1]]);
    finalNums.forEach(n => {
        if (jackpotSet.size < 4) jackpotSet.add(n);
    });
    let finalJackpotList = Array.from(jackpotSet).slice(0, 4);
    while (finalJackpotList.length < 4) {
        let rNum = Math.floor(Math.random() * 10);
        if (!finalJackpotList.includes(rNum)) finalJackpotList.push(rNum);
    }

    currentPrediction = {
        issue: nextId,
        predType: finalSelection,
        nums: finalNums,
        jackpotNums: finalJackpotList,
        level: botLevel
    };

    // Calculate dynamic betting recommendation scale
    const baseUnit = 10;
    const betMultiplier = Math.pow(2, botLevel - 1); // Progressive scale (1, 2, 4, 8, 16...)
    const betCost = baseUnit * betMultiplier * 4;

    // Post to Telegram Channel -1003752888794
    const nextPredMsg = `🚨 *NEW LIVE PREDICTION RELEASED* 🚨\n\n` +
                        `🆔 *Period ID:* #${nextId.slice(-4)}\n` +
                        `📡 *Trend Target:* ${finalSelection}(${finalNums.join(',')})\n` +
                        `🎯 *Jackpot Numbers (4x):* ${finalJackpotList.join(', ')}\n` +
                        `📊 *Scale Level:* L${botLevel}\n` +
                        `💸 *Recommended Cost:* ₹${betCost}\n\n` +
                        `⚠️ *Rule:* Play safe. Maintain strict 8-level balance!`;
    
    await bot.sendMessage(CHANNEL_CHAT_ID, nextPredMsg, { parse_mode: 'Markdown' });
}

// Safe Sticker dispatcher
async function sendStickerSafe(stickerId, fallbackEmoji) {
    try {
        await bot.sendSticker(CHANNEL_CHAT_ID, stickerId);
    } catch(err) {
        await bot.sendMessage(CHANNEL_CHAT_ID, fallbackEmoji);
    }
}

// Run loop checks every 5 seconds
setInterval(monitorLoop, 5000);
console.log("Monitoring Wingo loop active. Processing updates...");
