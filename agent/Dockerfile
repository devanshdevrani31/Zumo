FROM node:20-slim

# Security: run as non-root user
RUN groupadd -r agent && useradd -r -g agent -m agent

WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install --production && npm cache clean --force

# Copy agent code
COPY agent.js tools.js ./

# Create workspace directory
RUN mkdir -p /workspace && chown agent:agent /workspace

# Switch to non-root user
USER agent

# Agent workspace for sandboxed file operations
VOLUME /workspace

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:3100/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "agent.js"]
