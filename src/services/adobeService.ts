import { PsdParseResult, PremiereProjectParseResult } from '../../electron/ipc/adobe.ipc';

export class AdobeService {
  private get api() {
    return (window as any).mediaViewerAPI || (window as any).electronAPI || (window as any).api;
  }

  async parsePsd(filePath: string): Promise<PsdParseResult> {
    if (!this.api?.parsePsd) {
      return {
        ok: false,
        error: 'Adobe PSD parser API unavailable',
        width: 0,
        height: 0,
        colorMode: 'RGB',
        depth: 8,
        layers: [],
        layerCount: 0,
        hasThumbnail: false
      };
    }
    try {
      return await this.api.parsePsd(filePath);
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || String(err),
        width: 0,
        height: 0,
        colorMode: 'RGB',
        depth: 8,
        layers: [],
        layerCount: 0,
        hasThumbnail: false
      };
    }
  }

  async parsePrproj(filePath: string): Promise<PremiereProjectParseResult> {
    if (!this.api?.parsePrproj) {
      return {
        ok: false,
        error: 'Adobe Premiere parser API unavailable',
        projectName: 'Untitled',
        sequences: [],
        assets: []
      };
    }
    try {
      return await this.api.parsePrproj(filePath);
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || String(err),
        projectName: 'Untitled',
        sequences: [],
        assets: []
      };
    }
  }
}

export const adobeService = new AdobeService();
