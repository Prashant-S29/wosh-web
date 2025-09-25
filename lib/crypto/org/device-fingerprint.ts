import { sha256 } from '@noble/hashes/sha2.js';
import { toBase64 } from './crypto-utils.org';
import { DeviceFingerprintResult, DeviceInfo } from '@/types/encryptions';

// Generate canvas fingerprint for additional entropy
function generateCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    canvas.width = 200;
    canvas.height = 50;

    // Draw some shapes and text that will vary by system
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Wosh Device Fingerprint 🔐', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas fingerprint', 4, 35);

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

// Get WebGL information for fingerprinting
function getWebGLInfo(): { vendor: string; renderer: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return { vendor: 'no-webgl', renderer: 'no-webgl' };

    // Properly type the WebGL context
    const webglContext = gl as WebGLRenderingContext;
    const debugInfo = webglContext.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return { vendor: 'webgl-basic', renderer: 'webgl-basic' };

    return {
      vendor: webglContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown-vendor',
      renderer: webglContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown-renderer',
    };
  } catch {
    return { vendor: 'webgl-error', renderer: 'webgl-error' };
  }
}

// Get memory information if available
async function getMemoryInfo(): Promise<{ availableMemory?: number; storageQuota?: number }> {
  try {
    const memoryInfo: { availableMemory?: number; storageQuota?: number } = {};

    // Get device memory (Chrome only) - properly type navigator
    const navigatorWithMemory = navigator as Navigator & {
      deviceMemory?: number;
    };

    if ('deviceMemory' in navigatorWithMemory) {
      memoryInfo.availableMemory = navigatorWithMemory.deviceMemory;
    }

    // Get storage quota estimate
    if ('storage' in navigator && navigator.storage && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) {
        memoryInfo.storageQuota = estimate.quota;
      }
    }

    return memoryInfo;
  } catch {
    return {};
  }
}

// Generate comprehensive device info
async function collectDeviceInfo(): Promise<DeviceInfo> {
  const webglInfo = getWebGLInfo();
  const memoryInfo = await getMemoryInfo();

  return {
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language || 'unknown',
    platform: navigator.platform || 'unknown',
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    colorDepth: screen.colorDepth || 0,
    webglVendor: webglInfo.vendor,
    webglRenderer: webglInfo.renderer,
    ...memoryInfo,
    canvasFingerprint: generateCanvasFingerprint(),
  };
}

// Calculate fingerprint confidence based on entropy
function calculateConfidence(deviceInfo: DeviceInfo): 'high' | 'medium' | 'low' {
  let score = 0;

  // High entropy factors (each adds 2 points)
  if (deviceInfo.userAgent && !deviceInfo.userAgent.includes('Mozilla/5.0')) score += 2;
  if (deviceInfo.webglRenderer && !deviceInfo.webglRenderer.includes('unknown')) score += 2;
  if (deviceInfo.canvasFingerprint && deviceInfo.canvasFingerprint.length > 100) score += 2;
  if (deviceInfo.availableMemory) score += 2;

  // Medium entropy factors (each adds 1 point)
  if (deviceInfo.hardwareConcurrency > 0) score += 1;
  if (deviceInfo.screenResolution !== '0x0x0') score += 1;
  if (deviceInfo.timezone !== 'UTC') score += 1;
  if (deviceInfo.storageQuota) score += 1;

  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

// Generate stable device fingerprint
export async function generateDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  try {
    const deviceInfo = await collectDeviceInfo();
    const confidence = calculateConfidence(deviceInfo);

    // Create fingerprint string from stable characteristics
    const fingerprintData = [
      deviceInfo.userAgent,
      deviceInfo.screenResolution,
      deviceInfo.timezone,
      deviceInfo.language,
      deviceInfo.platform,
      deviceInfo.hardwareConcurrency.toString(),
      deviceInfo.colorDepth.toString(),
      deviceInfo.webglVendor,
      deviceInfo.webglRenderer,
      deviceInfo.availableMemory?.toString() || 'unknown',
      deviceInfo.canvasFingerprint,
    ].join('|');

    // Hash the fingerprint data
    const encoder = new TextEncoder();
    const fingerprintBytes = encoder.encode(fingerprintData);
    const hashBytes = sha256(fingerprintBytes);

    const base64Result = toBase64(hashBytes);
    if (!base64Result.data) {
      throw new Error('Failed to generate fingerprint hash');
    }

    return {
      fingerprint: base64Result.data,
      deviceInfo,
      confidence,
    };
  } catch (error) {
    console.error('Failed to generate device fingerprint:', error);
    // Fallback fingerprint based on minimal data
    const fallbackData = `${navigator.userAgent}|${screen.width}x${screen.height}|${Date.now()}`;
    const encoder = new TextEncoder();
    const hashBytes = sha256(encoder.encode(fallbackData));
    const base64Result = toBase64(hashBytes);

    return {
      fingerprint: base64Result.data || 'fallback-fingerprint',
      deviceInfo: {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: 'unknown',
        language: navigator.language || 'unknown',
        platform: navigator.platform || 'unknown',
        hardwareConcurrency: 0,
        colorDepth: 0,
        webglVendor: 'unknown',
        webglRenderer: 'unknown',
        canvasFingerprint: 'error',
      },
      confidence: 'low',
    };
  }
}

// Verify if current device matches a stored fingerprint
export async function verifyDeviceFingerprint(storedFingerprint: string): Promise<{
  matches: boolean;
  confidence: 'high' | 'medium' | 'low';
  currentFingerprint: string;
}> {
  try {
    const current = await generateDeviceFingerprint();

    return {
      matches: current.fingerprint === storedFingerprint,
      confidence: current.confidence,
      currentFingerprint: current.fingerprint,
    };
  } catch (error) {
    console.error('Failed to verify device fingerprint:', error);
    return {
      matches: false,
      confidence: 'low',
      currentFingerprint: 'error',
    };
  }
}

// Generate human-readable device name
export function generateDeviceName(deviceInfo?: DeviceInfo) {
  if (!deviceInfo) {
    return 'Unknown Device';
  }

  const ua = deviceInfo.userAgent.toLowerCase();

  // Detect OS
  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Detect browser
  let browser = 'Unknown Browser';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';

  return `${browser} on ${os}`;
}
