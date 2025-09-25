export interface ProjectsMKDFConfig {
  requiresPin: boolean;
  requiredFactors: number;
  enabledFactors: ('passphrase' | 'device' | 'pin')[];
}
