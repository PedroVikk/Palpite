FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY client/package*.json ./client/
# o cliente precisa das devDependencies (Vite) para ser construido
RUN npm ci --omit=dev && npm --prefix client ci --include=dev

COPY . .

# Os datasets ja vem versionados em data/. Se faltar (ex.: build limpo),
# a Pokedex e baixada da PokeAPI durante o build da imagem.
RUN test -f data/pokemon.json || npm run build:pokedex

# o build vai para client/dist; as dependencias do cliente nao vao para a imagem final
RUN npm --prefix client run build && rm -rf client/node_modules

EXPOSE 3000
CMD ["node", "src/server.js"]
