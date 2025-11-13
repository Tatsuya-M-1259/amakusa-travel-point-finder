// --- ユーティリティ関数 ---

/**
 * 住所文字列から数値化された地番を抽出する (例: "4番15号" -> 4.15, "1470番" -> 1470.0)
 * @param {string} houseNumberStr - 地番文字列
 * @returns {number} - 数値化された地番
 */
function parseToNumeric(houseNumberStr) {
    if (!houseNumberStr) return 0;
    
    // "番地"、"番"、"号"などを取り除く
    let cleanStr = houseNumberStr.replace(/番地|番|号|の/g, '').trim();
    
    // "-" や "の" を小数点 "." に変換 (例: 4-15 -> 4.15)
    cleanStr = cleanStr.replace(/[-]/g, '.');

    // 複数の "." が含まれる場合は最初の "." 以降を無視
    if (cleanStr.indexOf('.') !== cleanStr.lastIndexOf('.')) {
        cleanStr = cleanStr.substring(0, cleanStr.indexOf('.', cleanStr.indexOf('.') + 1));
    }
    
    // 文字列末尾が"."で終わる場合（例: "5."）に対応
    if (cleanStr.endsWith('.')) {
        cleanStr = cleanStr.substring(0, cleanStr.length - 1);
    }
    
    return parseFloat(cleanStr);
}

/**
 * 住所文字列から町名と地番を抽出する (簡易版)
 * @param {string} fullAddress - 完全な住所文字列 (例: "天草市浄南町４番１５号")
 * @returns {{townName: string, houseNumber: string}}
 */
function parseAddress(fullAddress) {
    const parts = fullAddress.split('天草市');
    if (parts.length < 2) return { townName: "", houseNumber: "" };
    
    const address = parts[1].trim();
    
    // 町名と地番を分けるための正規表現 (数字、ハイフン、番、号などが地番と仮定)
    const match = address.match(/^(.+?)([0-9０-９]+.*)$/);
    
    if (match && match[1] && match[2]) {
        // match[1]: 町名 (例: 浄南町)
        // match[2]: 地番部分 (例: ４番１５号)
        return { 
            townName: match[1].trim(), 
            houseNumber: match[2].trim() 
        };
    } else {
        // 地番が見つからない、または例外的な形式の場合 (例: 東町)
        return { 
            townName: address, 
            houseNumber: "" 
        };
    }
}


// --- 旅費地点検索ロジック ---

/**
 * 町名と地番から旅費地点を特定する
 * @param {string} townName - 町名 (例: "浄南町")
 * @param {number} numericHouseNumber - 数値地番 (例: 4.15)
 * @returns {string} - 旅費地点またはエラーメッセージ
 */
function getTravelPoint(townName, numericHouseNumber) {
    // 1. データ内で町名を探す
    // 完全一致 or TOWN_POINTS_DATAの町名が入力された町名に含まれるか (例: 入力「食場」-> データ「亀場町食場」)
    let targetEntry = TRAVEL_POINTS_DATA.find(entry => entry.town === townName);

    if (!targetEntry) {
        // より広い範囲での部分一致を試みる (例: 入力「食場」に対して「亀場町食場」を見つける)
        targetEntry = TRAVEL_POINTS_DATA.find(entry => entry.town.includes(townName) && entry.town.length > townName.length);
    }

    // 東町, 浄南町, 太田町の「その他」判定をカバー
    if (!targetEntry && (townName.includes('東町') || townName.includes('浄南町') || townName.includes('太田町'))) {
        targetEntry = TRAVEL_POINTS_DATA.find(entry => entry.town === '東・浄南・太田町以外');
    }

    if (!targetEntry) {
        return "エラー: 入力された町名に該当する旅費データが見つかりません。";
    }

    // 2. 範囲を順番にチェック
    for (let i = 0; i < targetEntry.ranges.length; i++) {
        const range = targetEntry.ranges[i];
        const rangeStart = range.start;
        const rangeEnd = range.end;

        // 【改訂ロジック適用】
        // (1) 開始地番以上 (>=)
        // (2) 終了地番未満 (<) - 境界値は次の範囲に優先権があるため

        if (numericHouseNumber >= rangeStart && numericHouseNumber < rangeEnd) {
            return range.location;
        }

        // 境界値の厳密処理: 地番が rangeEnd と完全に一致する場合
        if (numericHouseNumber === rangeEnd) {
            const nextRange = targetEntry.ranges[i + 1];
            
            // 次の範囲があり、かつその開始地番と一致する場合（境界値優先ルール）
            if (nextRange && numericHouseNumber === nextRange.start) {
                // 次の範囲が優先されるため、ここでは処理せず次のループへ（continue）
                continue; 
            } else {
                // 境界値が最後の範囲の end に一致するか、次の範囲が始まらない場合
                return range.location;
            }
        }
    }
    
    // 全ての範囲をチェックしても見つからない場合
    return "エラー: 入力された地番の範囲を特定できませんでした。";
}


