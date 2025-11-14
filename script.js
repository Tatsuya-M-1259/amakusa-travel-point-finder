// --- 旅費地点検索ロジック (コアロジック) ---

/**
 * 町名と地番から旅費地点を特定する
 */
function getTravelPoint(townName, numericHouseNumber) {
    try {
        const cleanInputTown = townName.replace(/町$/, '').trim();

        // 1. データ内で町名を探す (厳格な町名照合ロジック)
        let targetEntry = TRAVEL_POINTS_DATA.find(entry => {
            // 優先度1: 完全一致
            if (entry.town === townName) return true;
            // 優先度2: クリーン名でのマッチ (例: 五和町御領 vs 御領)
            if (entry.town.replace(/町$/, '').trim() === cleanInputTown) return true;
            // 優先度3: 入力町名がデータキーに含まれる (最も柔軟な部分一致)
            if (entry.town.includes(cleanInputTown) && cleanInputTown.length > 1) return true;
            return false;
        });

        // 2. 東浜町などの「東・浄南・太田町以外は本渡」ルールを適用
        if (!targetEntry && !['東町', '浄南町', '太田町'].some(ex => townName.includes(ex))) {
            const catchAllEntry = TRAVEL_POINTS_DATA.find(entry => entry.town === '東・浄南・太田町以外');
            if (catchAllEntry) {
                targetEntry = catchAllEntry;
            }
        }
        
        if (!targetEntry) {
            return `エラー: 入力された町名「${townName}」に該当する旅費データが見つかりません。`;
        }

        // 3. 範囲を順番にチェック (地番境界値の厳格な適用)
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
        
    } catch (e) {
        console.error("検索処理中に致命的なエラーが発生しました:", e);
        return "エラー: 検索ロジック処理中に例外が発生しました。";
    }
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
    
    console.log(`施設: ${facilityName}`);
    console.log(`住所: ${facility.address}`);
    console.log(`パース結果 - 町名: ${addressParts.townName}, 地番: ${addressParts.houseNumber}`);
    
    const numericHouseNum = parseToNumeric(addressParts.houseNumber);
    console.log(`数値化地番: ${numericHouseNum}`);

    const result = getTravelPoint(addressParts.townName, numericHouseNum);
    console.log(`判定結果: ${result}`);
    
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
    
    // 1. 重複を排除したリストを作成 
    const uniqueFacilities = [];
    const seen = new Set();

    FACILITY_DATA.forEach(facility => {
        const key = facility.name + '|' + facility.address;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueFacilities.push(facility);
        }
    });

    // 2. 施設リストを種別コードでソートし、同種別内は名前順でソート
    const sortedFacilities = uniqueFacilities.sort((a, b) => {
        const typeA = getFacilityType(a.name);
        const typeB = getFacilityType(b.name);

        if (typeA !== typeB) {
            return typeA - typeB; 
        }
        return a.name.localeCompare(b.name, 'ja'); 
    });

    // 3. ソート済みリストをドロップリストに追加
    sortedFacilities.forEach(facility => {
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

window.onload = initializeAp
