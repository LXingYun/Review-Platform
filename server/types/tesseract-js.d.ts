declare module "tesseract.js" {
  export interface RecognizeResult {
    data: {
      text: string;
    };
  }

  export interface Worker {
    recognize(image: Buffer): Promise<RecognizeResult>;
    terminate(): Promise<unknown>;
  }

  export function createWorker(language?: string): Promise<Worker>;
}
