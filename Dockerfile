FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# A Pokedex ja vem versionada em data/pokedex.json.
# Se faltar (ex.: build limpo), baixa da PokeAPI durante o build da imagem.
RUN test -f data/pokedex.json || npm run build:pokedex

EXPOSE 3000
CMD ["node", "src/server.js"]
