FROM node:20-slim

WORKDIR /app

# Install system dependencies for node-gyp if needed
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 5001

CMD ["npm", "start"]
