
import { $, escapeHtml, fmtDate } from "../utils/helpers.js";

function getHistoryFor(history, no) {
  return history
    .filter((item) => item.no === no)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getRecentDate(history, no) {
  return getHistoryFor(history, no)[0]?.date || "";
}

export function renderStats({ stations, history }) {
  const month = new Date().toLocaleDateString("en-CA").slice(0, 7);

  $("#statStations").textContent = stations.length;
  $("#navCount").textContent = stations.length;
  $("#statHistory").textContent = history.length;

  $("#statMonth").textContent = history.filter((item) =>
    item.date.startsWith(month),
  ).length;

  $("#statLatest").textContent = history.length
    ? fmtDate(
        [...history].sort((a, b) =>
          b.date.localeCompare(a.date),
        )[0].date,
      )
    : "—";
}

export function renderStations({
  stations,
  history,
  selectedNo,
  activeFilter,
  onSelectStation,
}) {
  const query = $("#stationSearch").value.trim().toLowerCase();

  const historyFor = (no) => getHistoryFor(history, no);

  const recentDate = (no) => getRecentDate(history, no);

  const searchText = (station) =>
    `${Object.values(station).join(" ")} ${
      historyFor(station.no)
        .map((item) =>
          `${item.date} ${item.category} ${item.content} ${item.memo}`,
        )
        .join(" ")
    }`.toLowerCase();

  let list = stations.filter((station) =>
    searchText(station).includes(query),
  );

  if (activeFilter === "history") {
    list = list.filter(
      (station) => historyFor(station.no).length > 0,
    );
  }

  if (activeFilter === "recent") {
    const cutoff = new Date(
      Date.now() - 30 * 86400000,
    ).toLocaleDateString("en-CA");

    list = list.filter((station) => {
      const date = recentDate(station.no);
      return date && date >= cutoff;
    });
  }

  list.sort(
    (a, b) =>
      Number(b.no === selectedNo) - Number(a.no === selectedNo),
  );

  $("#resultCount").textContent = list.length;

  $("#listFooter").textContent =
    `${list.length}개 충전소 표시 · 검색은 기본정보와 이력 내용을 포함합니다.`;

  $("#stationList").innerHTML = list.length
    ? list.map((station) => {
        const count = historyFor(station.no).length;
        const date = recentDate(station.no);

        return `
          <button
            type="button"
            class="station-item ${
              station.no === selectedNo ? "selected" : ""
            }"
            data-no="${escapeHtml(station.no)}"
          >
            <div class="station-item-head">
              <i class="station-dot"></i>
              <strong>${escapeHtml(station.station_name)}</strong>
              <span class="history-pill">이력 ${count}</span>
            </div>

            <div class="station-meta">
              ${escapeHtml(station.addr)}
            </div>

            <div class="station-submeta">
              <span>${escapeHtml(station.no)}</span>
              <span>IP ${escapeHtml(station.IP || "-")}</span>
              <span>최근 ${date ? fmtDate(date) : "기록 없음"}</span>
            </div>
          </button>
        `;
      }).join("")
    : '<div class="no-results">검색 결과가 없습니다.<br>다른 검색어를 입력해 보세요.</div>';

  $("#stationList")
    .querySelectorAll("[data-no]")
    .forEach((element) => {
      element.addEventListener("click", () => {
        onSelectStation(element.dataset.no);
      });
    });
}
