// js/state.js

const state = {
  selectedNo: null,
  activeFilter: "all",
  activeView: "history",
};

export function getState() {
  return { ...state };
}

export function getSelectedNo() {
  return state.selectedNo;
}

export function setSelectedNo(no) {
  state.selectedNo = no;
}

export function getActiveFilter() {
  return state.activeFilter;
}

export function setActiveFilter(filter) {
  state.activeFilter = filter;
}

export function getActiveView() {
  return state.activeView;
}

export function setActiveView(view) {
  state.activeView = view;
  console.log(view);
}