/*
 * H2 Station demo frontend
 * Data layer is intentionally isolated: replace DemoRepository with APIRepository
 * when a PostgreSQL-backed backend is available. The browser must never connect to
 * PostgreSQL directly; credentials and SQL belong on the server.
 */

import { $, escapeHtml, todayISO, fmtDate } from "./utils/helpers.js";

import { DemoRepository } from "./data/repository.js";

import { exportWorkbook, importWorkbook } from "./services/xlsxService.js";

import {
  renderStats as renderStationStats,
  renderStations as renderStationList,
} from "./views/stationView.js";


import {
  renderDetail as renderHistoryDetail,
  renderAllHistory as renderHistoryList,
  openHistoryModal,
  closeHistoryModal,
  openStationHistoryModal,
  closeStationHistoryModal,
} from "./views/historyView.js";
//1. 데이터 저장 및 조회
// 충전소와 이력 데이터를 관리하고 브라우저의 localStorage에 저장
const repo = new DemoRepository();

let selectedNo = null,
  activeFilter = "all",
  activeView = "stations",
  toastTimer;
const stationByNo = (no) => repo.stations.find((s) => s.no === no);
const historyFor = (no) =>
  repo.history
    .filter((h) => h.no === no)
    .sort((a, b) => b.date.localeCompare(a.date));
const recentDate = (no) => historyFor(no)[0]?.date || "";

function showToast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function renderAll() {
  renderStationStats({
    stations: repo.stations,
    history: repo.history,
  });

  renderStationList({
    stations: repo.stations,
    history: repo.history,
    selectedNo,
    activeFilter,
    onSelectStation: selectStation,
  });

  if (selectedNo) {
    renderDetail();
  }

  if (activeView === "history") {
    renderAllHistory();
  }
}

// 이력을 시간순 타임라인으로 표시하고 검색유형 필터 적용
function renderTimeline(no) {
  const h = historyFor(no);
  const q = ($("#detailHistorySearch")?.value || "").trim().toLowerCase();
  const cat = $("#detailCategory")?.value || "all";
  const filtered = h.filter(
    (x) =>
      (cat === "all" || x.category === cat) &&
      `${x.date} ${x.category} ${x.content} ${x.memo}`
        .toLowerCase()
        .includes(q),
  );
  $("#timeline").innerHTML = filtered.length
    ? filtered
        .map(
          (x) =>
            `<div class="timeline-entry"><div class="timeline-rail"><i class="timeline-dot"></i></div><div><div class="timeline-date">${fmtDate(x.date)} <span>·</span> ${escapeHtml(x.history_id)}</div><div class="timeline-content">${escapeHtml(x.content)}</div><span class="timeline-category">${escapeHtml(x.category || "기타")}</span>${x.memo ? `<div class="timeline-memo">메모 · ${escapeHtml(x.memo)}</div>` : ""}</div></div>`,
        )
        .join("")
    : '<div class="no-results">조건에 맞는 이력이 없습니다.</div>';
  $("#detailHistoryCount").textContent = `${filtered.length}건`;
}

// 선택한 충전소의 상세 정보 및 이력 영역 생성
function renderDetail() {
  renderHistoryDetail({
    station: stationByNo(selectedNo),
    history: repo.history,

    onAddHistory: (no) => openModal(no),

    onExportHistory: (no) => {
      exportWorkbook(
        {
          stations: repo.stations.filter((station) => station.no === no),
          history: historyFor(no),
        },
        `history_${no}.xlsx`,
      );
    },

    showToast,
  });
}

//전체 충전소의 이력을 통합 목록으로 표시
function renderAllHistory() {
  renderHistoryList({
    history: repo.history,
    stations: repo.stations,
    onSelectStation: selectStation,
  });
}
//5. 이벤트 연결 및 초기화

//search 이벤트
function stationSearchText(s) {
  return (
    Object.values(s).join(" ").toLowerCase() +
    " " +
    historyFor(s.no)
      .map((h) => `${h.date} ${h.category} ${h.content} ${h.memo}`)
      .join(" ")
      .toLowerCase()
  );
}

function refreshStationList() {
  renderStationList({
    stations: repo.stations,
    history: repo.history,
    selectedNo,
    activeFilter,
    onSelectStation: selectStation,
  });
}

// 충전소를 선택하고 이력 팝업 열기
function selectStation(no, showHistory = true) {
  selectedNo = no;
  activeView = "stations";
  $("#stationWorkspace").classList.remove("hidden");
  $("#allHistoryPanel").classList.add("hidden");
  $("#breadcrumbCurrent").textContent = "충전소 관리";
  $("#pageTitle").textContent = "충전소 관리";
  $("#pageSubtitle").textContent =
    "충전소를 검색하고 선택하면 해당 충전소의 과거 이력이 팝업으로 열립니다.";
  refreshStationList();
  renderDetail();
  if (showHistory) {
    const station = stationByNo(no);

    openStationHistoryModal(station?.station_name || "충전소");
  }
}

// 새 이력 입력 팝업 열기 및 입력값 초기화
function openModal(no = selectedNo) {
  openHistoryModal({
    stations: repo.stations,
    no,
  });
}

// 이력 입력 팝업 닫기
function closeModal() {
  closeHistoryModal();
}

// 충전소 이력 팝업 닫기
function closeStationHistory() {
  closeStationHistoryModal();
}

