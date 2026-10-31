/**
 * Viewport Windowing & DOM Culling Tests (Stage 2)
 *
 * Verifies that:
 * 1. For large project scales (100 to 300+ clips across 10-20 minute videos),
 *    only the visible pixel window (+ safe buffer) is rendered in the DOM.
 * 2. Spacer blocks (offsetBeforePx + offsetAfterPx) preserve 100% of the exact track layout,
 *    metrics, and scroll alignment.
 * 3. TimeRuler mounts only ticks inside the viewport window, reducing ruler DOM nodes by >90%.
 * 4. Held/dragged clips are guaranteed to remain mounted even during drag edge cases.
 * 5. Total width invariance: sum(offsetBeforePx) + sum(visibleClips) + sum(offsetAfterPx) === totalTrackWidth.
 */

import { VideoClip } from '../types';

export interface ViewportWindowResult {
  startIndex: number;
  endIndex: number;
  offsetBeforePx: number;
  offsetAfterPx: number;
  visibleClips: VideoClip[];
  totalClipsWidth: number;
}

export function computeViewportWindow(
  clips: VideoClip[],
  pixelsPerSecond: number,
  visibleStartPx: number,
  visibleEndPx: number,
  heldClipId: string | null = null
): ViewportWindowResult {
  if (clips.length === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      offsetBeforePx: 0,
      offsetAfterPx: 0,
      visibleClips: [],
      totalClipsWidth: 0,
    };
  }

  const widths = clips.map((c) => Math.max(12, c.duration * pixelsPerSecond));
  const totalClipsWidth = widths.reduce((a, b) => a + b, 0);

  let currentX = 0;
  let sIdx = -1;
  let eIdx = -1;

  for (let i = 0; i < clips.length; i++) {
    const clipWidth = widths[i];
    const clipStart = currentX;
    const clipEnd = currentX + clipWidth;
    currentX = clipEnd;

    const isVisible =
      (clipEnd >= visibleStartPx && clipStart <= visibleEndPx) ||
      clips[i].id === heldClipId;

    if (isVisible) {
      if (sIdx === -1) {
        sIdx = i;
      }
      eIdx = i;
    }
  }

  if (sIdx === -1) {
    const fallbackEnd = Math.min(clips.length - 1, 15);
    const visibleClips = clips.slice(0, fallbackEnd + 1);
    const visibleWidth = visibleClips.reduce((acc, c) => acc + Math.max(12, c.duration * pixelsPerSecond), 0);
    return {
      startIndex: 0,
      endIndex: fallbackEnd,
      offsetBeforePx: 0,
      offsetAfterPx: totalClipsWidth - visibleWidth,
      visibleClips,
      totalClipsWidth,
    };
  }

  const beforePx = clips.slice(0, sIdx).reduce((acc, c) => acc + Math.max(12, c.duration * pixelsPerSecond), 0);
  const afterPx = clips.slice(eIdx + 1).reduce((acc, c) => acc + Math.max(12, c.duration * pixelsPerSecond), 0);
  const visibleClips = clips.slice(sIdx, eIdx + 1);

  return {
    startIndex: sIdx,
    endIndex: eIdx,
    offsetBeforePx: beforePx,
    offsetAfterPx: afterPx,
    visibleClips,
    totalClipsWidth,
  };
}

export function computeTimeRulerTicks(
  totalDuration: number,
  pixelsPerSecond: number,
  visibleStartPx: number,
  visibleEndPx: number
): { mountedTicks: number[]; totalPossibleTicks: number } {
  const visibleSeconds = Math.ceil(totalDuration) + 10;
  const step = pixelsPerSecond <= 25 ? (totalDuration > 120 ? 10 : 5) : 1;

  // Unwindowed total ticks
  const allTicks: number[] = [];
  for (let i = 0; i <= visibleSeconds; i += step) {
    allTicks.push(i);
  }

  // Windowed ticks
  const minSec = Math.max(0, Math.floor(visibleStartPx / pixelsPerSecond));
  const maxSec = Math.min(visibleSeconds, Math.ceil(visibleEndPx / pixelsPerSecond));
  const startAligned = Math.floor(minSec / step) * step;

  const mountedTicks: number[] = [];
  for (let i = startAligned; i <= maxSec; i += step) {
    mountedTicks.push(i);
  }

  return {
    mountedTicks,
    totalPossibleTicks: allTicks.length,
  };
}

