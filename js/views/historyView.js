
import { $, escapeHtml, fmtDate, todayISO } from "../utils/helpers.js";

const HISTORY_CATEGORIES = [
  "점검",
  "통신 장애",
  "설비 정비",
  "검사",
  "운영 변경",
  "기타",
];

function historyFor(history, no) {
  return history
    .filter((item) => item.no === no)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function renderTimeline({ history, no }) {
  const query = ($("#detailHistorySearch")?.value || "")
    .trim()
    .toLowerCase();

  const category = $("#detailCategory")?.value || "all";

  const filtered = historyFor(history, no).filter((item) => {
    const matchesCategory =
      category === "all" || item.category === category;

    const searchableText =
      `${item.date} ${item.category} ${item.content} ${item.memo}`
        .toLowerCase();

    return matchesCategory && searchableText.includes(query);
  });

  $("#timeline").innerHTML = filtered.length
    ? filtered
        .map(
          (item) => `
            <div class="timeline-entry">
              <div class="timeline-rail">
                <i class="timeline-dot"></i>
              </div>
              <div>
                <div class="timeline-date">
                  ${fmtDate(item.date)}
                  <span>·</span>
                  ${escapeHtml(item.history_id)}
                </div>
                <div class="timeline-content">
                  ${escapeHtml(item.content)}
                </div>
                <span class="timeline-category">
                  ${escapeHtml(item.category || "기타")}
                </span>
                ${
                  item.memo
                    ? `<div class="timeline-memo">
                         메모 · ${escapeHtml(item.memo)}
                       </div>`
                    : ""
                }
              </div>
            </div>
          `,
        )
        .join("")
    : '<div class="no-results">조건에 맞는 이력이 없습니다.</div>';

  $("#detailHistoryCount").textContent = `${filtered.length}건`;
}

export function renderDetail({
  station,
  history,
  onAddHistory,
  onCopyStation,
  onExportHistory,
  showToast,
}) {
  const pane = $("#detailPane");

  if (!station) {
    pane.innerHTML = `
      <div class="empty-state">
        <div class="empty-illustration">⌖</div>
        <h2>충전소를 선택하세요</h2>
        <p>왼쪽 목록에서 충전소를 선택하면 기본정보와 과거 이력이 표시됩니다.</p>
      </div>
    `;
    return;
  }

  const infoItems = [
    ["업소번호", station.no],
    ["사업자번호", station.biz_no],
    ["모니터링", station.monitoring],
    ["SRP 상태", station.SRP],
    ["BLUE 상태", station.BLUE],
    ["IP 주소", station.IP],
    ["PORT", station.PORT],
    ["메트릭", station.is_metrix],
    ["충전 방식", station.type],
    ["공급 유형", station.sup_type],
    ["운영 유형", station.con_type],
    [
      "충전 압력",
      station.pressure ? `${station.pressure} bar` : "-",
    ],
  ];

  pane.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="station-label">
          STATION PROFILE · ${escapeHtml(station.no)}
        </div>
        <h2>${escapeHtml(station.station_name)}</h2>
        <div class="detail-address">
          ⌖ &nbsp;${escapeHtml(station.addr)}
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-secondary" id="copyStation">복사</button>
        <button class="btn btn-primary" id="detailAdd">
          ＋ 이력 추가
        </button>
      </div>
    </div>

    <div class="section-title">
      <h3>충전소 기본정보</h3>
      <span>등록 정보 기준</span>
    </div>

    <div class="info-grid">
      ${infoItems
        .map(
          ([label, value]) => `
            <div class="info-cell">
              <label>${label}</label>
              <strong>${escapeHtml(value || "-")}</strong>
            </div>
          `,
        )
        .join("")}
    </div>

    <div class="tabs">
      <button class="tab active">과거 이력</button>
      <button class="tab" id="stationExport">이력 내보내기</button>
    </div>

    <div class="section-title">
      <h3>이력 타임라인</h3>
      <span id="detailHistoryCount">0건</span>
    </div>

    <div class="history-tools">
      <label class="search-box">
        <span>⌕</span>
        <input
          id="detailHistorySearch"
          type="search"
          placeholder="이력 내용 검색"
        />
      </label>

      <select id="detailCategory">
        <option value="all">모든 유형</option>
        ${HISTORY_CATEGORIES
          .map((category) => `<option>${category}</option>`)
          .join("")}
      </select>
    </div>

    <div class="timeline" id="timeline"></div>
  `;

  $("#detailAdd").addEventListener("click", () => {
    onAddHistory(station.no);
  });

  $("#copyStation").addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("클립보드를 사용할 수 없습니다.");
      }

      await navigator.clipboard.writeText(
        `${station.station_name}\n${station.addr}\n업소번호: ${station.no}\nIP: ${station.IP || ""}\nPORT: ${station.PORT || ""}`,
      );

      showToast("충전소 정보를 복사했습니다.");
    } catch {
      showToast("복사를 지원하지 않는 환경입니다.");
    }
  });

  $("#stationExport").addEventListener("click", () => {
    onExportHistory(station.no);
  });

  // 새로 렌더링된 검색창에만 이벤트를 등록한다.
  $("#detailHistorySearch").addEventListener("input", () => {
    renderTimeline({ history, no: station.no });
  });

  $("#detailCategory").addEventListener("change", () => {
    renderTimeline({ history, no: station.no });
  });

  renderTimeline({ history, no: station.no });
}

export function renderAllHistory({
  history,
  stations,
  onSelectStation,
}) {
  const query = $("#historySearch").value.trim().toLowerCase();

  const stationByNo = (no) =>
    stations.find((station) => station.no === no);

  const rows = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((item) => {
      const station = stationByNo(item.no);

      const text = `
        ${item.date}
        ${item.category}
        ${item.content}
        ${item.memo}
        ${item.no}
        ${station?.station_name || ""}
        ${station?.addr || ""}
      `.toLowerCase();

      return text.includes(query);
    });

  $("#allHistoryCount").textContent = rows.length;

  $("#allHistoryList").innerHTML = rows.length
    ? rows
        .map((item) => {
          const station = stationByNo(item.no);

          return `
            <div class="all-history-row">
              <time>${fmtDate(item.date)}</time>
              <div>
                <strong>${escapeHtml(item.category || "기타")}</strong>
                <p>${escapeHtml(item.content)}${
                  item.memo
                    ? `\n메모: ${escapeHtml(item.memo)}`
                    : ""
                }</p>
              </div>
              <button
                class="row-station"
                data-history-station="${escapeHtml(item.no)}"
              >
                ${escapeHtml(station?.station_name || item.no)} ↗
              </button>
            </div>
          `;
        })
        .join("")
    : '<div class="no-results">검색 결과가 없습니다.</div>';

  $("#allHistoryList")
    .querySelectorAll("[data-history-station]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        onSelectStation(button.dataset.historyStation);
      });
    });
}

export function openHistoryModal({ stations, no }) {
  const select = $("#historyStation");

  select.innerHTML = stations
    .map(
      (station) => `
        <option value="${escapeHtml(station.no)}">
          ${escapeHtml(station.station_name)}
          (${escapeHtml(station.no)})
        </option>
      `,
    )
    .join("");

  if (no) select.value = no;

  $("#historyDate").value = todayISO();
  $("#historyCategory").value = "점검";
  $("#historyContent").value = "";
  $("#historyMemo").value = "";

  $("#historyModal").classList.remove("hidden");

  $("#historyContent").focus();
}

export function closeHistoryModal() {
  $("#historyModal").classList.add("hidden");

  if ($("#stationHistoryModal").classList.contains("hidden")) {
    document.body.classList.remove("modal-open");
  }
}

export function openStationHistoryModal(stationName) {
  $("#stationHistoryTitle").textContent = `${stationName} 이력`;
  $("#stationHistoryModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

export function closeStationHistoryModal() {
  $("#stationHistoryModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}
