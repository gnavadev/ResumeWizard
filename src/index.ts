import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import Store from "electron-store";
import { createWorker } from "tesseract.js";
import nodeLatex from "node-latex";
import fs from "fs";

// These are global variables injected by electron-forge's webpack plugin
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// Define the type for our store
interface AppStore {
  apiKey: string;
  documents: Array<{
    id: string;
    type: "resume" | "coverLetter";
    company: string;
    position: string;
    texPath: string;
    pdfPath: string;
    filePath: string;
    date: string;
    createdAt: string;
  }>;
  resumeTemplate: string;
  coverLetterTemplate: string;
  lastKeywords: string[];
  geminiModel: string; // Added geminiModel to your type
}

// Initialize electron-store with defaults
const store = new Store<AppStore>({
  defaults: {
    apiKey: "",
    documents: [],
    resumeTemplate: "",
    coverLetterTemplate: "",
    lastKeywords: [],
    geminiModel: "gemini-1.5-flash-latest", // Added default model
  },
});

let mainWindow: BrowserWindow | null = null;
let keywordsWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the main browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 900,
    minWidth: 600,
    minHeight: 700,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Override CSP for development
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https://generativelanguage.googleapis.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:",
          ],
        },
      });
    }
  );

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
    // Quit app when main window is closed
    app.quit();
  });
};

const createKeywordsWindow = (): void => {
  if (keywordsWindow) {
    keywordsWindow.focus();
    return;
  }

  // Add a null check for mainWindow
  if (!mainWindow) {
    console.error("Main window is not available to be a parent.");
    return;
  }

  keywordsWindow = new BrowserWindow({
    width: 400,
    height: 600,
    parent: mainWindow, // Set parent
    modal: false, // Set as non-modal
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Use the webpack entry and hash routing to point to the keywords page
  const keywordsUrl = `${MAIN_WINDOW_WEBPACK_ENTRY}#/keywords`;
  keywordsWindow.loadURL(keywordsUrl);

  keywordsWindow.on("closed", () => {
    keywordsWindow = null;
  });
};

// --- IPC Handlers ---

// Window operations
ipcMain.handle(
  "window:open",
  async (event, windowType: "keywords" | "settings") => {
    if (windowType === "keywords") {
      createKeywordsWindow();
    }
    // Add settings window creation if needed
    return { success: true };
  }
);

// Listen for request to open keywords window (legacy)
ipcMain.on("open-keywords-window", createKeywordsWindow);

// Listen for keywords update from main window
ipcMain.on("update-keywords", (event, keywords: string[]) => {
  if (keywordsWindow) {
    keywordsWindow.webContents.send("keywords-updated", keywords);
  }
});

// Listen for file path update from settings
ipcMain.on("template-path-updated", (event, filePath: string) => {
  if (mainWindow) {
    mainWindow.webContents.send("template-path-updated-renderer", filePath);
  }
});

// Document operations
ipcMain.handle("documents:get", async () => {
  try {
    const documents = store.get("documents", []);
    return documents;
  } catch (error) {
    console.error("Failed to get documents:", error);
    return [];
  }
});

// File operations
ipcMain.handle("dialog:openFile", async (event, filePath?: string) => {
  if (filePath) {
    // Open the file with default application
    try {
      await shell.openPath(filePath);
      return filePath;
    } catch (error) {
      console.error("Failed to open file:", error);
      return null;
    }
  } else {
    // Show file picker
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "All Files", extensions: ["*"] },
        { name: "PDF", extensions: ["pdf"] },
        { name: "LaTeX", extensions: ["tex"] },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
  }
});

// Template operations
ipcMain.handle("template:upload", async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "LaTeX Templates", extensions: ["tex"] }],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, "utf-8");
    const name = path.basename(filePath);

    return { name, content };
  } catch (error) {
    console.error("Failed to upload template:", error);
    return null;
  }
});

// Keywords operations
ipcMain.handle("keywords:get", async () => {
  try {
    return store.get("lastKeywords", []);
  } catch (error) {
    console.error("Failed to get keywords:", error);
    return [];
  }
});

// Image processing
ipcMain.handle("image:process", async (event, base64Image: string) => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Save to temp file
    const tempPath = path.join(
      app.getPath("temp"),
      `screenshot-${Date.now()}.png`
    );
    fs.writeFileSync(tempPath, buffer);

    // Perform OCR
    const worker = await createWorker("eng");
    const ret = await worker.recognize(tempPath);
    await worker.terminate();

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // Send result to renderer
    if (mainWindow) {
      mainWindow.webContents.send("ocr:result", ret.data.text);
    }

    return { success: true, text: ret.data.text };
  } catch (error) {
    console.error("Image processing failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (mainWindow) {
      mainWindow.webContents.send("generation:error", errorMessage);
    }
    return { success: false, error: errorMessage };
  }
});

