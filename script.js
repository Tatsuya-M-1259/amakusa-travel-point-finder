// --- ユーティリティ関数 ---

/**
 * 住所文字列から数値化された地番を抽出する
 * 修正点: 地番の第1・第2要素のみを考慮し、「整数.小数」形式で数値化するロジックに関するコメントを追加
 */
function parseToNumeric(houseNumberStr) {
    if (!houseNumberStr) return 0;
    
    // 全角数字を半角に変換
    let cleanStr = houseNumberStr.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    
    // 「番地」「番」「号」「の」を統一的にピリオドに変換
    cleanStr = cleanStr.replace(/番地/g, '.');
    cleanStr = cleanStr.replace(/番/g, '.');
    cleanStr = cleanStr.replace(/号/g, '.');
    cleanStr = cleanStr.replace(/の/g, '.');
    
    // ハイフンもピリオドに変換
    cleanStr = cleanStr.replace(/[-ー]/g, '.');
    
    // 複数のピリオドを整理（最初の2つまで残す: 例 1-2-3 → 1.2）
    const parts = cleanStr.split('.').filter(p => p.length > 0);
    if (parts.length >= 2) {
        cleanStr = parts[0] + '.' + parts[1];
    } else if (parts.length === 1) {
        cleanStr = parts[0];
    }
    
    // 修正点: 地番の第1・第2要素のみを考慮し、それを「整数.小数」形式で比較する（旅費規定の慣習による）
    return parseFloat(cleanStr.trim());
}

/**
 * 完全な住所文字列から町名と地番を抽出する
 */
function parseAddress(fullAddress) {
    const parts = fullAddress.split('天草市');
    if (parts.length < 2) return { townName: "", houseNumber: "" };
    
    const address = parts[1].trim();
    
    // 数字（半角/全角）が最初に出現する位置を探す
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


// --- 旅費地点検索ロジック (コアロジック) ---

/**
 * 町名と地番から旅費地点を特定する
 * 修正点: 戻り値にマッチした町名と範囲を含めることで、結果の透明性を向上
 * @returns {{point: string, matchedTown: string, rangeStr: string}}
 */
function getTravelPoint(townName, numericHouseNumber) {
    try {
        const cleanInputTown = townName.replace(/町$/, '').trim();
        let targetEntry = null;

        // 1. データ内で町名を探す (厳格な町名照合ロジック)
        const foundEntry = TRAVEL_POINTS_DATA.find(entry => {
            // 優先度1: 完全一致
            if (entry.town === townName) return true;
            // 優先度2: クリーン名でのマッチ (例: 御領 vs 五和町御領)
            if (entry.town.replace(/町$/, '').trim() === cleanInputTown) return true;
            // 修正点1: 柔軟すぎる部分一致のロジック（優先度3）を削除
            return false;
        });

        if (foundEntry) {
            targetEntry = foundEntry;
        }

        // 2. 東浜町などの「東・浄南・太田町以外は本渡」ルールを適用
        if (!targetEntry && !['東町', '浄南町', '太田町'].some(ex => townName.includes(ex))) {
            const catchAllEntry = TRAVEL_POINTS_DATA.find(entry => entry.town === '東・浄南・太田町以外');
            if (catchAllEntry) {
                targetEntry = catchAllEntry;
            }
        }
        
        if (!targetEntry) {
            return {
                point: `エラー: 入力された町名「${townName}」に該当する旅費データが見つかりません。`,
                matchedTown: "",
                rangeStr: ""
            };
        }

        // 3. 範囲を順番にチェック (地番境界値の厳格な適用)
        // data.jsの定義: start以上、end未満 (start <= x < end)
        for (let i = 0; i < targetEntry.ranges.length; i++) {
            const range = targetEntry.ranges[i];
            const rangeStart = range.start;
            const rangeEnd = range.end;
            
            // 基本の範囲判定: 開始地番以上 (>=) かつ 終了地番未満 (<)
            if (numericHouseNumber >= rangeStart && numericHouseNumber < rangeEnd) {
                const matchedTown = targetEntry.town;
                const rangeStr = `${rangeStart} 以上 ${rangeEnd} 未満`;
                return {
                    point: range.location,
                    matchedTown: matchedTown,
                    rangeStr: rangeStr
                };
            }
        }
        
        return {
            point: "エラー: 入力された地番の範囲を特定できませんでした。",
            matchedTown: targetEntry.town,
            rangeStr: ""
        };
        
    } catch (e) {
        console.error("検索処理中に致命的なエラーが発生しました:", e);
        return {
            point: "エラー: 検索ロジック処理中に例外が発生しました。",
            matchedTown: "",
            rangeStr: ""
        };
    }
}


// --- UI操作関数 ---

/**
 * 検索結果を画面に表示する
 * 修正点: 成功時の文字色を青に変更。適用データと範囲を表示。
 */
function displayResult(input, resultObj, isFacilitySearch) {
    const resultArea = document.getElementById('result-area');
    const inputDisplay = document.getElementById('search-input-display');
    const pointDisplay = document.getElementById('travel-point-display');
    const noteDisplay = document.getElementById('note-display');

    const point = resultObj.point;
    const matchedTown = resultObj.matchedTown;
    const rangeStr = resultObj.rangeStr;

    // 修正点: 施設検索時でもmatchedTownを表示するように修正 (透明性向上のため)
    inputDisplay.innerHTML = `
        検索対象: ${input}
        ${matchedTown ? `<br>適用データ: <strong>天草市${matchedTown}</strong>` : ''}
        ${rangeStr ? `<br>適用範囲: ${rangeStr}` : ''}
    `;

    pointDisplay.textContent = point;
    
    // 修正点3: 結果表示のカラーリングを動的に変更
    pointDisplay.classList.remove('error-point-color', 'success-point-color');

    if (point.startsWith("エラー:")) {
        resultArea.style.borderColor = '#dc3545';
        resultArea.style.backgroundColor = '#f8d7da';
        noteDisplay.textContent = "※ 地点特定に失敗しました。入力内容を確認するか、市役所にご確認ください。";
        pointDisplay.classList.add('error-point-color');
        return;
    }

    const isAmbiguous = point.includes("or") || point.includes("OR");

    resultArea.style.borderColor = isAmbiguous ? '#ffc107' : '#28a745'; 
    
    if (isAmbiguous) {
        noteDisplay.textContent = "※「or」を含む結果は、旅費規定の運用に基づき、いずれかの地点を適用してください。システム側で単一に限定することはできません。";
        resultArea.style.backgroundColor = '#fff3cd';
        pointDisplay.classList.add('success-point-color'); 
    } else {
        noteDisplay.textContent = "※ 特定された地点が旅費算定の基準となります。";
        resultArea.style.backgroundColor = '#e9f7ff';
        pointDisplay.classList.add('success-point-color');
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
    
    displayResult(inputStr, result, false);
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
    
    // 施設検索時は適用データが住所から明確なため、住所検索時とは異なる表示ロジックを適用
    displayResult(inputStr, result, true); 
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
        
        // 修正点4: モード切り替え時のリセット処理（施設検索→住所検索）
        document.getElementById('facility-select').value = "";
    });

    modeFacilityBtn.addEventListener('click', () => {
        modeFacilityBtn.classList.add('active');
        modeAddressBtn.classList.remove('active');
        formFacility.classList.remove('hidden');
        formAddress.classList.add('hidden');
        
        // 修正点4: モード切り替え時のリセット処理（住所検索→施設検索）
        document.getElementById('town-name').value = "";
        document.getElementById('house-number').value = "";
    });
}

window.onload = initializeApp;
