FROM node:15.9.0-buster

WORKDIR /usr/src/app

COPY package*.json .
COPY yarn.lock .

RUN yarn install --production

COPY ./dist .

CMD ["node", "uploadImages.js"]