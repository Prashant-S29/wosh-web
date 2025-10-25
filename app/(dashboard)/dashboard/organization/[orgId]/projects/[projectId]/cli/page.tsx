'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

// icons
import { Copy, Check } from 'lucide-react';

// hooks
import { useActiveOrg, useActiveProject, useCopyToClipboard } from '@/hooks';
import { useSecretAuthentication } from '@/hooks/useSecretAuthentication';
import { useMKDFConfig } from '@/hooks/useMKDFConfig';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { generateCLIToken, GenerateCLITokenParams } from '@/lib/crypto/cli';

// components
import { toast } from 'sonner';
import { Container, PageLoader, ResourceHandler, SecretAuthModal } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { GetOrganizationResponse, GetProjectResponse } from '@/types/api/response';

const CLI: React.FC = () => {
  const params = useParams();
  const { copyToClipboard } = useCopyToClipboard();

  const id = useMemo(
    () => [params.orgId, params.projectId] as string[],
    [params.orgId, params.projectId],
  );

  const [organizationId, projectId] = id;

  const { setActiveProjectId } = useActiveProject();
  const { setActiveOrgId } = useActiveOrg();

  const [cliToken, setCliToken] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { session, isLoading } = useCheckAuthClient({
    redirectTo: '/login',
    redirect: true,
  });

  const userId = session?.session.userId;

  const { mkdfConfig } = useMKDFConfig({
    organizationId,
    userId: userId || '',
    enabled: !!userId,
  });

  const { showAuthModal, isAuthenticating, openAuthModal, closeAuthModal, handleAuthentication } =
    useSecretAuthentication<{ masterPassphrase: string; pin?: string }>({
      projectId,
      organizationId,
      userId: userId || '',
    });

  useEffect(() => {
    if (id) {
      setActiveOrgId(id[0]);
      setActiveProjectId(id[1]);
    }
  }, [id, setActiveOrgId, setActiveProjectId]);

  useEffect(() => {
    if (!cliToken) return;

    const timer = setTimeout(() => {
      setCliToken('');
    }, 10000);

    return () => clearTimeout(timer);
  }, [cliToken]);

  const handleRevealToken = () => {
    openAuthModal({ masterPassphrase: '', pin: '' });
  };

  const onAuthenticationSuccess = async (credentials: {
    masterPassphrase: string;
    pin?: string;
  }) => {
    try {
      setIsGenerating(true);

      if (!userId || !organizationId || !projectId) {
        toast.error('Missing required context');
        return;
      }

      const dataToEncrypt: GenerateCLITokenParams = {
        masterPassphrase: credentials.masterPassphrase,
        pin: credentials.pin || '',
        orgId: organizationId,
        projectId: projectId,
      };

      const result = await generateCLIToken(dataToEncrypt);

      if (result.error || !result.data) {
        toast.error(result.message || 'Failed to generate CLI token');
        return;
      }

      setCliToken(result.data.token);
      toast.success('CLI token generated successfully');
    } catch (error) {
      console.error('Failed to generate CLI token:', error);
      toast.error('An error occurred while generating the CLI token');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToken = async () => {
    if (!cliToken) return;

    await copyToClipboard(cliToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('CLI token copied to clipboard');
  };

  const maskToken = (token: string) => {
    if (token.length <= 20) return '•'.repeat(token.length);
    return (
      token.substring(0, 8) + '•'.repeat(token.length - 16) + token.substring(token.length - 8)
    );
  };

  if (isLoading) return <PageLoader />;
  if (!session?.session.userId) return <ResourceHandler type="unauthorized" />;

  return (
    <Container className="gap-8">
      <div>
        <h1 className="text-2xl font-semibold">CLI Integration</h1>
        <p className="text-muted-foreground mt-2">
          Generate and manage your CLI access token for secure command-line operations
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-accent/50 flex flex-col gap-5 rounded-lg border p-5">
          <div className="flex w-full items-center justify-between">
            <section>
              <p className="text-sm">CLI Token</p>
              <p className="text-muted-foreground mt-1 max-w-[700px] text-sm">
                This token securely encrypts your organization and project info, master passphrase
                and PIN for CLI authentication. It is a non-deterministic token generated on-demand
                and never stored on server.
              </p>
            </section>

            {cliToken ? (
              <div className="relative w-[300px]">
                <Input defaultValue={maskToken(cliToken).slice(0, 35)} readOnly />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyToken}
                  className="absolute top-1/2 right-0 -translate-y-1/2"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                loading={isGenerating}
                onClick={handleRevealToken}
                disabled={isAuthenticating || isGenerating}
              >
                Reveal Token
              </Button>
            )}
          </div>
        </div>
      </div>

      <SecretAuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        onAuth={(credentials) =>
          handleAuthentication(credentials.credentials, () =>
            onAuthenticationSuccess({
              masterPassphrase: credentials.credentials.masterPassphrase,
              pin: credentials.credentials.pin ?? '',
            }),
          )
        }
        requiresPin={mkdfConfig?.requiresPin ?? false}
        isLoading={isAuthenticating || isGenerating}
        title="Generate CLI Token"
        description="Enter your master passphrase (and PIN if enabled) to generate your CLI access token."
      />
    </Container>
  );
};

export default CLI;
