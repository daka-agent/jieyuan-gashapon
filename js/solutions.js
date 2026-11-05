// 还愿（解决方案）本地存储：localStorage，无需服务器
const KEY = 'jieyou_solutions_v1';

export function loadSolutions() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSolution(problemId, { solution, author }) {
  const all = loadSolutions();
  all[problemId] = {
    solution: solution.trim(),
    author: (author || '').trim() || '匿名同学',
    time: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (err) {
    console.error('还愿保存失败', err);
  }
  return all;
}

export function getSolution(problemId) {
  return loadSolutions()[problemId] || null;
}

export function solvedCount() {
  return Object.keys(loadSolutions()).length;
}
