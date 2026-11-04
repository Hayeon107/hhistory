
/**
 * CSS 선택자로 HTML 요소를 가져온다.
 * 예: $("#stationList")
 */
export const $ = (selector) => document.querySelector(selector);

/**
 * HTML에 문자열을 표시할 때 특수문자를 이스케이프한다.
 * 사용자 입력값이 HTML 태그로 해석되는 것을 방지한다.
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

/**
 * 현재 날짜를 YYYY-MM-DD 형식으로 반환한다.
 */
export function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    
    return `${year}-${month}-${day}`;
    }
    
    
/**
const todayISO = () => new Date().toLocaleDateString("en-CA");

/**
 * YYYY-MM-DD 형식의 날짜를 YYYY.MM.DD 형식으로 표시한다.
 */
export const fmtDate = (date) =>
  date ? date.replaceAll("-", ".") : "";
