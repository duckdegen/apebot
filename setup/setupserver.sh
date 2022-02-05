#!/usr/bin/env bash

echo "
----------------------
  NODE & NPM & YARN & TSC
----------------------
"

# reload local package database
sudo apt-get update

sudo apt-get upgrade

# install nodejs and npm
sudo apt-get install -y npm

sudo npm install -g n

sudo npm install -g yarn

sudo apt install -y node-typescript

sudo n latest

echo "
----------------------
  MONGODB
----------------------
"

# import mongodb 4.0 public gpg key
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4

# create the /etc/apt/sources.list.d/mongodb-org-4.0.list file for mongodb
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list

# reload local package database
sudo apt-get update

# install the latest version of mongodb
sudo apt-get install -y mongodb-org

echo 'db = db.getSiblingDB("ApeBot");' > .mongorc.js

# start mongodb
sudo systemctl start mongod

# set mongodb to start automatically on system startup
sudo systemctl enable mongod


echo "
----------------------
  PM2
----------------------
"

# install pm2 with npm
sudo npm install -g pm2

# set pm2 to start automatically on system startup
sudo pm2 startup systemd


echo "
----------------------
  UFW (FIREWALL)
----------------------
"

# allow ssh connections through firewall
sudo ufw allow OpenSSH

# enable firewall
sudo ufw --force enable


echo "
----------------------
  Git
----------------------
"

git config --global url."git@github.com:".insteadOf "https://github.com/"

git clone git@github.com:beepboopdefi/apebot.git

cd apebot

yarn