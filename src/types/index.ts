// Photography suggestion data
export interface SuggestionTerm {
  label: string;
  description?: string;
}

export interface SuggestionCategory {
  name: string;
  terms: SuggestionTerm[];
}

// Generation request/response
export interface GenerateRequest {
  prompt: string;
  models: string[];
  imagesPerModel: number;
  width?: number;
  height?: number;
  steps?: number;
  imageDataUri?: string; // base64 data URI — enables T+I→I mode
}

export interface GeneratedImage {
  dataUri: string;
  durationMs: number;
}

export interface ModelResult {
  model: string;
  images: GeneratedImage[];
  error?: string;
}

export interface GenerateResponse {
  id: string;
  prompt: string;
  results: ModelResult[];
}

// SSE event emitted per completed image
export interface ImageSSEEvent {
  model: string;
  imageIndex: number;
  dataUri: string;
  durationMs: number;
  error?: string;
}

// Variation suggestion
export interface SuggestRequest {
  prompt: string;
  count: number;
}

export interface SuggestResponse {
  variations: string[];
}

// Model info
export interface ModelInfo {
  name: string;
  size: string;
  imageInput?: boolean; // true = supports text + image → image (T+I→I tab)
}

export interface ModelsResponse {
  imageModels: ModelInfo[];
  textModels: ModelInfo[];
  videoModels?: ModelInfo[];
}

// Video generation
export interface VideoRow {
  id: string;
  prompt: string;
  model: string;
  status: "generating" | "complete" | "error";
  filePath?: string;
  error?: string;
  durationMs?: number;
  startedAt: number;
}

export interface VideoSSEEvent {
  status: "generating" | "done" | "error";
  elapsedMs?: number;
  filePath?: string;
  durationMs?: number;
  error?: string;
}

// Debug info captured at generation time
export interface DebugParams {
  models: string[];
  imagesPerModel: number;
  width?: number;
  height?: number;
  steps?: number;
  imageDataUri?: string; // preserved so retry can re-send the same image
}

// UI state
export interface PromptRow {
  id: string;
  prompt: string;
  status: "pending" | "generating" | "complete" | "error";
  results: ModelResult[];
  timestamp: number;
  debugParams?: DebugParams;
}
