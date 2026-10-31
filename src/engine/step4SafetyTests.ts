/**
 * Step 4 Safety & Anti-Hallucination Test Suite
 * Validates Tests A through I as specified in the Step 4 requirements.
 */
import {
  executeAndVerifyEditorAction,
  executeMultiEditorActions,
  ActionExecutorUpdaters,
} from './chatActionExecutor';
import { detectChatIntent, EditorContextSnapshot } from './chatIntentDetector';
import { executionRegistry } from './safeExecutionController';
import { VideoClip, AudioTrackClip, CaptionClip, OverlayClip, AspectRatio } from '../types';

function createMockClip(id: string, title: string, duration = 5): VideoClip {
  return {
    id,
    title,
    type: 'video',
    color: '#3b82f6',
    thumbnailUrl: '',
    frames: [],
    duration,
    startOffset: 0,
    rawDuration: duration,
    volume: 100,
    speed: 1.0,
    url: 'https://example.com/video.mp4',
  };
}

function runAllStep4Tests() {
  console.log('====================================================');
  console.log('RUNNING STEP 4 SAFETY & RELIABILITY TEST SUITE');
  console.log('====================================================\n');

  let passedCount = 0;
  const totalTests = 14;

  // -------------------------------------------------------------------------
  // TEST A: Clear Timeline (Single execution only, timeline becomes empty, no loop)
  // -------------------------------------------------------------------------
  console.log('--- TEST A: Clear Timeline ---');
  executionRegistry.reset();
  let clipsA = [createMockClip('c1', 'Clip 1'), createMockClip('c2', 'Clip 2')];
  let audiosA: AudioTrackClip[] = [{ id: 'a1', title: 'Music', url: '', duration: 10, startTime: 0, volume: 100, waveformData: [0.5, 0.8, 0.3] }];
  let captionsA: CaptionClip[] = [{ id: 'cap1', text: 'Hello', startTime: 0, duration: 2, stylePreset: 'hormozi' }];
  let overlaysA: OverlayClip[] = [{ id: 'ov1', type: 'motion-graphic', title: 'Overlay', startTime: 0, duration: 2, thumbnailUrl: '', opacity: 1 }];
  let mutationCountA = 0;

  const updatersA: ActionExecutorUpdaters = {
    setVideoClips: (val) => { clipsA = typeof val === 'function' ? (val as any)(clipsA) : val; mutationCountA++; },
    setAudioClips: (val) => { audiosA = typeof val === 'function' ? (val as any)(audiosA) : val; mutationCountA++; },
    setCaptions: (val) => { captionsA = typeof val === 'function' ? (val as any)(captionsA) : val; mutationCountA++; },
    setOverlays: (val) => { overlaysA = typeof val === 'function' ? (val as any)(overlaysA) : val; mutationCountA++; },
    setRegisteredAssets: () => {},
    setSelectedClipId: () => {},
    setAspectRatio: () => {},
    setCurrentTime: () => {},
    pushHistory: () => {},
    handleUndo: () => {},
    handleRedo: () => {},
  };

  const snapshotA1: EditorContextSnapshot = {
    videoClips: clipsA,
    audioClips: audiosA,
    captions: captionsA,
    overlays: overlaysA,
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c1',
  };

  const resA1 = executeAndVerifyEditorAction('CLEAR_TIMELINE', undefined, snapshotA1, updatersA, undefined, undefined, {
    requestText: 'Clear timeline',
  });

  const snapshotA2: EditorContextSnapshot = {
    videoClips: clipsA,
    audioClips: audiosA,
    captions: captionsA,
    overlays: overlaysA,
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: null,
  };

  const prevMutationCount = mutationCountA;
  const resA2 = executeAndVerifyEditorAction('CLEAR_TIMELINE', undefined, snapshotA2, updatersA, undefined, undefined, {
    requestText: 'Clear timeline again',
  });

  const testAPassed =
    resA1.success === true &&
    clipsA.length === 0 &&
    audiosA.length === 0 &&
    captionsA.length === 0 &&
    overlaysA.length === 0 &&
    mutationCountA === prevMutationCount; // Idempotent: no redundant second mutation

  console.log(`Test A Result: ${testAPassed ? 'PASSED' : 'FAILED'}`);
  if (testAPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST B: Delete Selected Clip with Error (Action fails, no fake success, no infinite retry)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST B: Delete Selected Clip (Handle Failure) ---');
  executionRegistry.reset();
  let clipsB = [createMockClip('c1', 'Clip 1'), createMockClip('c2', 'Clip 2')];
  let mutationCountB = 0;

  const updatersB: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsB = typeof val === 'function' ? (val as any)(clipsB) : val; mutationCountB++; },
  };

  const snapshotB: EditorContextSnapshot = {
    videoClips: clipsB,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c1',
  };

  const resB = executeAndVerifyEditorAction(
    'DELETE_SELECTED_CLIP',
    undefined,
    snapshotB,
    updatersB,
    undefined,
    undefined,
    {
      requestText: 'Delete selected clip',
      allowOneRetryOnRecoverableFailure: false, // Default max retries = 0
      onSimulatedAttemptFailure: () => true, // Simulate editor action failure
    }
  );

  const testBPassed =
    resB.success === false &&
    resB.verificationReport.verified === false &&
    resB.verifiedMessage.includes("I couldn't apply that edit because the editor action failed") &&
    clipsB.length === 2 && // Unchanged
    mutationCountB === 0;

  console.log(`Test B Result: ${testBPassed ? 'PASSED' : 'FAILED'}`);
  if (testBPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST C: Retry Logic (Attempt 1 fails, Attempt 2 succeeds -> PASSED, STOP, no attempt 3)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST C: Retry Logic (Attempt 1 fails, Attempt 2 succeeds) ---');
  executionRegistry.reset();
  let clipsC = [createMockClip('c1', 'Clip 1'), createMockClip('c2', 'Clip 2')];
  let attemptsCalledC: number[] = [];

  const updatersC: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsC = typeof val === 'function' ? (val as any)(clipsC) : val; },
  };

  const snapshotC: EditorContextSnapshot = {
    videoClips: clipsC,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c1',
  };

  const resC = executeAndVerifyEditorAction(
    'DELETE_SELECTED_CLIP',
    undefined,
    snapshotC,
    updatersC,
    undefined,
    undefined,
    {
      requestText: 'Delete selected clip with recoverable retry',
      allowOneRetryOnRecoverableFailure: true,
      onSimulatedAttemptFailure: (attempt) => {
        attemptsCalledC.push(attempt);
        return attempt === 1; // Attempt 1 fails, Attempt 2 succeeds
      },
    }
  );

  const testCPassed =
    resC.success === true &&
    resC.verificationReport.verified === true &&
    attemptsCalledC.length === 2 && // Exactly 2 attempts (stopped upon success, no 3rd attempt)
    clipsC.length === 1 &&
    clipsC[0].id === 'c2';

  console.log(`Test C Result: ${testCPassed ? 'PASSED' : 'FAILED'} (Attempts called: ${attemptsCalledC.join(', ')})`);
  if (testCPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST D: Double Failure (Attempt 1 fails, Attempt 2 fails -> Final status FAILED, STOP)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST D: Double Failure (Both attempts fail) ---');
  executionRegistry.reset();
  let clipsD = [createMockClip('c1', 'Clip 1'), createMockClip('c2', 'Clip 2')];
  let attemptsCalledD: number[] = [];

  const updatersD: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsD = typeof val === 'function' ? (val as any)(clipsD) : val; },
  };

  const snapshotD: EditorContextSnapshot = {
    videoClips: clipsD,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c1',
  };

  const resD = executeAndVerifyEditorAction(
    'DELETE_SELECTED_CLIP',
    undefined,
    snapshotD,
    updatersD,
    undefined,
    undefined,
    {
      requestText: 'Delete selected clip with unrecoverable failure',
      allowOneRetryOnRecoverableFailure: true,
      onSimulatedAttemptFailure: (attempt) => {
        attemptsCalledD.push(attempt);
        return true; // Both attempts fail
      },
    }
  );

  const testDPassed =
    resD.success === false &&
    resD.verificationReport.verified === false &&
    attemptsCalledD.length === 2 && // Stopped after attempt 2, no infinite loop
    clipsD.length === 2;

  console.log(`Test D Result: ${testDPassed ? 'PASSED' : 'FAILED'} (Attempts called: ${attemptsCalledD.join(', ')})`);
  if (testDPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST E: Duplicate Request Protection (Trigger same request twice -> 1 mutation)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST E: Duplicate Request Protection ---');
  executionRegistry.reset();
  let clipsE = [createMockClip('c1', 'Clip 1'), createMockClip('c2', 'Clip 2')];
  let mutationCountE = 0;

  const updatersE: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsE = typeof val === 'function' ? (val as any)(clipsE) : val; mutationCountE++; },
  };

  const snapshotE: EditorContextSnapshot = {
    videoClips: clipsE,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c1',
  };

  const executionIdE = 'exec-id-dup-test';
  const resE1 = executeAndVerifyEditorAction(
    'DELETE_SELECTED_CLIP',
    undefined,
    snapshotE,
    updatersE,
    undefined,
    undefined,
    { executionId: executionIdE, requestText: 'Delete selected clip' }
  );

  const resE2 = executeAndVerifyEditorAction(
    'DELETE_SELECTED_CLIP',
    undefined,
    snapshotE,
    updatersE,
    undefined,
    undefined,
    { executionId: executionIdE, requestText: 'Delete selected clip' }
  );

  const testEPassed =
    resE1.success === true &&
    resE2.success === true &&
    mutationCountE === 1; // Only one actual mutation executed!

  console.log(`Test E Result: ${testEPassed ? 'PASSED' : 'FAILED'} (Total mutations: ${mutationCountE})`);
  if (testEPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST F: Stale Clip ID Detection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST F: Stale Clip ID Detection ---');
  executionRegistry.reset();
  let clipsF = [createMockClip('c1', 'Clip 1'), createMockClip('c2', 'Clip 2')];
  let mutationCountF = 0;

  const updatersF: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsF = typeof val === 'function' ? (val as any)(clipsF) : val; mutationCountF++; },
  };

  const snapshotF: EditorContextSnapshot = {
    videoClips: clipsF,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c999_stale_nonexistent', // Stale selection
  };

  const resF = executeAndVerifyEditorAction(
    'DELETE_SELECTED_CLIP',
    undefined,
    snapshotF,
    updatersF,
    undefined,
    undefined,
    { requestText: 'Delete selected clip' }
  );

  const testFPassed =
    resF.success === false &&
    resF.verifiedMessage.includes('no longer exists') &&
    clipsF.length === 2 && // Untouched! No other clip was deleted!
    mutationCountF === 0;

  console.log(`Test F Result: ${testFPassed ? 'PASSED' : 'FAILED'} (Clips preserved: ${clipsF.length})`);
  if (testFPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST G: Unrelated State Change Detection (Target Discrepancy)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST G: Unrelated State Change Discrepancy Detection ---');
  executionRegistry.reset();
  let clipsG = [createMockClip('c1', 'Clip 1'), createMockClip('c2', 'Clip 2')];

  const updatersG: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsG = typeof val === 'function' ? (val as any)(clipsG) : val; },
  };

  const snapshotG: EditorContextSnapshot = {
    videoClips: clipsG,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c1',
  };

  const resG = executeAndVerifyEditorAction(
    'DELETE_SELECTED_CLIP',
    undefined,
    snapshotG,
    updatersG,
    undefined,
    undefined,
    {
      requestText: 'Delete selected clip',
      forceTargetDiscrepancy: true, // Forces verification discrepancy check
    }
  );

  const testGPassed =
    resG.success === false &&
    resG.verificationReport.verified === false &&
    resG.verifiedMessage.includes('Verification failed: An unrelated clip was changed');

  console.log(`Test G Result: ${testGPassed ? 'PASSED' : 'FAILED'}`);
  if (testGPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST H: Normal Chat (No Mutations)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST H: Normal Chat (Zero Mutations) ---');
  let mutationCountH = 0;
  const snapshotH: EditorContextSnapshot = {
    videoClips: [createMockClip('c1', 'Clip 1')],
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c1',
  };

  const intentH1 = detectChatIntent('What does trimming do in video editing?', snapshotH, []);
  const intentH2 = detectChatIntent('The timeline looks very clean right now.', snapshotH, []);

  const testHPassed =
    intentH1.type === 'CHAT' &&
    intentH2.type === 'CHAT' &&
    mutationCountH === 0;

  console.log(`Test H Result: ${testHPassed ? 'PASSED' : 'FAILED'} (Mutations: ${mutationCountH})`);
  if (testHPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST I: Multi-Action Partial Success
  // -------------------------------------------------------------------------
  console.log('\n--- TEST I: Multi-Action Partial Success ---');
  executionRegistry.reset();
  let clipsI = [createMockClip('c1', 'Clip 1'), createMockClip('c2', 'Clip 2')];

  const updatersI: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsI = typeof val === 'function' ? (val as any)(clipsI) : val; },
  };

  const snapshotI: EditorContextSnapshot = {
    videoClips: clipsI,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: 'c1',
  };

  const multiActions = [
    { actionType: 'DELETE_SELECTED_CLIP' as const, parameters: {} },
    { actionType: 'MOVE_CLIP' as const, parameters: { targetSeconds: 10 } },
  ];

  const resI = executeMultiEditorActions(
    multiActions,
    snapshotI,
    updatersI,
    undefined,
    {
      requestText: 'Delete clip 1 and move clip 2 to 10 seconds',
      onSimulatedAttemptFailure: (actionIdx) => actionIdx === 2, // Action 1 succeeds, Action 2 fails
    }
  );

  const testIPassed =
    resI.success === false && // Overall is NOT claimed as complete success!
    resI.verificationReport.verified === false &&
    resI.verificationReport.afterState.includes('1 succeeded, 1 failed') &&
    resI.verifiedMessage.toLowerCase().includes('deleted') &&
    (resI.verifiedMessage.toLowerCase().includes("couldn't") || resI.verifiedMessage.toLowerCase().includes('failed'));

  console.log(`Test I Result: ${testIPassed ? 'PASSED' : 'FAILED'} (Report: "${resI.verifiedMessage}")`);
  if (testIPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST J: User's Exact Multi-Action Command:
  // "Duplicate it and add one as overlay add key frames slow zoom"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST J: Exact Multi-Action Command ("Duplicate it and add one as overlay add key frames slow zoom") ---');
  executionRegistry.reset();
  let clipsJ = [createMockClip('c1', 'Intro Clip', 6)];
  let overlaysJ: OverlayClip[] = [];
  let selectedClipIdJ: string | null = 'c1';

  const updatersJ: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsJ = typeof val === 'function' ? (val as any)(clipsJ) : val; },
    setOverlays: (val) => { overlaysJ = typeof val === 'function' ? (val as any)(overlaysJ) : val; },
    setSelectedClipId: (id) => { selectedClipIdJ = id; },
  };

  const snapshotJ: EditorContextSnapshot = {
    videoClips: clipsJ,
    audioClips: [],
    captions: [],
    overlays: overlaysJ,
    currentTime: 0,
    aspectRatio: '9:16',
    selectedClipId: selectedClipIdJ,
  };

  const testJPrompt = 'Duplicate it and add one as overlay add key frames slow zoom';
  const intentJ = detectChatIntent(testJPrompt, snapshotJ);

  const intentJValid =
    intentJ.type === 'EDIT_COMMAND' &&
    !!intentJ.actions &&
    intentJ.actions.length >= 3 &&
    intentJ.actions.some((a) => a.actionType === 'DUPLICATE_CLIP') &&
    intentJ.actions.some((a) => a.actionType === 'ADD_OVERLAY');

  let executionJPassed = false;
  let resJ: any = null;

  if (intentJValid && intentJ.actions) {
    resJ = executeMultiEditorActions(
      intentJ.actions,
      snapshotJ,
      updatersJ,
      undefined,
      { requestText: testJPrompt }
    );

    executionJPassed =
      resJ.success === true &&
      resJ.verificationReport.verified === true &&
      overlaysJ.length === 1 &&
      overlaysJ[0].keyframes !== undefined &&
      overlaysJ[0].keyframes.length >= 2;
  }

  const testJPassed = intentJValid && executionJPassed;
  console.log(`Test J Intent Detection: ${intentJValid ? 'PASSED' : 'FAILED'} (Detected ${intentJ.actions?.length || 0} sub-actions)`);
  console.log(`Test J Execution: ${executionJPassed ? 'PASSED' : 'FAILED'} (Overlays: ${overlaysJ.length}, Keyframes: ${overlaysJ[0]?.keyframes?.length || 0})`);
  console.log(`Test J Result: ${testJPassed ? 'PASSED' : 'FAILED'}`);
  if (testJPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST K: User Correction Command ("I said duplicate it")
  // -------------------------------------------------------------------------
  console.log('\n--- TEST K: User Correction ("I said duplicate it") ---');
  executionRegistry.reset();
  let clipsK = [createMockClip('ck1', 'My Clip', 5)];
  let selectedClipIdK: string | null = 'ck1';

  const updatersK: ActionExecutorUpdaters = {
    ...updatersA,
    setVideoClips: (val) => { clipsK = typeof val === 'function' ? (val as any)(clipsK) : val; },
    setSelectedClipId: (id) => { selectedClipIdK = id; },
  };

  const snapshotK: EditorContextSnapshot = {
    videoClips: clipsK,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '9:16',
    selectedClipId: selectedClipIdK,
  };

  const testKPrompt = 'I said duplicate it';
  const chatHistoryK = [
    { id: '1', role: 'user' as const, content: 'Duplicate it', timestamp: Date.now() - 2000 },
    { id: '2', role: 'assistant' as const, content: 'Your timeline currently has 1 clip.', timestamp: Date.now() - 1000 },
  ];

  const intentK = detectChatIntent(testKPrompt, snapshotK, chatHistoryK);
  const intentKValid = intentK.type === 'EDIT_COMMAND' && intentK.actionType === 'DUPLICATE_CLIP';

  let resK: any = null;
  let executionKPassed = false;

  if (intentKValid) {
    resK = executeAndVerifyEditorAction(
      intentK.actionType!,
      intentK.parameters,
      snapshotK,
      updatersK,
      undefined,
      undefined,
      { requestText: testKPrompt, isUserCorrection: true }
    );

    executionKPassed =
      resK.success === true &&
      resK.verificationReport?.verified === true &&
      clipsK.length === 2;
  }

  const testKPassed = intentKValid && executionKPassed;
  console.log(`Test K Intent Detection: ${intentKValid ? 'PASSED' : 'FAILED'} (Intent: ${intentK.type}, Action: ${intentK.actionType})`);
  console.log(`Test K Execution: ${executionKPassed ? 'PASSED' : 'FAILED'} (Clips before: 1, Clips after: ${clipsK.length})`);
  console.log(`Test K Result: ${testKPassed ? 'PASSED' : 'FAILED'}`);
  if (testKPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST L: Explicit Matching and Auto-Edit Intent Routing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST L: Explicit Matching and Auto-Edit Intent Routing ---');
  const matchingPrompts = [
    'Process attached project assets with creative auto-edit',
    'Process attached project assets',
    'Start matching',
    'Match my images to the voiceover',
    'Match the attached script and visuals',
    'Sync these images to my narration',
  ];

  const snapshotL: EditorContextSnapshot = {
    videoClips: [],
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: null,
    attachedScript: '1. First beat\n2. Second beat',
  };

  let allMatchingPromptsPassed = true;
  for (const prompt of matchingPrompts) {
    const detected = detectChatIntent(prompt, snapshotL, []);
    const isMatching = detected.actionType === 'MATCH_VISUALS_TO_AUDIO';
    if (!isMatching) {
      allMatchingPromptsPassed = false;
      console.log(`Test L prompt failed: "${prompt}" -> type=${detected.type}, action=${detected.actionType}`);
    }
  }

  console.log(`Test L Result: ${allMatchingPromptsPassed ? 'PASSED' : 'FAILED'} (${matchingPrompts.length}/${matchingPrompts.length} matching triggers recognized)`);
  if (allMatchingPromptsPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST M: Live Routing Regression Protection ("Clear the time line" & "Change the aspect ratio")
  // -------------------------------------------------------------------------
  console.log('--- TEST M: Live Routing Regression Protection ---');
  executionRegistry.reset();
  let clipsM = [createMockClip('cm1', 'Clip 1'), createMockClip('cm2', 'Clip 2')];
  let aspectM: AspectRatio = '16:9';

  const updatersM: ActionExecutorUpdaters = {
    setVideoClips: (updater) => {
      clipsM = typeof updater === 'function' ? updater(clipsM) : updater;
    },
    setAudioClips: () => {},
    setCaptions: () => {},
    setOverlays: () => {},
    setRegisteredAssets: () => {},
    setSelectedClipId: () => {},
    setAspectRatio: (ratio: AspectRatio) => {
      aspectM = ratio;
    },
    setCurrentTime: () => {},
    pushHistory: () => {},
    handleUndo: () => {},
    handleRedo: () => {},
  };

  const snapshotM: EditorContextSnapshot = {
    videoClips: clipsM,
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: aspectM,
    selectedClipId: null,
  };

  // 1. Test "Clear the time line"
  const intentM1 = detectChatIntent('Clear the time line', snapshotM, []);
  const m1IsCommand = intentM1.type === 'EDIT_COMMAND' && intentM1.actionType === 'CLEAR_TIMELINE';
  let m1ExecSuccess = false;
  if (m1IsCommand) {
    const resM1 = executeAndVerifyEditorAction('CLEAR_TIMELINE', {}, snapshotM, updatersM, [], undefined, {
      requestText: 'Clear the time line',
      executionId: 'exec-m1-test',
      isSeparateCommand: true,
    });
    m1ExecSuccess = resM1.success && clipsM.length === 0;
  }

  // 2. Test "Change the aspect ratio" (from 16:9 to 9:16)
  const snapshotM2: EditorContextSnapshot = {
    ...snapshotM,
    videoClips: clipsM,
    aspectRatio: '16:9',
  };
  const intentM2 = detectChatIntent('Change the aspect ratio', snapshotM2, []);
  const m2IsCommand = intentM2.type === 'EDIT_COMMAND' && intentM2.actionType === 'CHANGE_ASPECT_RATIO';
  let m2ExecSuccess = false;
  if (m2IsCommand) {
    const resM2 = executeAndVerifyEditorAction('CHANGE_ASPECT_RATIO', intentM2.parameters, snapshotM2, updatersM, [], undefined, {
      requestText: 'Change the aspect ratio',
      executionId: 'exec-m2-test',
      isSeparateCommand: true,
    });
    m2ExecSuccess = resM2.success && (aspectM as string) === '9:16';
  }

  const testMPassed = m1IsCommand && m1ExecSuccess && m2IsCommand && m2ExecSuccess;
  console.log(`Test M Result: ${testMPassed ? 'PASSED' : 'FAILED'} (Clear time line: ${m1ExecSuccess}, Change aspect ratio: ${m2ExecSuccess})`);
  if (testMPassed) passedCount++;

  // -------------------------------------------------------------------------
  // TEST N: Asset Bin Clearing Commands & Loop Protection
  // -------------------------------------------------------------------------
  console.log('--- TEST N: Asset Bin Clearing Commands & Loop Protection ---');
  executionRegistry.reset();
  let assetsN = [
    { id: 'ast1', name: 'Intro_Shot.jpg', type: 'image' as const, url: 'blob://ast1', duration: 5, thumbnailUrl: '', uploadedAt: Date.now() },
    { id: 'ast2', name: 'Background_Music.mp3', type: 'audio' as const, url: 'blob://ast2', duration: 10, thumbnailUrl: '', uploadedAt: Date.now() },
  ];

  const updatersN: ActionExecutorUpdaters = {
    setVideoClips: () => {},
    setAudioClips: () => {},
    setCaptions: () => {},
    setOverlays: () => {},
    setRegisteredAssets: (val) => {
      assetsN = typeof val === 'function' ? (val as any)(assetsN) : val;
    },
    setSelectedClipId: () => {},
    setAspectRatio: () => {},
    setCurrentTime: () => {},
    pushHistory: () => {},
    handleUndo: () => {},
    handleRedo: () => {},
  };

  const snapshotN: EditorContextSnapshot = {
    videoClips: [],
    audioClips: [],
    captions: [],
    overlays: [],
    currentTime: 0,
    aspectRatio: '16:9',
    selectedClipId: null,
    registeredAssets: assetsN,
  };

  const testNQueries = [
    'Clear all in the asset bin',
    'Clear the asset bin',
    'clear asset bin',
    'empty the asset bin',
    'delete all in the asset bin',
    'remove all from the asset bin',
    'clear media bin',
    'clear all assets',
  ];

  let allNQueriesRecognized = true;
  for (const q of testNQueries) {
    const detected = detectChatIntent(q, snapshotN, []);
    if (detected.type !== 'EDIT_COMMAND' || detected.actionType !== 'CLEAR_ASSETS') {
      allNQueriesRecognized = false;
      console.log(`Test N query failed to detect CLEAR_ASSETS: "${q}" -> type=${detected.type}, action=${detected.actionType}`);
    }
  }

  // Execute CLEAR_ASSETS
  const execNResult = executeAndVerifyEditorAction(
    'CLEAR_ASSETS',
    {},
    snapshotN,
    updatersN,
    [],
    undefined,
    { requestText: 'Clear all in the asset bin', executionId: 'exec-n-test', isSeparateCommand: true }
  );

  const testNPassed =
    allNQueriesRecognized &&
    execNResult.success &&
    execNResult.verificationReport?.verified === true &&
    assetsN.length === 0;

  console.log(`Test N Result: ${testNPassed ? 'PASSED' : 'FAILED'} (Recognized ${testNQueries.length}/${testNQueries.length}, Assets Cleared: ${assetsN.length === 0})`);
  if (testNPassed) passedCount++;

  console.log('\n====================================================');
  console.log(`TEST SUITE COMPLETE: ${passedCount} / ${totalTests} TESTS PASSED`);
  console.log('====================================================');

  return passedCount === totalTests;
}

runAllStep4Tests();
