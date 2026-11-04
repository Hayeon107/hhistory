/*
 * H2 Station demo frontend
 * Data layer is intentionally isolated: replace DemoRepository with APIRepository
 * when a PostgreSQL-backed backend is available. The browser must never connect to
 * PostgreSQL directly; credentials and SQL belong on the server.
 */

import { $, escapeHtml, todayISO, fmtDate } from "./utils/helpers.js";

import { DemoRepository } from "./data/repository.js";

import { exportWorkbook, importWorkbook } from "./services/xlsxService.js";

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

// 2. 화면그리기
function renderStats() {
  //충전소 수, 전체 이력 수, 이번달 이력 수, 최신 날짜 표시
  const h = repo.history;
  const month = todayISO().slice(0, 7);
  $("#statStations").textContent = repo.stations.length;
  $("#navCount").textContent = repo.stations.length;
  $("#statHistory").textContent = h.length;
  $("#statMonth").textContent = h.filter((x) =>
    x.date.startsWith(month),
  ).length;
  $("#statLatest").textContent = h.length
    ? fmtDate([...h].sort((a, b) => b.date.localeCompare(a.date))[0].date)
    : "—";
}

// 검색, 필터 결과에 맞춰 충전소 목록 표시
function renderStations() {
  const q = $("#stationSearch").value.trim().toLowerCase();
  let list = repo.stations.filter((s) => stationSearchText(s).includes(q));
  if (activeFilter === "history")
    list = list.filter((s) => historyFor(s.no).length);
  if (activeFilter === "recent")
    list = list.filter(
      (s) =>
        recentDate(s.no) &&
        recentDate(s.no) >=
          new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA"),
    );
  list.sort(
    (a, b) => (b.no === selectedNo ? 1 : 0) - (a.no === selectedNo ? 1 : 0),
  );
  $("#resultCount").textContent = list.length;
  $("#listFooter").textContent =
    `${list.length}개 충전소 표시 · 검색은 기본정보와 이력 내용을 포함합니다.`;
  $("#stationList").innerHTML = list.length
    ? list
        .map((s) => {
          const count = historyFor(s.no).length;
          return `<button class="station-item ${s.no === selectedNo ? "selected" : ""}" data-no="${escapeHtml(s.no)}"><div class="station-item-head"><i class="station-dot"></i><strong>${escapeHtml(s.station_name)}</strong><span class="history-pill">이력 ${count}</span></div><div class="station-meta">${escapeHtml(s.addr)}</div><div class="station-submeta"><span>${escapeHtml(s.no)}</span><span>IP ${escapeHtml(s.IP || "-")}</span><span>최근 ${recentDate(s.no) ? fmtDate(recentDate(s.no)) : "기록 없음"}</span></div></button>`;
        })
        .join("")
    : '<div class="no-results">검색 결과가 없습니다.<br>다른 검색어를 입력해 보세요.</div>';
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
  const pane = $("#detailPane");
  const s = stationByNo(selectedNo);
  if (!s) {
    pane.innerHTML =
      '<div class="empty-state"><div class="empty-illustration">⌖</div><h2>충전소를 선택하세요</h2><p>왼쪽 목록에서 충전소를 선택하면 기본정보와 과거 이력이 표시됩니다.</p></div>';
    return;
  }
  pane.innerHTML = `<div class="detail-header"><div><div class="station-label">STATION PROFILE · ${escapeHtml(s.no)}</div><h2>${escapeHtml(s.station_name)}</h2><div class="detail-address">⌖ &nbsp;${escapeHtml(s.addr)}</div></div><div class="detail-actions"><button class="btn btn-secondary" id="copyStation">복사</button><button class="btn btn-primary" id="detailAdd">＋ 이력 추가</button></div></div>
 <div class="section-title"><h3>충전소 기본정보</h3><span>등록 정보 기준</span></div><div class="info-grid">${[
   ["업소번호", s.no],
   ["사업자번호", s.biz_no],
   ["모니터링", s.monitoring],
   ["SRP 상태", s.SRP],
   ["BLUE 상태", s.BLUE],
   ["IP 주소", s.IP],
   ["PORT", s.PORT],
   ["메트릭", s.is_metrix],
   ["충전 방식", s.type],
   ["공급 유형", s.sup_type],
   ["운영 유형", s.con_type],
   ["충전 압력", s.pressure ? `${s.pressure} bar` : "-"],
 ]
   .map(
     ([k, v]) =>
       `<div class="info-cell"><label>${k}</label><strong>${escapeHtml(v || "-")}</strong></div>`,
   )
   .join("")}</div>
 <div class="tabs"><button class="tab active">과거 이력</button><button class="tab" id="stationExport">이력 내보내기</button></div><div class="section-title"><h3>이력 타임라인</h3><span id="detailHistoryCount">0건</span></div><div class="history-tools"><label class="search-box"><span>⌕</span><input id="detailHistorySearch" type="search" placeholder="이력 내용 검색" /></label><select id="detailCategory"><option value="all">모든 유형</option>${["점검", "통신 장애", "설비 정비", "검사", "운영 변경", "기타"].map((c) => `<option>${c}</option>`).join("")}</select></div><div class="timeline" id="timeline"></div>`;
  $("#detailAdd").onclick = () => openModal(selectedNo);
  $("#copyStation").onclick = () => {
    navigator.clipboard
      ?.writeText(
        `${s.station_name}\n${s.addr}\n업소번호: ${s.no}\nIP: ${s.IP}\nPORT: ${s.PORT}`,
      )
      .then(() => showToast("충전소 정보를 복사했습니다."))
      .catch(() => showToast("복사를 지원하지 않는 환경입니다."));
  };
  $("#stationExport").onclick = () =>
    exportWorkbook(
      {
        stations: repo.stations,
        history: historyFor(selectedNo),
      },
      `history_${selectedNo}.xlsx`,
    );
  $("#detailHistorySearch").addEventListener("input", () =>
    renderTimeline(selectedNo),
  );
  $("#detailCategory").addEventListener("change", () =>
    renderTimeline(selectedNo),
  );
  renderTimeline(selectedNo);
}

