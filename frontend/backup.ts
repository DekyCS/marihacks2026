const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ManualInfo {
  hash: string;
  filename: string;
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
  type: string;
  color: string;
  clean_image: string;
  model_path: string;
  image_hash: string;
  comparison_method: string;
}

export interface StepData {
  step_number: number;
  title: string;
  description: string;
  step_image: string;
  components_used: string[];
  components_moving: string[];
  components_static: string[];
  component_positions: Record<string, {x: number; y: number; z: number}>;
  audio_url: string;
}

export interface ManualJSON {
  manual_id: string;
  pdf_filename: string;
  components: Component[];
  steps: StepData[];
}

export async function fetchManuals(): Promise<ManualInfo[]> {
  const response = await fetch(`${API_BASE_URL}/manuals`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manuals: ${response.statusText}`);
  }
  const data = await response.json();
  return data.manuals || [];
}

export async function uploadPDF(file: File): Promise<{success: boolean; pdf_hash: string; filename: string}> {
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
  const response = await fetch(`${API_BASE_URL}/json/${pdfHash}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manual JSON: ${response.statusText}`);
  }
  return response.json();
}

export function getFileUrl(filepath: string): string {
  return `${API_BASE_URL}/file/${filepath}`;
}

export function getComponentImageUrl(component: Component): string {
  return getFileUrl(component.clean_image);
}

export function getComponentModelUrl(component: Component): string {
  return getFileUrl(component.model_path);
}

export function getStepImageUrl(step: StepData): string {
  return getFileUrl(step.step_image);
}

export function getStepAudioUrl(step: StepData): string {
  return getFileUrl(step.audio_url);
}
