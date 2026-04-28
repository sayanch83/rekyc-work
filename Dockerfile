FROM node:22-alpine
WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install --production --prefer-offline 2>&1 | tail -5

COPY src/ ./src/
RUN mkdir -p uploads

EXPOSE 4000
CMD ["node", "src/index.js"]
# force rebuild Tue Apr 28 11:36:12 AM IST 2026