// 주요 화면을 갱신하는 종합함수
function renderAll() {
  renderStats();
  renderStations();
  if (selectedNo) renderDetail();
  if (activeView === "history") renderAllHistory();
}

//전체 충전소의 이력을 통합 목록으로 표시
function renderAllHistory() {
  const q = $("#historySearch").value.trim().toLowerCase();
  const rows = repo.history
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((h) => {
      const s = stationByNo(h.no);
      return `${h.date} ${h.category} ${h.content} ${h.memo} ${h.no} ${s?.station_name || ""} ${s?.addr || ""}`
        .toLowerCase()
        .includes(q);
    });
  $("#allHistoryCount").textContent = rows.length;
  $("#allHistoryList").innerHTML = rows.length
    ? rows
        .map(
          (h) =>
            `<div class="all-history-row"><time>${fmtDate(h.date)}</time><div><strong>${escapeHtml(h.category || "기타")}</strong><p>${escapeHtml(h.content)}${h.memo ? `\n메모: ${escapeHtml(h.memo)}` : ""}</p></div><button class="row-station" data-history-station="${escapeHtml(h.no)}">${escapeHtml(stationByNo(h.no)?.station_name || h.no)} ↗</button></div>`,
        )
        .join("")
    : '<div class="no-results">검색 결과가 없습니다.</div>';
  $("#allHistoryList")
    .querySelectorAll("[data-history-station]")
    .forEach(
      (b) => (b.onclick = () => selectStation(b.dataset.historyStation)),
    );
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
  renderStations();
  renderDetail();
  if (showHistory) {
    $("#stationHistoryTitle").textContent =
      `${stationByNo(no)?.station_name || "충전소"} 이력`;
    $("#stationHistoryModal").classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
}

// 새 이력 입력 팝업 열기 및 입력값 초기화
function openModal(no = selectedNo) {
  const select = $("#historyStation");
  select.innerHTML = repo.stations
    .map(
      (s) =>
        `<option value="${escapeHtml(s.no)}">${escapeHtml(s.station_name)} (${escapeHtml(s.no)})</option>`,
    )
    .join("");
  if (no) select.value = no;
  $("#historyDate").value = todayISO();
  $("#historyCategory").value = "점검";
  $("#historyContent").value = "";
  $("#historyMemo").value = "";
  $("#historyModal").classList.remove("hidden");
  setTimeout(() => $("#historyContent").focus(), 50);
}

// 이력 입력 팝업 닫기
function closeModal() {
  $("#historyModal").classList.add("hidden");
  if ($("#stationHistoryModal").classList.contains("hidden"))
    document.body.classList.remove("modal-open");
}

// 충전소 이력 팝업 닫기
function closeStationHistory() {
  $("#stationHistoryModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
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
    renderDetail();
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
$("#stationSearch").addEventListener("input", renderStations);
$("#clearSearch").onclick = () => {
  $("#stationSearch").value = "";
  activeFilter = "all";
  document
    .querySelectorAll(".filter-chip")
    .forEach((x) => x.classList.toggle("active", x.dataset.filter === "all"));
  renderStations();
};
document.querySelectorAll(".filter-chip").forEach((b) =>
  b.addEventListener("click", () => {
    activeFilter = b.dataset.filter;
    document
      .querySelectorAll(".filter-chip")
      .forEach((x) => x.classList.toggle("active", x === b));
    renderStations();
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
