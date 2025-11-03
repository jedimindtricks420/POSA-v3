FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build:wallet

EXPOSE 4000

CMD ["npm", "start"]
