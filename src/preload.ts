import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

export interface ElectronAPI {
  // File operations
  openFile: (filePath?: string) => Promise<string | null>;

  // Store operations
  getStoreValue: (key: string) => Promise<unknown>;
  setStoreValue: (key: string, value: unknown) => Promise<void>;
  getApiKey: () => Promise<string>;
  setApiKey: (apiKey: string) => Promise<void>;

  // Document operations
  getDocuments: () => Promise<
    Array<{
      id: string;
      type: "resume" | "coverLetter";
      company: string;
      position: string;
      texPath: string;
      pdfPath: string;
      filePath: string;
      date: string;
      createdAt: string;
    }>
  >;

  // Template operations
  uploadTemplate: () => Promise<{ name: string; content: string } | null>;

  // OCR and Image processing
  performOcr: (imagePath: string) => Promise<string>;
  processImage: (base64Image: string) => Promise<void>;

  // AI operations
  callGemini: (
    prompt: string,
    jobDescription: string,
    template: string
  ) => Promise<string>;
  generateKeywords: (jobDescription: string) => Promise<string[]>;
  getLastKeywords: () => Promise<string[]>;

  // Document generation
  generatePdf: (
    latexContent: string,
    fileName: string
  ) => Promise<string | null>;
  generateDoc: (options: {
    type: "resume" | "cover-letter";
    jobDescription: string;
    resumeTemplate?: { name: string; content: string } | null;
    coverLetterTemplate?: { name: string; content: string } | null;
  }) => Promise<{ success: boolean; error?: string }>;

  // Window operations
  openWindow: (windowType: "keywords" | "settings") => Promise<void>;

  // Event listeners
  onOcrResult: (callback: (text: string) => void) => void;
  onKeywordsResult: (callback: (keywords: string[]) => void) => void;
  onKeywordsUpdate: (callback: (keywords: string[]) => void) => void;
  onGenerationComplete: (callback: (filePath: string) => void) => void;
  onGenerationError: (callback: (error: string) => void) => void;
  onKeywordsWindowRequest: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

contextBridge.exposeInMainWorld("electronAPI", {
  // File operations
  openFile: (filePath?: string) =>
    ipcRenderer.invoke("dialog:openFile", filePath),

  // Store operations
  getStoreValue: (key: string) => ipcRenderer.invoke("store:get", key),
  setStoreValue: (key: string, value: unknown) =>
    ipcRenderer.invoke("store:set", key, value),
  getApiKey: () => ipcRenderer.invoke("store:get", "apiKey"),
  setApiKey: (apiKey: string) =>
    ipcRenderer.invoke("store:set", "apiKey", apiKey),

  // Document operations
  getDocuments: () => ipcRenderer.invoke("documents:get"),

  // Template operations
  uploadTemplate: () => ipcRenderer.invoke("template:upload"),

  // OCR and Image processing
  performOcr: (imagePath: string) =>
    ipcRenderer.invoke("ocr:perform", imagePath),
  processImage: (base64Image: string) =>
    ipcRenderer.invoke("image:process", base64Image),

  // AI operations
  callGemini: (prompt: string, jobDescription: string, template: string) =>
    ipcRenderer.invoke("gemini:call", prompt, jobDescription, template),
  generateKeywords: (jobDescription: string) =>
    ipcRenderer.invoke("gemini:keywords", jobDescription),
  getLastKeywords: () => ipcRenderer.invoke("keywords:get"),

  // Document generation
  generatePdf: (latexContent: string, fileName: string) =>
    ipcRenderer.invoke("latex:generate", latexContent, fileName),
  generateDoc: (options: {
    type: "resume" | "cover-letter";
    jobDescription: string;
    resumeTemplate?: { name: string; content: string } | null;
    coverLetterTemplate?: { name: string; content: string } | null;
  }) => ipcRenderer.invoke("document:generate", options),

  // Window operations
  openWindow: (windowType: "keywords" | "settings") =>
    ipcRenderer.invoke("window:open", windowType),

  // Event listeners
  onOcrResult: (callback: (text: string) => void) =>
    ipcRenderer.on("ocr:result", (_event: IpcRendererEvent, text: string) =>
      callback(text)
    ),
  onKeywordsResult: (callback: (keywords: string[]) => void) =>
    ipcRenderer.on(
      "gemini:keywords-result",
      (_event: IpcRendererEvent, keywords: string[]) => callback(keywords)
    ),
  onKeywordsUpdate: (callback: (keywords: string[]) => void) =>
    ipcRenderer.on(
      "keywords:update",
      (_event: IpcRendererEvent, keywords: string[]) => callback(keywords)
    ),
  onGenerationComplete: (callback: (filePath: string) => void) =>
    ipcRenderer.on(
      "generation:complete",
      (_event: IpcRendererEvent, filePath: string) => callback(filePath)
    ),
  onGenerationError: (callback: (error: string) => void) =>
    ipcRenderer.on(
      "generation:error",
      (_event: IpcRendererEvent, error: string) => callback(error)
    ),
  onKeywordsWindowRequest: (callback: () => void) =>
    ipcRenderer.on("keywords:open-window", () => callback()),
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
});
