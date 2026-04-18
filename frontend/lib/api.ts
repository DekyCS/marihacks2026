const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const DEMO_BARCODE_MAP: Record<string, string> = {
  '885652020954': 'treadmill',
  '702.611.31': 'gersby',
  '70261131': 'gersby',
  '501.784.11': 'latt',
  '50178411': 'latt',
};

export function resolveDemoBarcode(code: string): string | null {
  const raw = code.trim();
  const stripped = raw.replace(/[\s.-]/g, '');
  const candidates = [
    raw,
    stripped,
    stripped.replace(/^0+/, ''),
    stripped.startsWith('0') ? stripped.slice(1) : `0${stripped}`,
  ];
  return candidates.map((c) => DEMO_BARCODE_MAP[c]).find(Boolean) || null;
}

export interface BarcodeScanResult {
  pdf_hash: string;
  filename: string;
  product_name: string;
  source_url: string;
}

export type ScanStreamEvent =
  | { type: 'STARTED'; run_id: string }
  | { type: 'STREAMING_URL'; streaming_url: string }
  | { type: 'PROGRESS'; purpose: string }
  | { type: 'TF_API_RESULT'; result: unknown }
  | { type: 'HEARTBEAT' }
  | { type: 'COMPLETE'; status: string; error?: string | null }
  | { type: 'DOWNLOADING'; manual_url: string }
  | { type: 'READY'; pdf_hash: string; filename: string; product_name: string; source_url: string }
  | { type: 'ERROR'; message: string };

export function openScanStream(code: string): EventSource {
  const url = `${API_BASE_URL}/barcode/stream?code=${encodeURIComponent(code)}`;
  return new EventSource(url);
}

export interface ManualInfo {
  hash: string;
  filename: string;
  id?: string;
  name?: string;
  json?: string;
  pdf?: string;
  thumbnail?: string;
}

export interface ManualIndex {
  manuals: Array<{
    id: string;
    name: string;
    json: string;
    pdf: string;
    thumbnail?: string;
  }>;
}

export interface ProcessResult {
  pdf_hash: string;
  json_path: string;
  total_steps: number;
  total_components: number;
}

export interface Component {
  id: string;
  name: string;
  color: string;
  model_path: string;
  appears_in_steps?: number[];
  size?: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface StepData {
  step_number: number;
  title: string;
  description: string;
  step_image: string;
  page_number?: number;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  components: string[];
  component_positions: Record<string, {
    x: number;
    y: number;
    z: number;
    rotation?: {x: number; y: number; z: number};
    scale?: {x: number; y: number; z: number};
    movement?: {
      position: {x: number; y: number; z: number};
    };
  }>;
  audio_url: string;
  zoom?: number; // Camera zoom level for this step (default: 1, higher = closer)
}

export interface ManualJSON {
  manual_id: string;
  pdf_filename: string;
  components: Component[];
  steps: StepData[];
  processing_metadata?: any;
}

async function fetchDemoManuals(): Promise<ManualInfo[]> {
  try {
    const response = await fetch('/data/index.json');
    if (!response.ok) return [];
    const data: ManualIndex = await response.json();
    return data.manuals.map((m) => ({
      hash: m.id,
      filename: m.pdf.split('/').pop() || m.pdf,
      id: m.id,
      name: m.name,
      json: m.json,
      pdf: m.pdf,
      thumbnail: m.thumbnail,
    }));
  } catch {
    return [];
  }
}

export async function fetchManuals(): Promise<ManualInfo[]> {
  return fetchDemoManuals();
}

export async function uploadPDF(file: File): Promise<{success: boolean; pdf_hash: string; filename: string}> {
  if (DEMO_MODE) {
    throw new Error('Upload disabled in demo mode');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to upload PDF');
  }

  return response.json();
}

export async function processManual(pdfHash: string): Promise<ProcessResult> {
  if (DEMO_MODE) {
    throw new Error('Processing disabled in demo mode');
  }

  const response = await fetch(`${API_BASE_URL}/process/${pdfHash}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to process manual');
  }

  const data = await response.json();
  return data.result;
}

export async function scanBarcode(code: string): Promise<BarcodeScanResult> {
  const raw = code.trim();
  const stripped = raw.replace(/[\s.-]/g, '');
  const candidates = [
    raw,
    stripped,
    stripped.replace(/^0+/, ''),
    stripped.startsWith('0') ? stripped.slice(1) : `0${stripped}`,
  ];
  const demoId = candidates.map((c) => DEMO_BARCODE_MAP[c]).find(Boolean);
  if (demoId) {
    const manuals = await fetchDemoManuals();
    const manual = manuals.find((m) => m.hash === demoId || m.id === demoId);
    if (manual) {
      return {
        pdf_hash: manual.hash,
        filename: manual.filename,
        product_name: manual.name || manual.filename,
        source_url: 'demo://local',
      };
    }
  }

  if (DEMO_MODE) {
    throw new Error(`No manual found for barcode ${code}`);
  }

  const response = await fetch(`${API_BASE_URL}/barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: code }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to look up barcode');
  }

