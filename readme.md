
apt update
apt install -y build-essential python3 make g++ pkg-config

npm cache clean --force
npm install

pm2 delete valorant-planner
SESSION_SECRET="change-this-to-a-random-long-secret" pm2 start server.js --name valorant-planner
pm2 save

pm2 status
