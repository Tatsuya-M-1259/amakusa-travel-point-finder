// 施設データ (一覧表.rtfから)
const FACILITY_DATA = [
    {"name": "天草市複合施設ここらす", "address": "天草市浄南町４番１５号"},
    {"name": "天草市役所", "address": "天草市東浜町８番１号"},
    {"name": "牛深総合センター", "address": "天草市牛深町１６０番地"},
    // 実際には、全ての施設データをここに追加します。
];

// 旅費地点判定データ (地点目安.csvから、ロジック反映済)
const TRAVEL_POINTS_DATA = [
    // 浄南町 (4番15号 -> 本渡)
    {
      "town": "浄南町",
      "ranges": [
        {"start": 5.0, "end": 99999.0, "location": "本渡or亀場"},
        {"start": 0.0, "end": 5.0, "location": "本渡"}
      ]
    },
    // 本渡町広瀬 (1470番地 -> 佐伊津)
    {
      "town": "本渡町広瀬",
      "ranges": [
        {"start": 1.0, "end": 1470.0, "location": "本渡"},
        {"start": 1470.0, "end": 2080.0, "location": "佐伊津"}, 
        {"start": 2080.0, "end": 99999.0, "location": "本渡"} 
      ]
    },
    // 亀場町食場 (700番 -> 枦宇土)
    {
      "town": "亀場町食場",
      "ranges": [
        {"start": 1.0, "end": 340.0, "location": "枦宇土"},
        {"start": 340.0, "end": 700.0, "location": "亀場"},
        {"start": 700.0, "end": 800.0, "location": "枦宇土"},
        {"start": 800.0, "end": 900.0, "location": "亀場or枦宇土"},
        {"start": 900.0, "end": 1200.0, "location": "亀場"},
        {"start": 1200.0, "end": 99999.0, "location": "枦宇土"}
      ]
    }
    // 実際には、全ての町名・地番データをここに追加します。
];
