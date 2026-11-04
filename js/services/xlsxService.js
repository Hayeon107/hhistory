
const STATION_HEADERS = [
  "no",
  "station_name",
  "biz_no",
  "addr",
  "monitoring",
  "SRP",
  "BLUE",
  "IP",
  "PORT",
  "is_metrix",
  "type",
  "sup_type",
  "con_type",
  "pressure",
];

const HISTORY_HEADERS = [
  "history_id",
  "no",
  "date",
  "category",
  "content",
  "memo",
];

function getXLSX() {
  if (!window.XLSX) {
    throw new Error(
      "엑셀 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.",
    );
  }

  return window.XLSX;
}

function createWorksheet(XLSX, rows, fallbackHeaders) {
  // 기존 데이터에 추가된 속성도 엑셀에 포함한다.
  const headers = [
    ...new Set([
      ...fallbackHeaders,
      ...rows.flatMap((row) => Object.keys(row)),
    ]),
  ];

  return XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });
}

function normalizeRows(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key.trim(),
        value == null ? "" : String(value).trim(),
      ]),
    ),
  );
}

/**
 * 충전소 목록과 이력을 하나의 XLSX 파일로 내보낸다.
 */
export function exportWorkbook(
  { stations = [], history = [] },
  filename = "hydrogen_station_data.xlsx",
) {
  const XLSX = getXLSX();
  const workbook = XLSX.utils.book_new();

  const stationSheet = createWorksheet(
    XLSX,
    stations,
    STATION_HEADERS,
  );

  const historySheet = createWorksheet(
    XLSX,
    history,
    HISTORY_HEADERS,
  );

  XLSX.utils.book_append_sheet(
    workbook,
    stationSheet,
    "Stations",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    historySheet,
    "History",
  );

  XLSX.writeFile(workbook, filename);
}

/**
 * XLSX 파일에서 충전소 목록과 이력을 읽는다.
 * 데이터 저장은 호출하는 app.js에서 처리한다.
 */
export async function importWorkbook(file) {
  const XLSX = getXLSX();

  if (!file || !/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error("엑셀 파일(.xlsx 또는 .xls)을 선택해 주세요.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
  });

  if (
    !workbook.SheetNames.includes("Stations") ||
    !workbook.SheetNames.includes("History")
  ) {
    throw new Error(
      "엑셀 파일에 Stations 시트와 History 시트가 모두 있어야 합니다.",
    );
  }

  const stations = normalizeRows(
    XLSX.utils.sheet_to_json(
      workbook.Sheets.Stations,
      { defval: "", raw: false },
    ),
  );

  const history = normalizeRows(
    XLSX.utils.sheet_to_json(
      workbook.Sheets.History,
      { defval: "", raw: false },
    ),
  );

  if (!stations.some((station) => station.no)) {
    throw new Error("Stations 시트에 충전소 번호(no)가 없습니다.");
  }

  if (
    history.length > 0 &&
    (!("no" in history[0]) || !("content" in history[0]))
  ) {
    throw new Error(
      "History 시트에는 no와 content 컬럼이 필요합니다.",
    );
  }

  return { stations, history };
}
