FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY client/package*.json ./client/
# o servidor roda so com as dependencias de producao — o sharp esta entre elas
# porque o modo imagem reduz a miniatura do segredo em tempo de request
# (src/picture.js), e nao so nos scripts de build. O cliente, esse precisa das
# devDependencies (Vite) para ser construido.
RUN npm ci --omit=dev && npm --prefix client ci --include=dev

COPY . .

# Os datasets ja vem versionados em data/. Se faltar (ex.: build limpo),
# a Pokedex e baixada da PokeAPI durante o build da imagem.
RUN test -f data/pokemon.json || npm run build:pokedex

# o build vai para client/dist; as dependencias do cliente nao vao para a imagem final
RUN npm --prefix client run build && rm -rf client/node_modules

EXPOSE 3000
CMD ["node", "src/server.js"]
