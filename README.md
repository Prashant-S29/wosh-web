<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/448d0f00-1ae4-48dd-9da1-a8ade38042e5" />


# Wosh - Zero Knowledge Secret Management Platform

**A Zero Knowledge and Zero Exposure secret management and sharing platform**

**Status:** Currently under development

## Repository Structure

- **Frontend Repo:** https://github.com/Prashant-S29/wosh-web
- **Backend Repo:** https://github.com/Prashant-S29/wosh-server
- **Wosh CLI Repo:** https://github.com/Prashant-S29/wosh-cli

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
