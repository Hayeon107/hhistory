
const API_BASE_URL = "http://127.0.0.1:8000/api";

// API 오류 응답을 읽기 위한 공통 함수
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `API 요청 실패 (${response.status})`;

    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      // 오류 응답이 JSON 형식이 아닌 경우 기본 메시지 사용
    }

    throw new Error(message);
  }

  // 204 No Content 응답 처리
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export class DemoRepository {
  constructor() {
    // main.js에서 사용하는 기존 데이터 인터페이스 유지
    this.stations = [];
    this.history = [];
  }

  // 앱 시작 시 서버에서 데이터를 가져옴
  async load() {
    const [stations, history] = await Promise.all([
      this.getStations(),
      this.getHistory(),
    ]);

    this.stations = stations;
    this.history = history;

    return {
      stations: this.stations,
      history: this.history,
    };
  }

  // 충전소 목록 조회
  async getStations() {
    return request(`${API_BASE_URL}/stations`);
  }

  // 전체 이력 또는 특정 충전소의 이력 조회
  async getHistory(no = null) {
    const url = new URL(`${API_BASE_URL}/history`);

    if (no != null) {
      url.searchParams.set("station_no", no);
    }

    return request(url.toString());
  }

  // 이력 한 건을 서버 DB에 저장
  async addHistory(record) {
    const savedRecord = await request(
      `${API_BASE_URL}/history`,
      {
        method: "POST",
        body: JSON.stringify(record),
      },
    );

    // 서버 저장에 성공한 경우에만 화면 데이터 갱신
    this.history.push(savedRecord);

    return savedRecord;
  }

  // 엑셀에서 가져온 여러 이력을 서버 DB에 저장
  async importHistory(records) {
    const savedRecords = await request(
      `${API_BASE_URL}/history/import`,
      {
        method: "POST",
        body: JSON.stringify(records),
      },
    );

    // 저장 성공 후 서버의 최신 이력 목록을 다시 조회
    this.history = await this.getHistory();

    return savedRecords;
  }
}
