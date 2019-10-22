FROM node:12

# set up app directory
RUN mkdir -p /home/node/quasar/node_modules && chown -R node:node /home/node/quasar
WORKDIR /home/node/quasar
COPY package*.json ./

# add script to wait until mongo / ipfs start
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.6.0/wait /wait
RUN chmod +x /wait

# switch to node user and install deps
USER node
RUN npm install --quiet --production

COPY --chown=node:node . .
EXPOSE 3001

# wait for ipfs / mongo and start app
CMD /wait && node server
