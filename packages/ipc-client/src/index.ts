// IPC Client Services for Renderer Process
// These services call Electron main process via IPC
// Can be used in React Web or React Native (with appropriate IPC bridge)

export { dbService } from './dbService';

export { ocrService, summaryService } from './aiService';
export type { OCRRequest, OCRResponse, SummaryRequest, SummaryResponse } from './aiService';
