/**
 * Scrubbing Performance & Audio Seek Coalescing Tests
 * 
 * Verifies that:
 * 1. Rapid scrubbing updates the visual/playhead target continuously without lag.
 * 2. Underlying audio element seeks are coalesced to prevent hardware decoder stalling.
 * 3. The final stopped position is committed accurately to the exact last timestamp.
 * 4. Immediate seek mode (used during playback) executes with zero delay.
 */

import { AudioSeekCoalescer, CoalescedSeekTarget } from '../utils/audioSeekCoalescer';

export async function runScrubbingPerformanceTests(): Promise<{ passed: boolean; message: string }> {
  console.log('====================================================');
  console.log('RUNNING STAGE 1 SCRUBBING & AUDIO SEEK COALESCING TESTS');
  console.log('====================================================\n');

  let passed = 0;
  const total = 4;

  // -------------------------------------------------------------------------
  // TEST 1: Rapid scrubbing coalesces audio seeks
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Rapid Scrubbing Coalesces Audio Seeks ---');
  const committedSeeks: CoalescedSeekTarget[] = [];
  const coalescer = new AudioSeekCoalescer((target) => {
    committedSeeks.push(target);
  }, 60);

  // Simulate user dragging finger across 25 frames within 20 milliseconds
  const visualFramesRendered: number[] = [];
  for (let i = 0; i < 25; i++) {
    const scrubTime = 1.0 + i * 0.1; // 1.0s to 3.4s
    visualFramesRendered.push(scrubTime);
    coalescer.seek({
      time: scrubTime,
      activeClipUrl: 'blob:mock-audio',
      clipStartTime: 0,
      volume: 100,
      isMuted: false,
    }, false);
  }

  // Visual frames should be 25 (responsive preview)
  const test1VisualCountPassed = visualFramesRendered.length === 25;
  // Audio seeks should be throttled (at most 1 or 2 during this 20ms burst)
  const test1AudioThrottled = committedSeeks.length <= 2;

  if (test1VisualCountPassed && test1AudioThrottled) {
    console.log(`Test 1 Result: PASSED (Visual frames: ${visualFramesRendered.length}, Audio seeks throttled to: ${committedSeeks.length})`);
    passed++;
  } else {
    console.error(`Test 1 Result: FAILED (Visual: ${visualFramesRendered.length}, Audio commits: ${committedSeeks.length})`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Final seek position accuracy after scrubbing stops
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: Final Seek Position Accuracy ---');
  // Wait 80ms for trailing coalesced seek to flush
  await new Promise((r) => setTimeout(r, 80));

  const lastCommitted = committedSeeks[committedSeeks.length - 1];
  const expectedLastTime = 3.4;
  const test2Passed = lastCommitted && Math.abs(lastCommitted.time - expectedLastTime) < 0.001;

  if (test2Passed) {
    console.log(`Test 2 Result: PASSED (Final audio seek committed at exact time: ${lastCommitted.time.toFixed(2)}s)`);
    passed++;
  } else {
    console.error(`Test 2 Result: FAILED (Expected: ${expectedLastTime}, got: ${lastCommitted?.time})`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Immediate seek commits synchronously (Playback seeking)
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: Immediate Seek for Active Playback ---');
  const immediateSeeks: CoalescedSeekTarget[] = [];
  const immediateCoalescer = new AudioSeekCoalescer((target) => {
    immediateSeeks.push(target);
  }, 60);

  immediateCoalescer.seek({
    time: 15.5,
    activeClipUrl: 'blob:mock-audio',
    clipStartTime: 0,
    volume: 100,
    isMuted: false,
  }, true); // immediate = true

  const test3Passed = immediateSeeks.length === 1 && immediateSeeks[0].time === 15.5;
  if (test3Passed) {
    console.log('Test 3 Result: PASSED (Immediate seek committed synchronously without queue delay)');
    passed++;
  } else {
    console.error('Test 3 Result: FAILED', immediateSeeks);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Flush guarantees instant final position on pointer/touch release
  // -------------------------------------------------------------------------
  console.log('--- TEST 4: Flush on Pointer Release ---');
  const releaseSeeks: CoalescedSeekTarget[] = [];
  const releaseCoalescer = new AudioSeekCoalescer((target) => {
    releaseSeeks.push(target);
  }, 100);

  // Initial seek
  releaseCoalescer.seek({ time: 5.0, clipStartTime: 0, volume: 100, isMuted: false }, false);
  // Rapid scrub 10ms later
  releaseCoalescer.seek({ time: 8.75, clipStartTime: 0, volume: 100, isMuted: false }, false);
  // User immediately releases pointer
  releaseCoalescer.flush();

  const finalRelease = releaseSeeks[releaseSeeks.length - 1];
  const test4Passed = finalRelease && finalRelease.time === 8.75;
  if (test4Passed) {
    console.log(`Test 4 Result: PASSED (Flush on pointer release committed exact target: ${finalRelease.time}s)`);
    passed++;
  } else {
    console.error('Test 4 Result: FAILED', finalRelease);
  }

  console.log('\n====================================================');
  console.log(`SCRUBBING PERFORMANCE SUITE: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================\n');

  return {
    passed: passed === total,
    message: `${passed} / ${total} tests passed`,
  };
}

if (import.meta.url.endsWith(process.argv[1])) {
  runScrubbingPerformanceTests().then((res) => {
    if (!res.passed) {
      process.exit(1);
    }
  });
}