  const data = await response.json();
  return {
    pdf_hash: data.pdf_hash,
    filename: data.filename,
    product_name: data.product_name,
    source_url: data.source_url,
  };
}

// Map demo manual IDs to their folder paths under /public/data.
const MANUAL_FOLDERS: Record<string, string> = {
  '1': 'ikea',
  'latt': 'ikea',
  '2': 'treadmill',
  'treadmill': 'treadmill',
  'gersby': 'gersby',
};

export function isDemoManual(manualId?: string): boolean {
  return !!manualId && manualId in MANUAL_FOLDERS;
}

export async function fetchManualJSON(pdfHash: string): Promise<ManualJSON> {
  if (isDemoManual(pdfHash)) {
    const indexResponse = await fetch('/data/index.json');
    if (!indexResponse.ok) {
      throw new Error('Failed to load demo manuals index');
    }
    const indexData: ManualIndex = await indexResponse.json();
    const manual = indexData.manuals.find((m) => m.id === pdfHash);
    if (!manual) {
      throw new Error(`Demo data not found: ${pdfHash}`);
    }
    const response = await fetch(`/data/${manual.json}`);
    if (!response.ok) {
      throw new Error(`Demo data not found: ${pdfHash}`);
    }
    return response.json();
  }

  if (DEMO_MODE) {
    throw new Error(`Manual "${pdfHash}" is not part of the demo set.`);
  }

  const response = await fetch(`${API_BASE_URL}/json/${pdfHash}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manual JSON: ${response.statusText}`);
  }
  return response.json();
}

export function getFileUrl(filepath: string, manualId?: string): string {
  if (isDemoManual(manualId)) {
    const folder = MANUAL_FOLDERS[manualId!];
    return `/data/${folder}/${filepath}`;
  }
  return `${API_BASE_URL}/file/${filepath}`;
}

export function getComponentModelUrl(component: Component, manualId?: string): string {
  return getFileUrl(component.model_path, manualId);
}

export function getStepImageUrl(step: StepData, manualId?: string): string {
  return getFileUrl(step.step_image, manualId);
}

export function getStepAudioUrl(step: StepData, manualId?: string): string {
  return getFileUrl(step.audio_url, manualId);
}

export interface VoiceChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VoiceToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface VoiceChatResponse {
  text: string;
  toolCalls: VoiceToolCall[];
}

export async function chatVoice(
  messages: VoiceChatMessage[],
  stepsContext: string,
  currentStep: number,
  totalSteps: number,
  signal?: AbortSignal
): Promise<VoiceChatResponse> {
  const response = await fetch(`${API_BASE_URL}/voice/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      steps_context: stepsContext,
      current_step: currentStep,
      total_steps: totalSteps,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Voice chat failed (${response.status})`);
  }

  const data = await response.json();
  return {
    text: (data.text || '').trim(),
    toolCalls: Array.isArray(data.tool_calls) ? data.tool_calls : [],
  };
}

export function getPDFUrl(pdfFilename: string, manualId?: string): string {
  if (isDemoManual(manualId)) {
    const folder = MANUAL_FOLDERS[manualId!];
    return `/data/${folder}/${pdfFilename}`;
  }
  return `${API_BASE_URL}/file/${pdfFilename}`;
}