// --- UI操作関数 ---

function displayResult(input, point, isAmbiguous) {
    const resultArea = document.getElementById('result-area');
    const inputDisplay = document.getElementById('search-input-display');
    const pointDisplay = document.getElementById('travel-point-display');
    const noteDisplay = document.getElementById('note-display');

    inputDisplay.textContent = `検索対象: ${input}`;
    pointDisplay.textContent = point;
    
    if (point.startsWith("エラー:")) {
        resultArea.style.borderColor = '#dc3545'; // エラー色
        resultArea.style.backgroundColor = '#f8d7da';
        noteDisplay.textContent = "※ 地点特定に失敗しました。入力内容を確認するか、市役所にご確認ください。";
        return;
    }

    resultArea.style.borderColor = isAmbiguous ? '#ffc107' : '#28a745'; 
    
    if (isAmbiguous) {
        noteDisplay.textContent = "※「or」を含む結果は、旅費規定の運用に基づき、いずれかの地点を適用してください。システム側で単一に限定することはできません。";
        resultArea.style.backgroundColor = '#fff3cd'; // 警告色
    } else {
        noteDisplay.textContent = "※ 特定された地点が旅費算定の基準となります。";
        resultArea.style.backgroundColor = '#e9f7ff'; // 通常色
    }
}

function searchByAddress() {
    const town = document.getElementById('town-name').value.trim();
    const houseNumStr = document.getElementById('house-number').value.trim();
    
    if (!town || !houseNumStr) {
        alert("町名と地番を入力してください。");
        return;
    }
    
    const numericHouseNum = parseToNumeric(houseNumStr);
    const result = getTravelPoint(town, numericHouseNum);
    
    const inputStr = `住所: ${town} ${houseNumStr}`;
    const isAmbiguous = result.includes("or") || result.includes("OR");
    
    displayResult(inputStr, result, isAmbiguous);
}

function searchByFacility() {
    const selectElement = document.getElementById('facility-select');
    const facilityName = selectElement.value;
    
    if (!facilityName) {
        alert("施設を選択してください。");
        return;
    }
    
    const facility = FACILITY_DATA.find(f => f.name === facilityName);
    const addressParts = parseAddress(facility.address);
    
    const numericHouseNum = parseToNumeric(addressParts.houseNumber);
    const result = getTravelPoint(addressParts.townName, numericHouseNum);
    
    const inputStr = `施設名: ${facilityName} (${facility.address})`;
    const isAmbiguous = result.includes("or") || result.includes("OR");

    displayResult(inputStr, result, isAmbiguous);
}

// --- 初期化 ---

function initializeApp() {
    // 施設選択ドロップダウンにオプションを追加
    const select = document.getElementById('facility-select');
    FACILITY_DATA.forEach(facility => {
        const option = document.createElement('option');
        option.value = facility.name;
        option.textContent = facility.name;
        select.appendChild(option);
    });

    // 検索モード切り替え
    const modeAddressBtn = document.getElementById('mode-address');
    const modeFacilityBtn = document.getElementById('mode-facility');
    const formAddress = document.getElementById('address-search-form');
    const formFacility = document.getElementById('facility-search-form');

    modeAddressBtn.addEventListener('click', () => {
        modeAddressBtn.classList.add('active');
        modeFacilityBtn.classList.remove('active');
        formAddress.classList.remove('hidden');
        formFacility.classList.add('hidden');
    });

    modeFacilityBtn.addEventListener('click', () => {
        modeFacilityBtn.classList.add('active');
        modeAddressBtn.classList.remove('active');
        formFacility.classList.remove('hidden');
        formAddress.classList.add('hidden');
    });
}

window.onload = initializeApp;
