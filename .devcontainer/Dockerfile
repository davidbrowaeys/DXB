FROM --platform=linux/amd64 mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install git gnupg2

# Install latest Salesforce CLI
RUN wget https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf-linux-x64.tar.xz && \
mkdir -p /home/node/cli/sf && \
tar xJf sf-linux-x64.tar.xz -C /home/node/cli/sf --strip-components 1 && \
echo 'export PATH="/home/node/cli/sf/bin:$PATH"' >> /home/node/.bashrc