export async function runViewportWindowingTests(): Promise<{ passed: boolean; message: string }> {
  console.log('====================================================');
  console.log('RUNNING STAGE 2 HORIZONTAL VIEWPORT WINDOWING TESTS');
  console.log('====================================================\n');

  let passed = 0;
  const total = 5;

  // Generate a realistic 200-clip project across a 15-minute (900 seconds) timeline
  const pps = 40; // 40px per second
  const projectClips: VideoClip[] = [];
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const dur = 3.5 + (i % 5) * 0.5; // durations 3.5s - 5.5s
    projectClips.push({
      id: `clip-${i + 1}`,
      title: `Shot ${i + 1}`,
      type: 'image',
      color: '#3b82f6',
      duration: dur,
      startOffset: 0,
      rawDuration: dur,
      volume: 100,
      speed: 1.0,
      thumbnailUrl: `blob:mock-thumb-${i + 1}`,
      url: `blob:mock-asset-${i + 1}`,
      frames: [`thumb-${i}-1.jpg`, `thumb-${i}-2.jpg`, `thumb-${i}-3.jpg`],
    });
    t += dur;
  }
  const totalDuration = t;

  // -------------------------------------------------------------------------
  // TEST 1: DOM Node Culling for 200 Clips on Mobile Viewport
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: DOM Node Culling on Mobile Viewport (400px screen) ---');
  // Mobile viewport: screen width 400px, scrolled to second 120 (scrollLeft = 4800px)
  // Safe buffer 700px on either side => visible window: [4100px, 5900px]
  const scrollLeft = 4800;
  const bufferPx = 700;
  const clientWidth = 400;
  const visibleStartPx = Math.max(0, scrollLeft - bufferPx);
  const visibleEndPx = scrollLeft + clientWidth + bufferPx;

  const result1 = computeViewportWindow(projectClips, pps, visibleStartPx, visibleEndPx);
  const mountedClips = result1.visibleClips.length;
  const totalClips = projectClips.length;
  const unmountedClips = totalClips - mountedClips;
  const reductionPercent = ((unmountedClips / totalClips) * 100).toFixed(1);

  // In a 1800px window with ~180px avg clip width, around 10-15 clips are mounted out of 200
  const test1Passed = mountedClips <= 18 && mountedClips >= 8 && totalClips === 200;
  if (test1Passed) {
    console.log(`Test 1 Result: PASSED (Mounted: ${mountedClips} clips / ${totalClips} total, DOM reduction: ${reductionPercent}%)`);
    passed++;
  } else {
    console.error(`Test 1 Result: FAILED (Mounted: ${mountedClips}, expected between 8 and 18)`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Exact Spacer Block Mathematics & Total Track Width Invariance
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: Exact Layout Invariance (Zero Pixel Drift) ---');
  const visibleWidth = result1.visibleClips.reduce(
    (acc, c) => acc + Math.max(12, c.duration * pps),
    0
  );
  const calculatedTotal = result1.offsetBeforePx + visibleWidth + result1.offsetAfterPx;
  const test2Passed = Math.abs(calculatedTotal - result1.totalClipsWidth) < 0.0001;

  if (test2Passed) {
    console.log(`Test 2 Result: PASSED (OffsetBefore: ${result1.offsetBeforePx.toFixed(1)}px, VisibleWidth: ${visibleWidth.toFixed(1)}px, OffsetAfter: ${result1.offsetAfterPx.toFixed(1)}px, Total: ${calculatedTotal.toFixed(1)}px)`);
    passed++;
  } else {
    console.error(`Test 2 Result: FAILED (Expected: ${result1.totalClipsWidth}, calculated: ${calculatedTotal})`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: TimeRuler Tick Culling (>85% node reduction)
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: TimeRuler Tick Culling ---');
  const rulerResult = computeTimeRulerTicks(totalDuration, pps, visibleStartPx, visibleEndPx);
  const rulerMounted = rulerResult.mountedTicks.length;
  const rulerTotal = rulerResult.totalPossibleTicks;
  const rulerReduction = (((rulerTotal - rulerMounted) / rulerTotal) * 100).toFixed(1);

  const test3Passed = rulerMounted < 50 && rulerReduction >= '85.0';
  if (test3Passed) {
    console.log(`Test 3 Result: PASSED (Ruler mounted ticks: ${rulerMounted} / ${rulerTotal} total ticks, DOM reduction: ${rulerReduction}%)`);
    passed++;
  } else {
    console.error(`Test 3 Result: FAILED (Mounted ticks: ${rulerMounted}, Total: ${rulerTotal})`);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Held/Dragged Clip Interaction Preservation
  // -------------------------------------------------------------------------
  console.log('--- TEST 4: Held Clip Preservation in Window ---');
  // Clip 50 is held by user (at ~225s, around px 9000, outside standard [4100, 5900] window)
  const heldClipId = 'clip-50';
  const result4 = computeViewportWindow(projectClips, pps, visibleStartPx, visibleEndPx, heldClipId);
  const isHeldIncluded = result4.visibleClips.some((c) => c.id === heldClipId);

  if (isHeldIncluded) {
    console.log(`Test 4 Result: PASSED (Held clip '${heldClipId}' preserved in active DOM for uninterrupted pointer capture)`);
    passed++;
  } else {
    console.error(`Test 4 Result: FAILED (Held clip was culled unexpectedly)`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Start & End of Timeline Boundary Safety
  // -------------------------------------------------------------------------
  console.log('--- TEST 5: Start and End Boundaries Invariance ---');
  // Window at the very beginning (scrollLeft = 0)
  const startWindow = computeViewportWindow(projectClips, pps, 0, 1100);
  const startCheck = startWindow.startIndex === 0 && startWindow.offsetBeforePx === 0;

  // Window at the very end
  const endWindow = computeViewportWindow(projectClips, pps, result1.totalClipsWidth - 1100, result1.totalClipsWidth + 500);
  const endCheck = endWindow.endIndex === projectClips.length - 1 && endWindow.offsetAfterPx === 0;

  if (startCheck && endCheck) {
    console.log(`Test 5 Result: PASSED (Start offset: ${startWindow.offsetBeforePx}px, End offset: ${endWindow.offsetAfterPx}px)`);
    passed++;
  } else {
    console.error(`Test 5 Result: FAILED (Start check: ${startCheck}, End check: ${endCheck})`);
  }

  console.log('\n====================================================');
  console.log(`VIEWPORT WINDOWING SUITE: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================\n');

  return {
    passed: passed === total,
    message: `${passed} / ${total} tests passed`,
  };
}

if (import.meta.url.endsWith(process.argv[1])) {
  runViewportWindowingTests().then((res) => {
    if (!res.passed) {
      process.exit(1);
    }
  });
}