// Document generation
ipcMain.handle(
  "document:generate",
  async (
    event,
    options: {
      type: "resume" | "cover-letter";
      jobDescription: string;
      resumeTemplate?: { name: string; content: string } | null;
      coverLetterTemplate?: { name: string; content: string } | null;
    }
  ) => {
    try {
      const apiKey = store.get("apiKey");
      if (!apiKey) {
        return { success: false, error: "API key is not set." };
      }

      // Determine which template to use
      const template =
        options.type === "resume"
          ? options.resumeTemplate?.content
          : options.coverLetterTemplate?.content;

      if (!template) {
        return {
          success: false,
          error: `No ${options.type} template selected.`,
        };
      }

      // *** ADDED CHARACTER COUNT LOGIC ***
      const templateLength = template.length;

      // Generate content using Gemini
      const selectedModel = store.get("geminiModel", "gemini-2.5-flash");

      // *** UPDATED PROMPT ***
      const prompt = `
You are to generate a tailored ${options.type} by modifying the LaTeX résumé below to best match the following job description:

${options.jobDescription}

Guidelines:
1. Keep all LaTeX structure, commands, formatting, and packages EXACTLY as is. Do NOT add, remove, or rename sections, environments, or LaTeX syntax.
2. Modify the content (text only) within each section — such as Skills, Experience, Projects, and Leadership — to highlight the most relevant experience, technologies, and achievements that match the job description.
3. Adjust bullet points to emphasize alignment with the role’s keywords, responsibilities, and tools.
4. Preserve the résumé’s professional tone, concise phrasing, and quantitative, results-oriented style.
5. **CRITICAL CHARACTER LIMIT:** The original template is ${templateLength} characters. Your final output MUST be less than this. This is the most important rule. Edit existing content; do not add new content that increases length.
6. Retain the candidate’s identity, layout, and formatting integrity — only update text content for relevance.
7. Ensure that all output is syntactically valid LaTeX code.
8. Escape LaTeX special characters when they appear in plain text:
   - \\#  → represents '#'
   - \\$  → represents '$'
   - \\%  → represents '%'
   - \\&  → represents 'and' (prefer writing 'and' instead)
   - \\_  → represents '_'
   - \\{  → represents '{'
   - \\}  → represents '}'
   - \\^{} → represents '^'
   - \\~{} → represents '~'
   - Backslashes (\\\\) are part of LaTeX commands and must not be added or removed except where required for proper escaping.

LaTeX résumé to modify:
${template}

Output requirements:
- Return ONLY valid LaTeX code.
- Do NOT include markdown formatting, code blocks, explanations, or commentary.
- The result must compile successfully as a standalone LaTeX document.
`;
      // *** UPDATED SYSTEM PROMPT ***
      const systemPrompt = `
  You are a LaTeX and professional résumé optimization expert.

  Your role:
  - Edit the provided LaTeX résumé to tailor it perfectly to the job description.
  - **CRITICAL CHARACTER LIMIT:** The ORIGINAL LaTeX template is ${templateLength} characters long. Your FINAL output MUST NOT exceed this length. This is your #1 priority.
  - Replace and refine text content only; do NOT modify LaTeX structure, section titles, commands, or spacing.
  - Emphasize the most relevant skills, achievements, and technologies from the résumé that match the job posting.
  - Use concise, impact-driven bullet points with quantifiable results.
  - Output ONLY valid LaTeX code — no markdown, no commentary, no extra text.
  `;

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(
          `API request failed with status ${response.status}: ${
            errorBody.error?.message || "Unknown error"
          }`
        );
      }

      const result = await response.json();
      let latexContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!latexContent) {
        return { success: false, error: "No content generated from API." };
      }

      // Clean up the latex content - remove markdown code blocks if present
      latexContent = latexContent
        .replace(/```latex\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // Save the LaTeX content to a temp file for debugging
      const debugTexPath = path.join(
        app.getPath("temp"),
        `debug-${Date.now()}.tex`
      );
      fs.writeFileSync(debugTexPath, latexContent);
      console.log("LaTeX content saved to:", debugTexPath);

      // Generate PDF
      const fileName = `${options.type}-${Date.now()}.pdf`;
      const outputPath = path.join(app.getPath("documents"), fileName);

      const pdfStream = nodeLatex(latexContent, {
        // Add error logging
        errorLogs: path.join(
          app.getPath("temp"),
          `latex-error-${Date.now()}.log`
        ),
      });

      const output = fs.createWriteStream(outputPath);

      let latexError = "";
      pdfStream.on("error", (err) => {
        latexError = err.message;
        console.error("LaTeX compilation error:", err);
      });

      pdfStream.pipe(output);

      await new Promise<void>((resolve, reject) => {
        output.on("finish", () => {
          if (latexError) {
            reject(
              new Error(
                `LaTeX compilation failed: ${latexError}\nCheck the .tex file at: ${debugTexPath}`
              )
            );
          } else {
            resolve();
          }
        });
        output.on("error", reject);
      });

      // Rest of the code stays the same...
      // Save document to store, generate keywords, etc.

      const documents = store.get("documents", []);
      documents.push({
        id: Date.now().toString(),
        type: options.type === "resume" ? "resume" : "coverLetter",
        company: "Generated",
        position: "Position",
        texPath: debugTexPath,
        pdfPath: outputPath,
        filePath: outputPath,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      store.set("documents", documents);

      // Generate and store keywords if resume
      if (options.type === "resume") {
        const keywordsPrompt = `Extract key skills and keywords from this job description:\n\n${options.jobDescription}`;
        const keywordsSystemPrompt =
          "You are a keyword extraction expert. Return only a comma-separated list of keywords.";

        const keywordsResponse = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: keywordsPrompt }] }],
            systemInstruction: {
              parts: [{ text: keywordsSystemPrompt }],
            },
          }),
        });

        if (keywordsResponse.ok) {
          const keywordsResult = await keywordsResponse.json();
          const keywordsText =
            keywordsResult.candidates?.[0]?.content?.parts?.[0]?.text;
          if (keywordsText) {
            const keywords = keywordsText
              .split(",")
              .map((k: string) => k.trim());
            store.set("lastKeywords", keywords);

            // Send keywords update to keywords window
            if (keywordsWindow) {
              keywordsWindow.webContents.send("keywords:update", keywords);
            }
          }
        }
      }

      if (mainWindow) {
        mainWindow.webContents.send("generation:complete", outputPath);
      }

      return { success: true, filePath: outputPath };
    } catch (error) {
      console.error("Document generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (mainWindow) {
        mainWindow.webContents.send("generation:error", errorMessage);
      }
      return { success: false, error: errorMessage };
    }
  }
);

// Gemini API Caller
ipcMain.handle("call-gemini", async (event, { prompt, systemPrompt }) => {
  const apiKey = store.get("apiKey");
  if (!apiKey) {
    return { success: false, error: "API key is not set." };
  }

  const selectedModel = store.get("geminiModel", "gemini-1.5-flash-latest"); // Corrected
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(
        `API request failed with status ${response.status}: ${
          errorBody.error?.message || "Unknown error"
        }`
      );
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      return { success: true, text };
    } else {
      return {
        success: false,
        error: "No text returned from API.",
        fullResponse: result,
      };
    }
  } catch (error) {
    console.error("Failed to call Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// OCR Handler
ipcMain.handle("perform-ocr", async (event, imagePath) => {
  try {
    const worker = await createWorker("eng");
    const ret = await worker.recognize(imagePath);
    await worker.terminate();
    return { success: true, text: ret.data.text };
  } catch (error) {
    console.error("OCR failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// File Dialog Handlers
ipcMain.handle("open-file-dialog", async (event, type) => {
  const filters =
    type === "image"
      ? [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "webp"] }]
      : [{ name: "LaTeX Templates", extensions: ["tex"] }];

  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters,
  });

  if (canceled || filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, filePath: filePaths[0] };
});

ipcMain.handle("open-save-dialog", async (event, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: "PDF Document", extensions: ["pdf"] }],
  });

  if (canceled) {
    return { success: false };
  }
  return { success: true, filePath };
});

// File System Handlers
ipcMain.handle("read-file", async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { success: true, content };
  } catch (error) {
    console.error(`Failed to read file: ${filePath}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle("save-file", async (event, { filePath, data }) => {
  try {
    // Type guard to ensure data is a Uint8Array
    if (!(data instanceof Uint8Array)) {
      throw new Error("Invalid data format. Expected Uint8Array.");
    }
    fs.writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (error) {
    console.error(`Failed to save file: ${filePath}`, error);
    // Type guard for error
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// In the main process:
ipcMain.handle("generate-latex", async (event, { latexContent, filePath }) => {
  try {
    // The 'node-latex' package returns a stream
    const pdfStream = nodeLatex(latexContent);

    // We need to pipe this stream to a file
    const output = fs.createWriteStream(filePath);
    pdfStream.pipe(output);

    // Wait for the stream to finish writing
    await new Promise<void>((resolve, reject) => {
      output.on("finish", () => resolve());
      pdfStream.on("error", reject);
    });

    return { success: true, filePath };
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// Electron Store Handlers
ipcMain.handle("get-store-value", (event, key) => {
  return store.get(key);
});

ipcMain.handle("set-store-value", (event, { key, value }) => {
  try {
    store.set(key, value);
    return { success: true };
  } catch (error) {
    console.error(`Failed to set store value for key: ${key}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// Store operations (for compatibility with preload)
ipcMain.handle("store:get", (event, key) => {
  return store.get(key);
});

ipcMain.handle("store:set", (event, key, value) => {
  try {
    store.set(key, value);
    return { success: true };
  } catch (error) {
    console.error(`Failed to set store value for key: ${key}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// --- App Lifecycle ---

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
// eslint-disable-next-line @typescript-eslint/no-var-requires
// require('electron-reload')(__dirname, {
//   electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron'),
// });

