// 抽取逻辑：洗牌队列，本轮不重复
export class Gacha {
  constructor() {
    this.pool = [];
    this.queue = [];
    this.drawn = 0;
  }

  init(items) {
    this.pool = [...items];
    this.reset();
  }

  reset() {
    // Fisher–Yates 洗牌
    this.queue = [...this.pool];
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.drawn = 0;
  }

  draw() {
    if (!this.queue.length) return null;
    const item = this.queue.pop();
    this.drawn += 1;
    return { ...item, index: this.drawn };
  }

  get remaining() {
    return this.queue.length;
  }

  get total() {
    return this.pool.length;
  }
}
