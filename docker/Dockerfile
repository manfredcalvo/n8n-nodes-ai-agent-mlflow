FROM n8nio/n8n:latest

USER root

# Install Python 3 and ALL build dependencies needed for MLflow full
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    g++ \
    musl-dev \
    python3-dev \
    libffi-dev \
    openssl-dev \
    build-base \
    linux-headers \
    gfortran \
    openblas-dev \
    lapack-dev

# Create symbolic link
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Upgrade pip and install wheel to speed up builds
RUN pip3 install --break-system-packages --no-cache-dir --upgrade pip setuptools wheel

COPY requirements.txt .

RUN pip install --break-system-packages --no-cache-dir -r requirements.txt

# Verify MLflow installation
RUN python3 -c "import mlflow; from mlflow.genai.scorers import Safety, Correctness; print(f'MLflow {mlflow.__version__} with genai.scorers installed')"

# Copy and install n8n custom node
RUN mkdir -p /opt/module_code/
COPY n8n-nodes-ai-agent-mlflow-0.2.0.tgz /opt/module_code/

RUN mkdir -p /opt/n8n-custom-nodes && \
    cd /opt/n8n-custom-nodes && \
    npm init -y && \
    npm install /opt/module_code/n8n-nodes-ai-agent-mlflow-0.2.0.tgz && \
    chown -R node:node /opt/n8n-custom-nodes

ENV N8N_CUSTOM_EXTENSIONS="/opt/n8n-custom-nodes"

USER node
ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]
