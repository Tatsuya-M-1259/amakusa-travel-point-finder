// --- ユーティリティ関数 ---

/**
 * 住所文字列から数値化された地番を抽出する
 * @param {string} houseNumberStr - 地番文字列
 * @returns {number} - 数値化された地番
 */
function parseToNumeric(houseNumberStr) {
    if (!houseNumberStr) return 0;
    
    let cleanStr = houseNumberStr.replace(/番地|番|号|の/g, '').trim();
    
    // 全角数字を半角に変換
    cleanStr = cleanStr.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

    // ハイフン(-) や "の" を小数点 "." に変換
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
 * 完全な住所文字列から町名と地番を抽出する
 * @param {string} fullAddress - 完全な住所文字列 (例: "天草市浄南町４番１５号")
 * @returns {{townName: string, houseNumber: string}}
 */
function parseAddress(fullAddress) {
    const parts = fullAddress.split('天草市');
    if (parts.length < 2) return { townName: "", houseNumber: "" };
    
    const address = parts[1].trim();
    
    const match = address.match(/^(.+?)([0-9０-９]+.*)$/);
    
    if (match && match[1] && match[2]) {
        return { 
            townName: match[1].trim(), 
            houseNumber: match[2].trim() 
        };
    } else {
        return { 
            townName: address.trim(), 
            houseNumber: "" 
        };
    }
}


// --- 旅費地点検索ロジック ---

/**
 * 町名と地番から旅費地点を特定する
 * @param {string} townName - 町名 (例: "御所浦町御所浦")
 * @param {number} numericHouseNumber - 数値地番 (例: 2895.14)
 * @returns {string} - 旅費地点またはエラーメッセージ
 */
function getTravelPoint(townName, numericHouseNumber) {
    const cleanInputTown = townName.replace(/町$/, '').trim();

    // 1. データ内で町名を探す (柔軟な照合)
    let targetEntry = TRAVEL_POINTS_DATA.find(entry => {
        if (entry.town === townName) return true;
        if (entry.town.replace(/町$/, '').trim() === cleanInputTown) return true;
        if (townName.includes(entry.town) && entry.town.length > 2) return true;
        if (entry.town.includes(cleanInputTown) && cleanInputTown.length > 1) return true;
        return false;
    });

    // 東町, 浄南町, 太田町の「その他」判定をカバー
    if (!targetEntry && (cleanInputTown.includes('東町') || cleanInputTown.includes('浄南町') || cleanInputTown.includes('太田町'))) {
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
        
        // 境界値の優先ルールをチェック
        if (numericHouseNumber === rangeEnd) {
             const nextRange = targetEntry.ranges[i + 1];
             
             // 境界値が次の範囲の開始地番でもある場合、次の範囲（優先される方）に処理を移す
             if (nextRange && numericHouseNumber === nextRange.start) {
                 continue; 
             }
        }

        // 基本の範囲判定: 開始地番以上 (>=) かつ 終了地番未満 (<)
        if (numericHouseNumber >= rangeStart && numericHouseNumber < rangeEnd) {
            return range.location;
        }

        // 終端で完全に一致する場合 (優先ルールで次の範囲に進まなかった境界値の処理)
        if (numericHouseNumber === rangeEnd) {
             return range.location;
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

    const result = getTravelPoint(addressParts.townName, numericHouseNumber);
    
    const inputStr = `施設名: ${facilityName} (${facility.address})`;
    const isAmbiguous = result.includes("or") || result.includes("OR");

    displayResult(inputStr, result, isAmbiguous);
}

// --- 初期化 ---

function getFacilityType(name) {
    if (name.includes('市役所') || name.includes('支所')) return 1; 
    if (name.includes('公民館') || name.includes('コミュニティセンター') || name.includes('交流センター')) return 2; 
    if (name.includes('中学校')) return 3; 
    if (name.includes('小学校')) return 4; 
    if (name.includes('幼稚園')) return 5; 
    if (name.includes('体育館') || name.includes('グラウンド') || name.includes('運動広場') || name.includes('テニスコート') || name.includes('相撲場')) return 6; 
    if (name.includes('図書館') || name.includes('博物館') || name.includes('資料館') || name.includes('アーカイブズ') || name.includes('生涯学習センター') || name.includes('市民センター')) return 7; 
    if (name.includes('給食センター')) return 8; 
    return 9; 
}

function initializeApp() {
    const select = document.getElementById('facility-select');
    
    const sortedFacilities = FACILITY_DATA.sort((a, b) => {
        const typeA = getFacilityType(a.name);
        const typeB = getFacilityType(b.name);

        if (typeA !== typeB) {
            return typeA - typeB; 
        }
        return a.name.localeCompare(b.name, 'ja'); 
    });

    sortedFacilities.forEach(facility => {
        const option = document.createElement('option');
        option.value = facility.name;
        option.textContent = facility.name;
        select.appendChild(option);
    });

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
