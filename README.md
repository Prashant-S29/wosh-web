# Wosh - Zero Knowledge Secret Management Platform

**A Zero Knowledge and Zero Exposure secret management and sharing platform**

**Status:** Currently under development

## Repository Structure

- **Frontend Repo:** https://github.com/Prashant-S29/wosh-web
- **Backend Repo:** https://github.com/Prashant-S29/wosh-server
- **Wosh CLI Repo:** (coming soon)

## Core Security Architecture

### Zero Knowledge

All data is encrypted locally on your device before transmission. Wosh servers never have access to your plaintext secrets or encryption keys.

### Zero Exposure

When sharing secrets, the CLI directly injects decrypted values into your local environment without exposing them to logs, stdout, or temporary files.

## Security Guarantees

- **Zero Knowledge:** Servers cannot decrypt your data
- **Zero Exposure:** Secrets never appear in logs or temporary files
- **Device Security:** Multi-device support with proper key isolation
- **Cryptographic Integrity:** Ed25519 signatures ensure data authenticity
- **Forward Secrecy:** Compromised sessions don't affect past communications
