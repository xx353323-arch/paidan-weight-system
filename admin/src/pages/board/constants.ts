export const BOARD_QUERY_KEY = 'board-ranking';

export const GRADE_TONE: Record<
  string,
  { color: string; bg: string; desc: string }
> = {
  S: { color: '#237804', bg: 'rgba(82, 196, 26, 0.16)', desc: '90 分以上' },
  A: { color: '#08979c', bg: 'rgba(19, 194, 194, 0.16)', desc: '80 到 89 分' },
  B: { color: '#1677ff', bg: 'rgba(22, 119, 255, 0.14)', desc: '70 到 79 分' },
  C: { color: '#d46b08', bg: 'rgba(250, 140, 22, 0.16)', desc: '60 到 69 分' },
  D: { color: '#cf1322', bg: 'rgba(255, 77, 79, 0.14)', desc: '60 分以下' },
  F: { color: '#8c8c8c', bg: 'rgba(140, 140, 140, 0.16)', desc: '已冻结' },
};

export const ANONYMOUS_NOTE = '榜单匿名展示，只有名次与分数，不显示任何姓名。';
export const MINE_NOTE = '标记「我」的是你自己的位置。';
