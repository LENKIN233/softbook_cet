/** The same 24-point icon geometry is drawn by native views and Web SVG. */
export type StudioIconPoint = readonly [number, number];
export type StudioIconShape =
  | {kind: 'line'; x1: number; y1: number; x2: number; y2: number}
  | {kind: 'polyline'; points: readonly StudioIconPoint[]}
  | {kind: 'circle'; cx: number; cy: number; r: number; filled?: boolean}
  | {kind: 'rect'; x: number; y: number; width: number; height: number; radius?: number};

const line = (x1: number, y1: number, x2: number, y2: number): StudioIconShape => ({kind: 'line', x1, y1, x2, y2});
const path = (...points: StudioIconPoint[]): StudioIconShape => ({kind: 'polyline', points});
const circle = (cx: number, cy: number, r: number, filled = false): StudioIconShape => ({kind: 'circle', cx, cy, r, filled});
const rect = (x: number, y: number, width: number, height: number, radius = 2): StudioIconShape => ({kind: 'rect', x, y, width, height, radius});

export const STUDIO_ICON_SHAPES = {
  book: [path([12, 5], [9, 3.5], [3, 3.5], [3, 19], [9, 19], [12, 21], [15, 19], [21, 19], [21, 3.5], [15, 3.5], [12, 5]), line(12, 5, 12, 21), line(6, 8, 9, 8), line(15, 8, 18, 8)],
  map: [line(7, 8, 10, 10), line(14, 10, 17, 7), line(14, 14, 17, 17), circle(5, 6, 2.5), circle(12, 12, 2.5), circle(19, 5, 2.5), circle(19, 19, 2.5)],
  chart: [path([4, 3], [4, 20], [21, 20]), line(9, 16, 9, 11), line(14, 16, 14, 7), line(19, 16, 19, 4)],
  user: [circle(12, 7, 4), path([4, 21], [4, 19], [5.5, 16], [8.5, 14.5], [15.5, 14.5], [18.5, 16], [20, 19], [20, 21])],
  play: [path([8, 4], [20, 12], [8, 20], [8, 4])],
  pause: [rect(6, 4, 4, 16, 1), rect(14, 4, 4, 16, 1)],
  chevronRight: [path([9, 5], [16, 12], [9, 19])],
  chevronLeft: [path([15, 5], [8, 12], [15, 19])],
  chevronDown: [path([5, 9], [12, 16], [19, 9])],
  chevronUp: [path([5, 15], [12, 8], [19, 15])],
  arrowRight: [line(3, 12, 21, 12), path([14, 5], [21, 12], [14, 19])],
  arrowLeft: [line(3, 12, 21, 12), path([10, 5], [3, 12], [10, 19])],
  close: [line(5, 5, 19, 19), line(19, 5, 5, 19)],
  check: [path([4, 12], [9, 17], [20, 6])],
  checkCircle: [circle(12, 12, 9), path([7, 12], [10.5, 15.5], [17, 8.5])],
  star: [path([12, 2.5], [15, 8.7], [22, 9.7], [17, 14.6], [18.2, 21.5], [12, 18.2], [5.8, 21.5], [7, 14.6], [2, 9.7], [9, 8.7], [12, 2.5])],
  moon: [path([20.7, 14.2], [18, 15], [14.5, 14.5], [11.5, 12.5], [9.5, 9.5], [9, 6], [9.8, 3.3], [6.5, 4.5], [4, 7.5], [3.2, 11], [3.7, 14.5], [5.5, 17.5], [8.5, 19.6], [12, 20.5], [15.5, 20], [18.5, 18], [20.7, 14.2])],
  sun: [circle(12, 12, 4), line(12, 2, 12, 4), line(12, 20, 12, 22), line(2, 12, 4, 12), line(20, 12, 22, 12), line(4.9, 4.9, 6.4, 6.4), line(17.6, 17.6, 19.1, 19.1), line(4.9, 19.1, 6.4, 17.6), line(17.6, 6.4, 19.1, 4.9)],
  search: [circle(10.5, 10.5, 6.5), line(15.3, 15.3, 21, 21)],
  filter: [path([3, 4], [21, 4], [14, 12], [14, 20], [10, 18], [10, 12], [3, 4])],
  grid: [rect(3, 3, 7, 7, 1.5), rect(14, 3, 7, 7, 1.5), rect(3, 14, 7, 7, 1.5), rect(14, 14, 7, 7, 1.5)],
  list: [circle(4, 6, 1, true), circle(4, 12, 1, true), circle(4, 18, 1, true), line(9, 6, 21, 6), line(9, 12, 21, 12), line(9, 18, 21, 18)],
  folder: [path([3, 20], [3, 5], [10, 5], [12, 8], [21, 8], [21, 20], [3, 20])],
  home: [path([2.5, 10], [12, 2.5], [21.5, 10]), path([5, 8], [5, 21], [10, 21], [10, 14], [14, 14], [14, 21], [19, 21], [19, 8])],
  refresh: [path([20, 9], [18.5, 5.5], [15.5, 3.5], [12, 3], [8.5, 3.8], [5.5, 6], [4, 9]), path([20, 3], [20, 9], [14, 9]), path([4, 15], [5.5, 18.5], [8.5, 20.5], [12, 21], [15.5, 20.2], [18.5, 18], [20, 15]), path([4, 21], [4, 15], [10, 15])],
  help: [circle(12, 12, 9), path([9, 8], [10, 6.5], [12, 6], [14, 6.5], [15, 8], [14.5, 10], [12, 12], [12, 13.5]), circle(12, 17, 1, true)],
  lightbulb: [circle(12, 9, 6), line(8, 14, 9, 18), line(16, 14, 15, 18), line(9, 18, 15, 18), line(10, 21, 14, 21)],
  volume: [path([3, 9], [7, 9], [12, 5], [12, 19], [7, 15], [3, 15], [3, 9]), path([16, 8], [18, 10], [18.5, 12], [18, 14], [16, 16]), path([19, 4.5], [21, 8], [22, 12], [21, 16], [19, 19.5])],
  settings: [circle(12, 12, 3), path([9.5, 2.5], [14.5, 2.5], [15, 5.5], [17, 6.5], [20, 5.5], [22, 9], [19.5, 11], [19.5, 13], [22, 15], [20, 18.5], [17, 17.5], [15, 18.5], [14.5, 21.5], [9.5, 21.5], [9, 18.5], [7, 17.5], [4, 18.5], [2, 15], [4.5, 13], [4.5, 11], [2, 9], [4, 5.5], [7, 6.5], [9, 5.5], [9.5, 2.5])],
  logout: [path([10, 3], [4, 3], [4, 21], [10, 21]), line(9, 12, 22, 12), path([17, 7], [22, 12], [17, 17])],
  shield: [path([12, 2], [21, 6], [20, 13], [17, 18], [12, 22], [7, 18], [4, 13], [3, 6], [12, 2]), path([8, 12], [11, 15], [16, 9])],
  phone: [rect(6, 2, 12, 20, 2.5), line(10, 5, 14, 5), circle(12, 19, 0.7, true)],
  keyboard: [rect(2, 5, 20, 14, 2), line(6, 9, 7, 9), line(11, 9, 12, 9), line(16, 9, 17, 9), line(6, 12, 7, 12), line(11, 12, 12, 12), line(16, 12, 17, 12), line(6, 16, 18, 16)],
  calendar: [rect(3, 5, 18, 16, 2), line(3, 10, 21, 10), line(7, 2, 7, 7), line(17, 2, 17, 7), path([8, 15], [11, 18], [16, 13])],
  clock: [circle(12, 12, 9), path([12, 6], [12, 12], [16, 14])],
  eye: [path([2, 12], [5, 7.5], [9, 5.5], [15, 5.5], [19, 7.5], [22, 12], [19, 16.5], [15, 18.5], [9, 18.5], [5, 16.5], [2, 12]), circle(12, 12, 3)],
  lock: [rect(5, 10, 14, 11, 2), path([8, 10], [8, 6], [9, 3.5], [12, 2.5], [15, 3.5], [16, 6], [16, 10]), circle(12, 15, 1, true), line(12, 16, 12, 18)],
  unlock: [rect(5, 10, 14, 11, 2), path([8, 10], [8, 6], [9, 3.5], [12, 2.5], [15, 3.5], [16, 6]), circle(12, 15, 1, true), line(12, 16, 12, 18)],
  expand: [path([9, 3], [3, 3], [3, 9]), path([15, 3], [21, 3], [21, 9]), path([3, 15], [3, 21], [9, 21]), path([21, 15], [21, 21], [15, 21])],
  info: [circle(12, 12, 9), circle(12, 7, 1, true), line(12, 11, 12, 17)],
  warning: [path([12, 3], [22, 21], [2, 21], [12, 3]), line(12, 9, 12, 14), circle(12, 17, 1, true)],
  trash: [line(3, 6, 21, 6), path([9, 6], [9, 3], [15, 3], [15, 6]), path([5, 6], [6, 21], [18, 21], [19, 6]), line(10, 10, 10, 17), line(14, 10, 14, 17)],
  moreHorizontal: [circle(5, 12, 1.5, true), circle(12, 12, 1.5, true), circle(19, 12, 1.5, true)],
  mail: [rect(3, 5, 18, 14, 2), path([3, 6], [12, 13], [21, 6])],
} as const satisfies Record<string, readonly StudioIconShape[]>;

export type StudioIconName = keyof typeof STUDIO_ICON_SHAPES;
