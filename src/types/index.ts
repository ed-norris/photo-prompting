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
}

export interface ModelsResponse {
  imageModels: ModelInfo[];
  textModels: ModelInfo[];
}

// Debug info captured at generation time
export interface DebugParams {
  models: string[];
  imagesPerModel: number;
  width?: number;
  height?: number;
  steps?: number;
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
