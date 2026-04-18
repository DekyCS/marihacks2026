const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEMO_MODE = true;

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

export async function fetchManuals(): Promise<ManualInfo[]> {
  if (DEMO_MODE) {
    const response = await fetch('/data/index.json');
    if (!response.ok) {
      throw new Error('Failed to load demo manuals index');
    }
    const data: ManualIndex = await response.json();
    return data.manuals.map(m => ({
      hash: m.id,
      filename: m.name,
      id: m.id,
      name: m.name,
      json: m.json,
      pdf: m.pdf,
      thumbnail: m.thumbnail
    }));
  }

  const response = await fetch(`${API_BASE_URL}/manuals`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manuals: ${response.statusText}`);
  }
  const data = await response.json();
  return data.manuals || [];
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

export async function fetchManualJSON(pdfHash: string): Promise<ManualJSON> {
  if (DEMO_MODE) {
    // First get the index to find the correct JSON path
    const indexResponse = await fetch('/data/index.json');
    if (!indexResponse.ok) {
      throw new Error('Failed to load demo manuals index');
    }
    const indexData: ManualIndex = await indexResponse.json();
    const manual = indexData.manuals.find(m => m.id === pdfHash);

    if (!manual) {
      throw new Error(`Demo data not found: ${pdfHash}`);
    }

    const response = await fetch(`/data/${manual.json}`);
    if (!response.ok) {
      throw new Error(`Demo data not found: ${pdfHash}`);
    }
    return response.json();
  }

  const response = await fetch(`${API_BASE_URL}/json/${pdfHash}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manual JSON: ${response.statusText}`);
  }
  return response.json();
}

// Map manual IDs to their folder paths
const MANUAL_FOLDERS: Record<string, string> = {
  '1': 'ikea',
  'latt': 'ikea',
  '2': 'treadmill',
  'treadmill': 'treadmill'
};

export function getFileUrl(filepath: string, manualId?: string): string {
  if (DEMO_MODE && manualId) {
    const folder = MANUAL_FOLDERS[manualId] || 'ikea';
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

export function getPDFUrl(pdfFilename: string, manualId?: string): string {
  if (DEMO_MODE && manualId) {
    const folder = MANUAL_FOLDERS[manualId] || 'ikea';
    return `/data/${folder}/${pdfFilename}`;
  }

  return `${API_BASE_URL}/file/${pdfFilename}`;
}
