process.env.DISABLE_HMR = 'true';

import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));

  // AI Conversational Editor Backend Endpoint
  app.post('/api/ai-editor/chat', async (req, res) => {
    try {
      const { message, script, assets, style, currentTimeline, editorMode = 'general', cutGuide, chatHistory } = req.body;
      const ai = getGenAI();

      if (!ai) {
        // Return structured signal to use local deterministic AI engine seamlessly
        return res.json({
          mode: 'fallback',
          message: 'Local timeline engine active.',
        });
      }

      const systemPrompt = `You are the AI Assistant and Controller for a professional Video Editor (General Editor and Recap Generator).

CORE ARCHITECTURE & VISUAL-TO-AUDIO MATCHING ENGINE RULES:
- The General Auto Editor utilizes an authoritative script-beat-to-visual matching engine.
- When answering questions about how matching works, whether filename matching overrides visual content, or how visual assets are selected:
  * "No. Filename numbers or labels are only supporting evidence. The actual visual content, action, meaning, and context of the image are primary. A filename alone cannot override a visually incorrect asset."
  * Actual visual content is authoritative: The engine profiles detected actions, characters/people, key objects, and scene environment to match the meaning of each script beat. Active character and motion shots are prioritized over static backgrounds.
  * Filename numbers/labels (such as "23a") are supporting evidence only: they provide a minor supporting confidence boost when the visual content already aligns with the beat, but can NEVER by themselves produce a STRONG_MATCH.
  * Contradiction penalty & downgrade: If an asset's filename contains a beat label (such as "23a") but the actual image content contradicts or fails to depict beat 23a, the match is penalized and downgraded. A visually matching asset will always win over a contradictory filename.
  * Voiceover audio is master clock: Voiceover audio timing strictly governs clip duration and timing, while numbered/lettered script beats preserve narrative sequence.
  * CRITICAL RESTRICTION: Do NOT refer to ImageSync as the matching engine for this General Auto Editor. Do NOT claim that filename numbering takes top priority over computer-vision visual analysis. Do not claim features, EDL workflows, or priorities that are not actually implemented.

You MUST determine the user's intent before taking any action.

INTENT TYPES:

TYPE 1 — NORMAL CHAT / DISCUSSION
If the user is asking a question, discussing an idea, asking for advice, explaining something, or talking about their video or matching logic without explicitly requesting an editor change:
→ Respond normally in chat.
→ DO NOT modify the editor. Set "operations": [], "plan": null, "actionType": null.
→ Examples: "What can you do?", "How should I edit this?", "Does filename matching override the actual visual content of an image?", "How does visual matching work?", "What transition would look good here?", "Why is my video too long?", "I want this video to feel more cinematic.", "What does this button do?", "What does the timeline do?"

AMBIGUOUS REQUESTS
If the user's message mentions an editing problem or observation without a direct instruction:
→ DO NOT guess. Ask a short clarification.
→ NEVER modify the editor merely because the user mentioned an editing problem.
→ Set "operations": [], "plan": null, "actionType": null.
→ Example: User says "The timeline is messy." → Respond: "Do you want me to clean it up, or are you just describing the problem?"

TYPE 2 — EXPLICIT EDITING COMMAND
If the user clearly instructs the AI to change something in the editor:
→ Output "intent": "EXPLICIT_COMMAND" with the specific "actionType":
  - "CLEAR_ASSETS" (e.g. "Remove all assets", "Clear all assets")
  - "CLEAR_TIMELINE" (e.g. "Clear the timeline", "Empty timeline")
  - "DELETE_EVERYTHING" (e.g. "Delete everything")
  - "DELETE_CLIP" (e.g. "Delete this clip", "Remove this clip")
  - "REMOVE_AUDIO" (e.g. "Remove the audio", "Delete audio")
  - "ADD_IMAGE" (e.g. "Add this image")
  - "MOVE_CLIP" (e.g. "Move this image to 10 seconds")
  - "SET_CLIP_DURATION" (e.g. "Make this clip 5 seconds")
  - "UNDO" (e.g. "Undo that")
  - "REDO" (e.g. "Redo that")
  - "CLEAR_CAPTIONS" (e.g. "Remove all captions")
  - "CLEAR_TRANSITIONS" (e.g. "Remove all transitions")
  - "CHANGE_ASPECT_RATIO" (e.g. "Change aspect ratio to 16:9")
  - "REMOVE_SILENCE" (e.g. "Remove silence", "Cut pauses")
  - "DUCK_MUSIC" (e.g. "Duck music to 15%")
  - "ADD_CAPTIONS" (e.g. "Add captions")
  - "ADD_BACKGROUND_MUSIC" (e.g. "Add background music")
  - "BUILD_RECAP" (e.g. "Build the recap", "image-to-audio matching", "match the numbered script", "sync images to audio", "assemble sequence", or pasted script/cut guide)
  - "AUTO_EDIT_PLAN" (e.g. "Make a top 5 ranking", "Auto edit this video")

Output strictly valid JSON with format:
{
  "intent": "NORMAL_CHAT" | "AMBIGUOUS" | "EXPLICIT_COMMAND",
  "actionType": string | null,
  "parameters": { ... },
  "reply": "Conversational explanation or confirmation...",
  "operations": [],
  "updatedAspectRatio": null
}`;

      const userPrompt = `MODE: ${editorMode}
USER REQUEST: ${message}
RECENT CONVERSATION HISTORY: ${JSON.stringify((chatHistory || []).slice(-4))}
SCRIPT/NARRATION: ${script || 'None provided'}
CUT GUIDE: ${cutGuide || 'None provided'}
STYLE PREFERENCE: ${style?.name || 'Default'}
REGISTERED ASSETS: ${JSON.stringify(assets || [])}
CURRENT TIMELINE STATE: ${JSON.stringify(currentTimeline || {})}`;

      const candidateModels = [
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];
      let responseText = '';

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
            },
          });

          if (response.text) {
            responseText = response.text.trim();
            break; // Succeeded!
          }
        } catch {
          // Attempt next model candidate if available
          continue;
        }
      }

      if (!responseText) {
        // Fallback seamlessly to local deterministic reasoning engine
        return res.json({
          mode: 'fallback',
          message: 'Deterministic local editor active.',
        });
      }

      // Clean markdown codeblocks if present
      let cleanJson = responseText;
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanJson);

      return res.json({
        mode: 'gemini',
        ...parsed,
      });
    } catch (err: any) {
      console.warn('Gemini chat processing fallback handled gracefully.');
      return res.json({
        mode: 'fallback',
        message: 'Using client-side timeline reasoning engine.',
      });
    }
  });

  // Gemini Speech-to-Text Audio Alignment Endpoint
  app.post('/api/ai-editor/align-audio', async (req, res) => {
    let tempAudioPath: string | null = null;
    let uploadedFileUri: string | null = null;

    try {
      const { audioBase64, mimeType = 'audio/mp3', audioDuration, beats = [] } = req.body;
      const ai = getGenAI();

      if (!ai) {
        return res.json({
          success: false,
          fallback: true,
          message: 'No GEMINI_API_KEY configured on server.',
        });
      }

      if (!audioBase64 || beats.length === 0) {
        return res.status(400).json({
          success: false,
          fallback: true,
          message: 'Missing audioBase64 or script beats.',
        });
      }

      // 1. Audio handling:
      // For large audio files (e.g., an 8.5-minute MP3) or long scripts,
      // upload once to Gemini File API to prevent memory/token overflows and reuse the URI across batches.
      try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'mp3';
        tempAudioPath = path.join(os.tmpdir(), `gemini-align-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`);
        await fs.promises.writeFile(tempAudioPath, audioBuffer);

        // Upload to File API if supported
        if (typeof ai.files?.upload === 'function') {
          const uploadResp = await ai.files.upload({
            file: tempAudioPath,
            config: {
              mimeType: mimeType || 'audio/mp3',
            },
          });
          if (uploadResp && uploadResp.uri) {
            uploadedFileUri = uploadResp.uri;
          }
        }
      } catch (uploadErr) {
        console.warn('File API upload notice (falling back to inline audio):', uploadErr);
      }

      // Build audio content part: File URI if available, otherwise inlineData
      const audioPart = uploadedFileUri
        ? { fileData: { fileUri: uploadedFileUri, mimeType: mimeType || 'audio/mp3' } }
        : { inlineData: { mimeType: mimeType || 'audio/mp3', data: audioBase64 } };

      // 2. Handle Long Scripts (e.g. 270 numbered lines across 8.5-minute narration)
      // Chunking into batches of 140 beats minimizes API roundtrips and prevents rate limit exhaustion
      const BATCH_SIZE = 140;
      const beatBatches: any[][] = [];
      for (let i = 0; i < beats.length; i += BATCH_SIZE) {
        beatBatches.push(beats.slice(i, i + BATCH_SIZE));
      }

      const allAlignedBeats: any[] = [];
      const candidateModels = [
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];

      // Structured JSON Schema for 100% reliable extraction
      const alignmentSchema = {
        type: Type.ARRAY,
        description: 'List of aligned script beats with exact audio start and end timestamps',
        items: {
          type: Type.OBJECT,
          properties: {
            beat_index: {
              type: Type.NUMBER,
              description: 'The numeric index of the script line',
            },
            text: {
              type: Type.STRING,
              description: 'The spoken text of the script line',
            },
            start_time: {
              type: Type.NUMBER,
              description: 'Exact second in floating-point seconds (e.g. 14.35) where narrator begins speaking this line',
            },
            end_time: {
              type: Type.NUMBER,
              description: 'Exact second in floating-point seconds (e.g. 17.80) where narrator finishes speaking this line',
            },
            confidence: {
              type: Type.STRING,
              description: 'Confidence level: high, medium, or low',
            },
          },
          required: ['beat_index', 'text', 'start_time', 'end_time', 'confidence'],
        },
      };

      let lastModelError = '';

      for (let batchIdx = 0; batchIdx < beatBatches.length; batchIdx++) {
        const batch = beatBatches[batchIdx];
        const isMultiBatch = beatBatches.length > 1;
        const batchSummary = isMultiBatch
          ? `NOTE: This is Batch ${batchIdx + 1} of ${beatBatches.length} (covering Beats ${batch[0].beat_index} to ${batch[batch.length - 1].beat_index} of ${beats.length} total script beats). Align these specific lines against their location in the spoken narration.`
          : '';

        const systemPrompt = `You are an expert speech-to-text audio alignment and subtitle timestamping engine for video editors.
Listen to the attached audio file and align it against the provided numbered script. For every numbered script line, identify the exact second where the narrator begins speaking that line and where they finish speaking it.

${batchSummary}
${audioDuration ? `Total Audio Duration: ${audioDuration} seconds.` : ''}

RULES:
1. start_time must be the exact second (in floating-point seconds, e.g. 14.35) where the narrator begins speaking this script line.
2. end_time must be the exact second (e.g. 17.80) where the narrator finishes speaking this script line (end_time > start_time).
3. The timestamps must progress monotonically through the audio.
4. Return a strict JSON array where each item has:
   {
     "beat_index": number,
     "text": string,
     "start_time": number,
     "end_time": number,
     "confidence": "high" | "medium" | "low"
   }
5. Do NOT skip any numbered script line from the provided list.`;

        const userPrompt = `NUMBERED SCRIPT LINES TO ALIGN:
${JSON.stringify(
  batch.map((b: any) => ({
    beat_index: b.beat_index,
    text: b.text,
  })),
  null,
  2
)}`;

        let batchResponseText = '';

        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [
                  audioPart,
                  {
                    text: userPrompt,
                  },
                ],
              },
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: alignmentSchema,
              },
            });

            if (response.text) {
              batchResponseText = response.text.trim();
              break;
            }
          } catch (modelErr: any) {
            const errMsg = String(modelErr?.message || modelErr);
            console.warn(`Model ${modelName} alignment attempt failed:`, errMsg);
            lastModelError = errMsg;
            if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('503')) {
              // Avoid burning further quota or stalling the client; break to fast deterministic fallback
              break;
            }
            continue;
          }
        }

        if (batchResponseText) {
          let cleanJson = batchResponseText;
          if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          try {
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed)) {
              allAlignedBeats.push(...parsed);
            }
          } catch (pe) {
            console.warn('Failed to parse Gemini alignment JSON for batch:', pe);
          }
        }
      }

      if (allAlignedBeats.length > 0) {
        // Sort monotonically by beat_index
        allAlignedBeats.sort((a, b) => Number(a.beat_index) - Number(b.beat_index));

        return res.json({
          success: true,
          mode: 'gemini_speech_to_text',
          alignedBeats: allAlignedBeats,
        });
      }

      return res.json({
        success: false,
        error: lastModelError || 'Gemini speech-to-text alignment could not generate timestamps for the audio.',
        message: lastModelError || 'Could not extract Gemini alignment.',
      });
    } catch (err: any) {
      console.warn('Audio alignment endpoint error:', err);
      return res.json({
        success: false,
        fallback: true,
        error: err.message,
      });
    } finally {
      // Clean up temporary audio file
      if (tempAudioPath) {
        fs.promises.unlink(tempAudioPath).catch(() => {});
      }
    }
  });

  // Dedicated Chart Workspace Chat Endpoint (Session conversation)
  app.post('/api/chart/chat', async (req, res) => {
    try {
      const { message = '' } = req.body;
      const cleanMessage = String(message).trim();
      const firstLine = cleanMessage.split('\n')[0] || 'Chart Conversation';
      const sessionTitle = firstLine.length > 35 ? `${firstLine.slice(0, 32)}...` : firstLine || 'New Chart';

      return res.json({
        reply: `Received your note for "${sessionTitle}". This conversation has been saved to your Chart History on the left.`,
        sessionTitle,
      });
    } catch {
      return res.json({
        reply: 'Message recorded in chart conversation history.',
        sessionTitle: 'Chart Session',
      });
    }
  });

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CapCut Editor Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