// 전체 충전소의 이력을 통합 목록으로 표시
function showAllHistory() {
  activeView = "history";
  $("#stationWorkspace").classList.add("hidden");
  $("#allHistoryPanel").classList.remove("hidden");
  $("#breadcrumbCurrent").textContent = "전체 이력";
  $("#pageTitle").textContent = "전체 이력";
  $("#pageSubtitle").textContent =
    "모든 충전소의 기록을 최신순으로 검색하고 확인하세요.";
  renderAllHistory();
}

$("#historyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const no = $("#historyStation").value;
  const record = {
    history_id: `H-${Date.now()}`,
    no,
    date: $("#historyDate").value,
    category: $("#historyCategory").value,
    content: $("#historyContent").value.trim(),
    memo: $("#historyMemo").value.trim(),
  };
  if (!record.content) return;
  await repo.addHistory(record);
  selectedNo = no;
  closeModal();
  renderAll();
  if (activeView === "history") renderAllHistory();
  if (!$("#stationHistoryModal").classList.contains("hidden")) {
    $("#stationHistoryTitle").textContent =
      `${stationByNo(no)?.station_name || "충전소"} 이력`;
  }
  showToast("새 이력이 등록되었습니다.");
});

$("#closeModal").onclick = closeModal;
$("#cancelModal").onclick = closeModal;
$("#closeStationHistory").onclick = closeStationHistory;
$("#stationHistoryModal").addEventListener("click", (e) => {
  if (e.target === $("#stationHistoryModal")) closeStationHistory();
});
$("#historyModal").addEventListener("click", (e) => {
  if (e.target === $("#historyModal")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeStationHistory();
  }
});
$("#stationSearch").addEventListener("input", refreshStationList);
$("#clearSearch").onclick = () => {
  $("#stationSearch").value = "";
  activeFilter = "all";
  document
    .querySelectorAll(".filter-chip")
    .forEach((x) => x.classList.toggle("active", x.dataset.filter === "all"));
  refreshStationList();
};
document.querySelectorAll(".filter-chip").forEach((b) =>
  b.addEventListener("click", () => {
    activeFilter = b.dataset.filter;
    document
      .querySelectorAll(".filter-chip")
      .forEach((x) => x.classList.toggle("active", x === b));
    refreshStationList();
  }),
);
$("#addHistoryTop").onclick = () =>
  openModal(selectedNo || repo.stations[0]?.no);
$("#exportTop").onclick = () =>
  exportWorkbook({
    stations: repo.stations,
    history: repo.history,
  });

$("#exportHistory").onclick = () =>
  exportWorkbook({
    stations: repo.stations,
    history: repo.history,
  });

$("#navStations").onclick = () => {
  activeView = "stations";
  $("#stationWorkspace").classList.remove("hidden");
  $("#allHistoryPanel").classList.add("hidden");
  $("#breadcrumbCurrent").textContent = "충전소 관리";
  $("#pageTitle").textContent = "충전소 관리";
  $("#pageSubtitle").textContent =
    "충전소 정보를 검색하고 과거 이력을 한곳에서 관리하세요.";
};
$("#navHistory").onclick = showAllHistory;
$("#historySearch").addEventListener("input", renderAllHistory);
$("#importButton").onclick = () => $("#importFile").click();

$("#importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const imported = await importWorkbook(file);

    // 1. 충전소 목록 병합: 같은 no가 있으면 갱신, 없으면 추가
    const stationMap = new Map(
      repo.stations.map((station) => [String(station.no), station]),
    );

    for (const station of imported.stations) {
      const no = String(station.no || "").trim();
      const stationName = String(station.station_name || "").trim();

      if (!no || !stationName) continue;

      const existing = stationMap.get(no);

      stationMap.set(no, {
        ...existing,
        ...station,
        no,
      });
    }

    repo.stations = [...stationMap.values()];

    // 2. 기존 이력 ID를 기록해 중복 추가 방지
    const historyIds = new Set(
      repo.history.map((item) => String(item.history_id)),
    );

    let addedCount = 0;
    let skippedCount = 0;

    for (const item of imported.history) {
      const no = String(item.no || "").trim();
      const content = String(item.content || "").trim();

      // 등록된 충전소가 아니거나 내용이 비어 있으면 건너뛴다.
      if (!stationMap.has(no) || !content) {
        skippedCount++;
        continue;
      }

      let historyId = String(item.history_id || "").trim();

      if (!historyId) {
        historyId = `H-IMPORT-${Date.now()}-${addedCount}`;
      }

      if (historyIds.has(historyId)) {
        skippedCount++;
        continue;
      }

      repo.history.push({
        ...item,
        history_id: historyId,
        no,
        date: item.date || todayISO(),
        category: item.category || "기타",
        content,
        memo: item.memo || "",
      });

      historyIds.add(historyId);
      addedCount++;
    }

    // 3. 충전소와 이력을 함께 저장
    repo.persist();

    // 4. 화면 갱신
    renderAll();

    showToast(
      `충전소 ${repo.stations.length}개 · 신규 이력 ${addedCount}건을 반영했습니다.` +
        (skippedCount ? ` 이력 ${skippedCount}건은 건너뛰었습니다.` : ""),
    );
  } catch (err) {
    showToast(err.message || "엑셀 파일을 읽지 못했습니다.");
  } finally {
    e.target.value = "";
  }
});

$("#mobileMenu").onclick = () => $("#sidebar").classList.toggle("open");
document.addEventListener("click", (e) => {
  if (
    window.innerWidth <= 780 &&
    !e.target.closest("#sidebar") &&
    !e.target.closest("#mobileMenu")
  )
    $("#sidebar").classList.remove("open");
});
renderAll();
selectStation("HS-001", false);
