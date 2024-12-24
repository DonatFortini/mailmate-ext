export interface ProcessingResult {
  id: string;
  file_id: string;
  original_title: string;
  processed_title: string;
  confidence?: number;
  processing_time?: number;
  error?: string;
}

export interface ProcessingBatchResponse {
  results: ProcessingResult[];
  metadata?: {
    total_processed: number;
    successful: number;
    failed: number;
    total_processing_time: number;
  };
}

export interface ProcessingError {
  file_id: string;
  error_code: string;
  error_message: string;
}

export interface ProcessingBatchResponseWithErrors {
  successful_results: ProcessingResult[];
  failed_results: ProcessingError[];
  metadata: {
    total_processed: number;
    successful: number;
    failed: number;
    total_processing_time: number;
  };
}
