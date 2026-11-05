// main.js

import { DemoRepository } from "./data/repository.js";

import { $, todayISO, fmtDate } from "./utils/helpers.js";

import { renderStats, renderStations } from "./views/stationView.js";

import {
  renderDetail,
  renderAllHistory,
  openHistoryModal,
  closeHistoryModal,
  openStationHistoryModal,
  closeStationHistoryModal,
} from "./views/historyView.js";

import {
  getState,
  getSelectedNo,
  setSelectedNo,
  setActiveFilter,
  setActiveView,
} from "./state.js";

import { exportWorkbook, importWorkbook } from "./services/xlsxService.js";

// ------------------------------
// 공통 데이터 조회
// ------------------------------

function stationByNo(no) {
  return repo.stations.find((station) => station.no === no);
}

function historyFor(no) {
  return repo.history
    .filter((item) => item.no === no)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ------------------------------
// 공통 UI
// ------------------------------

let toastTimer;
const repo = new DemoRepository();
function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function updateActiveNav(view) {
  $("#navStations").classList.toggle("active", view === "stations");

  $("#navHistory").classList.toggle("active", view === "history");
}

// ------------------------------
// 화면 렌더링
// ------------------------------

function refreshStationList() {
  const state = getState();

  renderStations({
    stations: repo.stations,
    history: repo.history,
    selectedNo: state.selectedNo,
    activeFilter: state.activeFilter,
    onSelectStation: selectStation,
  });
}

function refreshStats() {
  renderStats({
    stations: repo.stations,
    history: repo.history,
  });
}

function refreshDetail() {
  const no = getSelectedNo();
  const station = stationByNo(no);

  renderDetail({
    station,
    history: repo.history,

    onAddHistory: (stationNo) => {
      openModal(stationNo);
    },

    onExportHistory: (stationNo) => {
      exportWorkbook(
        {
          stations: repo.stations.filter((item) => item.no === stationNo),
          history: historyFor(stationNo),
        },
        `history_${stationNo}.xlsx`,
      );
    },

    showToast,
  });
}

function refreshAllHistory() {
  renderAllHistory({
    history: repo.history,
    stations: repo.stations,
    onSelectStation: (no) => selectStation(no),
  });
}

function renderAll() {
  refreshStats();
  refreshStationList();

  if (getSelectedNo()) {
    refreshDetail();
  }

  if (getState().activeView === "history") {
    refreshAllHistory();
  }
}

// ------------------------------
// 충전소 선택 및 화면 전환
// ------------------------------

function selectStation(no, showHistory = true) {
  if (!stationByNo(no)) {
    showToast("충전소 정보를 찾을 수 없습니다.");
    return;
  }

  setSelectedNo(no);
  setActiveView("stations");
  updateActiveNav("stations");

  $("#stationWorkspace").classList.remove("hidden");
  $("#allHistoryPanel").classList.add("hidden");

  $("#breadcrumbCurrent").textContent = "충전소 관리";
  $("#pageTitle").textContent = "충전소 관리";
  $("#pageSubtitle").textContent =
    "충전소를 검색하고 선택하면 해당 충전소의 과거 이력을 확인할 수 있습니다.";

  refreshStationList();
  refreshDetail();

  if (showHistory) {
    openStationHistoryModal(stationByNo(no)?.station_name || "충전소");
  }
}

function showAllHistory() {
  setActiveView("history");
  updateActiveNav("history");

  $("#stationWorkspace").classList.add("hidden");
  $("#allHistoryPanel").classList.remove("hidden");

  $("#breadcrumbCurrent").textContent = "전체 이력";
  $("#pageTitle").textContent = "전체 이력";
  $("#pageSubtitle").textContent =
    "모든 충전소의 기록을 최신순으로 검색하고 확인하세요.";

  refreshAllHistory();
}

// ------------------------------
// 이력 추가 팝업
// ------------------------------

function openModal(no = getSelectedNo()) {
  openHistoryModal({
    stations: repo.stations,
    no,
  });
}

function closeModal() {
  closeHistoryModal();
}

function closeStationHistory() {
  closeStationHistoryModal();
}

// ------------------------------
// 이벤트 연결
// ------------------------------

function bindEvents() {
  // 충전소 검색
  $("#stationSearch").addEventListener("input", refreshStationList);

  $("#clearSearch").addEventListener("click", () => {
    $("#stationSearch").value = "";
    refreshStationList();
  });

  // 충전소 필터
  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-chip")
        .forEach((chip) => chip.classList.remove("active"));

      button.classList.add("active");
      setActiveFilter(button.dataset.filter || "all");

      refreshStationList();
    });
  });

  // 전체 이력 검색
  $("#historySearch").addEventListener("input", refreshAllHistory);

  // 화면 전환
  $("#navStations").addEventListener("click", () => {
    setActiveView("stations");
    updateActiveNav("stations");

    $("#stationWorkspace").classList.remove("hidden");
    $("#allHistoryPanel").classList.add("hidden");

    $("#breadcrumbCurrent").textContent = "충전소 관리";
    $("#pageTitle").textContent = "충전소 관리";
    $("#pageSubtitle").textContent =
      "충전소를 검색하고 선택하면 해당 충전소의 과거 이력을 확인할 수 있습니다.";

    renderAll();
  });

  $("#navHistory").addEventListener("click", showAllHistory);

  // 이력 추가
  $("#addHistoryTop").addEventListener("click", () => {
    openModal();
  });

  $("#closeModal").addEventListener("click", closeModal);
  $("#cancelModal").addEventListener("click", closeModal);

  $("#closeStationHistory").addEventListener("click", closeStationHistory);

  // 팝업 바깥쪽 클릭 시 닫기
  $("#historyModal").addEventListener("click", (event) => {
    if (event.target === $("#historyModal")) {
      closeModal();
    }
  });

  $("#stationHistoryModal").addEventListener("click", (event) => {
    if (event.target === $("#stationHistoryModal")) {
      closeStationHistory();
    }
  });

  // ESC 키로 팝업 닫기
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeStationHistory();
    }
  });

  // 엑셀 내보내기
  $("#exportTop").addEventListener("click", () => {
    exportWorkbook(
      {
        stations: repo.stations,
        history: repo.history,
      },
      "hydrogen_history.xlsx",
    );
  });

  $("#exportHistory").addEventListener("click", () => {
    exportWorkbook(
      {
        stations: repo.stations,
        history: repo.history,
      },
      "hydrogen_history.xlsx",
    );
  });

  // 엑셀 가져오기
  $("#importButton").addEventListener("click", () => {
    $("#importFile").click();
  });

  $("#importFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const imported = await importWorkbook(file);

      // importWorkbook의 반환 형식에 맞춰 저장 로직을 연결해야 함.
      // 기존 앱의 가져오기·중복 검사 로직을 그대로 유지할 것.
      showToast("파일을 읽었습니다. 가져오기 결과를 확인하세요.");

      console.log("가져온 데이터:", imported);
    } catch (error) {
      console.error(error);
      showToast("파일을 가져오지 못했습니다.");
    } finally {
      event.target.value = "";
    }
  });

  // 이력 등록
  $("#historyForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const no = $("#historyStation").value;
    const content = $("#historyContent").value.trim();

    if (!no || !content) {
      showToast("충전소와 이력 내용을 입력해 주세요.");
      return;
    }

    const record = {
      history_id: `H-${Date.now()}`,
      no,
      date: $("#historyDate").value || todayISO(),
      category: $("#historyCategory").value || "기타",
      content,
      memo: $("#historyMemo").value.trim(),
    };

    try {
      await repo.addHistory(record);

      setSelectedNo(no);
      closeModal();

      renderAll();

      if (!$("#stationHistoryModal").classList.contains("hidden")) {
        openStationHistoryModal(stationByNo(no)?.station_name || "충전소");
      }

      showToast("새 이력이 등록되었습니다.");
    } catch (error) {
      console.error(error);
      showToast("이력 등록에 실패했습니다.");
    }
  });
}

// ------------------------------
// 앱 초기화
// ------------------------------

function initApp() {
  bindEvents();
  renderAll();
}

initApp();
