'use server';

interface CLITokenData {
  // hashKeys: string;
  masterPassphrase: string;
  pin?: string;
  orgId: string;
  projectId: string;
}

interface GenerateCLITokenResult {
  data: { token: string } | null;
  error: string | null;
  message: string;
}

export interface GenerateCLITokenParams {
  masterPassphrase: string;
  pin?: string;
  orgId: string;
  projectId: string;
}

export async function generateCLIToken({
  masterPassphrase,
  pin,
  orgId,
  projectId,
}: GenerateCLITokenParams): Promise<GenerateCLITokenResult> {
  try {
    const tokenData: CLITokenData = {
      masterPassphrase,
      ...(pin ? { pin } : {}),
      orgId,
      projectId,
    };

    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64url');

    return {
      data: { token },
      error: null,
      message: 'CLI token generated successfully',
    };
  } catch (error) {
    console.error('Failed to generate CLI token:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to generate CLI token',
    };
  }
}
