declare module 'clamscan' {
  interface ClamScanOptions {
    clamdscan?: {
      socket?: string;
      timeout?: number;
      localFallback?: boolean;
    };
    preference?: string;
  }

  interface InfectedResult {
    isInfected: boolean;
    viruses: string[];
  }

  interface InitializedScanner {
    isInfected(filePath: string): Promise<InfectedResult>;
  }

  class NodeClam {
    init(options: ClamScanOptions): Promise<InitializedScanner>;
  }

  export default NodeClam;
}
