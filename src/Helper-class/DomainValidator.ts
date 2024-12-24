import { SupportedDomain } from "@/@enums/SupportedDomain";

export class DomainValidator {
  static isSupported(url: string): boolean {
    return Object.values(SupportedDomain).includes(url as SupportedDomain);
  }

  static getHostname(url: string): string {
    return new URL(url).hostname;
  }
}
