FROM n8nio/n8n:latest

USER root

RUN mkdir -p /opt/module_code/

COPY n8n-nodes-ai-agent-mlflow-0.1.0.tgz /opt/module_code/

RUN mkdir -p /opt/n8n-custom-nodes && \
    cd /opt/n8n-custom-nodes && \
    npm init -y && \
    npm install /opt/module_code/n8n-nodes-ai-agent-mlflow-0.1.0.tgz && \
    chown -R node:node /opt/n8n-custom-nodes

ENV N8N_CUSTOM_EXTENSIONS="/opt/n8n-custom-nodes"
ENV DATABRICKS_HOST=""
ENV DATABRICKS_TOKEN=""

USER node
ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]
