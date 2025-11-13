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
    
    // 全角数字を半角に変換
    cleanStr = cleanStr.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

    // ハイフン(-) や "の" を小数点 "." に変換 (例: 4-15 -> 4.15)
    cleanStr = cleanStr.replace(/[-]/g, '.');

    // 複数の "." が含まれる場合は最初の "." 以降を無視
    if (cleanStr.indexOf('.') !== cleanStr.lastIndexOf('.')) {
        cleanStr = cleanStr.substring(0, cleanStr.indexOf('.', cleanStr.indexOf('.') + 1));
    }
    
    if (cleanStr.endsWith('.')) {
        cleanStr = cleanStr.substring(0, cleanStr.length - 1);
    }
    
    return parseFloat(cleanStr);
}

/**
 * 完全な住所文字列から町名と地番を抽出する (精度向上)
 * @param {string} fullAddress - 完全な住所文字列 (例: "天草市浄南町４番１５号")
 * @returns {{townName: string, houseNumber: string}}
 */
function parseAddress(fullAddress) {
    const parts = fullAddress.split('天草市');
    if (parts.length < 2) return { townName: "", houseNumber: "" };
    
    const address = parts[1].trim();
    
    // 住所の末尾から数字、ハイフン、番、号などの地番部分を抽出し、残りを町名とする
    const match = address.match(/^(.+?)([0-9０-９]+.*)$/);
    
    if (match && match[1] && match[2]) {
        return { 
            townName: match[1].trim(), 
            houseNumber: match[2].trim() 
        };
    } else {
        // 地番が見つからない、または例外的な形式の場合
        return { 
            townName: address.trim(), 
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
    // 検索を容易にするため、入力された町名の「町」を削除したクリーンな名前を用意
    const cleanInputTown = townName.replace(/町$/, '').trim();

    // 1. データ内で町名を探す (柔軟な照合)
    let targetEntry = TRAVEL_POINTS_DATA.find(entry => {
        // 1. 完全一致 (例: 浄南町 vs 浄南町)
        if (entry.town === townName) return true;
        
        // 2. 「町」を削除した名前で完全一致 (例: 入力「浄南町」のクリーン名 vs データ「浄南町」)
        if (entry.town.replace(/町$/, '').trim() === cleanInputTown) return true;

        // 3. データ名が入力名に含まれる場合 (例: 入力「本渡町広瀬」はデータ「広瀬」を含む)
        if (townName.includes(entry.town) && entry.town.length > 2) return true;

        // 4. 入力名がデータ名に含まれる場合 (例: 入力「食場」はデータ「亀場町食場」に含まれる)
        if (entry.town.includes(cleanInputTown) && cleanInputTown.length > 1) return true;

        return false;
    });

    // 東町, 浄南町, 太田町の「その他」判定をカバー
    if (!targetEntry && (cleanInputTown === '東町' || cleanInputTown === '浄南町' || cleanInputTown === '太田町')) {
        targetEntry = TRAVEL_POINTS_DATA.find(entry => entry.town === '東・浄南・太田町以外');
    }

    if (!targetEntry) {
        return `エラー: 入力された町名「${townName}」に該当する旅費データが見つかりません。`;
    }

    // 2. 範囲を順番にチェック
    for (let i = 0; i < targetEntry.ranges.length; i++) {
        const range = targetEntry.ranges[i];
        const rangeStart = range.start;
        const rangeEnd = range.end;

        // 地番が範囲内に収まるか: 開始地番以上 (>=) かつ 終了地番未満 (<)
        if (numericHouseNumber >= rangeStart && numericHouseNumber < rangeEnd) {
            return range.location;
        }

        // 境界値の厳密処理: 地番が rangeEnd と完全に一致する場合
        if (numericHouseNumber === rangeEnd) {
            const nextRange = targetEntry.ranges[i + 1];
            
            // 次の範囲が優先される場合 (次の範囲の開始地番でもある)
            if (nextRange && numericHouseNumber === nextRange.start) {
                continue; 
            } else {
                // 境界値が最後の範囲の end に一致、またはデータ不整合の場合、現在の範囲を返す
                return range.location;
            }
        }
    }
    
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
        resultArea.style.borderColor = '#dc3545';
        resultArea.style.backgroundColor = '#f8d7da';
        noteDisplay.textContent = "※ 地点特定に失敗しました。入力内容を確認するか、市役所にご確認ください。";
        return;
    }

    resultArea.style.borderColor = isAmbiguous ? '#ffc107' : '#28a745'; 
    
    if (isAmbiguous) {
        noteDisplay.textContent = "※「or」を含む結果は、旅費規定の運用に基づき、いずれかの地点を適用してください。システム側で単一に限定することはできません。";
        resultArea.style.backgroundColor = '#fff3cd';
    } else {
        noteDisplay.textContent = "※ 特定された地点が旅費算定の基準となります。";
        resultArea.style.backgroundColor = '#e9f7ff';
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
    // 施設名をソートして追加
    FACILITY_DATA.sort((a, b) => a.name.localeCompare(b.name, 'ja')).forEach(facility => {
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
