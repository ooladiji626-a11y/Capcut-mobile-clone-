import { EditorContextSnapshot } from './chatIntentDetector';
import { AIChatMessage } from '../types';

/**
 * Generates natural, helpful, context-aware conversational replies for CHAT.
 * These replies NEVER mutate the editor state.
 */
export function generateConversationalReply(
  userText: string,
  snapshot: EditorContextSnapshot,
  chatHistory?: AIChatMessage[]
): string {
  const lower = userText.toLowerCase().trim();

  // 1. "What does trimming do?"
  if (
    lower === 'what does trimming do' ||
    lower === 'what does trimming do?' ||
    lower.includes('what does trimming do') ||
    lower.includes('what is trimming') ||
    lower.includes('how does trimming work')
  ) {
    return (
      `**Trimming** adjusts where a clip starts and ends (its in/out points) without altering its playback speed or modifying the original file.\n\n` +
      `• **Top of the clip (Head)**: Trim the start to eliminate dead air before someone starts speaking.\n` +
      `• **Tail of the clip**: Trim the end to remove shaky footage or pauses after the action concludes.\n` +
      `• **Handles**: In the timeline, you can drag the left or right edges of any clip to trim it manually, or tell me *"Trim this clip to 5 seconds"* to adjust it automatically.`
    );
  }

  // 1b. "What does clearing the timeline do?"
  if (
    lower.includes('what does clearing the timeline do') ||
    lower.includes('what does clear timeline do') ||
    lower.includes('what happens if i clear the timeline') ||
    lower.includes('what does clear the timeline do') ||
    lower.includes('what does clearing the timeline') ||
    lower.includes('what does clearing all clips do')
  ) {
    return (
      `**Clearing the timeline** removes all video clips, audio tracks, captions, and overlays from your active sequence, providing a fresh, empty workspace.\n\n` +
      `• **Safe Media Library**: Your imported assets and files in the Media Library remain completely intact.\n` +
      `• **Reversible**: You can immediately undo this action with Ctrl/Cmd+Z if needed.\n\n` +
      `To clear the timeline, just tell me *"Clear all clips"* or *"Clear the timeline"*!`
    );
  }

  // 1c. "What does adding captions do?"
  if (
    lower.includes('what does adding captions do') ||
    lower.includes('what does adding caption do') ||
    lower.includes('what does add captions do') ||
    lower.includes('what does add caption do') ||
    lower.includes('what do captions do') ||
    lower.includes('what does captioning do')
  ) {
    return (
      `**Adding captions** creates synchronized subtitle overlays on the timeline aligned with your audio and dialogue.\n\n` +
      `• **Viewer Retention**: Over 70% of viewers watch short-form videos on mobile without sound; captions keep them engaged.\n` +
      `• **Dynamic Styling**: Captions include active word highlights and customizable font presets (like Hormozi or minimal styles).\n\n` +
      `To add captions to your video, simply say *"Add captions"* or *"Put captions on the video"*!`
    );
  }

  // 2. "What's the difference between a cut and a split?"
  if (
    lower.includes('difference between a cut and a split') ||
    lower.includes('difference between cut and split') ||
    lower.includes('cut vs split') ||
    lower.includes('split vs cut') ||
    lower.includes('cut or split') ||
    lower.includes('split or cut')
  ) {
    return (
      `Here is the key difference between a **cut** and a **split**:\n\n` +
      `• **Split**: Slices an existing clip in two at the current playhead position. Both parts remain on your timeline right next to each other—no frames are lost. This allows you to apply different effects, delete only one half, or insert B-roll in between.\n` +
      `• **Cut (or Trim)**: Completely removes a section of footage from the timeline sequence, closing or shifting the surrounding clips.\n\n` +
      `In practice, editors often **split** at two points and then **delete** the middle segment to eliminate an unwanted sentence or pause.`
    );
  }

  // 3. "How can I make this video more engaging?"
  if (
    lower.includes('how can i make this video more engaging') ||
    lower.includes('make this video more engaging') ||
    lower.includes('make it more engaging') ||
    lower.includes('how to make this video more engaging') ||
    lower.includes('how to improve engagement') ||
    lower.includes('boost engagement')
  ) {
    const clipCount = snapshot.videoClips.length;
    const hasAudio = snapshot.audioClips.length > 0;
    const hasCaptions = snapshot.captions.length > 0;

    return (
      `To maximize engagement on your video (${clipCount} clip${clipCount === 1 ? '' : 's'} on timeline), follow these core retention tactics:\n\n` +
      `1. **The 3-Second Hook**: Front-load your most exciting visual or thought-provoking quote in the first 0–3 seconds.\n` +
      `2. **Pacing & Trimming Dead Space**: Cut out pauses longer than 0.8 seconds between speech phrases to keep energy high.\n` +
      `3. **Dynamic Captions**: ${hasCaptions ? 'Your timeline already has captions configured!' : 'Add synchronized captions with bold text and active word highlights (over 70% of viewers watch without sound).'}\n` +
      `4. **Keyframe Punch-Ins**: Add subtle zoom keyframes (1.0x → 1.08x) every 3–4 seconds to introduce visual movement.\n` +
      `5. **Music & Audio Ducking**: ${hasAudio ? 'Duck your background music to ~15% under dialogue so speech remains crisp.' : 'Add a rhythmic or ambient soundtrack to elevate emotional pacing.'}\n\n` +
      `Let me know if you would like me to apply any of these techniques to your timeline!`
    );
  }

  // 4. "What transition would work here?" / "What transition"
  if (
    lower.includes('what transition would work here') ||
    lower.includes('what transition would look good') ||
    lower.includes('what transition') ||
    lower.includes('which transition')
  ) {
    return (
      `The most effective transition depends on your video's genre and energy:\n\n` +
      `• **Narrative / Documentary**: A clean straight cut or a subtle **0.35s Cross Dissolve** is best—it keeps the viewer focused on the story without distraction.\n` +
      `• **Shorts / TikTok / Fast Paced**: A **Whip Pan (Left or Right)** or **Zoom-In Punch** matches camera motion and maintains kinetic momentum.\n` +
      `• **Tech / Commentary**: A crisp **Glitch** or **Light Leak** accents topic shifts.\n` +
      `• **Tone Shift**: A **Dip to Black / Fade to Color** signals a major scene or chapter change.\n\n` +
      `If you'd like to try one between your clips, let me know which style you prefer!`
    );
  }

  // 5. "The timeline looks messy."
  if (
    lower === 'the timeline looks messy' ||
    lower === 'the timeline looks messy.' ||
    lower === 'the timeline is messy' ||
    lower === 'the timeline is messy.' ||
    lower.includes('timeline looks messy') ||
    lower.includes('timeline is messy') ||
    lower.includes('timeline looks cluttered') ||
    lower.includes('timeline looks disorganized')
  ) {
    const clipCount = snapshot.videoClips.length;
    return (
      `I see what you mean! When clips have varied durations, gaps, or overlapping layers, the sequence can feel a bit cluttered.\n\n` +
      `We can tidy it up in a few ways:\n` +
      `• **Remove dead space**: Snap clips flush against each other and trim silent gaps.\n` +
      `• **Organize tracks**: Keep video clips on Track 1 and background audio on Track 2.\n` +
      `• **Consistent pacing**: Normalize clip lengths to a steady cadence (e.g. 3–5 seconds per visual beat).\n\n` +
      `Would you like me to clean up dead space or organize any specific clips for you?`
    );
  }

  // 6. "What happens if I delete the clip?"
  if (
    lower.includes('what happens if i delete the clip') ||
    lower.includes('what happens if i delete this clip') ||
    lower.includes('what happens if i remove the clip') ||
    lower.includes('what will happen if i delete')
  ) {
    return (
      `If you delete a clip from the timeline:\n\n` +
      `• It will be removed from your active sequence track.\n` +
      `• Any subsequent clips will either shift forward or remain at their designated timestamps.\n` +
      `• **Your original media file is safe**: The asset remains in your Media Library, so you can drag or re-insert it back onto the timeline anytime.\n` +
      `• You can always press **Undo** (Ctrl/Cmd+Z) if you change your mind!`
    );
  }

  // 7. "Should I delete this clip?"
  if (
    lower.includes('should i delete this clip') ||
    lower.includes('should i delete the clip') ||
    lower.includes('should i remove this clip') ||
    lower.includes('do you think i should delete')
  ) {
    return (
      `It depends on how that clip serves your video's narrative and momentum:\n\n` +
      `• **Keep it** if it introduces new visual information, illustrates what the speaker is saying, or maintains visual variety.\n` +
      `• **Delete it** if it lingers too long without action, repeats an earlier visual beat, or slows down viewer retention.\n\n` +
      `If you'd like to evaluate it together or want me to remove it, just say **"Delete this clip"** and I'll take care of it.`
    );
  }

  // 8. "I think we should delete this clip." (Suggestion / discussion, NOT an explicit command)
  if (
    lower.startsWith('i think we should delete') ||
    lower.startsWith('i think we should remove') ||
    lower.startsWith('maybe we should delete') ||
    lower.startsWith('maybe we should remove') ||
    lower.includes('i feel like we should delete')
  ) {
    return (
      `That sounds like a sensible editing choice. Removing footage that drags the pacing usually tightens the overall impact.\n\n` +
      `Whenever you want me to execute that change, just give the word by saying **"Delete this clip"** (or specify which clip) and I'll remove it from the timeline!`
    );
  }

  // 9. Informational: "What is a split?" / "What does splitting do?"
  if (
    lower.includes('what does splitting do') ||
    lower.includes('what is a split') ||
    lower.includes('how does split work')
  ) {
    return (
      `**Splitting** cuts a clip into two separate segments at the exact position of your playhead. Both halves remain on the timeline, but they become independent clips that you can move, trim, delete, or style separately.`
    );
  }

  // 9b. Questions about the Visual/Audio Matching Engine (Visual Content vs Filenames, Matching Priorities)
  if (
    lower.includes('filename matching override') ||
    lower.includes('filename override') ||
    lower.includes('does filename override') ||
    lower.includes('do filenames override') ||
    lower.includes('filename vs visual') ||
    lower.includes('filename matching take priority') ||
    lower.includes('filename priority') ||
    lower.includes('how does matching work') ||
    lower.includes('how does the matching engine work') ||
    lower.includes('how do you match images') ||
    lower.includes('visual matching priority')
  ) {
    return (
      `No. Filename numbers or labels are only supporting evidence. The actual visual content, action, meaning, and context of the image are primary. A filename alone cannot override a visually incorrect asset.\n\n` +
      `Here is how the General Auto Editor matching engine operates:\n\n` +
      `• **Visual Content & Meaning are Authoritative**: The engine evaluates detected actions, characters, objects, and environment to match each script beat. Active character and motion shots take priority over static backgrounds.\n` +
      `• **Supporting Evidence Only**: Filename labels (such as "23a") act as supporting hints when visual content aligns, but can never produce a strong match on their own.\n` +
      `• **Contradiction Penalty**: If an asset has a matching filename number but the image depicts contradictory or unrelated content, it is penalized and downgraded.\n` +
      `• **Sequence & Timing**: Numbered script beats preserve narrative sequence, while the voiceover audio track serves as the master clock for timeline duration.`
    );
  }

  // 10. Greetings & Casual
  if (
    lower === 'hey' ||
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey there' ||
    lower === 'hello there' ||
    lower.startsWith('hey ') ||
    lower.startsWith('hi ') ||
    lower.startsWith('hello ') ||
    lower === "what's up" ||
    lower === 'whats up' ||
    lower === 'good morning' ||
    lower === 'good afternoon' ||
    lower === 'good evening'
  ) {
    return (
      `Hey! I'm here and ready to help you edit your video.\n\n` +
      `You can ask me questions about editing techniques, discuss pacing and transitions, or give me commands like trimming clips, ducking music, or generating captions. What are you working on today?`
    );
  }

  if (
    lower === 'thanks' ||
    lower === 'thank you' ||
    lower === 'great job' ||
    lower === 'looks good' ||
    lower === 'cool' ||
    lower === 'nice' ||
    lower === 'awesome'
  ) {
    return `Glad to hear it! Let me know if you want to make any further adjustments or try out another edit.`;
  }

  // 11. "What can you do?"
  if (lower.includes('what can you do') || lower.includes('what are your capabilities') || lower.includes('help me with')) {
    return (
      `I am your intelligent AI Video Editor and timeline controller. Here is what I can do:\n\n` +
      `• **Conversational Guidance**: Discuss editing techniques, pacing, transitions, engagement hooks, and video aesthetics.\n` +
      `• **Direct Timeline Editing**: Execute commands like *"Clear the timeline"*, *"Delete the selected clip"*, *"Trim this clip"*, *"Move this clip to 0 seconds"*, or *"Split clip"*.\n` +
      `• **Audio & Music**: Duck background music under dialogue, remove dead silence pauses, or mute tracks.\n` +
      `• **Captions & Aspect Ratios**: Generate synchronized captions and switch aspect ratios (16:9 widescreen or 9:16 vertical Shorts).\n\n` +
      `Feel free to ask a question or give me an editing command anytime!`
    );
  }

  // 12. "What does the timeline do?"
  if (lower.includes('what does the timeline do') || lower.includes('what is the timeline') || lower.includes('how does the timeline work')) {
    return (
      `The timeline is your primary multi-track visual workspace:\n\n` +
      `• **Main Video Track**: Arranges video and image clips with trimming handles and transitions.\n` +
      `• **Audio Track**: Holds background music and voiceovers with volume ducking controls.\n` +
      `• **Captions Track**: Shows synchronized subtitles with word highlights.\n` +
      `• **Overlays Track**: Lets you layer B-roll, stickers, and graphics on top of your primary footage.\n` +
      `• **Playhead**: Red vertical indicator showing the current playback time in seconds.\n\n` +
      `You can interact with it directly or give me editing commands to update it for you.`
    );
  }

  // 13. "What is the asset bin?" / Asset management guidance
  if (
    lower.includes('what is the asset bin') ||
    lower.includes('what is asset bin') ||
    lower.includes('what are assets') ||
    lower.includes('where are my assets') ||
    lower.includes('how to use the asset bin') ||
    lower.includes('media bin') ||
    lower.includes('media library') ||
    lower === 'asset bin' ||
    lower === 'assets' ||
    lower === 'media'
  ) {
    const assetCount = snapshot.registeredAssets?.length || 0;
    return (
      `The **Asset Bin** is your media library where uploaded video clips, voiceover tracks, and images are stored before or after being arranged on the timeline.\n\n` +
      `• **Current Project**: You have **${assetCount} asset${assetCount === 1 ? '' : 's'}** in your library.\n` +
      `• **Clearing Assets**: You can tell me *"Clear the asset bin"* or *"Clear all assets"* at any time to empty it.\n` +
      `• **Using Assets**: You can drag media directly onto the timeline, or tell me *"Match my images to the voiceover"* to auto-assemble a cut!`
    );
  }

  // 14. Loop & frustration recovery (avoid repeat canned bot loops)
  if (
    lower.includes('loop') ||
    lower.includes('stuck') ||
    lower.includes('repeating') ||
    lower.includes('again and again') ||
    lower.includes('keeps saying') ||
    lower.includes('same message') ||
    lower.includes('not working')
  ) {
    return (
      `I apologize for repeating that. Let's make sure we execute exactly what you need:\n\n` +
      `• **To empty your asset library**: Tell me *"Clear the asset bin"*.\n` +
      `• **To empty your timeline sequence**: Tell me *"Clear the timeline"*.\n` +
      `• **To add subtitles**: Tell me *"Add captions"*.\n` +
      `• **To convert for Shorts/TikTok**: Tell me *"Turn into 9:16 vertical Short"*.\n\n` +
      `Which action would you like me to perform right now?`
    );
  }

  // 15. Contextual fallback with anti-repetition protection
  const lastAssistantMsg = (chatHistory || [])
    .filter((m) => m.role === 'assistant')
    .slice(-1)[0]?.content || '';

  const alreadySentGreeting =
    lastAssistantMsg.includes("I'm ready to help with your project") ||
    lastAssistantMsg.includes("Your timeline currently has");

  if (alreadySentGreeting) {
    return (
      `Here are a few things we can do with your current project:\n\n` +
      `• **Asset Management**: Say *"Clear the asset bin"* to clear uploaded files, or import new media.\n` +
      `• **Timeline Actions**: Say *"Clear the timeline"* to reset clips, or *"Add captions"* to generate synchronized subtitles.\n` +
      `• **Aspect Ratio**: Say *"Make it 9:16"* for vertical Shorts or *"Make it 16:9"* for widescreen.\n\n` +
      `Let me know what you'd like to do next!`
    );
  }

  const clipCount = snapshot.videoClips.length;
  if (clipCount > 0) {
    return (
      `Your timeline currently has **${clipCount} clip${clipCount === 1 ? '' : 's'}** (${snapshot.aspectRatio || '16:9'}).\n\n` +
      `You can ask for advice on editing flow, or give me a direct command like *"Trim this clip"*, *"Delete the selected clip"*, or *"Add captions"*. How would you like to proceed?`
    );
  }

  return (
    `I'm ready to help with your project! You can ask questions about video editing or give me direct instructions to format, arrange, or build your timeline.`
  );
}
