
import { seedStations, seedHistory } from "../../data/seedData.js";

// const STORAGE_KEY = "hydrogen-station-manager";
const STORAGE_KEY = "h2-station-demo-v1";
// 데모 데이터의 조회와 저장을 담당하는 클래스


//1. 데이터 저장 및 조회
// 충전소와 이력 데이터를 관리하고 브라우저의 localStorage에 저장
export class DemoRepository {
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      this.stations = saved?.stations || structuredClone(seedStations);
      this.history = saved?.history || structuredClone(seedHistory);
    } catch {
      // 저장 데이터가 없거나 JSON을 읽을 수 없으면 초기 데이터 사용
      this.stations = structuredClone(seedStations);
      this.history = structuredClone(seedHistory);
    }
  }

  // 현재 데이터를 브라우저의 localStorage에 저장
  persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: this.stations,
        history: this.history,
      }),
    );
  }

  // 전체 충전소 조회
  async getStations() {
    return this.stations;
  }

  // 전체 이력 또는 특정 충전소의 이력 조회
  async getHistory(no = null) {
    return this.history
      .filter((h) => !no || h.no === no)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.history_id.localeCompare(a.history_id),
      );
  }

  // 이력 한 건 추가 후 저장
  async addHistory(record) {
    this.history.push(record);
    this.persist();
    return record;
  }

  // 여러 이력 추가 후 저장
  async importHistory(records) {
    this.history.push(...records);
    this.persist();
  }
}

async function init() {
  try {
    const { seedStations, seedHistory } =
      await loadExcelData();

    console.log("충전소 목록:", seedStations);
    console.log("이력 목록:", seedHistory);

    // 이곳에서 기존 화면 렌더링 함수를 호출하면 돼.
    // renderStations(seedStations);
    // renderHistory(seedHistory);

  } catch (error) {
    console.error("데이터 로딩 실패:", error);
  }
}

init();