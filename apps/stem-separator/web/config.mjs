export const SAMPLE_RATE = 44100;
export const SEGMENT = 343980;
export const OVERLAP = Math.floor(SEGMENT / 4);
export const STRIDE = SEGMENT - OVERLAP;
export const MAX_SECONDS = 300;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const SOURCES = ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano'];
export const MODEL = Object.freeze({
  url: 'https://huggingface.co/StemSplitio/htdemucs-6s-onnx/resolve/49df9b6989cf2150840ea65b0bef77a2e471b678/htdemucs_6s_fp16weights.onnx',
  bytes: 136428532,
  sha256: '7ce55792e2231c93fbf92de95f5fd5b3a5e6c89f7db690dfd693e8f1dce56869',
  cache: 'stem-separator-model-7ce55792-v1',
  runtime: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/',
});
